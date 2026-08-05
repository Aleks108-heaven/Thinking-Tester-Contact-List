# Complete QA Test Suite — Thinking Tester Contact List App

**Role:** Junior/Middle QA Tester
**Target:** <https://thinking-tester-contact-list.herokuapp.com/>
**API Base URL:** <https://thinking-tester-contact-list.herokuapp.com/>
**Standard:** ISTQB-aligned test design (Equivalence Partitioning, Boundary Value Analysis, Decision Tables, State Transition, Error Guessing)

---

## 0. Mentor Notes — How to Read This Document

As a junior QA, the biggest habit to build is: **every test case should map to a risk**. Before writing a test, ask "what could realistically break here, and how bad would it be if it did?" That's why every section below starts with risk thinking, not just steps.

Also note: this app is a well-known practice site built by "Thinking Tester" specifically for people learning API + UI testing. Its Swagger docs are usually at `/contacts/api` — check for `/addressbook` or similar routes. Always verify actual endpoints via the live Swagger/OpenAPI docs before automating, since practice apps sometimes change.

---

## 1. TEST PLAN / STRATEGY (Summary)

| Item | Detail |
| --- | --- |
| **Application** | Contact List Manager (Web + REST API) |
| **Test Levels** | Functional (UI), API/Integration |
| **Test Types** | Positive, Negative, Boundary, Security (basic), Exploratory |
| **In Scope** | Registration, Login, Logout, Contacts CRUD via API |
| **Out of Scope** | Performance/load testing, full penetration testing, mobile responsiveness (unless requested) |
| **Environment** | Public Heroku instance (shared — expect test data pollution from other users) |
| **Test Data Strategy** | Use unique emails per run (timestamp/UUID suffix) to avoid duplicate-user collisions from other testers using the same public app |
| **Tools** | Manual: Browser + DevTools. API: Postman/Newman. Automation (future): Playwright + REST-assured/axios/Supertest |
| **Entry Criteria** | App is reachable, test accounts can be created |
| **Exit Criteria** | All High priority cases executed, no open Critical/High defects unresolved |

**Key Risk (Environment):** Because this is a shared public demo app, data isn't isolated per tester. Always generate dynamic unique test data (e.g., `qa.junior.<timestamp>@test.com`) rather than hardcoded emails to avoid false "duplicate email" failures.

---

## 2. USER REGISTRATION

### 2.1 Risk Analysis

| Risk | Why it matters | Detection method |
| --- | --- | --- |
| Weak/no password validation | Security exposure, weak accounts | Negative + boundary tests |
| Duplicate email accepted | Data integrity, account takeover confusion | Negative test |
| Client-side only validation (bypassable via API) | Real defect class in many apps | Cross-check UI validation vs raw API call |
| Improper error messaging | Poor UX, hides real problems | Exploratory |
| Field length not enforced server-side | DB errors / injection risk | Boundary + API test |

### 2.2 Equivalence Partitioning (EP) — Email Field

| Class | Example | Valid? |
| --- | --- | --- |
| Valid format | <user@test.com> | Valid |
| Missing @ | usertest.com | Invalid |
| Missing domain | user@ | Invalid |
| Missing local part | @test.com | Invalid |
| Multiple @ | user@@test.com | Invalid |
| Valid with subdomain | <user@mail.test.com> | Valid |
| Empty string | "" | Invalid |
| Whitespace only | "   " | Invalid |

### 2.3 EP — Password Field (assume app requires min 7 chars, per known app behavior — verify live)

| Class | Example | Valid? |
| --- | --- | --- |
| Below minimum length | "123456" (6 chars) | Invalid |
| Exactly minimum length | "1234567" (7 chars) | Valid |
| Normal valid password | "Passw0rd!" | Valid |
| Empty | "" | Invalid |
| Very long (500+ chars) | "aaaa...a" | Valid/Invalid — verify max limit |
| Only spaces | "       " | Invalid |

### 2.4 Boundary Value Analysis (BVA) — Password Length (assuming min=7, max=undefined/large)

