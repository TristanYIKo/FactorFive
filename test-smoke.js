#!/usr/bin/env node

/**
 * vercel-ready: Smoke test for API routes
 * 
 * Tests that the health endpoint responds correctly
 * Run after build to verify production build works
 * 
 * Usage:
 * npm run build && npm start
 * npm run test:smoke
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === expectedStatus) {
          try {
            const json = JSON.parse(data);
            resolve({ success: true, status: res.statusCode, data: json });
          } catch (e) {
            resolve({ success: true, status: res.statusCode, data });
          }
        } else {
          reject(new Error(`Expected ${expectedStatus}, got ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function runTests() {
  console.log('🧪 Running smoke tests...\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  try {
    // Test 1: Health check
    console.log('Test 1: GET /api/health');
    const health = await testEndpoint('/api/health');
    console.log('✅ Health check passed');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, JSON.stringify(health.data, null, 2));
    
    if (!health.data.ok) {
      throw new Error('Health check returned ok: false');
    }
    
    if (!health.data.env.hasFinnhubKey) {
      console.warn('⚠️  Warning: FINNHUB_KEY not set');
    }
    
    if (!health.data.env.hasNewsApiKey) {
      console.warn('⚠️  Warning: NEWS_API_KEY not set');
    }
    
    console.log('\n✅ All smoke tests passed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Smoke tests failed!');
    console.error(`   Error: ${error.message}\n`);
    console.error('Make sure the server is running:');
    console.error('   npm run build && npm start\n');
    process.exit(1);
  }
}

// Run tests
runTests();
