// Test the proxy server to verify it correctly forwards JSON from the API
const http = require('http');

console.log('Testing proxy server at http://localhost:3000/proxy');

function testProxy() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/proxy',
    method: 'GET',
    timeout: 15000
  };

  const req = http.request(options, (res) => {
    console.log(`Proxy Status: ${res.statusCode}`);
    console.log(`Proxy Headers: ${JSON.stringify(res.headers, null, 2)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n--- Proxy Response ---');
      try {
        const jsonData = JSON.parse(data);
        console.log('Proxy returned JSON:');
        console.log(JSON.stringify(jsonData, null, 2));
        
        // Verify the proxy structure
        console.log('\n--- Verification ---');
        console.log('✓ Success:', jsonData.success);
        console.log('✓ Has originalData:', !!jsonData.originalData);
        console.log('✓ Has processedForAI:', !!jsonData.processedForAI);
        console.log('✓ Has timestamp:', !!jsonData.timestamp);
        
        if (jsonData.processedForAI) {
          console.log('✓ AI processed data structure:');
          console.log('  - messageCount:', jsonData.processedForAI.messageCount);
          console.log('  - messages array length:', jsonData.processedForAI.messages?.length);
          console.log('  - summary:', jsonData.processedForAI.summary);
        }
        
      } catch (error) {
        console.log('Raw proxy response (not JSON):');
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Proxy test error:', error.message);
    console.log('Make sure the proxy server is running with: npm start');
  });

  req.on('timeout', () => {
    console.error('Proxy request timeout');
    req.destroy();
  });

  req.end();
}

// Test the proxy
testProxy();
