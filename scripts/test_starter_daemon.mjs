import axios from "axios";

async function testStarterDaemon() {
  const DAEMON_URL = "http://127.0.0.1:5006/execute";
  const args = [
    "--action", "starter",
    "--phone", "9999999999",
    "--order-ref", "BENCH_" + Date.now(),
    "--payment-mode", "GATEWAY"
  ];
  console.log("Calling daemon for starter...");
  const t0 = Date.now();
  try {
    const res = await axios.post(DAEMON_URL, { argv: args }, { timeout: 20000 });
    console.log(`Daemon responded in ${Date.now() - t0}ms:`, res.data?.success, res.data?.message);
  } catch (err) {
    console.error(`Daemon failed in ${Date.now() - t0}ms:`, err.response?.data || err.message);
  }
}

testStarterDaemon();
