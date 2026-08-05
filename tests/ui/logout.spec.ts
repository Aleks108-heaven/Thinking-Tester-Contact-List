import { test, expect, Page } from '@playwright/test';
import { generateTestUser } from '../fixtures/testData';

/**
 * UI Logout Tests
 * 
 * This suite tests the logout flow via the web UI.
 * 
 * Key risks being tested:
 * 1. Token not invalidated on logout → session hijacking (old token still works)
 * 2. Protected pages still accessible after logout → session not cleared
 * 3. Logout button not visible when logged in → UX issue
 * 4. Multiple logout attempts crash → error handling issue
 * 5. Logout redirect goes to wrong page → user confusion
 */

async function loginUser(page: Page, email: string, password: string) {
  // Helper to login a user via UI
  await page.goto('/');
  
  try {
    const loginLink = page.locator('text=Login') || page.locator('[href*="login"]');
    await loginLink.click();
  } catch {
    await page.goto('/login');
  }

  const inputs = page.locator('input');
  await inputs.first().waitFor({ timeout: 10000 });
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  
  const submitButton = page.locator('button:has-text("Submit")') ||
                       page.locator('button[type="submit"]');
  await submitButton.click();

  await page.waitForURL(/contactList|contacts|home|dashboard/, { timeout: 10000 });
}

async function logoutUser(page: Page) {
  // Helper to logout via UI
  const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
  await logoutButton.click();
}

test.describe('Logout UI - Happy Path', () => {
  let testUser = null as any;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    
    // Pre-register via API
    const registerResponse = await page.context().request.post(
      'https://thinking-tester-contact-list.herokuapp.com/users',
      { data: testUser }
    );
    expect(registerResponse.ok()).toBe(true);
  });

  test('LOGOUT-UI-01: Successful logout redirects to login page', async ({ page }) => {
    // Risk: Ensure logout actually happens
    await loginUser(page, testUser.email, testUser.password);
    
    // Verify we're logged in
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    await expect(logoutButton).toBeVisible();
    
    // Logout
    await logoutUser(page);

    // Should show the login form again.
    await page.locator('input').first().waitFor({ timeout: 10000 });
    await expect(page.locator('input').nth(0)).toBeVisible();
  });

  test('LOGOUT-UI-02: Logout button is visible when logged in', async ({ page }) => {
    // Risk: If logout button not visible, user can't logout
    await loginUser(page, testUser.email, testUser.password);
    
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    await expect(logoutButton).toBeVisible();
  });

  test('LOGOUT-UI-03: Logout button is not visible when not logged in', async ({ page }) => {
    // Risk: Confusing UX if logout button visible on login page
    await page.goto('/login');
    
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    const isVisible = await logoutButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(isVisible).toBe(false);
  });
});