| Boundary | Value | Expected |
| --- | --- | --- |
| Min - 1 | 6 chars | Rejected |
| Min | 7 chars | Accepted |
| Min + 1 | 8 chars | Accepted |
| Max (if documented, e.g. 50) - 1 | 49 chars | Accepted |
| Max | 50 chars | Accepted |
| Max + 1 | 51 chars | Rejected (verify actual server limit) |

> ⚠️ **Assumption flagged:** Exact min/max password length isn't stated in your prompt. I've used commonly known defaults for this app (min 7). **Action for you:** confirm via UI error message or API docs before finalizing pass/fail expectations.

### 2.5 Manual Test Cases — Registration

| TC ID | Scenario | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REG-01 | Successful registration with valid data | App loaded, unique email ready | 1. Go to Sign Up 2. Enter valid First/Last name, unique email, valid password 3. Submit | Account created, redirected to contact list, logged in | High | High | Positive |
| REG-02 | Registration with missing first name | On sign up form | Leave First Name blank, fill rest, submit | Validation error shown, no account created | High | Medium | Negative |
| REG-03 | Registration with missing email | On sign up form | Leave Email blank, submit | Validation error, blocked submission | High | High | Negative |
| REG-04 | Registration with missing password | On sign up form | Leave Password blank, submit | Validation error, blocked submission | High | High | Negative |
| REG-05 | Invalid email format | On sign up form | Enter "userattest.com" | Error: invalid email format | High | Medium | Negative |
| REG-06 | Duplicate email registration | An account already exists with email X | Register again using email X | Error: "Email address is already in use" (or similar), no duplicate created | High | High | Negative |
| REG-07 | Password below minimum length | On sign up form | Enter password of 6 chars | Error shown, rejected | High | Medium | Boundary |
| REG-08 | Password at exact minimum length | On sign up form | Enter password of 7 chars | Accepted | Medium | Low | Boundary |
| REG-09 | Extremely long input in name field | On sign up form | Enter 1000-char string in First Name | Either truncated/rejected gracefully, no crash/500 error | Medium | Medium | Boundary |
| REG-10 | SQL/Script injection attempt in fields | On sign up form | Enter `<script>alert(1)</script>` in name field | Input sanitized/escaped, no script execution, no server error | High | High | Security/Negative |
| REG-11 | Whitespace-only inputs | On sign up form | Enter spaces only in name/email/password | Rejected as invalid (not treated as valid non-empty) | Medium | Medium | Negative |
| REG-12 | Case sensitivity of email uniqueness | Account exists for "<User@test.com>" | Register with "<user@test.com>" | Verify whether treated as duplicate (define expected behavior — flag as exploratory if unclear) | Medium | Medium | Edge Case |
| REG-13 | Leading/trailing spaces in email | On sign up form | Enter " <user@test.com> " | Trimmed and accepted, or rejected consistently | Low | Low | Edge Case |
| REG-14 | Successful registration then immediate duplicate via API bypass | Registered via UI | Call POST /users with same email directly via API | Server should reject regardless of UI validation | High | High | Security |

**Why REG-14 matters (mentor note):** Many apps validate only in the browser (JS) but forget server-side validation. This is a classic real-world defect — testers who only click through the UI miss it. Always pair a UI negative test with the equivalent raw API call.

---

## 3. USER LOGIN

### 3.1 Risk Analysis

| Risk | Impact |
| --- | --- |
| Login accepted with wrong password | Critical security failure |
| No account lockout / rate limiting | Brute-force vulnerability |
| Token not invalidated properly | Session hijacking risk |
| Verbose error messages (e.g., "email not found" vs "password wrong") | User enumeration security leak |
| Login bypass via API without proper credential check | Auth bypass |

### 3.2 Decision Table — Login Logic

| Email Valid? | Password Correct? | Fields Empty? | Expected Result |
| --- | --- | --- | --- |
| Yes | Yes | No | Login success, token issued |
| Yes | No | No | Login failure, generic error |
| No (unregistered) | N/A | No | Login failure, generic error (not "user not found" — avoid enumeration) |
| N/A | N/A | Yes (any field) | Validation error, no request sent to server / 400 response |
| Yes | Yes (but account not verified, if applicable) | No | Depends on app logic — clarify if email verification exists |

### 3.3 Manual Test Cases — Login

