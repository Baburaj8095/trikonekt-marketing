# Render to AWS Migration

The active production migration target is now documented in:

```text
deploy/aws/README.md
```

Use that runbook for the EC2 + Nginx + systemd + RDS deployment requested for this project.

Prepared EC2 artifacts:

- `deploy/aws/backend.env.example`
- `deploy/aws/nginx-trikonekt-bootstrap.conf`
- `deploy/aws/nginx-trikonekt.conf`
- `deploy/aws/trikonekt-web.service`
- `deploy/aws/trikonekt-worker.service`

Notes:

- The backend is Django/Gunicorn, so systemd is used instead of PM2.
- The database target is PostgreSQL on RDS because the existing app and Render deployment already use PostgreSQL.
- Cloudinary should remain the media backend if `CLOUDINARY_URL` is set in current production. S3 migration should be handled as a separate code change with `django-storages` and a media migration plan.
- Existing ECS/Fargate examples under `deploy/aws/` are retained only as optional future artifacts, not as the EC2 migration path.
