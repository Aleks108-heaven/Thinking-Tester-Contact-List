# Getting Started - Automated Test Suite

## 5-Minute Quick Start

### Step 1: Install

```bash
npm install
npx playwright install --with-deps
```

### Step 2: Run Tests

```bash
npm test
```

### Step 3: View Results

```bash
npm run report
```

Done! ✅

---

## What Just Happened?

You ran ~70 automated tests covering:

- ✅ User registration (sign up)
- ✅ User login
- ✅ User logout
- ✅ Contact CRUD (create, read, update, delete)
- ✅ Security tests (unauthorized access, IDOR attacks)
- ✅ Data validation (missing fields, invalid emails)
- ✅ Error handling (graceful failures)

Each test includes a comment explaining **why** it exists (what vulnerability or defect it catches).

---

## Understanding the Results

### Test Passed ✅

```
PASS  tests/api/auth.spec.ts
  ✓ AUTH-REG-01: Successful registration with valid data
  ✓ AUTH-LOG-01: Successful login returns JWT token
  ...
```
Good news — the app is working as expected for that test case.

### Test Failed ❌

```
FAIL  tests/api/auth.spec.ts
  ✗ AUTH-REG-06: Registration rejects duplicate email
    Expected: 400
    Received: 200
```
The test expected the app to reject a duplicate email (status 400), but it accepted it (status 200). This indicates a bug or API contract mismatch.

### Skipped ⊘

```
⊘ LOGOUT-SEC-04: Old token no longer works for API calls (architectural verification)
```
Some tests are informational. They'll pass regardless, but provide important findings about how the app works.

---

## Test Organization

### API Tests (`tests/api/`)

- **auth.spec.ts** - Registration, login, logout, tokens
- **contacts.spec.ts** - CRUD operations, IDOR (authorization), data validation

→ Faster, more reliable, test server-side logic directly

### UI Tests (`tests/ui/`)

- **registration.spec.ts** - Sign-up form, validation messages, redirects
- **login.spec.ts** - Login form, error handling, session storage
- **logout.spec.ts** - Logout button, session cleanup, back button behavior

→ Slower (use real browser), test user experience

---

## Useful Commands

```bash
# Run all tests
npm test

# Run only API tests (faster)
npm run test:api

# Run only UI tests
npm run test:ui-suite

# Run with browser visual mode (watch tests run)
npm run test:ui

# Debug: Step through code line by line
npm run test:debug

# View previous test report
npm run report

# Run specific test file
npx playwright test tests/api/auth.spec.ts

# Run tests matching a pattern
npx playwright test -g "IDOR"

# Run a single test by name
npx playwright test -g "AUTH-REG-01"
```

---

## If Tests Fail

### Common Failures & Fixes

**❌ Timeout (waiting for element)**
```
Error: Waiting for selector 'input[name="email"]' failed
```
→ The element doesn't exist or the page structure changed

- Check live app at https://thinking-tester-contact-list.herokuapp.com/
- Update selector in test file

**❌ Duplicate email error**
```
Error: Email address is already in use
```
→ Test data collision (another tester used same email)

- Normal on shared public app; tests automatically generate unique emails now
- If it still fails, wait 5 minutes and re-run

**❌ 401 Unauthorized**
```
Expected: 200
Received: 401
```
→ Token missing or expired

- Check that login succeeded before this test
- If you manually ran tests with old token, clear browser storage and re-run

**❌ Network error**
```
Error: connect ECONNREFUSED
```
→ App is down or unreachable

- Check: https://thinking-tester-contact-list.herokuapp.com/
- Heroku app may need to "wake up" after inactivity

---

## Key Concepts

### Why Unique Emails?

This app is a **public shared environment**. Thousands of testers use it.

❌ DON'T hardcode: `qa@test.com`
✅ DO use dynamic: `qa.test.1722609834123@test.com`

Every test automatically generates unique emails based on current timestamp.

### What's Tested?

- **Happy path** (should work): User signs up, logs in, creates contact
- **Negative path** (should fail): User tries to sign up with invalid email, login with wrong password
- **Security** (should prevent): User tries to access another user's data, exploit SQL injection
- **Boundaries** (edge cases): Very long input, missing fields, type mismatches

### Risk Categories

Each test checks for a specific **defect class**:

| Type | Risk | Example |
|------|------|---------|
| **Security** | Unauthorized access, data theft | IDOR: User A accessing User B's contact |
| **Authentication** | Wrong user logged in, bypass | SQL injection in login field |
| **Validation** | Bad data accepted | Email with no @ symbol accepted |
| **Authorization** | Access control failure | Protected page viewable without login |
| **Boundaries** | Crashes on edge cases | 5000-character string causes 500 error |

---

## Learning Path

### Day 1: Understand the App

1. **Visit:** https://thinking-tester-contact-list.herokuapp.com/
2. **Try it:** Register an account, create a contact, log out
3. **Note:** What works? What error messages do you see?

### Day 2: Read the Test Code

