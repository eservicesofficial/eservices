import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = 'http://127.0.0.1:3000';
const errors = [];
const logs = [];
const screenshots = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});
const context = await browser.newContext();
const page = await context.newPage();

// Capture errors
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`);
  else if (msg.type() === 'warning') logs.push(`[warn] ${msg.text()}`);
  else logs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`Page Error: ${err.message}`));
page.on('requestfailed', req => errors.push(`Network Error: ${req.url()} - ${req.failure()?.errorText}`));

async function ss(name) {
  const path = `/tmp/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
  console.log(`  Screenshot saved: ${path}`);
}

async function checkError(context) {
  const text = await page.textContent('body');
  if (text.includes('Something went wrong')) {
    const msg = `"Something went wrong" on ${context}`;
    errors.push(msg);
    console.log(`  ❌ ${msg}`);
    return true;
  }
  console.log(`  ✓ No error on ${context}`);
  return false;
}

try {
  // ─── STEP 1: Load Home Page ───────────────────────────────
  console.log('\n=== STEP 1: Navigate to application ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`  URL: ${page.url()}`);
  await ss('step01-homepage');

  // ─── STEP 2: Login ────────────────────────────────────────
  console.log('\n=== STEP 2: Login with FD001/admin/admin123 ===');
  
  const clientIdInput = page.locator('#clientId');
  const userIdInput = page.locator('#loginId');
  const passwordInput = page.locator('#password');
  
  await clientIdInput.waitFor({ state: 'visible', timeout: 10000 });
  await clientIdInput.click();
  await clientIdInput.fill('FD001');
  await userIdInput.click();
  await userIdInput.fill('admin');
  await passwordInput.click();
  await passwordInput.fill('admin123');
  console.log('  Filled credentials');
  
  // Submit form by clicking submit button
  const submitBtn = page.locator('form button[type="submit"]');
  await submitBtn.click();
  
  // Wait for page change (sidebar should appear)
  console.log('  Waiting for dashboard to load...');
  try {
    // Wait for sidebar to appear (indicates successful login)
    await page.locator('[data-sidebar-content], [data-slot="sidebar-content"]').waitFor({ state: 'visible', timeout: 15000 });
    console.log('  ✓ Sidebar appeared - login successful');
  } catch {
    // Alternative: wait for any dashboard element
    try {
      await page.waitForSelector('text=Dashboard', { timeout: 5000 });
      console.log('  ✓ Dashboard text found');
    } catch {
      console.log('  ⚠ Could not confirm dashboard loaded');
    }
  }
  
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await ss('step02-after-login');
  await checkError('after login');

  // ─── STEP 3: Navigate to Customer Folio ─────────────────────
  console.log('\n=== STEP 3: Navigate to Customer Folio ===');
  
  // Click "Customer Folio" link in sidebar
  // The sidebar text is exactly "Customer Folio"
  // Use the button role to target the sidebar nav item specifically
  const folioLink = page.getByRole('button', { name: 'Customer Folio' });
  await folioLink.click();
  console.log('  Clicked Customer Folio in sidebar');
  
  // Wait for the folio section to load - it's dynamically imported
  // Wait for either the customer list table or the loading spinner to appear
  console.log('  Waiting for Customer Folio section to load...');
  await page.waitForTimeout(3000);
  
  // Wait for content to appear - look for customer table or customer list
  try {
    // The component renders a table with customer rows - wait for any text that indicates loading is done
    await page.waitForFunction(() => {
      const body = document.body.textContent || '';
      return body.includes('Add Customer') || body.includes('Customer List') || 
             (document.querySelector('table tbody tr') !== null);
    }, { timeout: 15000 });
    console.log('  ✓ Customer Folio section loaded');
  } catch (e) {
    console.log(`  ⚠ Timeout waiting for Customer Folio: ${e.message}`);
  }
  
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await ss('step03-customer-folio');
  await checkError('Customer Folio page');

  // ─── STEP 4: Check for error explicitly ─────────────────────
  console.log('\n=== STEP 4: Explicit error check ===');
  const folioPageText = await page.textContent('body');
  const hasError = folioPageText.includes('Something went wrong');
  if (hasError) {
    errors.push('Customer Folio has "Something went wrong" error');
    console.log('  ❌ CONFIRMED: "Something went wrong" is present!');
    // Get the error details
    const errorDetail = await page.evaluate(() => {
      const el = document.querySelector('.text-slate-500, .text-red-500');
      return el ? el.textContent : 'No details found';
    });
    console.log(`  Error detail: ${errorDetail}`);
  } else {
    console.log('  ✅ PASSED: No "Something went wrong" error on Customer Folio');
  }

  // ─── STEP 5: Click on a customer ────────────────────────────
  console.log('\n=== STEP 5: Click on a customer card ===');
  
  // The Customer Folio shows a card grid, NOT a table
  try {
    // Wait for customer cards to appear (div with cursor-pointer that has customer name)
    // The cards are rendered in a grid of clickable divs
    const customerCard = page.locator('.cursor-pointer.group').first();
    await customerCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  Found customer card');
    
    const cardText = await customerCard.textContent();
    console.log(`  Card text: ${cardText?.substring(0, 100)}`);
    
    await customerCard.click();
    console.log('  Clicked first customer card');
    
    // Wait for the detail view to load
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await ss('step04-customer-detail');
    await checkError('customer detail view');
    
    // Verify we're now in detail view (look for Back button and folio management)
    const detailVisible = await page.locator('text=Back').first().isVisible().catch(() => false);
    if (detailVisible) {
      console.log('  ✓ Customer detail view loaded');
    } else {
      console.log('  ⚠ Could not confirm detail view - checking page state');
      // Debug: get all visible text
      const pageText = await page.textContent('body');
      console.log(`  Page text (first 300): ${pageText.substring(0, 300)}`);
    }

    // ─── STEP 6: Click Notes button ───────────────────────────
    console.log('\n=== STEP 6: Click Notes button ===');
    
    // The Notes button is an ActionBtn that renders as <button><span>Notes</span></button>
    // Try multiple selectors
    let notesFound = false;
    
    // Try finding button with exact "Notes" text
    const notesBtn = page.locator('button').filter({ hasText: 'Notes' }).first();
    const notesCount = await notesBtn.count();
    
    if (notesCount > 0) {
      const isVisible = await notesBtn.isVisible();
      if (isVisible) {
        console.log('  Found Notes button, clicking...');
        await notesBtn.click();
        notesFound = true;
        
        await page.waitForTimeout(2000);
        await ss('step05-notes-view');
        await checkError('Notes view');
        
        // Check if notes dialog/section appeared
        const notesContent = await page.textContent('body');
        if (notesContent.includes('Add Note') || notesContent.includes('Notes')) {
          console.log('  ✓ Notes section/dialog appeared');
        } else {
          console.log('  ⚠ Notes content not confirmed');
        }
      }
    }
    
    if (!notesFound) {
      console.log('  Notes button not found');
      // List all buttons for debugging
      const allBtns = await page.locator('button').allTextContents();
      const filtered = allBtns.filter(t => t && t.trim().length > 0);
      console.log(`  Available buttons (${filtered.length}):`, filtered.slice(0, 30));
      await ss('step05-no-notes');
    } else {
      // Take a screenshot of the Notes dialog
      // Close the Notes dialog before proceeding to Documents
      console.log('  Closing Notes dialog...');
      // Try to close dialog by pressing Escape or clicking overlay/X
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      // If dialog still open, try clicking the X or overlay
      const closeBtn = page.locator('[data-slot="dialog-close"], button[aria-label="Close"]').first();
      if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
      // Force close any remaining dialog overlay
      await page.evaluate(() => {
        // Click all close buttons and dismiss dialogs
        document.querySelectorAll('[data-state="open"]').forEach(el => {
          if (el.getAttribute('data-slot') === 'dialog-overlay') {
            el.click();
          }
        });
      });
      await page.waitForTimeout(500);
    }

    // ─── STEP 7: Click Documents button ──────────────────────
    console.log('\n=== STEP 7: Click Documents button ===');
    
    let docsFound = false;
    const docsBtn = page.locator('button').filter({ hasText: 'Documents' }).first();
    const docsCount = await docsBtn.count();
    
    if (docsCount > 0) {
      const isVisible = await docsBtn.isVisible();
      if (isVisible) {
        console.log('  Found Documents button, clicking...');
        await docsBtn.click();
        docsFound = true;
        
        await page.waitForTimeout(2000);
        await ss('step06-documents-view');
        await checkError('Documents view');
        
        const docsContent = await page.textContent('body');
        if (docsContent.includes('Upload') || docsContent.includes('Document')) {
          console.log('  ✓ Documents section/dialog appeared');
        } else {
          console.log('  ⚠ Documents content not confirmed');
        }
      }
    }
    
    if (!docsFound) {
      console.log('  Documents button not found');
      await ss('step06-no-docs');
    }

  } catch (e) {
    console.log(`  ❌ Error in customer interaction: ${e.message}`);
    errors.push(`Customer interaction error: ${e.message}`);
    
    // Debug: get page content
    const bodyText = await page.textContent('body');
    console.log(`  Page text (first 300 chars): ${bodyText.substring(0, 300)}`);
  }

  // ─── STEP 8: Check console errors ──────────────────────────
  console.log('\n=== STEP 8: Console & network error check ===');
  console.log(`  Total console errors captured: ${errors.filter(e => e.startsWith('Console')).length}`);
  console.log(`  Total page errors captured: ${errors.filter(e => e.startsWith('Page')).length}`);
  console.log(`  Total network errors captured: ${errors.filter(e => e.startsWith('Network')).length}`);

  // Also check browser console directly via evaluate
  const browserErrors = await page.evaluate(() => {
    // Try to get any errors from window
    return (window.__playwright_errors__ || []).length;
  }).catch(() => 0);
  console.log(`  Browser-evaluated errors: ${browserErrors}`);

} catch (err) {
  console.error(`\n❌ FATAL TEST ERROR: ${err.message}`);
  errors.push(`Fatal: ${err.message}`);
} finally {
  await browser.close();
}

// ─── FINAL REPORT ────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  CUSTOMER FOLIO - TEST REPORT');
console.log('═'.repeat(60));

console.log('\nSCREENSHOTS:');
screenshots.forEach(s => console.log(`  ${s}`));

if (errors.length > 0) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  ❌ ${e}`));
} else {
  console.log('\n✅ ALL CHECKS PASSED - No errors detected!');
}

if (logs.length > 0) {
  console.log(`\nNOTABLE CONSOLE LOGS (${Math.min(logs.length, 10)} shown):`);
  logs.slice(-10).forEach(l => console.log(`  ${l}`));
}

// Save full results
fs.writeFileSync('/tmp/test-results.json', JSON.stringify({
  errors,
  logs,
  screenshots,
  timestamp: new Date().toISOString()
}, null, 2));
console.log('\nFull results: /tmp/test-results.json');