| TC ID | Scenario | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-01 | Successful login with valid credentials | Registered user exists | Enter correct email/password, submit | Redirected to contact list, session/token established | High | High | Positive |
| LOG-02 | Login with invalid email (not registered) | None | Enter random unregistered email + any password | Generic error: "Incorrect email or password" | High | High | Negative |
| LOG-03 | Login with wrong password | Registered user exists | Enter correct email, wrong password | Generic error, login blocked | High | High | Negative |
| LOG-04 | Login with empty email field | On login form | Leave email blank, enter password, submit | Validation error, no request/blocked | High | Medium | Negative |
| LOG-05 | Login with empty password field | On login form | Enter email, leave password blank | Validation error | High | Medium | Negative |
| LOG-06 | Login with both fields empty | On login form | Submit with nothing entered | Validation error, form blocked | Medium | Medium | Negative |
| LOG-07 | Token/session returned matches expected format | Valid login via API | POST /users/login, inspect response | JWT/token present in response body, correct structure | High | Medium | Positive |
| LOG-08 | Access protected resource with valid token | Logged in, token stored | GET /contacts with Authorization header | 200 OK, contact list returned | High | High | Positive |
| LOG-09 | Access protected resource without token | No login performed | GET /contacts with no Authorization header | 401 Unauthorized | High | High | Security/Negative |
| LOG-10 | Access protected resource with invalid/expired token | Tampered token | GET /contacts with malformed token string | 401 Unauthorized, no data leaked | High | High | Security/Negative |
| LOG-11 | SQL Injection attempt in login fields | On login form | Enter `' OR '1'='1` as email/password | Login rejected, no server error, no bypass | High | High | Security |
| LOG-12 | Login field boundary — very long email string | On login form | Enter 1000+ char string as email | Rejected gracefully, no crash | Medium | Medium | Boundary |
| LOG-13 | Case sensitivity of email at login | User registered with "<User@test.com>" | Login using "<user@test.com>" | Define & verify expected behavior (should likely still work) | Medium | Low | Edge Case |
| LOG-14 | Multiple failed login attempts (brute force check) | Registered user exists | Attempt wrong password 5-10 times rapidly | Check if lockout/rate-limiting/captcha triggers (likely NOT implemented — flag as risk/finding) | Medium | High | Security/Exploratory |

**Why LOG-09/LOG-10 matter:** This is core authentication testing — if protected endpoints don't reject missing/bad tokens, that's a **Critical severity** defect (unauthorized data access).

---

## 4. USER LOGOUT

### 4.1 Risk Analysis

| Risk | Impact |
| --- | --- |
| Token remains valid after logout (not invalidated server-side) | Session hijack risk if token intercepted |
| Protected pages still accessible via browser back button after logout | Poor session security, likely client-side only routing issue |
| Logout button not clearing local storage/cookies | Stale session artifacts |

### 4.2 Manual Test Cases — Logout

| TC ID | Scenario | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LGT-01 | Successful logout | Logged in | Click Logout | Redirected to login page, token/session cleared client-side | High | Medium | Positive |
| LGT-02 | Access protected page after logout (browser navigation) | Just logged out | Navigate back to /contactList via URL or back button | Redirected to login, not showing cached data | High | High | Negative/Security |
| LGT-03 | Reuse old token via API after logout | Logged out, old token saved | Call GET /contacts with old token | Verify: does the API actually invalidate JWT server-side, or is it stateless and still "valid" until expiry? (Known limitation of JWT apps — document as finding, not necessarily a bug) | High | Medium | Security/Exploratory |
| LGT-04 | Multiple logout attempts in a row | Logged in | Click logout twice quickly, or call logout endpoint twice via API | No crash, second call handled gracefully (idempotent or appropriate error) | Low | Low | Edge Case |
| LGT-05 | Logout clears local storage/cookies | Logged in | Logout, inspect DevTools > Application storage | Token/localStorage entries removed | Medium | Medium | Positive |

**Mentor note on LGT-03:** Many JWT-based apps (like this one) don't maintain server-side session state — logout is often just a client-side token removal, and the JWT itself remains technically valid until it expires. This is a very common and important **architectural finding** to document, not necessarily a "bug," but definitely worth reporting as a risk if the app claims true logout/session invalidation.

