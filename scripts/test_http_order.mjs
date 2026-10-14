import axios from "axios";

async function testHttpProcessOrder() {
  const t0 = Date.now();
  try {
    // Generate an internal token or test login
    const loginRes = await axios.post("http://127.0.0.1:5005/api/auth/login", {
      phone: "9999999999",
      password: "password123"
    });
    const token = loginRes.data?.tokens?.access;
    console.log(`Login took ${Date.now() - t0}ms`);

    const t1 = Date.now();
    const orderRes = await axios.post("http://127.0.0.1:5005/api/orders/process", {
      packageId: "40000",
      stageNumber: 3,
      trancheNumber: [1, 2, 3],
      paymentMethod: "GATEWAY"
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`End-to-End processOrder took ${Date.now() - t1}ms:`, orderRes.data?.success, orderRes.data?.message);
  } catch (err) {
    console.error(`Failed in ${Date.now() - t0}ms:`, err.response?.data || err.message);
  }
}

testHttpProcessOrder();
