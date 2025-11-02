#!/usr/bin/env node

/**
 * Test NewsAPI-based Market Calendar
 * 
 * Tests the calendar API endpoint that extracts event dates from news articles
 */

async function testNewsCalendar() {
  console.log('🧪 Testing NewsAPI-Based Market Calendar\n');
  console.log('This calendar extracts event dates from financial news articles');
  console.log('Sources: Bloomberg, Reuters, CNBC, MarketWatch, Yahoo Finance, WSJ\n');
  console.log('═'.repeat(80));

  try {
    // Test local API endpoint (try both ports)
    // Test local API endpoint (try both ports)
    let url = 'http://localhost:3000/api/calendar';
    let response = await fetch(url).catch(() => null);
    if (!response || !response.ok) {
      // Try port 3001
      url = 'http://localhost:3001/api/calendar';
      console.log(`\n📡 Fetching from: ${url}\n`);
      response = await fetch(url);
    } else {
      console.log(`\n📡 Fetching from: ${url}\n`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Response received\n');
    console.log(`📊 Total Events: ${data.count}`);
    console.log(`💾 Cached: ${data.cached}`);
    console.log(`🕐 Timestamp: ${data.timestamp}`);
    console.log(`📰 Source: ${data.source}`);

    if (data.breakdown) {
      console.log('\n📈 Event Breakdown:');
      console.log(`   High Impact: ${data.breakdown.High}`);
      console.log(`   Medium Impact: ${data.breakdown.Medium}`);
      console.log(`   Low Impact: ${data.breakdown.Low}`);
      console.log(`   Verified (2+ sources): ${data.breakdown.Verified}`);
      console.log(`   Estimated (1 source): ${data.breakdown.Estimated}`);
    }

    if (!data.events || data.events.length === 0) {
      console.log('\n⚠️  No upcoming events found in news articles.');
      console.log('This may mean:');
      console.log('  • No recent financial news about upcoming events');
      console.log('  • Events are scheduled further out than 7-day news window');
      console.log('  • NewsAPI rate limit reached');
      return;
    }

    // Display events
    console.log('\n═'.repeat(80));
    console.log(`\n📅 Upcoming Economic Events (Extracted from News):\n`);

    data.events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.icon} **${event.title}**`);
      console.log(`   📅 ${event.displayDate}`);
      console.log(`   ⚡ Impact: ${event.impact}`);
      console.log(`   ${event.confidence === 'Verified' ? '✅' : '📌'} Confidence: ${event.confidence}`);
      console.log(`   📰 Sources: ${event.sources.join(', ')}`);
      console.log('');
    });

    // Check for key events
    console.log('═'.repeat(80));
    console.log('\n🔍 Key Events Found:\n');

    const categories = {
      fomc: data.events.filter(e => e.category === 'monetary'),
      inflation: data.events.filter(e => e.category === 'inflation'),
      employment: data.events.filter(e => e.category === 'employment'),
      consumer: data.events.filter(e => e.category === 'consumer'),
      growth: data.events.filter(e => e.category === 'growth'),
    };

    console.log(`🏛️  FOMC Meetings: ${categories.fomc.length}`);
    categories.fomc.forEach(e => {
      console.log(`    • ${e.displayDate} (${e.confidence}) - ${e.sources.length} sources`);
    });

    console.log(`\n💹 Inflation Reports (CPI/PPI): ${categories.inflation.length}`);
    categories.inflation.forEach(e => {
      console.log(`    • ${e.title} on ${e.displayDate} (${e.confidence})`);
    });

    console.log(`\n🧾 Employment Reports: ${categories.employment.length}`);
    categories.employment.forEach(e => {
      console.log(`    • ${e.title} on ${e.displayDate} (${e.confidence})`);
    });

    console.log(`\n📊 Consumer Data: ${categories.consumer.length}`);
    categories.consumer.forEach(e => {
      console.log(`    • ${e.title} on ${e.displayDate} (${e.confidence})`);
    });

    console.log(`\n📊 Growth Indicators: ${categories.growth.length}`);
    categories.growth.forEach(e => {
      console.log(`    • ${e.title} on ${e.displayDate} (${e.confidence})`);
    });

    console.log('\n═'.repeat(80));
    console.log('\n✨ Test completed successfully!');
    console.log('\n💡 Notes:');
    console.log('  • Events are extracted from recent financial news (last 7 days)');
    console.log('  • "Verified" = 2+ independent sources confirm the same date');
    console.log('  • "Estimated" = Single source mentions the date');
    console.log('  • Calendar refreshes every 24 hours');
    console.log('  • No hardcoded dates - all from NewsAPI articles');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Make sure dev server is running: npm run dev');
    console.error('  2. Check NEWS_API_KEY is set in .env.local');
    console.error('  3. Verify NewsAPI subscription is active');
    console.error('  4. Check server logs for detailed errors');
    process.exit(1);
  }
}

console.log('🚀 Starting NewsAPI Calendar Test...\n');
testNewsCalendar();