---

## 5. CONTACTS API TESTING

### 5.1 API Overview (verify exact paths against live Swagger docs at app URL + `/contacts/api` or `/api-docs`)

| Action | Method | Endpoint | Auth Required |
| --- | --- | --- | --- |
| Register | POST | /users | No |
| Login | POST | /users/login | No |
| Get current user | GET | /users/me | Yes |
| Logout | POST | /users/logout | Yes |
| Create contact | POST | /contacts | Yes |
| List contacts | GET | /contacts | Yes |
| Get single contact | GET | /contacts/{id} | Yes |
| Update contact | PUT/PATCH | /contacts/{id} | Yes |
| Delete contact | DELETE | /contacts/{id} | Yes |

### 5.2 Expected HTTP Status Codes

| Scenario | Expected Status |
| --- | --- |
| Successful creation | 201 Created |
| Successful retrieval | 200 OK |
| Successful update | 200 OK |
| Successful delete | 200 OK / 204 No Content |
| Missing/invalid auth token | 401 Unauthorized |
| Resource not found | 404 Not Found |
| Invalid payload (missing required field) | 400 Bad Request |
| Duplicate/conflict resource | 400 or 409 |

### 5.3 Sample JSON — Create Contact Request

```json
POST /contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Alice",
  "lastName": "Nguyen",
  "birthdate": "1990-05-14",
  "email": "alice.nguyen@example.com",
  "phone": "5551234567",
  "street1": "123 Main St",
  "street2": "",
  "city": "Springfield",
  "stateProvince": "IL",
  "postalCode": "62701",
  "country": "USA"
}
```

### 5.4 Sample JSON — Success Response

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "firstName": "Alice",
  "lastName": "Nguyen",
  "birthdate": "1990-05-14",
  "email": "alice.nguyen@example.com",
  "phone": "5551234567",
  "street1": "123 Main St",
  "street2": "",
  "city": "Springfield",
  "stateProvince": "IL",
  "postalCode": "62701",
  "country": "USA",
  "owner": "64e0a1b2c3d4e5f6a7b8c9d0",
  "__v": 0
}
```

### 5.5 Manual/API Test Cases — Contacts

| TC ID | Scenario | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API-01 | Create contact with all valid fields | Authenticated | POST /contacts with full valid payload | 201 Created, contact object returned with unique `_id` | High | High | Positive |
| API-02 | Create contact with only required fields | Authenticated | POST /contacts with firstName + lastName only (if others optional) | 201 Created | High | Medium | Positive |
| API-03 | Create contact missing required field (e.g., firstName) | Authenticated | POST /contacts without firstName | 400 Bad Request with validation message | High | High | Negative |
| API-04 | Create contact with invalid email format | Authenticated | POST /contacts with `email: "not-an-email"` | 400 Bad Request or field-specific error | Medium | Medium | Negative |
| API-05 | Create contact without auth token | Not authenticated | POST /contacts, no Authorization header | 401 Unauthorized | High | High | Security |
| API-06 | Create contact with expired/invalid token | Invalid token | POST /contacts, Authorization: Bearer invalidtoken | 401 Unauthorized | High | High | Security |
| API-07 | Retrieve full contact list | Authenticated, contacts exist | GET /contacts | 200 OK, array of contacts returned, all created contacts present | High | High | Positive |
| API-08 | Retrieve single contact by valid ID | Authenticated, contact exists | GET /contacts/{validId} | 200 OK, correct contact data returned | High | Medium | Positive |
| API-09 | Retrieve contact with invalid/non-existent ID | Authenticated | GET /contacts/000000000000000000000000 | 404 Not Found | Medium | Medium | Negative |
| API-10 | Update existing contact | Authenticated, contact exists | PUT /contacts/{id} with updated fields | 200 OK, fields updated correctly, verify via GET | High | Medium | Positive |
| API-11 | Delete existing contact | Authenticated, contact exists | DELETE /contacts/{id} | 200/204, contact removed from list | High | Medium | Positive |
| API-12 | Delete already-deleted contact (idempotency check) | Contact previously deleted | DELETE /contacts/{sameId} again | 404 Not Found, no server crash | Low | Low | Edge Case |
| API-13 | Create 11 contacts sequentially, verify uniqueness | Authenticated | Loop: POST /contacts x11 with varying data | All 11 return 201, all `_id` values unique, all appear in GET /contacts list | High | High | Positive/Volume |
| API-14 | Attempt to access another user's contact by ID | Two separate user accounts, User B's contact ID known | Authenticate as User A, GET /contacts/{UserB_contactId} | 404 (not 200 with data) — verify no data leak across users | High | Critical | Security |
| API-15 | Very long string in a text field (e.g., 5000 chars in firstName) | Authenticated | POST /contacts with oversized firstName | Rejected gracefully (400) or truncated per app rules — no 500 error | Medium | Medium | Boundary |
| API-16 | Invalid data types in fields (e.g., phone as number/array instead of string) | Authenticated | POST /contacts with `"phone": 12345` (number not string) | 400 Bad Request, no server crash | Medium | Medium | Negative |
| API-17 | Cleanup: delete all 11 created contacts after test run | Contacts created in API-13 | DELETE /contacts/{id} for each of the 11 | All return 200/204, GET /contacts confirms empty/clean state | High | Low | Cleanup |

**Why API-14 is Critical severity:** Cross-user data access (IDOR — Insecure Direct Object Reference) is one of the most common and dangerous real-world API vulnerabilities (OWASP API Security Top 10 #1). Always test this when an app has per-user resources.

---

## 6. ACCEPTANCE CRITERIA (Given-When-Then)

```gherkin
Feature: User Registration
  Scenario: Successful registration with valid data
    Given I am on the registration page
    When I submit valid first name, last name, unique email, and a password meeting the minimum length
    Then my account should be created
    And I should be redirected to the contact list, logged in

  Scenario: Rejecting duplicate email
    Given an account already exists with email "existing@test.com"
    When I attempt to register again using "existing@test.com"
    Then the system should reject the registration
    And display an appropriate error message