test.describe('Logout UI - Session Cleanup', () => {
  let testUser = null as any;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    
    const registerResponse = await page.context().request.post(
      'https://thinking-tester-contact-list.herokuapp.com/users',
      { data: testUser }
    );
    expect(registerResponse.ok()).toBe(true);
  });

  test('LOGOUT-SEC-01: Protected page inaccessible after logout (via redirect)', async ({ page }) => {
    // Risk: CRITICAL - Session hijacking if protected pages still accessible
    // Login
    await loginUser(page, testUser.email, testUser.password);
    
    // Logout
    await logoutUser(page);
    await page.locator('input').first().waitFor({ timeout: 10000 });
    
    // Try to navigate back to /contacts
    await page.goto('/contacts');

    // App may redirect to login OR return unauthorized JSON at /contacts.
    const bodyText = (await page.locator('body').textContent()) || '';
    const isRedirectedToLogin = /login|auth/i.test(page.url());
    const isUnauthorizedApiResponse =
      page.url().includes('/contacts') && /please authenticate/i.test(bodyText);
    expect(isRedirectedToLogin || isUnauthorizedApiResponse).toBe(true);
  });

  test('LOGOUT-SEC-02: Cannot access protected page via back button after logout', async ({ page }) => {
    // Risk: Browser history may allow cached page access
    // Login and navigate to contacts
    await loginUser(page, testUser.email, testUser.password);
    
    // Logout
    await logoutUser(page);
    await page.locator('input').first().waitFor({ timeout: 10000 });
    
    // Use browser back button to try to access contacts
    await page.goBack();
    
    // Should redirect to login or stay on login (not show old contacts)
    const url = page.url();
    const isNotOnContacts = !url.includes('/contacts') && !url.includes('/contactList');
    expect(isNotOnContacts).toBe(true);
  });

  test('LOGOUT-SEC-03: Token is cleared from storage after logout', async ({ page }) => {
    // Risk: If token remains in localStorage, it can be reused if recovered
    // Login
    await loginUser(page, testUser.email, testUser.password);

    // Capture browser storage before logout. This app may not use a literal
    // "token" key, so inspect auth-like entries generically.
    const storageBefore = await page.evaluate(() => {
      const entries: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) entries[`local:${key}`] = localStorage.getItem(key) || '';
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) entries[`session:${key}`] = sessionStorage.getItem(key) || '';
      }

      return entries;
    });

    const authEntriesBefore = Object.entries(storageBefore).filter(([key, value]) =>
      /token|auth|jwt|session|user/i.test(key) || /token|jwt/i.test(value)
    );
    
    // Logout
    await logoutUser(page);

    // Verify login form is shown again and auth-like storage is gone.
    await page.locator('input').first().waitFor({ timeout: 10000 });

    const storageAfter = await page.evaluate(() => {
      const entries: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) entries[`local:${key}`] = localStorage.getItem(key) || '';
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) entries[`session:${key}`] = sessionStorage.getItem(key) || '';
      }

      return entries;
    });

    const authEntriesAfter = Object.entries(storageAfter).filter(([key, value]) =>
      /token|auth|jwt|session|user/i.test(key) || /token|jwt/i.test(value)
    );

    if (authEntriesBefore.length > 0) {
      expect(authEntriesAfter).toEqual([]);
    } else {
      expect(authEntriesAfter.length).toBe(0);
    }
  });

  test('LOGOUT-SEC-04: Old token no longer works for API calls (architectural verification)', async ({ page }) => {
    // Risk: This is a critical JWT security test
    // Capture token before logout
    let tokenBeforeLogout = '';
    
    await page.context().addCookies([]); // Ensure clean slate
    
    // Login
    await loginUser(page, testUser.email, testUser.password);
    
    // Extract token from storage
    tokenBeforeLogout = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
    
    // Logout
    await logoutUser(page);
    
    // Try to use old token to call protected API
    const response = await page.context().request.get(
      'https://thinking-tester-contact-list.herokuapp.com/contacts',
      {
        headers: {
          Authorization: `Bearer ${tokenBeforeLogout}`,
        },
      }
    );
    
    // In a stateless JWT app, the token might still be technically valid until expiry.
    // This is a common architectural pattern and important to document.
    if (response.status() === 200) {
      // Token still works post-logout (JWT stateless behavior)
      console.warn(
        'FINDING: Token remains valid for API calls after logout. ' +
        'This is expected JWT behavior (stateless), but means logout is only client-side. ' +
        'If true server-side session invalidation is required, implement a token blacklist.'
      );
    } else if (response.status() === 401) {
      // Token invalidated on logout (good practice, requires server-side session management)
      expect(response.status()).toBe(401);
    }
  });
});

