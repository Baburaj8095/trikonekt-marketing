import { executeStarterBundleActivation } from "./src/services/growthBridgeService.js";

async function run() {
  console.log("Starting starter bundle test...");
  const t0 = Date.now();
  const res = await executeStarterBundleActivation({
    phone: "9999999999",
    username: "9999999999",
    paymentMode: "GATEWAY",
  });
  console.log(`executeStarterBundleActivation took: ${Date.now() - t0}ms, success:`, res?.success);
}

run().catch(console.error);