Feature: User Login
  Scenario: Reject invalid credentials
    Given I am on the login page
    When I enter a valid email with an incorrect password
    Then I should see a generic authentication error
    And no session token should be issued

Feature: Contacts API
  Scenario: Create and verify a contact
    Given I am authenticated with a valid token
    When I POST a new contact with valid required fields
    Then the response status should be 201
    And the response body should contain a unique contact ID
    And the contact should appear when I GET /contacts
```

---

## 7. REGRESSION SCOPE (Priority Order)

1. **Critical path (must run every release):** Register → Login → Create Contact → Retrieve Contact → Logout
2. **High priority:** Auth token validation on protected endpoints (401 cases), duplicate email rejection, IDOR check (API-14)
3. **Medium priority:** Boundary/length validations, update/delete contact flows
4. **Low priority:** UI cosmetic edge cases, idempotency of repeated logout/delete

---

## 8. RISKS & RECOMMENDATIONS SUMMARY

| Risk Area | Recommendation |
| --- | --- |
| Shared public test environment | Always use dynamically generated unique test data; don't hardcode emails |
| JWT logout may not invalidate server-side | Document as architectural note; test token reuse post-logout explicitly |
| No visible rate-limiting on login | Flag as a security recommendation (not necessarily a bug, but worth reporting) |
| Server-side validation must mirror UI validation | Always pair every UI negative test with a raw API equivalent |
| Cross-user data exposure (IDOR) | Treat as highest-priority security test — Critical severity if found |
| Field-level input sanitization | Test XSS/script injection payloads in every free-text field |

---

## 9. EXPLORATORY TESTING IDEAS

- Try registering with an email containing a "+" alias (e.g., `user+test@test.com`) — common real-world edge case for email parsers.
- Refresh the page mid-registration/login — check for stuck loading states.
- Open the app in two tabs, log in on one, log out on the other — check session behavior sync.
- Use browser DevTools to intercept and modify the request payload (e.g., change `email` after client-side validation passes) to test server-side enforcement.
- Rapidly double-click "Submit" on registration/login — check for duplicate submissions/race conditions.
- Try uploading unexpected characters (emoji, right-to-left text, null bytes) in name fields.
- Resize browser / test mobile viewport for layout-breaking bugs (if UI testing is in scope).

---

## 10. POSSIBLE BUGS TO LOOK FOR

- Client-side-only validation bypassed via direct API calls.
- Inconsistent error messages between UI and API for the same failure.
- Contact list not refreshing after create/delete without full page reload.
- Token persists in localStorage after logout (stale session artifact).
- Duplicate contacts allowed with identical data (no uniqueness constraint on contacts, unlike users).
- Off-by-one errors in boundary-length fields.
- 500 Internal Server Error instead of graceful 400 on malformed payloads.

---

## 11. SECURITY-FOCUSED TEST IDEAS

| Area | Test Idea |
| --- | --- |
| Authentication | Attempt login with SQL injection-style strings; verify no bypass |
| Authorization | Attempt to access/modify/delete another user's contact by guessing/reusing IDs |
| Input validation | Submit `<script>` tags, HTML entities in every text field; verify escaping |
| Token handling | Inspect JWT payload (base64-decode) — verify no sensitive data (like plaintext password) is embedded |
| Transport security | Confirm app is served over HTTPS, not HTTP |
| Error verbosity | Ensure error messages don't reveal stack traces or internal server details |

---

## 12. API VALIDATION CHECKLIST

- [ ] Correct HTTP status code returned for every scenario
- [ ] Response body schema matches expected structure (field names, types)
- [ ] Response time is reasonable (no undue latency) — informal, not full perf testing
- [ ] Content-Type header is `application/json`
- [ ] Authorization header enforcement is consistent across all protected endpoints
- [ ] Created resource IDs are unique and persist correctly
- [ ] Deleted resources are truly removed (verify via subsequent GET → 404)
- [ ] Pagination/list limits behave correctly if list grows large (11+ contacts)

---

## 13. POSTMAN COLLECTION EXAMPLE (Structure)

```json
{
  "info": { "name": "Contact List API Tests", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "item": [
    {
      "name": "Register User",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/users",
        "body": {
          "mode": "raw",
          "raw": "{\"firstName\":\"QA\",\"lastName\":\"Tester\",\"email\":\"{{uniqueEmail}}\",\"password\":\"Passw0rd1\"}"
        }
      }
    },
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/users/login",
        "body": { "mode": "raw", "raw": "{\"email\":\"{{uniqueEmail}}\",\"password\":\"Passw0rd1\"}" }
      }
    },
    {
      "name": "Create Contact",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/contacts",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }],
        "body": { "mode": "raw", "raw": "{\"firstName\":\"Alice\",\"lastName\":\"Nguyen\",\"email\":\"alice@test.com\"}" }
      }
    }
  ]
}
```

### 13.1 Postman Test Scripts (JavaScript — add to "Tests" tab)

**Login request — capture token:**

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has token", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.token).to.exist;
    pm.environment.set("token", jsonData.token);
});
```

