#!/usr/bin/env node

// Chalk v5+ is ESM only, use simple colors instead
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: {
    green: (text) => `\x1b[1m\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[1m\x1b[31m${text}\x1b[0m`,
  }
};

const puppeteer = require('puppeteer');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_PAGES = [
  '/courses',
  '/all-courses',
  '/home',
  '/profile',
  '/community',
];

// Performance thresholds
// Note: Dev mode with React StrictMode will have 1-2 duplicates (intentional double render)
// Production mode should have 0 duplicates
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const THRESHOLDS = {
  maxRequests: 15,                    // Max requests per page
  maxDuplicates: IS_PRODUCTION ? 0 : 2,  // Dev: 2 (StrictMode), Prod: 0
  maxLoadTime: IS_PRODUCTION ? 3000 : 7000, // Dev: 7s (first load), Prod: 3s
  minCacheHitRate: 50,                // Min cache hit rate (%)
};

async function testPagePerformance(browser, path) {
  const page = await browser.newPage();
  const metrics = {
    requests: [],
    duplicates: new Map(),
    startTime: Date.now(),
    errors: [],
  };

  // Track network requests
  page.on('request', (request) => {
    const url = request.url();
    
    // Filter out non-API requests
    if (!url.includes('/api/') && !url.includes('supabase')) {
      return;
    }
    
    const key = extractRequestKey(url);
    const existingCount = metrics.requests.filter(r => r.key === key).length;
    
    metrics.requests.push({
      key,
      url,
      method: request.method(),
      timestamp: Date.now(),
    });
    
    if (existingCount > 0) {
      metrics.duplicates.set(key, (metrics.duplicates.get(key) || 1) + 1);
    }
  });

  // Track errors
  page.on('pageerror', (error) => {
    metrics.errors.push(error.toString());
  });

  console.log(colors.blue(`\nTesting ${path}...`));

  try {
    // Navigate to page
    await page.goto(`${BASE_URL}${path}`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    const loadTime = Date.now() - metrics.startTime;
    
    // Calculate statistics
    const totalRequests = metrics.requests.length;
    const duplicateCount = Array.from(metrics.duplicates.values()).reduce((a, b) => a + b, 0);
    const duplicateRate = totalRequests > 0 ? (duplicateCount / totalRequests * 100).toFixed(2) : 0;

    // Print results
    console.log(colors.gray('  Load Time:'), formatTime(loadTime));
    console.log(colors.gray('  Total Requests:'), totalRequests);
    console.log(colors.gray('  Duplicate Requests:'), duplicateCount);
    console.log(colors.gray('  Duplicate Rate:'), `${duplicateRate}%`);
    
    // Check thresholds
    const issues = [];
    
    if (totalRequests > THRESHOLDS.maxRequests) {
      issues.push(`Too many requests (${totalRequests} > ${THRESHOLDS.maxRequests})`);
    }
    
    if (duplicateCount > THRESHOLDS.maxDuplicates) {
      issues.push(`Too many duplicates (${duplicateCount} > ${THRESHOLDS.maxDuplicates})`);
    }
    
    if (loadTime > THRESHOLDS.maxLoadTime) {
      issues.push(`Load time too high (${formatTime(loadTime)} > ${formatTime(THRESHOLDS.maxLoadTime)})`);
    }
    
    if (metrics.errors.length > 0) {
      issues.push(`${metrics.errors.length} JavaScript errors`);
    }

    // Print duplicate details if any
    if (metrics.duplicates.size > 0) {
      console.log(colors.yellow('  Duplicate endpoints:'));
      metrics.duplicates.forEach((count, key) => {
        console.log(colors.gray(`    - ${key}: ${count} duplicates`));
      });
    }

    // Print issues
    if (issues.length > 0) {
      console.log(colors.red('  ❌ Issues:'));
      issues.forEach(issue => {
        console.log(colors.red(`    - ${issue}`));
      });
    } else {
      console.log(colors.green('  ✅ All checks passed!'));
    }

    return {
      path,
      loadTime,
      totalRequests,
      duplicateCount,
      duplicateRate,
      errors: metrics.errors,
      passed: issues.length === 0,
    };
  } finally {
    await page.close();
  }
}

function extractRequestKey(url) {
  try {
    const urlObj = new URL(url);
    
    // For Supabase requests - include query params to differentiate
    if (urlObj.hostname.includes('supabase')) {
      const match = urlObj.pathname.match(/\/rest\/v1\/(\w+)/);
      if (match) {
        const table = match[1];
        const select = urlObj.searchParams.get('select');
        
        // Create unique key based on table and select fields
        if (select) {
          // Simplify select to main fields only
          const mainFields = select.split(',')[0].split('(')[0].trim();
          return `supabase:${table}:${mainFields}`;
        }
        
        return `supabase:${table}`;
      }
    }
    
    // For API routes
    if (url.includes('/api/')) {
      return urlObj.pathname;
    }
    
    return urlObj.pathname;
  } catch {
    return url;
  }
}

function formatTime(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

async function checkServerRunning() {
  try {
    const response = await fetch(BASE_URL);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 Performance Testing Suite\n');
  console.log(colors.gray('Testing URL:'), BASE_URL);
  
  // Check if server is running
  console.log(colors.gray('Checking server status...'));
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.log(colors.red('\n❌ Server is not running at ' + BASE_URL));
    console.log(colors.yellow('\n📝 Please start the dev server first:'));
    console.log(colors.gray('   Terminal 1: npm run dev'));
    console.log(colors.gray('   Terminal 2: npm run test:performance\n'));
    process.exit(1);
  }
  
  console.log(colors.green('✅ Server is running!\n'));
  
  console.log(colors.gray('Thresholds:'));
  console.log(colors.gray(`  - Max requests: ${THRESHOLDS.maxRequests}`));
  console.log(colors.gray(`  - Max duplicates: ${THRESHOLDS.maxDuplicates}${!IS_PRODUCTION ? ' (React StrictMode in dev)' : ''}`));
  console.log(colors.gray(`  - Max load time: ${formatTime(THRESHOLDS.maxLoadTime)}`));
  
  if (!IS_PRODUCTION) {
    console.log(colors.yellow('\n⚠️  Dev Mode: React StrictMode causes intentional double-renders.'));
    console.log(colors.yellow('   This is NORMAL behavior to detect bugs.'));
    console.log(colors.yellow('   Production builds will have 0 duplicates.\n'));
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  try {
    for (const path of TEST_PAGES) {
      const result = await testPagePerformance(browser, path);
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n📊 Test Summary\n');
  
  const totalPassed = results.filter(r => r.passed).length;
  const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
  const avgRequests = results.reduce((sum, r) => sum + r.totalRequests, 0) / results.length;
  const avgDuplicates = results.reduce((sum, r) => sum + r.duplicateCount, 0) / results.length;
  
  console.log(colors.gray('Pages tested:'), results.length);
  console.log(colors.gray('Pages passed:'), totalPassed);
  console.log(colors.gray('Average load time:'), formatTime(avgLoadTime));
  console.log(colors.gray('Average requests:'), avgRequests.toFixed(1));
  console.log(colors.gray('Average duplicates:'), avgDuplicates.toFixed(1));
  
  if (totalPassed === results.length) {
    console.log(colors.bold.green('\n✅ All tests passed!'));
    process.exit(0);
  } else {
    console.log(colors.bold.red(`\n❌ ${results.length - totalPassed} tests failed`));
    process.exit(1);
  }
}

// Handle missing dependencies
try {
  require('puppeteer');
} catch (error) {
  console.error('Please install required dependencies:');
  console.error('npm install --save-dev puppeteer');
  process.exit(1);
}

// Run tests
runTests().catch((error) => {
  console.error(colors.red('Test failed:'), error);
  process.exit(1);
});
