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
    sidebarVisible: false,
    customerFolioLinkFound: false,
    customerFolioLoaded: false,
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
    // === STEP A: Open localhost:3000 ===
    console.log('=== STEP A: Opening http://localhost:3000 ===');
    // Try with load first, then networkidle
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3000); // Wait for JS hydration
    } catch (e) {
      console.log('First attempt failed, retrying...');
      await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3000);
    }
    results.loginPageLoaded = true;
    console.log('Login page loaded successfully');
    
    // === STEP B: Screenshot 1 ===
    await page.screenshot({ path: '/home/z/my-project/tool-results/test1.png', fullPage: true });
    console.log('Screenshot 1 saved: test1.png');

    // === STEP C: Fill login form ===
    console.log('=== STEP C: Filling login form ===');
    
    // Find Client ID input
    const clientIdInput = await page.$('input[name="clientId"], input[placeholder*="Client"], input[id*="client"]');
    if (clientIdInput) {
      await clientIdInput.fill('FD001');
      console.log('Filled Client ID: FD001');
    } else {
      // Try by label
      const allInputs = await page.$$('input');
      console.log(`Found ${allInputs.length} input elements on page`);
      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        const placeholder = await input.getAttribute('placeholder') || '';
        const name = await input.getAttribute('name') || '';
        const id = await input.getAttribute('id') || '';
        const type = await input.getAttribute('type') || '';
        console.log(`  Input ${i}: name="${name}" id="${id}" placeholder="${placeholder}" type="${type}"`);
      }
      
      // Fill first 3 inputs
      if (allInputs.length >= 3) {
        await allInputs[0].fill('FD001');
        await allInputs[1].fill('admin');
        await allInputs[2].fill('admin123');
        console.log('Filled 3 inputs: FD001, admin, admin123');
      }
    }
    
    // Only fill individually if we found the clientIdInput
    if (clientIdInput) {
      const userIdInput = await page.$('input[name="userId"], input[name="username"], input[placeholder*="User"]');
      const passwordInput = await page.$('input[name="password"], input[type="password"]');
      
      if (userIdInput) {
        await userIdInput.fill('admin');
        console.log('Filled User ID: admin');
      }
      if (passwordInput) {
        await passwordInput.fill('admin123');
        console.log('Filled Password: admin123');
      }
    }

    // === STEP D: Click submit/login button ===
    console.log('=== STEP D: Clicking login button ===');
    const submitBtn = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign"), button:has-text("Log")');
    if (submitBtn) {
      await submitBtn.click();
      console.log('Clicked login button');
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
      console.log('Pressed Enter to submit');
    }

    // === STEP E: Wait 3 seconds, screenshot 2 ===
    console.log('=== STEP E: Waiting 3 seconds ===');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test2.png', fullPage: true });
    console.log('Screenshot 2 saved: test2.png');
    
    // Check if login succeeded
    const currentUrl = page.url();
    const pageContent = await page.content();
    results.loginSucceeded = !currentUrl.includes('login') || pageContent.includes('Dashboard') || pageContent.includes('sidebar') || pageContent.includes('Customer');
    console.log(`Current URL after login: ${currentUrl}`);
    console.log(`Login succeeded (estimated): ${results.loginSucceeded}`);

    // === STEP F: Look for sidebar and click "Customer Folio" or "Khata" ===
    console.log('=== STEP F: Looking for sidebar and Customer Folio link ===');
    
    // Check for sidebar
    const sidebar = await page.$('[data-sidebar], nav, aside, [class*="sidebar"], [class*="Sidebar"]');
    results.sidebarVisible = !!sidebar;
    console.log(`Sidebar found: ${results.sidebarVisible}`);
    
    // Look for Customer Folio or Khata link
    const folioLink = await page.$('a:has-text("Customer Folio"), button:has-text("Customer Folio"), a:has-text("Khata"), button:has-text("Khata"), a:has-text("Folio"), button:has-text("Folio"), [data-nav*="folio"], [data-nav*="khata"]');
    results.customerFolioLinkFound = !!folioLink;
    console.log(`Customer Folio/Khata link found: ${results.customerFolioLinkFound}`);
    
    if (folioLink) {
      await folioLink.click();
      console.log('Clicked Customer Folio/Khata link');
    } else {
      // Try finding by text content in sidebar
      console.log('Folio link not found directly, searching page text...');
      const allLinks = await page.$$('a, button, [role="button"], [role="link"]');
      for (let i = 0; i < allLinks.length; i++) {
        const text = (await allLinks[i].textContent()).trim();
        const visible = await allLinks[i].isVisible();
        if (visible && (text.toLowerCase().includes('folio') || text.toLowerCase().includes('khata'))) {
          console.log(`  Found: "${text}" at index ${i}`);
          results.customerFolioLinkFound = true;
          await allLinks[i].click();
          console.log('Clicked the link');
          break;
        }
      }
      
      if (!results.customerFolioLinkFound) {
        // Dump all visible sidebar items
        console.log('All visible sidebar items:');
        const allSidebarItems = await page.$$('nav a, nav button, aside a, aside button, [class*="sidebar"] a, [class*="sidebar"] button');
        for (let i = 0; i < allSidebarItems.length; i++) {
          const text = (await allSidebarItems[i].textContent()).trim().substring(0, 50);
          const visible = await allSidebarItems[i].isVisible();
          console.log(`  [${visible ? 'V' : 'H'}] "${text}"`);
        }
      }
    }

    // === STEP G: Wait 5 seconds, screenshot 3 ===
    console.log('=== STEP G: Waiting 5 seconds ===');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test3.png', fullPage: true });
    console.log('Screenshot 3 saved: test3.png');

    // === STEP H: Check for "Something went wrong" ===
    console.log('=== STEP H: Checking for "Something went wrong" ===');
    const pageText = await page.textContent('body');
    results.somethingWentWrong = pageText.includes('Something went wrong');
    console.log(`"Something went wrong" found: ${results.somethingWentWrong}`);
    
    // Check for "isAdmin is not defined" in accumulated errors
    const allErrorTexts = [...consoleErrors, ...pageErrors].join(' ');
    results.isAdminNotDefined = allErrorTexts.includes('isAdmin is not defined');
    console.log(`"isAdmin is not defined" in console: ${results.isAdminNotDefined}`);
    
    // Check if Customer Folio section loaded
    results.customerFolioLoaded = pageText.includes('Customer') || pageText.includes('Folio') || pageText.includes('Khata') || pageText.includes('Profile');
    console.log(`Customer Folio section loaded (has relevant text): ${results.customerFolioLoaded}`);

    // === STEP I: Click on customer card ===
    console.log('=== STEP I: Looking for customer card ===');
    // Try various selectors for customer cards
    const cardSelectors = [
      '[class*="card"]', '[class*="Card"]', '[class*="customer"]', '[class*="Customer"]',
      '[class*="profile"]', '[class*="Profile"]', '[class*="grid"] > div', 
      '[data-testid*="customer"]', '[data-testid*="card"]',
      'div[role="button"]', 'div[class*="cursor-pointer"]'
    ];
    
    let cardClicked = false;
    for (const selector of cardSelectors) {
      const cards = await page.$$(selector);
      for (const card of cards) {
        const isVisible = await card.isVisible();
        const box = await card.boundingBox();
        if (isVisible && box && box.width > 50 && box.height > 30) {
          const text = (await card.textContent()).trim().substring(0, 80);
          console.log(`  Found clickable element (${selector}): "${text}" [${box.width}x${box.height}]`);
          await card.click();
          cardClicked = true;
          results.customerCardClicked = true;
          console.log('Clicked customer card');
          break;
        }
      }
      if (cardClicked) break;
    }
    
    if (!cardClicked) {
      console.log('No customer card found. Trying to click on first visible grid item...');
      // Try clicking on any grid item
      const gridItems = await page.$$('div[class*="grid"] > *');
      for (const item of gridItems) {
        const isVisible = await item.isVisible();
        if (isVisible) {
          const text = (await item.textContent()).trim().substring(0, 80);
          console.log(`  Clicking grid item: "${text}"`);
          await item.click();
          results.customerCardClicked = true;
          break;
        }
      }
    }

    // === STEP J: Wait 3 seconds, screenshot 4 ===
    console.log('=== STEP J: Waiting 3 seconds ===');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test4.png', fullPage: true });
    console.log('Screenshot 4 saved: test4.png');
    
    // Check if detail view loaded
    const detailText = await page.textContent('body');
    results.customerDetailViewLoaded = detailText.includes('Statement') || detailText.includes('Ledger') || detailText.includes('Transaction') || detailText.includes('Balance') || detailText.includes('Notes');
    console.log(`Customer detail view loaded: ${results.customerDetailViewLoaded}`);

    // Check again for errors
    const pageText2 = await page.textContent('body');
    if (pageText2.includes('Something went wrong')) {
      results.somethingWentWrong = true;
    }

    // === STEP K: Look for Notes or Documents button ===
    console.log('=== STEP K: Looking for Notes/Documents button ===');
    
    // Re-check console errors at this point
    const currentErrors = [...consoleErrors, ...pageErrors];
    const currentErrorTexts = currentErrors.join(' ');
    results.isAdminNotDefined = currentErrorTexts.includes('isAdmin is not defined');

    // Find Notes button
    const notesBtn = await page.$('button:has-text("Notes"), button:has-text("notes"), [role="tab"]:has-text("Notes"), button:has-text("📝"), button:has-text("Add Note")');
    results.notesButtonFound = !!notesBtn;
    console.log(`Notes button found: ${results.notesButtonFound}`);
    
    if (notesBtn) {
      await notesBtn.click();
      console.log('Clicked Notes button');
      await page.waitForTimeout(2000);
      results.notesDialogOpened = true;
      
      // Check for errors after notes
      const notesPageText = await page.textContent('body');
      results.notesDocErrors = notesPageText.includes('Something went wrong');
      if (results.notesDocErrors) {
        console.log('ERROR: "Something went wrong" appeared after clicking Notes!');
      }
    }

    // Find Documents button
    const docsBtn = await page.$('button:has-text("Documents"), button:has-text("documents"), [role="tab"]:has-text("Documents"), button:has-text("📄"), button:has-text("Docs")');
    results.documentsButtonFound = !!docsBtn;
    console.log(`Documents button found: ${results.documentsButtonFound}`);
    
    if (docsBtn) {
      await docsBtn.click();
      console.log('Clicked Documents button');
      await page.waitForTimeout(2000);
      results.documentsDialogOpened = true;
      
      // Check for errors after documents
      const docsPageText = await page.textContent('body');
      if (docsPageText.includes('Something went wrong')) {
        results.notesDocErrors = true;
        console.log('ERROR: "Something went wrong" appeared after clicking Documents!');
      }
    }
    
    // If neither Notes nor Documents found, try searching for them
    if (!notesBtn && !docsBtn) {
      console.log('Notes/Documents buttons not found directly. Searching...');
      const allButtons = await page.$$('button, [role="button"], [role="tab"]');
      for (let i = 0; i < allButtons.length; i++) {
        const text = (await allButtons[i].textContent()).trim();
        const visible = await allButtons[i].isVisible();
        if (visible && text.length > 0 && text.length < 30) {
          console.log(`  Button: "${text}"`);
        }
      }
    }

    // === STEP L: Wait 2 seconds, screenshot 5 ===
    console.log('=== STEP L: Waiting 2 seconds ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/z/my-project/tool-results/test5.png', fullPage: true });
    console.log('Screenshot 5 saved: test5.png');

    // === STEP M: Final console error check ===
    console.log('=== STEP M: Final console error check ===');
    
    // Wait a bit more for any late errors
    await page.waitForTimeout(2000);
    
    // Collect final state
    results.consoleErrors = [...new Set(consoleErrors)];
    results.pageErrors = [...new Set(pageErrors)];
    results.consoleWarnings = [...new Set(consoleWarnings)];
    
    // Final isAdmin check
    const finalErrorTexts = [...results.consoleErrors, ...results.pageErrors].join('\n');
    results.isAdminNotDefined = finalErrorTexts.includes('isAdmin is not defined');
    
    // Final Something went wrong check
    const finalPageText = await page.textContent('body');
    results.somethingWentWrong = finalPageText.includes('Something went wrong');

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
  console.log(`  [${results.sidebarVisible ? 'PASS' : 'FAIL'}] Sidebar visible`);
  console.log(`  [${results.customerFolioLinkFound ? 'PASS' : 'FAIL'}] Customer Folio/Khata link found`);
  console.log(`  [${results.customerFolioLoaded ? 'PASS' : 'FAIL'}] Customer Folio section loaded`);
  console.log(`  [${results.customerCardClicked ? 'PASS' : 'FAIL'}] Customer card clicked`);
  console.log(`  [${results.customerDetailViewLoaded ? 'PASS' : 'FAIL'}] Customer detail view loaded`);
  console.log(`  [${results.notesButtonFound ? 'PASS' : 'FAIL'}] Notes button found`);
  console.log(`  [${results.notesDialogOpened ? 'PASS' : 'FAIL'}] Notes dialog opened`);
  console.log(`  [${results.documentsButtonFound ? 'PASS' : 'FAIL'}] Documents button found`);
  console.log(`  [${results.documentsDialogOpened ? 'PASS' : 'FAIL'}] Documents dialog opened`);
  console.log('');
  console.log('KEY CHECKS:');
  console.log('-'.repeat(50));
  console.log(`  "Something went wrong" appears:  ${results.somethingWentWrong ? '❌ YES - BUG!' : '✅ NO'}`);
  console.log(`  "isAdmin is not defined" error: ${results.isAdminNotDefined ? '❌ YES - BUG!' : '✅ NO'}`);
  console.log(`  Notes/Documents errors:         ${results.notesDocErrors ? '❌ YES - BUG!' : '✅ NO'}`);
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
    results.pageErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  } else {
    console.log('PAGE ERRORS: None');
  }
  console.log('');
  
  if (results.consoleWarnings.length > 0) {
    console.log('CONSOLE WARNINGS:');
    console.log('-'.repeat(50));
    results.consoleWarnings.slice(0, 10).forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    if (results.consoleWarnings.length > 10) console.log(`  ... and ${results.consoleWarnings.length - 10} more`);
  } else {
    console.log('CONSOLE WARNINGS: None');
  }
  console.log('');
  console.log('SCREENSHOTS:');
  console.log('-'.repeat(50));
  console.log('  test1.png - Login page');
  console.log('  test2.png - After login');
  console.log('  test3.png - Customer Folio section');
  console.log('  test4.png - Customer detail view');
  console.log('  test5.png - Notes/Documents view');
  console.log('='.repeat(70));
  
  // Exit with non-zero if critical errors found
  if (results.somethingWentWrong || results.isAdminNotDefined) {
    process.exit(1);
  }
})();
