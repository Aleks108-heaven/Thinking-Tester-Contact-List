# Thinking Tester Contact List - Automated Test Suite

This project was developed with assistance from Claude using the Manual_QA_LLM_MCP. The Manual_QA_LLM_MCP itself was also created with Claude. GitHub Copilot in Visual Studio Code was used to assist with code generation and editing.

A comprehensive Playwright-based automated test suite for the Thinking Tester Contact List practice application. This suite includes UI tests and API tests following ISTQB-aligned test design principles.

## Project Structure

```
.
├── tests/
│   ├── api/
│   │   ├── auth.spec.ts           # User registration, login, logout, token validation
│   │   └── contacts.spec.ts       # CRUD operations, IDOR, authorization tests
│   ├── ui/
│   │   ├── registration.spec.ts   # Registration flow UI tests
│   │   ├── login.spec.ts          # Login flow UI tests
│   │   └── logout.spec.ts         # Logout flow and session management
│   └── fixtures/
│       ├── testData.ts             # Dynamic test data generators (emails, contacts, payloads)
│       └── apiClient.ts            # Reusable authenticated API client
├── playwright.config.ts            # Playwright configuration
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
└── .github/workflows/tests.yml     # GitHub Actions CI/CD pipeline
```

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all tests (UI + API)
npm test

# Run only API tests
npm run test:api

# Run only UI tests
npm run test:ui-suite

# Run with UI mode (visual browser)
npm run test:ui

# Run with debug mode (step through code)
npm run test:debug

