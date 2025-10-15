/**
 * Test to verify the app's earnings sorting logic
 * Run: node test-earnings-sorting.js AAPL
 */

const symbol = process.argv[2] || 'AAPL';

console.log('\n🧪 Testing App Earnings Sorting Logic\n');
console.log('Symbol:', symbol);
console.log('Fetching from app API...\n');

// Fetch from your actual app API
fetch(`http://localhost:3000/api/stock?symbol=${symbol}`)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error('❌ ERROR:', data.error);
      console.log('\nMake sure dev server is running: npm run dev');
      return;
    }
    
    console.log('='.repeat(80));
    console.log('📊 APP RESPONSE - Earnings Data:\n');
    
    if (data.earnings) {
      console.log('✅ Earnings data found:');
      console.log(`  Date: ${data.earnings.date}`);
      console.log(`  Time: ${data.earnings.hour === 'bmo' ? 'Before Market Open' : data.earnings.hour === 'amc' ? 'After Market Close' : data.earnings.hour}`);
      console.log(`  Quarter: Q${data.earnings.quarter} ${data.earnings.year}`);
      console.log(`  EPS Estimate: ${data.earnings.epsEstimate !== null ? '$' + data.earnings.epsEstimate.toFixed(2) : 'N/A'}`);
      console.log(`  Revenue Estimate: ${data.earnings.revenueEstimate !== null ? '$' + (data.earnings.revenueEstimate / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      
      // Date validation
      const earningsDate = new Date(data.earnings.date);
      const today = new Date();
      const daysDiff = Math.floor((earningsDate - today) / (1000 * 60 * 60 * 24));
      
      console.log('\n📅 Date Validation:');
      console.log(`  Current Date: ${today.toISOString().split('T')[0]}`);
      console.log(`  Earnings Date: ${data.earnings.date}`);
      console.log(`  Days Until Earnings: ${daysDiff} days`);
      console.log(`  Status: ${earningsDate >= today ? '✅ FUTURE' : '❌ PAST'}`);
      
      // Check if this is the NEAREST earnings date
      console.log('\n🔍 Is this the NEAREST upcoming earnings?');
      if (daysDiff < 30) {
        console.log('  ✅ YES - Within next 30 days (likely correct)');
      } else if (daysDiff > 100) {
        console.log('  ⚠️  MAYBE - More than 100 days away (might be wrong quarter)');
      } else {
        console.log('  ✅ Probably correct - Within quarterly range');
      }
      
    } else {
      console.log('❌ No earnings data in response');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n🌐 Verify against these sources:\n');
    console.log(`  1. Yahoo Finance: https://finance.yahoo.com/quote/${symbol}`);
    console.log(`  2. Company IR: Google "${symbol} investor relations earnings"`);
    console.log(`  3. Nasdaq: https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/earnings`);
    console.log('');
    
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure dev server is running: npm run dev');
    console.log('  2. Check that server is on port 3000');
    console.log('  3. Environment variables are set in .env.local');
    console.log('');
  });
