import { executeStageUpgrade, fetchGrowthUserData } from "./src/services/growthBridgeService.js";

async function run() {
  console.log("Starting test...");
  const t0 = Date.now();
  const res = await executeStageUpgrade({
    phone: "9999999999",
    username: "9999999999",
    stageNumber: 3,
    trancheNumber: 1,
    amount: 5000,
    paymentMode: "GATEWAY",
  });
  console.log(`executeStageUpgrade took: ${Date.now() - t0}ms, success:`, res?.success);

  const t1 = Date.now();
  const overview = await fetchGrowthUserData("9999999999", null, true);
  console.log(`fetchGrowthUserData took: ${Date.now() - t1}ms`);
}

run().catch(console.error);
