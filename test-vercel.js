// Test para funciones serverless de Vercel (desarrollo local con vercel dev)
const http = require('http');

console.log('Testing Vercel serverless functions at http://localhost:3000');

function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`\n=== ${method} ${path} ===`);
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('Response:');
          console.log(JSON.stringify(jsonData, null, 2));
          
          // Verificaciones específicas por endpoint
          if (path === '/health') {
            console.log('✓ Health check:', jsonData.status === 'healthy' ? 'PASS' : 'FAIL');
            console.log('✓ Environment:', jsonData.environment);
          } else if (path === '/') {
            console.log('✓ Has endpoints:', !!jsonData.endpoints ? 'PASS' : 'FAIL');
            console.log('✓ Has usage info:', !!jsonData.usage ? 'PASS' : 'FAIL');
          } else if (path.startsWith('/proxy')) {
            console.log('✓ Success:', jsonData.success ? 'PASS' : 'FAIL');
            console.log('✓ Has originalData:', !!jsonData.originalData ? 'PASS' : 'FAIL');
            console.log('✓ Has processedForAI:', !!jsonData.processedForAI ? 'PASS' : 'FAIL');
            
            if (jsonData.processedForAI) {
              console.log('✓ AI processed structure:');
              console.log('  - messageCount:', jsonData.processedForAI.messageCount);
              console.log('  - messages array:', Array.isArray(jsonData.processedForAI.messages) ? 'PASS' : 'FAIL');
              console.log('  - summary:', !!jsonData.processedForAI.summary ? 'PASS' : 'FAIL');
            }
          }
          
          resolve(jsonData);
        } catch (error) {
          console.log('Raw response (not JSON):');
          console.log(data);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error testing ${method} ${path}:`, error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error(`Timeout testing ${method} ${path}`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Vercel Serverless Functions');
  console.log('Make sure to run: npm run vercel-dev\n');

  try {
    // Test 1: Health check
    await testEndpoint('/health');
    
    // Test 2: Root endpoint
    await testEndpoint('/');
    
    // Test 3: Proxy GET
    await testEndpoint('/proxy?test=vercel');
    
    // Test 4: Proxy POST
    await testEndpoint('/proxy', 'POST', { 
      query: 'test vercel deployment',
      source: 'vercel-test'
    });
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nMake sure Vercel dev server is running with:');
    console.log('npm run vercel-dev');
  }
}

// Ejecutar tests
runTests();
