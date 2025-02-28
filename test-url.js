// Test script for URL validation

const testUrls = [
  "https://www.loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034",
  "https://www.loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034?sid=aebad0e0-980f-4d77-bb28-bf27b8910348",
  "http://loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034",
  "https://loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034",
  "www.loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034",
  "loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034"
];

// Test with the current regex
const currentRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9]+)/;

console.log("Testing with current regex:");
testUrls.forEach(url => {
  const match = url.match(currentRegex);
  console.log(`URL: ${url}`);
  console.log(`  Match: ${match ? 'YES' : 'NO'}`);
  if (match) {
    console.log(`  Video ID: ${match[2]}`);
  }
  console.log('---');
});

// Test with a more permissive regex
const permissiveRegex = /loom\.com\/(share|v)\/([a-zA-Z0-9_-]+)/i;

console.log("\nTesting with more permissive regex:");
testUrls.forEach(url => {
  const match = url.match(permissiveRegex);
  console.log(`URL: ${url}`);
  console.log(`  Match: ${match ? 'YES' : 'NO'}`);
  if (match) {
    console.log(`  Video ID: ${match[2]}`);
  }
  console.log('---');
});

// Test with an even more permissive approach
console.log("\nTesting with manual extraction:");
testUrls.forEach(url => {
  let videoId = null;
  
  // Try to extract the ID using string operations
  if (url.includes('loom.com/share/')) {
    const parts = url.split('loom.com/share/');
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0].split('#')[0];
    }
  }
  
  console.log(`URL: ${url}`);
  console.log(`  Extracted ID: ${videoId || 'NONE'}`);
  console.log('---');
}); 