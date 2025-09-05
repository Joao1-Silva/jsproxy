// Test to verify the updated API endpoint
const http = require('http');

console.log('Testing API endpoint: http://api-sermaca.lat/api_aguilera/api/ai-data');

const options = {
  hostname: 'api-sermaca.lat',
  path: '/api_aguilera/api/ai-data',
  method: 'GET',
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:');
    try {
      const jsonData = JSON.parse(data);
      console.log('JSON Response:');
      console.log(JSON.stringify(jsonData, null, 2));
      
      // Verify the structure for AI consumption
      console.log('\n--- Analysis for AI consumption ---');
      if (Array.isArray(jsonData)) {
        console.log(`Found array with ${jsonData.length} items`);
      } else if (jsonData.messages && Array.isArray(jsonData.messages)) {
        console.log(`Found messages array with ${jsonData.messages.length} messages`);
      } else {
        console.log('Found object data:', Object.keys(jsonData));
      }
      
    } catch (error) {
      console.log('Raw response (not JSON):');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.on('timeout', () => {
  console.error('Request timeout');
  req.destroy();
});

req.end();
