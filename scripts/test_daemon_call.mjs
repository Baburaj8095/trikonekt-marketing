import axios from "axios";

async function testDaemon() {
  const DAEMON_URL = "http://127.0.0.1:5006/execute";
  const args = [
    "--action", "stage_upgrade",
    "--phone", "8951244364",
    "--stage", "3",
    "--payment-mode", "GATEWAY",
    "--tranche", "3",
    "--amount", "25000"
  ];
  console.log("Calling daemon...");
  const t0 = Date.now();
  try {
    const res = await axios.post(DAEMON_URL, { argv: args }, { timeout: 15000 });
    console.log(`Daemon responded in ${Date.now() - t0}ms:`, res.data);
  } catch (err) {
    console.error(`Daemon failed in ${Date.now() - t0}ms:`, err.response?.data || err.message);
  }
}

testDaemon();