**Create Contact request:**

```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Contact has unique _id", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData._id).to.be.a("string").and.to.have.lengthOf.above(0);
    pm.environment.set("contactId_" + Date.now(), jsonData._id);
});

pm.test("Response contains correct firstName", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.firstName).to.eql("Alice");
});
```

**Negative test — no auth token:**

```javascript
pm.test("Status code is 401 when unauthorized", function () {
    pm.response.to.have.status(401);
});
```

**Get Contacts List — verify created contact is present:**

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Created contact exists in list", function () {
    const jsonData = pm.response.json();
    const ids = jsonData.map(c => c._id);
    pm.expect(ids).to.include(pm.environment.get("lastCreatedContactId"));
});
```

---

## 14. AUTOMATION RECOMMENDATIONS (Future Work)

### 14.1 Playwright (UI Automation) — Pseudo-code

```javascript
// registration.spec.js
test('should register a new user successfully', async ({ page }) => {
  const uniqueEmail = `qa.test.${Date.now()}@example.com`;
  await page.goto('https://thinking-tester-contact-list.herokuapp.com/');
  await page.click('text=Sign up');
  await page.fill('#firstName', 'QA');
  await page.fill('#lastName', 'Tester');
  await page.fill('#email', uniqueEmail);
  await page.fill('#password', 'Passw0rd1');
  await page.click('#submit');
  await expect(page).toHaveURL(/contactList/);
});

