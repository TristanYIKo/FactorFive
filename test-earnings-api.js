/**
 * Test script to check Finnhub earnings calendar data
 * Run: node test-earnings-api.js AAPL
 */

const symbol = process.argv[2] || 'AAPL';
const FINNHUB_KEY = 'd3l9fi1r01qq28emgpngd3l9fi1r01qq28emgpo0';

// Calculate date range
const today = new Date();
const toDate = today.toISOString().split('T')[0];

const futureDate = new Date();
futureDate.setDate(today.getDate() + 120);
const toDateFuture = futureDate.toISOString().split('T')[0];

console.log('\n🔍 Testing Finnhub Earnings Calendar API\n');
console.log('Symbol:', symbol);
console.log('Date Range:', toDate, 'to', toDateFuture);
console.log('API:', `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${toDate}&to=${toDateFuture}`);
console.log('\n' + '='.repeat(80) + '\n');

// Fetch earnings data
fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${toDate}&to=${toDateFuture}&token=${FINNHUB_KEY}`)
  .then(res => res.json())
  .then(data => {
    console.log('📅 RAW API RESPONSE:\n');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    if (data.earningsCalendar && data.earningsCalendar.length > 0) {
      console.log(`✅ Found ${data.earningsCalendar.length} earnings event(s):\n`);
      
      data.earningsCalendar.forEach((event, index) => {
        console.log(`Event #${index + 1}:`);
        console.log(`  Date: ${event.date}`);
        console.log(`  Time: ${event.hour === 'bmo' ? 'Before Market Open' : event.hour === 'amc' ? 'After Market Close' : event.hour}`);
        console.log(`  Quarter: ${event.quarter}`);
        console.log(`  Year: ${event.year}`);
        console.log(`  EPS Estimate: ${event.epsEstimate !== null ? '$' + event.epsEstimate : 'N/A'}`);
        console.log(`  Revenue Estimate: ${event.revenueEstimate !== null ? '$' + (event.revenueEstimate / 1e9).toFixed(2) + 'B' : 'N/A'}`);
        console.log('');
      });
      
      // Check if dates are in the past
      console.log('🕐 DATE VALIDATION:\n');
      data.earningsCalendar.forEach((event, index) => {
        const eventDate = new Date(event.date);
        const isPast = eventDate < today;
        const daysDiff = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        
        console.log(`Event #${index + 1}: ${event.date}`);
        console.log(`  Status: ${isPast ? '❌ PAST DATE' : '✅ FUTURE DATE'}`);
        console.log(`  Days from now: ${daysDiff} days`);
        console.log('');
      });
      
    } else {
      console.log('❌ No earnings data found for this symbol');
      console.log('\nPossible reasons:');
      console.log('  1. Company hasn\'t announced next earnings date yet');
      console.log('  2. Finnhub doesn\'t have data for this symbol');
      console.log('  3. Earnings date is beyond 120-day range');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('🌐 Verify with official sources:\n');
    console.log(`  Yahoo Finance: https://finance.yahoo.com/quote/${symbol}`);
    console.log(`  Nasdaq: https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}`);
    console.log(`  Google: Search "${symbol} earnings date 2025"`);
    console.log('');
    
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
  });