# View HTML report of last run
npm run report
```

## Test Suites Overview

### API Tests

#### `tests/api/auth.spec.ts` - Authentication

Tests user registration, login, logout, and token validation.

**Key test cases:**

- ✅ Successful registration with valid data
- ❌ Duplicate email rejection (prevents account confusion)
- ❌ Missing required fields (data integrity)
- ❌ Password below minimum length (security)
- ❌ SQL injection in login (authentication bypass prevention)
- ❌ Invalid email format (data quality)
- ✅ JWT token structure validation (no sensitive data in token)
- ❌ Protected endpoints without auth (authorization bypass prevention)
- ❌ IDOR attempts (cross-user data leakage prevention)

**Why these tests matter:**

- Weak authentication is the #1 vulnerability in web applications
- Injection attacks can bypass login entirely
- Missing server-side validation allows client-side bypass

#### `tests/api/contacts.spec.ts` - CRUD Operations

Tests create, read, update, delete operations on contacts.

**Key test cases:**

- ✅ Create contact with all fields
- ✅ Create contact with minimal fields
- ❌ Missing required fields (data integrity)
- ❌ Invalid email in contact (data quality)
- ✅ List all user's contacts
- ✅ Retrieve single contact by ID
- ✅ Update existing contact
- ✅ Delete contact (verify removal)
- **🔴 IDOR Check (CRITICAL):** User A cannot access User B's contact (OWASP API Security #1)
- ❌ Very long string in field (buffer overflow, DB limits)
- ❌ Invalid data types (type confusion)
- ✅ Volume test: Create 11 contacts, verify uniqueness
- ❌ Unauthenticated requests (401 enforcement)

**Cleanup:** All created contacts are deleted in `afterEach` to avoid data pollution in shared environment.

### UI Tests

#### `tests/ui/registration.spec.ts` - Registration Flow

Tests the sign-up form and registration process.

**Key test cases:**

- ✅ Successful registration
- ❌ Missing first name
- ❌ Missing email
- ❌ Missing password
- ❌ Invalid email format
- ❌ Password below minimum length
- ❌ Duplicate email (specific error message)
- ❌ XSS payload in first name (input sanitization)
- ✅ Form validation error messages display
- ✅ Redirect to contact list on success

#### `tests/ui/login.spec.ts` - Login Flow

Tests the login form and authentication.

**Key test cases:**

- ✅ Successful login with valid credentials
- ❌ Wrong password (generic error, not "password incorrect")
- ❌ Unregistered email (no user enumeration)
- ❌ Missing email/password fields
- ✅ Password field is masked (type="password")
- ✅ Protected pages redirect to login when not authenticated
- ❌ Multiple failed login attempts (brute force check)
- ✅ Token stored after login (session persistence)
- ✅ Token not visible in URL (no accidental leaks)

#### `tests/ui/logout.spec.ts` - Logout & Session Management

Tests logout functionality and session cleanup.

**Key test cases:**

- ✅ Successful logout redirects to login
- ✅ Logout button visible when logged in
- ✅ Token cleared from storage after logout
- ❌ Protected pages inaccessible after logout
- ❌ Cannot access cached page via browser back button
- **🔴 Token validation:** Verify old token doesn't work for API calls (architectural finding)
- ✅ Can re-login after logout
- ✅ Multiple logout attempts don't crash

## Critical Security Tests

The following tests are marked as **CRITICAL** and must pass:

### 1. **IDOR (Insecure Direct Object Reference)** - `API-SEC-IDOR-*`

- User B cannot access User A's contact by ID
- User B cannot update User A's contact
- User B cannot delete User A's contact
- This is OWASP API Security Top 10 #1

### 2. **Authentication Enforcement** - `API-SEC-AUTH-*`

- Unauthenticated requests to protected endpoints return 401
- Invalid/malformed tokens rejected with 401
- Token required for all protected operations

### 3. **Session Isolation** - `LOGIN-SEC-*`, `LOGOUT-SEC-*`

- Protected pages inaccessible after logout
- Old token doesn't work after logout
- Multiple users can't interfere with each other

## Test Data & Environment Considerations

### Why Dynamic Emails?

This app is a **public, shared demo environment**. Thousands of testers use it daily. **NEVER hardcode test email addresses** like `qa@test.com` because other testers will have created accounts with those emails, causing "duplicate email" failures.

**Solution:** All tests use dynamically generated emails based on timestamps:

```typescript
// Example output: qa.test.1722609834123@test.com
const email = generateUniqueEmail();
```

This ensures:

- ✅ Zero collision risk even with concurrent testers
- ✅ Every test run uses unique data
- ✅ Cleanup is guaranteed (can delete everything at end of run)

### Password Policy

All tests use `Passw0rd1!` which meets typical app requirements:

- ✅ 7+ characters
- ✅ Mix of uppercase and lowercase
- ✅ At least one number
- ✅ At least one special character

**If tests fail on password validation:**
Verify the actual password policy via the live Swagger docs or by examining error messages in a failed test run.

## API Contract Assumptions

The following assumptions are made about the API. **Verify these against the live Swagger documentation before fully trusting the suite:**

| Item | Assumption | How to Verify |
| ------ | ----------- | --------------- |
| **Password Min Length** | 7 characters | Check `/users` POST endpoint docs or error message |
| **Required User Fields** | firstName, lastName, email, password | Try POST /users with minimal fields |
| **Required Contact Fields** | firstName, lastName (others optional) | Try POST /contacts with minimal fields |
| **Email Validation** | RFC 5321 format (<user@domain.ext>) | Try invalid formats in test |
| **Status Codes** | 201 for create, 200 for read/update, 404 for not found, 401 for unauthorized | Check actual responses |
| **Auth Header Format** | `Authorization: Bearer <token>` | Check login response structure |
| **JWT Claims** | Token contains iat, exp, userId (no password) | Decode token with `base64url` decoder |
| **IDOR Prevention** | Contacts scoped to user; 404 when accessing other user's contact | Run IDOR tests |
| **Logout Behavior** | Stateless JWT (token remains valid until exp) or server-side invalidation | Try using old token after logout |

## Test Defect Classifications

Tests are organized by the **type of defect they catch**. Understanding this helps you learn QA testing:

### Security Defects

- **Authentication bypass:** SQL injection, weak password validation
- **Authorization bypass:** IDOR, accessing other users' data
- **Injection attacks:** XSS, SQL injection in input fields
- **Session hijacking:** Expired tokens still accepted, logout ineffective

### Functional Defects

- **Missing validation:** Fields with no validation
- **Incorrect logic:** Wrong redirect, wrong status code
- **Data integrity:** Duplicate emails allowed, lost data on update

### Boundary Defects

- **Off-by-one errors:** Min password length off by one character
- **Field length limits:** Very long input not handled gracefully
- **Overflow conditions:** 500 error instead of graceful rejection

### UX Defects

- **Poor error messages:** Generic vs. specific (enables enumeration)
- **Missing feedback:** No loading spinner, button still enabled during submit
- **Wrong navigation:** Redirect to wrong page after action

## Running in CI/CD

The GitHub Actions workflow (`.github/workflows/tests.yml`) automatically:

1. Runs tests on push to `main` or `develop`
2. Runs tests on all pull requests
3. Generates HTML and JUnit reports
4. Uploads artifacts for 30 days
5. Comments on PRs with test results

To manually trigger:

1. Go to GitHub → Actions → "Automated Test Suite"
2. Click "Run workflow" → Select branch → "Run workflow"

## Troubleshooting

### Test Timeout

The app is shared and sometimes slow. If tests timeout:

- Increase timeout in `playwright.config.ts` (default 60s per test)
- Check Heroku app status: <https://thinking-tester-contact-list.herokuapp.com/>

### "Duplicate email" Errors

This means test data from a previous run is still in the database. Options:

1. Wait a few minutes (other testers' data gets overwritten)
2. Use a different test email (generator already does this)
3. Pre-cleanup: Delete old test accounts via direct DB access (if available)

### "404 Not Found" on Contact Retrieval

Possible causes:

- Contact ID is wrong
- Wrong user context (trying to access another user's contact)
- Contact was deleted in a previous step

### "401 Unauthorized"

Missing or invalid token. Verify:

- User logged in successfully
- Token is present in `api.getToken()`
- Token format is valid JWT (3 parts separated by dots)
- Token not corrupted during transmission

## Learning Resources

This test suite is designed as a **learning tool** for junior QA engineers. Each test includes:

- **Why it exists:** The risk/defect class it catches
- **How it works:** Step-by-step explanation
- **What to look for:** Expected results and failure modes

### Recommended Learning Path

1. **Start with API auth tests** (`auth.spec.ts`)
   - Understand happy path (registration → login → token)
   - Learn why missing validation is bad (REG-03, REG-04)
   - See why injection attacks matter (REG-10)

2. **Then move to IDOR tests** (contacts API, `API-SEC-IDOR-*`)
   - This is the most common and critical API vulnerability
   - Understand cross-user data isolation
   - See how a simple ID guess can leak private data

3. **Finally UI tests** (registration, login, logout)
   - Verify client-side matches server-side
   - Understand UX implications of validation
   - Learn session management

## Common Test Patterns

### Pattern 1: Happy Path + Negative Tests

```typescript
// Happy path: should succeed
test('should create contact', async () => {
  const response = await api.createContact(validData);
  expect(response.status()).toBe(201);
});

