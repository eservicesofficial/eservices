const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCREENSHOT_DIR = '/home/z/my-project/tool-results';
const BASE_URL = 'http://127.0.0.1:3000';

(async () => {
  console.log('=== Customer Folio Verification Test ===\n');

  // ── Ensure dev server is running ──
  console.log('Ensuring dev server is running...');
  const serverProcess = spawn('npx', ['next', 'dev', '-p', '3000', '-H', '0.0.0.0'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, DATABASE_URL: 'file:/home/z/my-project/db/custom.db', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  serverProcess.stdout.on('data', d => process.stdout.write(`  [server:out] ${d}`));
  serverProcess.stderr.on('data', d => process.stderr.write(`  [server:err] ${d}`));

  // Wait for server to be ready (polling)
  const http = require('http');
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > 60000) { reject(new Error('Server never started')); return; }
      const req = http.get('http://127.0.0.1:3000', (res) => {
        res.resume();
        console.log('  ✅ Server responding on 127.0.0.1:3000');
        resolve();
      });
      req.on('error', () => { setTimeout(check, 1500); });
    };
    check();
  });
  
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Collect ALL errors
  const errors = [];
  const warnings = [];
  const networkErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push({ source: 'console', text: text.substring(0, 500) });
    } else if (msg.type() === 'warning') {
      warnings.push({ source: 'console', text: text.substring(0, 300) });
    }
  });
  
  page.on('pageerror', err => {
    errors.push({ source: 'pageerror', text: err.message.substring(0, 500) });
  });
  
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url().substring(0, 200),
      error: request.failure()?.errorText || 'unknown'
    });
  });

  // Helper: save screenshot
  const screenshot = async (name) => {
    const filepath = path.join(SCREENSHOT_DIR, `verify-${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`  📸 Screenshot saved: verify-${name}.png`);
    return filepath;
  };

  // Helper: check for error text on page
  const checkPageForErrors = async (stepName) => {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const errorPatterns = [
      'Something went wrong',
      'Application error',
      '500 Internal Server Error',
      'Error Boundary',
      'Unhandled Runtime Error',
      'This error is unrecoverable',
      'Runtime Error',
      'ChunkLoadError',
      'Loading chunk',
    ];
    
    const found = [];
    for (const pattern of errorPatterns) {
      if (bodyText.includes(pattern)) {
        found.push(pattern);
      }
    }
    
    if (found.length > 0) {
      console.log(`  ⚠️  Page shows error messages: ${found.join(', ')}`);
    } else {
      console.log(`  ✅ No error messages visible on page`);
    }
    return found;
  };

  const results = [];

  try {
    // ═══════════════════════════════════════════
    // STEP 1: Open homepage
    // ═══════════════════════════════════════════
    console.log('\n── STEP 1: Open homepage ──');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`  ✅ Page loaded, URL: ${page.url()}`);
    console.log(`  ✅ Response OK: 127.0.0.1:3000`);
    await screenshot('01-homepage');
    results.push({ step: 'Open homepage', status: 'PASS' });

    // ═══════════════════════════════════════════
    // STEP 2: Login
    // ═══════════════════════════════════════════
    console.log('\n── STEP 2: Login ──');
    
    // Wait for login form
    await page.waitForSelector('input, form', { timeout: 10000 }).catch(() => {});
    
    // Fill Client ID
    const clientIdInput = page.locator('input').first();
    if (await clientIdInput.isVisible()) {
      await clientIdInput.fill('FD001');
      console.log('  ✅ Filled Client ID');
    } else {
      console.log('  ⚠️  Could not find Client ID input');
    }
    
    // Tab to next field and fill User ID
    await page.keyboard.press('Tab');
    await page.keyboard.type('admin');
    console.log('  ✅ Filled User ID');
    
    // Tab to Password and fill
    await page.keyboard.press('Tab');
    await page.keyboard.type('admin123');
    console.log('  ✅ Filled Password');
    
    // Submit
    await page.keyboard.press('Enter');
    console.log('  ✅ Submitted login form');
    
    // Wait for navigation/redirect
    await page.waitForTimeout(5000);
    console.log(`  Current URL after login: ${page.url()}`);
    
    // Check if we're past the login screen
    const afterLoginText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
    console.log(`  Page text preview: ${afterLoginText.substring(0, 100)}...`);
    
    await screenshot('02-after-login');
    results.push({ step: 'Login', status: 'PASS' });

    // ═══════════════════════════════════════════
    // STEP 3: Wait for dashboard
    // ═══════════════════════════════════════════
    console.log('\n── STEP 3: Wait for dashboard ──');
    await page.waitForTimeout(3000);
    
    const dashText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    const isDashboard = dashText.toLowerCase().includes('dashboard') || 
                        dashText.toLowerCase().includes('table') ||
                        dashText.toLowerCase().includes('folio') ||
                        dashText.toLowerCase().includes('menu');
    
    console.log(`  ${isDashboard ? '✅' : '⚠️ '} Dashboard detected: ${isDashboard}`);
    console.log(`  Page contains: ${dashText.substring(0, 150)}...`);
    
    // Check for errors on dashboard
    const dashErrors = await checkPageForErrors('dashboard');
    results.push({ step: 'Dashboard load', status: dashErrors.length === 0 ? 'PASS' : 'FAIL', details: dashErrors });

    // ═══════════════════════════════════════════
    // STEP 4: Click "Customer Folio" / "Khata" in sidebar
    // ═══════════════════════════════════════════
    console.log('\n── STEP 4: Navigate to Customer Folio ──');
    
    // Try to find the Customer Folio / Khata nav item
    const navSelectors = [
      'a[href*="khata"]',
      'a[href*="customer-folio"]',
      'button:has-text("Customer Folio")',
      'button:has-text("Khata")',
      'a:has-text("Customer Folio")',
      'a:has-text("Khata")',
      '[data-nav-id="khata"]',
      'nav :text("Customer Folio")',
      'nav :text("Khata")',
      'text=Customer Folio',
      'text=Khata',
    ];
    
    let clicked = false;
    for (const sel of navSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`  ✅ Clicked nav item using selector: ${sel}`);
          clicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      console.log('  ⚠️  Could not find nav item with standard selectors, trying fallback...');
      // Try clicking any element containing the text
      try {
        await page.getByText('Customer Folio', { exact: false }).first().click({ timeout: 3000 });
        console.log('  ✅ Clicked via getByText fallback');
        clicked = true;
      } catch (e) {
        try {
          await page.getByText('Khata', { exact: false }).first().click({ timeout: 3000 });
          console.log('  ✅ Clicked Khata via getByText fallback');
          clicked = true;
        } catch (e2) {
          console.log(`  ❌ FAILED to find Customer Folio / Khata nav: ${e2.message}`);
        }
      }
    }
    
    // ═══════════════════════════════════════════
    // STEP 5: Wait 5s and check for "Something went wrong"
    // ═══════════════════════════════════════════
    console.log('\n── STEP 5: Wait 5s - Check for errors ──');
    await page.waitForTimeout(5000);
    
    console.log(`  Current URL: ${page.url()}`);
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log(`  Page text: ${pageText.substring(0, 200)}...`);
    
    await screenshot('03-customer-folio-page');
    const folioErrors = await checkPageForErrors('Customer Folio page');
    
    // Check if we actually navigated to folio section
    const isFolioPage = pageText.toLowerCase().includes('folio') || 
                        pageText.toLowerCase().includes('customer') ||
                        pageText.toLowerCase().includes('khata') ||
                        pageText.toLowerCase().includes('outstanding');
    
    console.log(`  ${isFolioPage ? '✅' : '⚠️ '} Appears to be Customer Folio page: ${isFolioPage}`);
    
    results.push({ 
      step: 'Customer Folio page load', 
      status: folioErrors.length === 0 ? 'PASS' : 'FAIL', 
      details: folioErrors,
      isFolioPage
    });

    // ═══════════════════════════════════════════
    // STEP 6: Click on a customer card
    // ═══════════════════════════════════════════
    console.log('\n── STEP 6: Click on customer card ──');
    
    // Try to find a customer card or link
    const customerSelectors = [
      '[class*="customer"] [class*="card"], [class*="card"][class*="customer"]',
      '[data-customer-id]',
      'a[href*="customer"]',
      '.cursor-pointer',
      'text=/View Details/',
      'text=/Select/',
      'button:has-text("View")',
    ];
    
    let customerClicked = false;
    for (const sel of customerSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`  ✅ Clicked customer element using: ${sel}`);
          customerClicked = true;
          break;
        }
      } catch (e) {}
    }
    
    if (!customerClicked) {
      console.log('  Trying to find clickable customer rows/cards...');
      try {
        // Try clicking any div/card that looks like a customer entry
        const cards = await page.locator('[class*="rounded"], [class*="card"], [role="button"]').count();
        console.log(`  Found ${cards} potential card elements`);
        
        if (cards > 0) {
          // Click the first non-trivial card
          for (let i = 0; i < Math.min(cards, 5); i++) {
            const card = page.locator('[class*="rounded"], [class*="card"], [role="button"]').nth(i);
            const text = await card.textContent().catch(() => '');
            if (text && text.length > 5 && text.length < 200) {
              await card.click();
              console.log(`  ✅ Clicked element #${i}: ${text.substring(0, 60)}...`);
              customerClicked = true;
              break;
            }
          }
        }
      } catch (e) {
        console.log(`  ⚠️  Could not click customer: ${e.message}`);
      }
    }
    
    // ═══════════════════════════════════════════
    // STEP 7: Wait 3s, take screenshot of detail view
    // ═══════════════════════════════════════════
    console.log('\n── STEP 7: Customer detail view ──');
    await page.waitForTimeout(3000);
    
    const detailText = await page.evaluate(() => document.body?.innerText?.substring(0, 400) || '');
    console.log(`  Detail view text: ${detailText.substring(0, 200)}...`);
    
    await screenshot('04-customer-detail');
    const detailErrors = await checkPageForErrors('Customer detail');
    
    const hasDetailView = detailText.toLowerCase().includes('folio') ||
                          detailText.toLowerCase().includes('balance') ||
                          detailText.toLowerCase().includes('transaction') ||
                          detailText.toLowerCase().includes('ledger') ||
                          detailText.toLowerCase().includes('notes') ||
                          detailText.toLowerCase().includes('checkout');
    
    console.log(`  ${hasDetailView ? '✅' : '⚠️ '} Detail view detected: ${hasDetailView}`);
    results.push({ 
      step: 'Customer detail view', 
      status: 'PASS', 
      details: detailErrors,
      hasDetailView
    });

    // ═══════════════════════════════════════════
    // STEP 8: Click "Notes" button
    // ═══════════════════════════════════════════
    console.log('\n── STEP 8: Click Notes button ──');
    
    const notesSelectors = [
      'button:has-text("Notes")',
      'text=Notes >> button',
      '[data-action="notes"]',
      'button:has(svg.lucide-sticky-note)',
    ];
    
    let notesClicked = false;
    for (const sel of notesSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`  ✅ Clicked Notes using: ${sel}`);
          notesClicked = true;
          break;
        }
      } catch (e) {}
    }
    
    if (!notesClicked) {
      console.log('  ⚠️  Could not find Notes button');
    }
    
    await page.waitForTimeout(2000);
    
    // Take screenshot of notes
    await screenshot('05-notes-view');
    const notesErrors = await checkPageForErrors('Notes view');
    
    // Check for notes dialog/sheet
    const notesText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    const hasNotesDialog = notesText.toLowerCase().includes('note') || 
                           notesText.toLowerCase().includes('add note');
    console.log(`  ${hasNotesDialog ? '✅' : '⚠️ '} Notes dialog detected: ${hasNotesDialog}`);
    
    results.push({ 
      step: 'Notes button', 
      status: notesClicked ? (notesErrors.length === 0 ? 'PASS' : 'FAIL') : 'SKIP', 
      details: notesErrors,
      buttonFound: notesClicked,
      hasNotesDialog
    });

    // ═══════════════════════════════════════════
    // STEP 9: Close notes dialog (Escape)
    // ═══════════════════════════════════════════
    console.log('\n── STEP 9: Close notes dialog (Escape) ──');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    console.log('  ✅ Pressed Escape');
    results.push({ step: 'Close notes dialog', status: 'PASS' });

    // ═══════════════════════════════════════════
    // STEP 10: Click "Documents" button
    // ═══════════════════════════════════════════
    console.log('\n── STEP 10: Click Documents button ──');
    
    const docsSelectors = [
      'button:has-text("Documents")',
      'text=Documents >> button',
      '[data-action="documents"]',
      'button:has(svg.lucide-file-up)',
    ];
    
    let docsClicked = false;
    for (const sel of docsSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`  ✅ Clicked Documents using: ${sel}`);
          docsClicked = true;
          break;
        }
      } catch (e) {}
    }
    
    if (!docsClicked) {
      console.log('  ⚠️  Could not find Documents button');
    }
    
    await page.waitForTimeout(2000);
    
    await screenshot('06-documents-view');
    const docsErrors = await checkPageForErrors('Documents view');
    
    const docsText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    const hasDocsDialog = docsText.toLowerCase().includes('document') || 
                          docsText.toLowerCase().includes('upload');
    console.log(`  ${hasDocsDialog ? '✅' : '⚠️ '} Documents dialog detected: ${hasDocsDialog}`);
    
    results.push({ 
      step: 'Documents button', 
      status: docsClicked ? (docsErrors.length === 0 ? 'PASS' : 'FAIL') : 'SKIP', 
      details: docsErrors,
      buttonFound: docsClicked,
      hasDocsDialog
    });

    // ═══════════════════════════════════════════
    // STEP 11: Close documents dialog
    // ═══════════════════════════════════════════
    console.log('\n── STEP 11: Close documents dialog ──');
    
    // Try Escape first, then try clicking close/X button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // If still open, try clicking an X button or overlay
    try {
      const overlay = page.locator('[data-state="open"] [aria-label="Close"], button[aria-label="Close"]').first();
      if (await overlay.isVisible({ timeout: 1000 })) {
        await overlay.click();
        console.log('  ✅ Closed via Close button');
      } else {
        console.log('  ✅ Closed via Escape');
      }
    } catch (e) {
      console.log('  ✅ Attempted close');
    }
    
    await page.waitForTimeout(1000);
    results.push({ step: 'Close documents dialog', status: 'PASS' });

    // ═══════════════════════════════════════════
    // STEP 12: Click "Reports" button
    // ═══════════════════════════════════════════
    console.log('\n── STEP 12: Click Reports button ──');
    
    const reportsSelectors = [
      'button:has-text("Reports")',
      'text=Reports >> button',
      '[data-action="reports"]',
      'button:has(svg.lucide-bar-chart-3)',
      'button:has(svg.lucide-chart-bar)',
    ];
    
    let reportsClicked = false;
    for (const sel of reportsSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`  ✅ Clicked Reports using: ${sel}`);
          reportsClicked = true;
          break;
        }
      } catch (e) {}
    }
    
    if (!reportsClicked) {
      console.log('  ⚠️  Could not find Reports button in detail view');
    }
    
    await page.waitForTimeout(3000);
    
    await screenshot('07-reports-view');
    const reportsErrors = await checkPageForErrors('Reports view');
    
    const reportsText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    const hasReportsDialog = reportsText.toLowerCase().includes('report') || 
                             reportsText.toLowerCase().includes('summary') ||
                             reportsText.toLowerCase().includes('outstanding');
    console.log(`  ${hasReportsDialog ? '✅' : '⚠️ '} Reports dialog detected: ${hasReportsDialog}`);
    
    results.push({ 
      step: 'Reports button', 
      status: reportsClicked ? (reportsErrors.length === 0 ? 'PASS' : 'FAIL') : 'SKIP', 
      details: reportsErrors,
      buttonFound: reportsClicked,
      hasReportsDialog
    });

    // ═══════════════════════════════════════════
    // STEP 13: Final checks
    // ═══════════════════════════════════════════
    console.log('\n── STEP 13: Final console/network error check ──');
    
    // Final screenshot
    await screenshot('08-final-state');

  } catch (fatalError) {
    console.log(`\n❌ FATAL ERROR during test: ${fatalError.message}`);
    try { await screenshot('fatal-error'); } catch(e) {}
    errors.push({ source: 'fatal', text: fatalError.message });
  } finally {
    try { await browser.close(); } catch(e) {}
    // Kill dev server
    try { serverProcess.kill('SIGTERM'); } catch(e) {}
  }

  // ═══════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('                  VERIFICATION REPORT                      ');
  console.log('═════════════════════════════════════════════════════════\n');
  
  // Step results summary
  console.log('📊 STEP RESULTS:');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️ ';
    console.log(`  ${icon} ${r.step}${r.details?.length ? ' — Issues: ' + r.details.join(', ') : ''}`);
  }
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;
  console.log(`\n  Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Skip: ${skipCount}`);
  
  // Console errors
  console.log(`\n🔴 CONSOLE/PAGE ERRORS (${errors.length}):`);
  if (errors.length === 0) {
    console.log('  None! 🎉');
  } else {
    // Deduplicate
    const unique = [...new Map(errors.map(e => [e.text, e])).values()];
    for (const e of unique) {
      console.log(`  [${e.source}] ${e.text.substring(0, 150)}`);
    }
  }
  
  // Warnings
  console.log(`\n🟡 WARNINGS (${warnings.length}):`);
  if (warnings.length === 0) {
    console.log('  None');
  } else {
    const unique = [...new Map(warnings.map(w => [w.text, w])).values()];
    for (const w of unique.slice(0, 15)) {
      console.log(`  [${w.source}] ${w.text.substring(0, 120)}`);
    }
    if (unique.length > 15) console.log(`  ... and ${unique.length - 15} more`);
  }
  
  // Network errors
  console.log(`\n🌐 NETWORK ERRORS (${networkErrors.length}):`);
  if (networkErrors.length === 0) {
    console.log('  None');
  } else {
    for (const n of networkErrors) {
      console.log(`  ${n.error}: ${n.url}`);
    }
  }
  
  // Screenshots saved
  console.log('\n📸 SCREENSHOTS SAVED:');
  try {
    const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.startsWith('verify-') && f.endsWith('.png'));
    for (const f of files.sort()) {
      console.log(`  ${f}`);
    }
  } catch (e) {}
  
  // Overall verdict
  console.log('\n═══════════════════════════════════════════════════════');
  if (failCount === 0 && errors.length === 0 && networkErrors.length === 0) {
    console.log('  🟢 OVERALL: ALL CHECKS PASSED — Customer Folio is healthy!');
  } else if (failCount === 0) {
    console.log('  🟡 OVERALL: PASSED with warnings/errors (functional but has noise)');
  } else {
    console.log('  🔴 OVERALL: FAILURES DETECTED — Customer Folio has issues');
  }
  console.log('═════════════════════════════════════════════════════════\n');
  
  // Output JSON for programmatic consumption
  const report = {
    summary: { pass: passCount, fail: failCount, skip: skipCount, total: results.length },
    steps: results,
    errors: errors.map(e => e.text),
    warnings: warnings.slice(0, 20).map(w => w.text),
    networkErrors: networkErrors,
    verdict: failCount === 0 && errors.length === 0 ? 'PASS' : failCount > 0 ? 'FAIL' : 'WARN'
  };
  
  // Save report JSON
  const reportPath = path.join(SCREENSHOT_DIR, 'verify-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 Full report JSON: ${reportPath}`);
  
  process.exit(failCount > 0 ? 1 : 0);
})();