test('should reject duplicate email registration', async ({ page }) => {
  // pre-register a user via API for speed, then try registering again via UI
  await page.goto('/addUser');
  await page.fill('#email', 'existing@test.com');
  // ... fill other fields
  await page.click('#submit');
  await expect(page.locator('.error-message')).toBeVisible();
});
```

### 14.2 API Automation — Pseudo-code (Supertest/axios + Jest style)

```javascript
describe('Contacts API', () => {
  let token;

  beforeAll(async () => {
    const loginRes = await api.post('/users/login', { email, password });
    token = loginRes.data.token;
  });

  test('creates 11 contacts with unique IDs', async () => {
    const ids = new Set();
    for (let i = 0; i < 11; i++) {
      const res = await api.post('/contacts', contactPayload(i), {
        headers: { Authorization: `Bearer ${token}` }
      });
      expect(res.status).toBe(201);
      expect(ids.has(res.data._id)).toBe(false);
      ids.add(res.data._id);
    }
    expect(ids.size).toBe(11);
  });

  afterAll(async () => {
    // cleanup: delete all created contacts
    for (const id of createdIds) {
      await api.delete(`/contacts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    }
  });
});
```

### 14.3 Automation Strategy Suggestions

- Use **Playwright** for UI critical-path smoke tests (register/login/logout) — keep the suite small and fast.
- Use **API-layer automation** (Supertest, Postman/Newman, or REST-assured) for the bulk of Contacts CRUD + negative/security tests — API tests are faster and more stable than UI tests.
- Store test data generation logic (unique emails) in a shared utility/fixture.
- Integrate into CI/CD (GitHub Actions) to run API suite on every commit; run UI smoke suite nightly or pre-release.
- Use environment variables/secrets for base URL and test credentials — never hardcode.

---

## 15. SAMPLE BUG REPORT TEMPLATE

```
Bug ID: BUG-001
Title: JWT token remains valid for protected API calls after user logs out via UI
Environment: https://thinking-tester-contact-list.herokuapp.com/, Chrome 126
Priority: Medium
Severity: Medium (session management weakness, not full account takeover)

Steps to Reproduce:
1. Register/login as a test user, capture the JWT token.
2. Click "Logout" in the UI.
3. Using Postman, send GET /contacts with the previously captured token in the Authorization header.

Expected Result:
Server should return 401 Unauthorized since the session/token was invalidated on logout.

Actual Result:
Server returns 200 OK with the contact list data — token still accepted after logout.

Attachments: [Postman screenshot, request/response JSON]

Notes:
This may be expected behavior for stateless JWT apps without a token blacklist, but should be
confirmed with the dev/product team and documented if intentional, since it has session-security
implications if a token is ever leaked/intercepted.
```

---

## 16. ADDITIONAL TEST CASES TO CONSIDER (Beyond Initial Scope)

1. **Password reset / forgot password flow** (if it exists) — often overlooked and security-sensitive.
2. **Profile update / user data edit** (PATCH /users/me) — validation and auth checks.
3. **Rate limiting / brute-force protection** on login — formal security test.
4. **Pagination behavior** if contact list grows large (e.g., 50+ contacts).
5. **Concurrent modification** — two sessions editing the same contact simultaneously.
6. **Field-level max-length enforcement consistency** between DB schema and API validation.
7. **HTTP method tampering** — e.g., sending DELETE as POST with `_method=DELETE` override, or trying PATCH where only PUT is supported.
8. **CORS policy check** — verify API doesn't allow requests from arbitrary origins if that's a security requirement.
9. **Accessibility testing (a11y)** on the registration/login forms if UI quality is in scope.
10. **Data persistence check** — logout, close browser fully, reopen — verify "remember me" (if present) works as expected, or that user is properly logged out.

---

### What should I check additionally?

Before treating this suite as "done," confirm with the live app (via its Swagger docs, typically at `/contacts/api`) the exact validation rules for password length, field max-lengths, and whether contacts have any user-facing uniqueness constraints — several test cases above (REG-07/08, API-15) rely on assumptions I've flagged that should be verified against the real system rather than my best-guess defaults.
