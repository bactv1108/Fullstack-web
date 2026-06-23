const axios = require('axios');

async function main() {
  const falKey = '2f9997af-792d-41b0-941e-1f0d94200656:4b3643d5b52a651a304253446d7a5e4c';
  const url = 'https://queue.fal.run/fal-ai/kling-video/requests/019ee98b-947e-7d92-862b-664bb36b1483/status';
  
  try {
    const res = await axios.get(url, {
      headers: { 'Authorization': 'Key ' + falKey, 'Content-Type': 'application/json' }
    });
    console.log("Status Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Failed:", err.message, err.response?.status, err.response?.data);
  }
}
main();
