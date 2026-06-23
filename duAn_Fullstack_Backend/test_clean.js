const urls = [
  "https://queue.fal.run/fal-ai/wan/v2.2-a14b/image-to-video/turbo/requests/019ee984-b742-7e63-9332-b80c53a14702/status",
  "https://queue.fal.run/fal-ai/wan/v2.2/image-to-video/turbo/requests/019ee984-b742-7e63-9332-b80c53a14702/status",
  "https://queue.fal.run/fal-ai/wan/requests/019ee984-b742-7e63-9332-b80c53a14702/status",
  "https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/standard/image-to-video/requests/019ee984-b742-7e63-9332-b80c53a14702/status",
  "https://queue.fal.run/fal-ai/kling-video/requests/019ee984-b742-7e63-9332-b80c53a14702/status"
];

for (const url of urls) {
  let clean = url;
  if (clean.includes('fal-ai/wan/') && !clean.includes('fal-ai/wan/requests/')) {
    clean = clean.replace(/fal-ai\/wan\/.*?\/requests\//, 'fal-ai/wan/requests/');
  }
  if (clean.includes('fal-ai/kling-video/') && !clean.includes('fal-ai/kling-video/requests/')) {
    clean = clean.replace(/fal-ai\/kling-video\/.*?\/requests\//, 'fal-ai/kling-video/requests/');
  }
  console.log("Original:", url);
  console.log("Cleaned :", clean);
  console.log("----------------------------------------");
}
