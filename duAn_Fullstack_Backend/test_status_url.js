const axios = require('axios');
require('dotenv').config();

async function main() {
  const falKey = '2f9997af-792d-41b0-941e-1f0d94200656:4b3643d5b52a651a304253446d7a5e4c';
  const url = 'https://queue.fal.run/fal-ai/wan/requests/019ee98b-4e37-79e3-8226-0ab2496dfc0b/status';
  
  try {
    const res = await axios.get(url, {
      headers: { 'Authorization': 'Key ' + falKey, 'Content-Type': 'application/json' }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Failed:", err.message, err.response?.status, err.response?.data);
  }
}
main();