// Negative: missing required field
test('should reject contact without firstName', async () => {
  const response = await api.createContact({ ...validData, firstName: undefined });
  expect(response.status()).toBe(400);
});
```

### Pattern 2: Security + Functional

```typescript
// Functional: does it work?
test('should accept password at minimum length', async () => {
  const response = await api.post('/users', { ...user, password: '1234567' }); // 7 chars
  expect(response.ok()).toBe(true);
});

// Security: is it secure?
test('should reject password below minimum', async () => {
  const response = await api.post('/users', { ...user, password: '123456' }); // 6 chars
  expect(response.status()).toBe(400);
});
```

### Pattern 3: State Verification

```typescript
// Action: delete contact
await api.deleteContact(contactId);

// Verification: confirm it's gone
const getResponse = await api.getContact(contactId);
expect(getResponse.status()).toBe(404);
```

## Maintenance & Updates

### Adding New Tests

1. Determine which suite it belongs to (UI/API, auth/contacts)
2. Follow the naming convention: `TEST-CATEGORY-##: Description`
3. Include a comment explaining the risk it catches
4. Add cleanup in `afterEach` if creating data
5. Update this README with the new test

### Updating for API Changes

If the API contract changes:

1. Update assumptions in this README
2. Modify test expectations to match new behavior
3. Mark breaking changes in git commit message
4. Re-run full suite to identify cascading failures

### Updating for App UI Changes

If selectors break:

1. Find new selectors using `page.locator()` debugging
2. Update the helper functions (e.g., `navigateToSignUp`)
3. Re-run UI tests to verify

## Contact & Questions

For questions about specific tests, check:

1. The test file's inline comments (each test has a "Why" section)
2. The `testData.ts` file for data generation logic
3. The `apiClient.ts` file for API helper methods

## License

MIT - Feel free to use and modify for learning purposes.

---

**Last Updated:** 2026-08-03
**Playwright Version:** 1.48.0+
**Node Version:** 18.0.0+