1. Open `tests/api/auth.spec.ts`
2. Read the first test: `AUTH-REG-01`
3. Each test has:
   - **Title** - what it's testing
   - **Comment** - why it matters
   - **Steps** - what it does
   - **Assertions** - expected results

### Day 3: Run Tests & Fix Failures

1. Run: `npm test`
2. Find a failing test
3. Read the failure message carefully
4. Understand **why** it failed
5. Check live app to see real behavior
6. Update test assumptions in `API_CONTRACT_ASSUMPTIONS.md`

### Day 4: Write Your Own Test

1. Copy an existing test as template
2. Choose a new test case (e.g., "Contact with special characters")
3. Write the test following the pattern
4. Run it
5. Make it pass

### Day 5: Review & Refactor

1. Check test code for clarity
2. Add helpful comments
3. Look for duplicate code (refactor helpers)
4. Verify all tests still pass

---

## File Roadmap

| File | Purpose | Start Here? |
|------|---------|-----------|
| `tests/fixtures/testData.ts` | Dynamic test data generators | Yes — understand how test emails/contacts are created |
| `tests/fixtures/apiClient.ts` | Reusable API helper methods | Yes — understand the API client wrapper |
| `tests/api/auth.spec.ts` | Registration/login tests | Yes — read 3-4 tests to see pattern |
| `tests/api/contacts.spec.ts` | CRUD tests, IDOR tests | Yes (especially IDOR-01 for security) |
| `tests/ui/registration.spec.ts` | Sign-up form tests | Skim — similar patterns to API tests |
| `API_CONTRACT_ASSUMPTIONS.md` | What assumptions are made about the API | Check here if test fails unexpectedly |
| `playwright.config.ts` | Test configuration | Only edit if you need to change timeouts, parallelization, etc. |

---

## Before You Run Tests in CI (GitHub Actions)

1. **Verify API assumptions:** Run through checklist in `API_CONTRACT_ASSUMPTIONS.md`
2. **Test locally first:** `npm test` on your machine
3. **Commit & push:** To a feature branch
4. **Workflow runs automatically** → Check Actions tab for results
5. **Review failures:** Click on failed test for details

---

## Troubleshooting

**Q: "Dependency not found"**
```bash
npm install
npx playwright install --with-deps
```

**Q: "Timeout waiting for navigation"**

- App is slow (shared environment)
- Edit timeout in `playwright.config.ts`: change `timeout: 60000` to higher value

**Q: "Test passes locally but fails in CI"**

- CI runs on Linux (you're on Mac/Windows)
- Different environment, slight timing differences
- Add `.toBeVisible({ timeout: 10000 })` to assert wait time
- Consider test flakiness; run locally multiple times

**Q: "How do I update a test?"**

- Edit file, save, re-run `npm test`
- Playwright watches for changes (no rebuild needed)

**Q: "Can I run just one test?"**
```bash
npx playwright test -g "IDOR-01"
```

**Q: "How do I see the browser?"**
```bash
npm run test:ui
# Opens browser with visual controls (slow-motion available)
```

---

## Security Tests You MUST Pass

These tests check for critical vulnerabilities. If ANY of these fail, it's a serious bug:

1. **IDOR (API-SEC-IDOR-01, IDOR-02, IDOR-03)**
   - User A cannot access User B's contacts
   - If it fails: DATA LEAK vulnerability 🔴

2. **Authentication Enforcement (API-SEC-AUTH-01)**
   - Cannot access /contacts without login token
   - If it fails: UNAUTHORIZED ACCESS vulnerability 🔴

3. **Duplicate Email Rejection (AUTH-REG-06)**
   - Cannot register twice with same email
   - If it fails: DATA INTEGRITY issue 🔴

4. **Wrong Password Rejected (AUTH-LOG-03)**
   - Login fails with incorrect password
   - If it fails: AUTHENTICATION BYPASS 🔴

---

## Next Steps

1. ✅ Run tests: `npm test`
2. ✅ Review results: `npm run report`
3. ✅ Read API assumptions: Open `API_CONTRACT_ASSUMPTIONS.md`
4. ✅ Explore test code: Open `tests/api/auth.spec.ts`
5. ✅ Try modifying a test: Change expected status code, run again, see it fail
6. ✅ Read comments in test files: Each test explains why it exists
7. ✅ Plan: What new test would be valuable? (Email with + alias, concurrent requests, etc.)

---

## Resources

- **Playwright Docs:** https://playwright.dev/
- **API Testing:** https://playwright.dev/docs/api-testing
- **ISTQB Test Design:** Google "ISTQB equivalence partitioning boundary value analysis"
- **OWASP API Security:** https://owasp.org/www-project-api-security/
- **Common Vulnerabilities:** OWASP Top 10 Web Application Security Risks

---

## Questions?

Read the **inline comments** in test files. Each test has:
```typescript
/**
 * AUTH-REG-01: Successful user registration with valid data
 * Risk: Ensure basic happy path works
 * Why: If this fails, nothing else will work
 * Covers: Happy path, positive test, ISTQB equivalence partitioning
 */
test('successful registration...', async () => {
```

---

**Happy testing! 🚀**

*Last updated: 2026-08-03*
