import time
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import F

from jobs.models import BackgroundTask


class Command(BaseCommand):
    help = "Process DB-backed background tasks (lightweight worker)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process a single task and exit")
        parser.add_argument("--sleep", type=float, default=1.0, help="Sleep seconds between polls (default: 1.0)")
        parser.add_argument("--max-iterations", type=int, default=0, help="Max loop iterations before exit (0 = infinite)")
        parser.add_argument("--max-runtime-seconds", type=int, default=0, help="Max total runtime before exit (0 = infinite)")
        parser.add_argument("--backoff-base", type=float, default=2.0, help="Exponential backoff base for failures (default: 2.0)")
        parser.add_argument("--backoff-max", type=float, default=60.0, help="Max backoff seconds (default: 60.0)")
        parser.add_argument("--reap-stuck-seconds", type=int, default=300, help="Requeue RUNNING tasks stuck longer than this many seconds (0 to disable)")
        parser.add_argument("--reap-on-start", action="store_true", help="Run stuck-task reaper once on startup")

    def handle(self, *args, **opts):
        once = opts["once"]
        sleep_s = max(0.05, float(opts["sleep"]))
        max_iter = int(opts["max_iterations"] or 0)
        max_runtime = int(opts["max_runtime_seconds"] or 0)
        backoff_base = max(1.0, float(opts["backoff_base"]))
        backoff_max = max(1.0, float(opts["backoff_max"]))

        start = timezone.now()
        iterations = 0
        idle_streak = 0

        reap_stuck_secs = int(opts["reap_stuck_seconds"] or 0)
        reap_on_start = bool(opts["reap_on_start"])

        def reap_stuck():
            if reap_stuck_secs <= 0:
                return 0, 0
            try:
                stale_before = timezone.now() - timedelta(seconds=reap_stuck_secs)
                requeued = (BackgroundTask.objects
                            .filter(status=BackgroundTask.STATUS_RUNNING, started_at__lt=stale_before)
                            .filter(attempts__lt=F("max_attempts"))
                            .update(status=BackgroundTask.STATUS_PENDING, scheduled_at=timezone.now()))
                failed = (BackgroundTask.objects
                          .filter(status=BackgroundTask.STATUS_RUNNING, started_at__lt=stale_before)
                          .filter(attempts__gte=F("max_attempts"))
                          .update(status=BackgroundTask.STATUS_FAILED, finished_at=timezone.now(), last_error="Watchdog: stuck RUNNING marked FAILED"))
                if requeued or failed:
                    self.stdout.write(self.style.WARNING(f"Reaped stuck tasks: requeued={requeued} failed={failed}"))
                return requeued, failed
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Reaper exception: {e!r}"))
                return 0, 0

        self.stdout.write(self.style.SUCCESS("Worker started"))

        if reap_stuck_secs > 0 and reap_on_start:
            reap_stuck()

        while True:
            if max_iter and iterations >= max_iter:
                self.stdout.write(self.style.WARNING("Max iterations reached; exiting"))
                break
            if max_runtime and (timezone.now() - start).total_seconds() >= max_runtime:
                self.stdout.write(self.style.WARNING("Max runtime reached; exiting"))
                break

            iterations += 1

            if reap_stuck_secs > 0:
                reap_stuck()

            task = BackgroundTask.fetch_next()
            if not task:
                idle_streak += 1
                time.sleep(sleep_s)
                continue

            # Reset idle streak on work
            idle_streak = 0

            try:
                self.stdout.write(f"Running task {task.id} type={task.type} attempt={task.attempts}/{task.max_attempts}")
                task.run()
                if task.status == BackgroundTask.STATUS_DONE:
                    self.stdout.write(self.style.SUCCESS(f"Task {task.id} DONE"))
                else:
                    self.stdout.write(self.style.ERROR(f"Task {task.id} FAILED: {task.last_error}"))
                    # Backoff scheduling for retry attempts
                    if task.attempts < (task.max_attempts or 1):
                        # Exponential backoff based on attempts
                        delay = min(backoff_max, (backoff_base ** task.attempts))
                        task.scheduled_at = timezone.now() + timedelta(seconds=delay)
                        task.status = BackgroundTask.STATUS_PENDING
                        task.save(update_fields=["scheduled_at", "status"])
                        self.stdout.write(self.style.WARNING(f"Rescheduled task {task.id} after {delay:.2f}s"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Worker exception while running task: {e!r}"))

            if once:
                break

            time.sleep(sleep_s)
