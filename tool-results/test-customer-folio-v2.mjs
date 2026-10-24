import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  const consoleErrors = [];
  const pageErrors = [];
  const consoleWarnings = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  
  const results = {
    loginPageLoaded: false,
    loginSucceeded: false,
    customerFolioNavigated: false,
    somethingWentWrong: false,
    isAdminNotDefined: false,
    customerCardClicked: false,
    customerDetailViewLoaded: false,
    notesButtonFound: false,
    notesDialogOpened: false,
    documentsButtonFound: false,
    documentsDialogOpened: false,
    notesDocErrors: false,
    consoleErrors: [],
    pageErrors: [],
    consoleWarnings: [],
  };

  try {
    // === STEP 1: Open login page ===
    console.log('=== STEP 1: Opening http://localhost:3000 ===');
    await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    results.loginPageLoaded = true;
    console.log('Login page loaded');
    
    await page.screenshot({ path: '/home/z/my-project/tool-results/test1.png', fullPage: true });
    console.log('Screenshot 1 saved');

    // === STEP 2: Fill login and submit ===
    console.log('=== STEP 2: Login ===');
    const inputs = await page.$$('input');
    if (inputs.length >= 3) {
      await inputs[0].fill('FD001');
      await inputs[1].fill('admin');
      await inputs[2].fill('admin123');
      console.log('Filled credentials: FD001 / admin / admin123');
    }
    
    const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Login")') || await page.$('button:has-text("Sign")');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('Submitted login');

    // === STEP 3: Wait for dashboard ===
    console.log('=== STEP 3: Waiting for dashboard ===');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test2.png', fullPage: true });
    console.log('Screenshot 2 saved');
    
    results.loginSucceeded = !(await page.textContent('body')).includes('Invalid');
    console.log(`Login succeeded: ${results.loginSucceeded}`);

    // === STEP 4: Navigate to Customer Folio ===
    console.log('=== STEP 4: Navigating to Customer Folio ===');
    
    // Wait for sidebar buttons to appear
    await page.waitForTimeout(2000);
    
    // Click Customer Folio button (we know it exists from previous test)
    const folioBtn = await page.$('button:has-text("Customer Folio")');
    if (folioBtn) {
      const isVisible = await folioBtn.isVisible();
      console.log(`Customer Folio button found, visible: ${isVisible}`);
      if (isVisible) {
        await folioBtn.click();
        results.customerFolioNavigated = true;
        console.log('Clicked Customer Folio');
      } else {
        // Maybe sidebar is collapsed, try to expand it
        console.log('Button not visible, trying to expand sidebar...');
        const toggleBtn = await page.$('button:has-text("Toggle Sidebar")');
        if (toggleBtn) {
          await toggleBtn.click();
          await page.waitForTimeout(500);
          // Now find and click Customer Folio again
          const folioBtn2 = await page.$('button:has-text("Customer Folio")');
          if (folioBtn2) {
            await folioBtn2.click();
            results.customerFolioNavigated = true;
            console.log('Clicked Customer Folio after expanding sidebar');
          }
        }
      }
    } else {
      console.log('Customer Folio button not found');
      // Dump all buttons for debugging
      const allBtns = await page.$$('button');
      console.log('All buttons on page:');
      for (const btn of allBtns) {
        const text = (await btn.textContent()).trim().substring(0, 60);
        const visible = await btn.isVisible();
        if (visible) console.log(`  [V] "${text}"`);
      }
    }

    // === STEP 5: Wait and screenshot Customer Folio page ===
    console.log('=== STEP 5: Customer Folio page ===');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test3.png', fullPage: true });
    console.log('Screenshot 3 saved');

    // Check for "Something went wrong"
    let pageText = await page.textContent('body');
    results.somethingWentWrong = pageText.includes('Something went wrong');
    console.log(`"Something went wrong" on Folio page: ${results.somethingWentWrong}`);
    
    // Check isAdmin
    let allErrors = [...consoleErrors, ...pageErrors].join(' ');
    results.isAdminNotDefined = allErrors.includes('isAdmin is not defined');
    console.log(`"isAdmin is not defined" in console: ${results.isAdminNotDefined}`);
    
    // Log what's on the page
    console.log('Page text snippet (first 500 chars):');
    console.log(pageText.substring(0, 500));
    console.log('---');

    // === STEP 6: Click on customer card ===
    console.log('=== STEP 6: Clicking customer card ===');
    
    // Try to find a profile card / customer item
    const cardSelectors = [
      'div[class*="profile-card"]',
      'div[class*="customer-card"]',
      'div[class*="ProfileCard"]',
      'div[class*="CustomerCard"]',
      '[class*="cursor-pointer"]',
    ];
    
    let cardClicked = false;
    for (const selector of cardSelectors) {
      const cards = await page.$$(selector);
      for (const card of cards) {
        const visible = await card.isVisible();
        const box = await card.boundingBox();
        if (visible && box && box.width > 80 && box.height > 50) {
          const text = (await card.textContent()).trim().substring(0, 100);
          console.log(`  Found card (${selector}): "${text}" [${Math.round(box.width)}x${Math.round(box.height)}]`);
          await card.click();
          cardClicked = true;
          results.customerCardClicked = true;
          break;
        }
      }
      if (cardClicked) break;
    }
    
    if (!cardClicked) {
      // Try broader: any clickable divs that might be customer cards
      console.log('No card with specific selector found, looking for clickable elements...');
      // Look for elements with specific text patterns (customer names, room numbers, etc.)
      const allDivs = await page.$$('div, button, a');
      for (const el of allDivs) {
        const visible = await el.isVisible();
        if (!visible) continue;
        const box = await el.boundingBox();
        if (!box || box.width < 100 || box.height < 40) continue;
        const text = (await el.textContent()).trim();
        // Look for elements that have customer-like info (names, phone numbers, room numbers)
        if (text.length > 20 && text.length < 300 && (text.includes('Room') || text.includes('₹') || text.includes('Check') || /\d{10}/.test(text))) {
          console.log(`  Found potential customer element: "${text.substring(0, 100)}" [${Math.round(box.width)}x${Math.round(box.height)}]`);
          await el.click();
          cardClicked = true;
          results.customerCardClicked = true;
          break;
        }
      }
    }
    
    if (!cardClicked) {
      // Last resort: just click on a grid item
      console.log('Still no card found. Trying all clickable grid items...');
      const clickableElements = await page.$$('div[class*="cursor-pointer"], button, [role="button"]');
      for (const el of clickableElements) {
        const visible = await el.isVisible();
        if (!visible) continue;
        const box = await el.boundingBox();
        if (!box || box.width < 100 || box.height < 50) continue;
        const text = (await el.textContent()).trim();
        // Skip nav/sidebar elements
        if (text.includes('Dashboard') || text.includes('Bill') || text.includes('Cash') || text.includes('Staff') || text.includes('Settings') || text.includes('Reports') || text.includes('Calculator') || text.includes('Table') || text.includes('Item') || text.includes('Toggle') || text.includes('Activity') || text.includes('Admin')) continue;
        
        console.log(`  Clicking: "${text.substring(0, 80)}"`);
        await el.click();
        cardClicked = true;
        results.customerCardClicked = true;
        break;
      }
    }

    // === STEP 7: Wait and screenshot customer detail ===
    console.log('=== STEP 7: Customer detail view ===');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test4.png', fullPage: true });
    console.log('Screenshot 4 saved');
    
    pageText = await page.textContent('body');
    results.customerDetailViewLoaded = pageText.includes('Statement') || pageText.includes('Ledger') || pageText.includes('Transaction') || pageText.includes('Balance') || pageText.includes('Notes') || pageText.includes('Documents') || pageText.includes('Folio');
    console.log(`Customer detail view loaded: ${results.customerDetailViewLoaded}`);
    
    if (pageText.includes('Something went wrong')) {
      results.somethingWentWrong = true;
      console.log('ERROR: "Something went wrong" appeared in detail view!');
    }

    // Re-check isAdmin error
    allErrors = [...consoleErrors, ...pageErrors].join(' ');
    results.isAdminNotDefined = allErrors.includes('isAdmin is not defined');
    console.log(`"isAdmin is not defined" check (step 7): ${results.isAdminNotDefined}`);

    // === STEP 8: Look for Notes button ===
    console.log('=== STEP 8: Looking for Notes button ===');
    
    // List all visible buttons/tabs in the current view
    const allVisibleBtns = await page.$$('button, [role="button"], [role="tab"], a');
    console.log('Visible buttons/tabs:');
    for (const btn of allVisibleBtns) {
      const visible = await btn.isVisible();
      if (!visible) continue;
      const text = (await btn.textContent()).trim();
      if (text.length > 0 && text.length < 50) {
        console.log(`  "${text}"`);
      }
    }

    // Try to find Notes
    const notesSelectors = [
      'button:has-text("Notes")',
      'button:has-text("Add Note")',
      '[role="tab"]:has-text("Notes")',
      'button:has-text("📝")',
      'a:has-text("Notes")',
    ];
    
    for (const sel of notesSelectors) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        console.log(`Found Notes button with selector: ${sel}`);
        results.notesButtonFound = true;
        await btn.click();
        console.log('Clicked Notes button');
        await page.waitForTimeout(3000);
        results.notesDialogOpened = true;
        await page.screenshot({ path: '/home/z/my-project/tool-results/test5a-notes.png', fullPage: true });
        console.log('Screenshot test5a-notes.png saved');
        
        // Check for errors
        const notesText = await page.textContent('body');
        if (notesText.includes('Something went wrong')) {
          results.notesDocErrors = true;
          console.log('ERROR: "Something went wrong" after Notes click!');
        }
        break;
      }
    }

    // Try to find Documents
    const docsSelectors = [
      'button:has-text("Documents")',
      'button:has-text("Docs")',
      '[role="tab"]:has-text("Documents")',
      'button:has-text("📄")',
      'a:has-text("Documents")',
    ];
    
    for (const sel of docsSelectors) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        console.log(`Found Documents button with selector: ${sel}`);
        results.documentsButtonFound = true;
        await btn.click();
        console.log('Clicked Documents button');
        await page.waitForTimeout(3000);
        results.documentsDialogOpened = true;
        await page.screenshot({ path: '/home/z/my-project/tool-results/test5b-docs.png', fullPage: true });
        console.log('Screenshot test5b-docs.png saved');
        
        // Check for errors
        const docsText = await page.textContent('body');
        if (docsText.includes('Something went wrong')) {
          results.notesDocErrors = true;
          console.log('ERROR: "Something went wrong" after Documents click!');
        }
        break;
      }
    }

    // === STEP 9: Final screenshot ===
    console.log('=== STEP 9: Final screenshot ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test5.png', fullPage: true });
    console.log('Screenshot 5 saved');

    // === STEP 10: Collect final results ===
    console.log('=== STEP 10: Final results collection ===');
    await page.waitForTimeout(2000);
    
    results.consoleErrors = [...new Set(consoleErrors)];
    results.pageErrors = [...new Set(pageErrors)];
    results.consoleWarnings = [...new Set(consoleWarnings)];
    
    // Final isAdmin check
    const finalErrors = [...results.consoleErrors, ...results.pageErrors].join('\n');
    results.isAdminNotDefined = finalErrors.includes('isAdmin is not defined');
    
    // Final Something went wrong check
    const finalText = await page.textContent('body');
    results.somethingWentWrong = finalText.includes('Something went wrong');

    // Also check specifically for isAdmin in error page text
    if (finalText.includes('isAdmin is not defined')) {
      results.isAdminNotDefined = true;
      console.log('NOTE: "isAdmin is not defined" also found in page text (rendered as error)');
    }

  } catch (error) {
    console.error('Test error:', error.message);
    results.pageErrors.push(error.message);
  } finally {
    await page.waitForTimeout(1000);
    await browser.close();
  }

  // === REPORT ===
  console.log('\n');
  console.log('='.repeat(70));
  console.log('         CUSTOMER FOLIO TEST REPORT');
  console.log('='.repeat(70));
  console.log('');
  console.log('STEP-BY-STEP RESULTS:');
  console.log('-'.repeat(50));
  console.log(`  [${results.loginPageLoaded ? 'PASS' : 'FAIL'}] Login page loaded`);
  console.log(`  [${results.loginSucceeded ? 'PASS' : 'FAIL'}] Login succeeded`);
  console.log(`  [${results.customerFolioNavigated ? 'PASS' : 'FAIL'}] Customer Folio navigated`);
  console.log(`  [${results.customerCardClicked ? 'PASS' : 'FAIL'}] Customer card clicked`);
  console.log(`  [${results.customerDetailViewLoaded ? 'PASS' : 'FAIL'}] Customer detail view loaded`);
  console.log(`  [${results.notesButtonFound ? 'PASS' : 'FAIL'}] Notes button found`);
  console.log(`  [${results.notesDialogOpened ? 'PASS' : 'FAIL'}] Notes dialog opened`);
  console.log(`  [${results.documentsButtonFound ? 'PASS' : 'FAIL'}] Documents button found`);
  console.log(`  [${results.documentsDialogOpened ? 'PASS' : 'FAIL'}] Documents dialog opened`);
  console.log('');
  console.log('KEY CHECKS:');
  console.log('-'.repeat(50));
  console.log(`  "Something went wrong" appears:    ${results.somethingWentWrong ? '❌ YES - BUG!' : '✅ NO'}`);
  console.log(`  "isAdmin is not defined" error:     ${results.isAdminNotDefined ? '❌ YES - BUG!' : '✅ NO'}`);
  console.log(`  Notes/Documents errors:             ${results.notesDocErrors ? '❌ YES - BUG!' : '✅ NO'}`);
  console.log('');
  
  if (results.consoleErrors.length > 0) {
    console.log('CONSOLE ERRORS:');
    console.log('-'.repeat(50));
    results.consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  } else {
    console.log('CONSOLE ERRORS: None');
  }
  console.log('');
  
  if (results.pageErrors.length > 0) {
    console.log('PAGE ERRORS:');
    console.log('-'.repeat(50));
    results.pageErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 200)}`));
  } else {
    console.log('PAGE ERRORS: None');
  }
  console.log('');
  
  if (results.consoleWarnings.length > 0) {
    console.log(`CONSOLE WARNINGS (${results.consoleWarnings.length}):`);
    console.log('-'.repeat(50));
    results.consoleWarnings.slice(0, 15).forEach((w, i) => console.log(`  ${i + 1}. ${w.substring(0, 200)}`));
    if (results.consoleWarnings.length > 15) console.log(`  ... and ${results.consoleWarnings.length - 15} more`);
  } else {
    console.log('CONSOLE WARNINGS: None');
  }
  console.log('');
  console.log('SCREENSHOTS:');
  console.log('-'.repeat(50));
  console.log('  test1.png            - Login page');
  console.log('  test2.png            - After login (dashboard)');
  console.log('  test3.png            - Customer Folio section');
  console.log('  test4.png            - Customer detail view');
  console.log('  test5.png            - Final state');
  console.log('  test5a-notes.png      - Notes view (if found)');
  console.log('  test5b-docs.png      - Documents view (if found)');
  console.log('='.repeat(70));
  
  if (results.somethingWentWrong || results.isAdminNotDefined) {
    process.exit(1);
  }
})();
