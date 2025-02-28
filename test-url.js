// Test script for URL validation

function testUrl(urlString) {
  console.log('Testing URL:', urlString);
  
  // Clean up the URL - remove any trailing query parameters or hash fragments
  let cleanUrl = urlString.trim();
  console.log('After trim:', cleanUrl);
  
  // Remove any query parameters
  cleanUrl = cleanUrl.split('?')[0];
  console.log('After removing query params:', cleanUrl);
  
  // Remove any hash fragments
  cleanUrl = cleanUrl.split('#')[0];
  console.log('After removing hash fragments:', cleanUrl);
  
  // Validate URL
  try {
    const url = new URL(cleanUrl);
    console.log('URL is valid');
    console.log('Protocol:', url.protocol);
    console.log('Hostname:', url.hostname);
    console.log('Pathname:', url.pathname);
    
    // Check if it's a Loom URL
    const isLoomUrl = url.hostname.includes('loom.com');
    console.log('Is Loom URL:', isLoomUrl);
    
    // Check path format
    const hasSharePath = url.pathname.includes('/share/');
    const hasVPath = url.pathname.includes('/v/');
    console.log('Has /share/ path:', hasSharePath);
    console.log('Has /v/ path:', hasVPath);
    
    // Extract the Loom video ID
    const pathParts = url.pathname.split('/');
    const loomVideoId = pathParts[pathParts.length - 1];
    console.log('Path parts:', pathParts);
    console.log('Extracted video ID:', loomVideoId);
    
    // Validate the ID
    if (!loomVideoId || loomVideoId.length < 5) {
      console.log('Invalid video ID: too short or empty');
    } else {
      console.log('Video ID looks valid');
    }
    
  } catch (error) {
    console.error('URL is invalid:', error.message);
  }
}

// Test with the URL from the screenshot
testUrl('https://www.loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034');

// Test with a URL that has query parameters
testUrl('https://www.loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034?sid=aebad0e0-980f-4d77-bb28-bf27b8910348');

// Test with a URL that has a different format
testUrl('https://www.loom.com/v/8cbbde0f75fe4d1fbf14277824ceb034');

// Test with an invalid URL
testUrl('loom.com/share/8cbbde0f75fe4d1fbf14277824ceb034'); 