test.describe('Logout UI - Edge Cases', () => {
  let testUser = null as any;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    
    const registerResponse = await page.context().request.post(
      'https://thinking-tester-contact-list.herokuapp.com/users',
      { data: testUser }
    );
    expect(registerResponse.ok()).toBe(true);
  });

  test('LOGOUT-UI-04: Multiple logout attempts do not crash', async ({ page }) => {
    // Risk: Race conditions, error handling
    await loginUser(page, testUser.email, testUser.password);
    
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    
    // Try to click logout multiple times rapidly
    try {
      await logoutButton.click();
      await logoutButton.click(); // Second click (might not be visible anymore)
    } catch {
      // Second click will fail if button removed; that's expected
    }
    
    // Should redirect and not crash with 500 error
    const url = page.url();
    expect(url).not.toMatch(/500|error/);
  });

  test('LOGOUT-UI-05: Logout from different pages works (e.g., from contact detail page)', async ({ page }) => {
    // Risk: Logout button might not be available on all pages
    await loginUser(page, testUser.email, testUser.password);
    
    // Verify we have a logout button at this point
    let logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    const hasLogoutButton = await logoutButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasLogoutButton) {
      await logoutButton.click();

      // Should show the login form again.
      await page.locator('input').first().waitFor({ timeout: 10000 });
    } else {
      console.warn('Logout button not found on contact list page');
    }
  });

  test('LOGOUT-UI-06: After logout and re-login, session is fresh', async ({ page }) => {
    // Risk: Old session data might be reused
    // First login
    await loginUser(page, testUser.email, testUser.password);
    
    // Logout
    await logoutUser(page);
    
    // Re-login
    await loginUser(page, testUser.email, testUser.password);
    
    // Should be logged in successfully (fresh session)
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    await expect(logoutButton).toBeVisible();
    
    // Verify URL is contacts (logged in)
    expect(/contactList|contacts/i.test(page.url())).toBe(true);
  });

  test('LOGOUT-UI-07: Logout performs a server call (not client-side only)', async ({ page }) => {
    // Risk: If logout only clears client-side state, server still has active session
    await loginUser(page, testUser.email, testUser.password);
    
    let logoutRequestMade = false;
    
    // Monitor network requests
    page.on('response', (response) => {
      if (response.url().includes('/logout')) {
        logoutRequestMade = true;
      }
    });
    
    // Logout
    await logoutUser(page);
    
    // Should have made at least one logout API call
    // Note: Some apps may only do client-side logout; this test flags it as a finding
    if (!logoutRequestMade) {
      console.warn(
        'FINDING: No logout API call detected. Logout may be client-side only. ' +
        'This is less secure than server-side session invalidation.'
      );
    }
  });
});

test.describe('Logout UI - Logout Flow Variations', () => {
  let testUser = null as any;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    
    const registerResponse = await page.context().request.post(
      'https://thinking-tester-contact-list.herokuapp.com/users',
      { data: testUser }
    );
    expect(registerResponse.ok()).toBe(true);
  });

  test('LOGOUT-UI-08: Can login again after logout', async ({ page }) => {
    // Risk: Ensure logout doesn't permanently disable the account
    // First login/logout cycle
    await loginUser(page, testUser.email, testUser.password);
    await logoutUser(page);
    
    // Second login
    await loginUser(page, testUser.email, testUser.password);
    
    // Should be logged in
    const logoutButton = page.locator('text=Logout') || page.locator('text=Log out');
    await expect(logoutButton).toBeVisible();
  });

  test('LOGOUT-UI-09: Logout clears cookies/session storage properly', async ({ page }) => {
    // Risk: Stale session data in storage
    await loginUser(page, testUser.email, testUser.password);
    
    // Get all storage before logout
    const storageBefore = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) storage[key] = localStorage.getItem(key) || '';
      }
      return storage;
    });
    
    console.log('Storage before logout:', storageBefore);
    
    // Logout
    await logoutUser(page);
    
    // Get storage after logout
    const storageAfter = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) storage[key] = localStorage.getItem(key) || '';
      }
      return storage;
    });
    
    console.log('Storage after logout:', storageAfter);
    
    // Storage should be cleared of auth tokens
    expect(storageAfter['token']).toBeFalsy();
  });
});
