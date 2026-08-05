# API Contract Assumptions

This document lists all assumptions made about the Thinking Tester Contact List API contract. **Before running the full test suite in production or CI, verify each assumption against the live Swagger documentation or by making test API calls.**

## How to Verify

1. **Via Swagger/OpenAPI Docs:**
   - Navigate to: `https://thinking-tester-contact-list.herokuapp.com/`
   - Look for "API Docs," "Swagger UI," or `/api-docs` endpoint
   - Review endpoint definitions, request/response schemas

2. **Via Manual API Testing (Postman/curl):**
   - Use Postman or curl to make test calls
   - Observe actual response codes, body structure, error messages
   - Update assumptions below if real behavior differs

3. **Via Test Failure Messages:**
   - Run tests and read failures carefully
   - Compare expected vs. actual responses
   - Update assumptions and re-run

---

## User Registration (`POST /users`)

### Request Body Schema

| Field | Type | Required | Assumption | How to Verify |
| ------- | ------ | ---------- | ----------- | --------------- |
| `firstName` | string | Yes | Must be non-empty | Try POST with empty firstName; expect 400 |
| `lastName` | string | Yes | Must be non-empty | Try POST with empty lastName; expect 400 |
| `email` | string | Yes | Must be RFC 5321 format (user@domain) | Try POST with "notanemail"; expect 400 |
| `password` | string | Yes | Min 7 chars, no max documented | Try 6-char password; expect 400. Try 500-char; check response |

**⚠️ Critical Assumptions:**

1. Email uniqueness is enforced → Duplicate email returns 400 with specific error message
2. Server-side validation is required → Client can be bypassed via direct API calls
3. Password validation includes minimum length but not documented maximum
4. No regex/special character requirements beyond documented (if any)

### Response Status Codes

| Status | Scenario | Assumption |
| -------- | ---------- | ----------- |
| `201` | Successful registration | User created, token/credentials returned |
| `200` | Alternative success | Some apps return 200 instead of 201 |
| `400` | Invalid input | Missing field, bad email, password too short, duplicate email |
| `409` | Duplicate email | Some apps return 409 Conflict instead of 400 |
| `422` | Validation error | Some apps return 422 instead of 400 |

**How to verify:** Look at live error responses in browser DevTools or test with curl:

```bash
curl -X POST https://thinking-tester-contact-list.herokuapp.com/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"","lastName":"Test","email":"test@test.com","password":"Pass1234"}'
# Should see 400 (or 422) with "firstName required" in error message
```

### Response Body Schema (Success)

Assumption (201 Created):

```json
{
  "_id": "ObjectId string",
  "firstName": "string",
  "lastName": "string",
  "email": "string (normalized)",
  "password": "NOT included in response (security best practice)"
}
```

**Verify:** Check if response includes unexpected fields or missing expected fields.

---

## User Login (`POST /users/login`)

### Request Body Schema

| Field | Type | Required | Assumption |
| ------- | ------ | ---------- | ----------- |
| `email` | string | Yes | Must match registered user's email (case-sensitivity TBD) |
| `password` | string | Yes | Must match user's password exactly |

### Response Status Codes

| Status | Scenario | Assumption |
| -------- | ---------- | ----------- |
| `200` | Successful login | Token returned in response body or headers |
| `401` | Failed login | Invalid email or password (generic error, no enumeration) |
| `400` | Bad request | Missing field, malformed JSON |

### Response Body Schema (Success - 200)

Assumption:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { /* optional user object */ }
}
```

**JWT Token Structure Assumption:**

- Format: `header.payload.signature` (3 parts, base64url-encoded)
- Header: `{"alg":"HS256","typ":"JWT"}`
- Payload: `{"userId":"...","iat":...,"exp":...,/* no password */}`
- Expiration: `exp` claim in seconds since epoch
- No sensitive data (password, PIN, API key) in payload

**How to verify:**

```bash
# After login, inspect token:
TOKEN="eyJhbGciOi..."
echo $TOKEN | cut -d'.' -f2 | base64 -D
# Should see JSON with userId, iat, exp
```

---

## Current User (`GET /users/me`)

### Request

| Aspect | Assumption |
| -------- | ----------- |
| Auth Required | Yes (Bearer token in Authorization header) |
| Header Format | `Authorization: Bearer <token>` |
| Status if no token | 401 Unauthorized |
| Status if invalid token | 401 Unauthorized |

### Response (200 OK)

```json
{
  "_id": "ObjectId string",
  "firstName": "string",
  "lastName": "string",
  "email": "string"
}
```

---

## Logout (`POST /users/logout`)

### Behavior Assumptions

| Aspect | Assumption | Finding |
| -------- | ----------- | --------- |
| Auth Required | Yes | Must be authenticated to logout |
| Side Effect | Clears session (may be client-side only) | **JWT apps typically don't invalidate server-side** |
| Status Code | 200 OK or 204 No Content | Either is acceptable |
| Response Body | Empty or `{"message":"Logged out"}` | Varies by implementation |
| Token Reusability | JWT tokens may still be valid until expiry | This is stateless JWT behavior; document as finding if unexpected |

**Critical Finding to Document:**
If you can successfully call `GET /contacts` with a token after logout, it means:

- ✅ Expected (stateless JWT, token valid until expiry time)
- ⚠️ Document as architectural finding (logout is client-side only)
- ❌ Only unexpected if app claims true server-side session invalidation

---

## Contacts CRUD

### Create Contact (`POST /contacts`)

**Auth Required:** Yes (Bearer token)

**Request Body Schema:**

| Field | Type | Required | Assumption |
| ------- | ------ | ---------- | ----------- |
| `firstName` | string | Yes | Non-empty string |
| `lastName` | string | Yes | Non-empty string |
| `email` | string | No | If provided, must be RFC 5321 format |
| `phone` | string | No | Any format accepted (no validation) |
| `birthdate` | string | No | ISO 8601 format (YYYY-MM-DD) |
| `street1` | string | No | Any string |
| `street2` | string | No | Any string |
| `city` | string | No | Any string |
| `stateProvince` | string | No | Any string |
| `postalCode` | string | No | Any string |
| `country` | string | No | Any string |

**⚠️ Assumption Flags:**

1. **Required fields:** Only `firstName` and `lastName` assumed required. Test with minimal payload to verify.
2. **Email validation:** If provided, should validate format. Test with "not-an-email" to confirm.
3. **Field length limits:** No documented max lengths. Sending 5000-char string will test DB limits.

**How to verify required fields:**

```bash
curl -X POST https://thinking-tester-contact-list.herokuapp.com/contacts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe"}'
# If succeeds (201), only firstName+lastName required
# If fails (400), additional fields required
```

**Response Status Codes:**

| Status | Scenario |
| -------- | ---------- |
| `201` | Contact created successfully |
| `200` | Alternative success code (some apps use 200) |
| `400` | Invalid input (missing required field, bad email, etc.) |
| `401` | Unauthorized (missing or invalid token) |
| `409` | Conflict (duplicate contact, if uniqueness enforced) |

**Response Body (201):**

```json
{
  "_id": "ObjectId string (unique per contact)",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "birthdate": "string",
  "street1": "string",
  "street2": "string",
  "city": "string",
  "stateProvince": "string",
  "postalCode": "string",
  "country": "string",
  "owner": "ObjectId (user ID who created)",
  "__v": "number (MongoDB version)"
}
```

---

### List Contacts (`GET /contacts`)

**Auth Required:** Yes

**Response (200 OK):**

```json
[
  {
    "_id": "...",
    "firstName": "...",
    // ... (same structure as above)
  },
  // ... more contacts
]
```

**Assumption:** Only returns contacts owned by authenticated user (no cross-user data)

**CRITICAL TEST:** List contacts as User A, verify User B's contacts are NOT included.

---

### Get Single Contact (`GET /contacts/{id}`)

**Auth Required:** Yes

**Response Codes:**

| Status | Scenario | Assumption |
| -------- | ---------- | ----------- |
| `200` | Contact found and user owns it | Return contact object |
| `404` | Contact not found OR user doesn't own it | CRITICAL: Don't differentiate (IDOR prevention) |
| `401` | Unauthorized (missing token) | Return 401 |

**CRITICAL IDOR ASSUMPTION:** If User B tries to GET User A's contact:

- ❌ **NOT 200 with data** (data leak!)
- ✅ **404** (best practice - no information leakage)
- ✅ **403** (also acceptable - explicit "forbidden")

---

### Update Contact (`PUT /contacts/{id}` or `PATCH /contacts/{id}`)

**Auth Required:** Yes

**Assumption:** Only contact owner can update (authorization enforced)

**Request Body:** Any fields to update (partial updates assumed for PATCH)

**Response Codes:**

| Status | Scenario |
| -------- | ---------- |
| `200` | Updated successfully |
| `404` | Contact not found / user doesn't own |
| `401` | Unauthorized |
| `400` | Invalid input |

---

### Delete Contact (`DELETE /contacts/{id}`)

**Auth Required:** Yes

**Response Codes:**

| Status | Scenario |
| -------- | ---------- |
| `200` | Deleted successfully |
| `204` | No Content (also acceptable for DELETE) |
| `404` | Contact not found / user doesn't own |
| `401` | Unauthorized |

**Post-Delete Verification:** After delete, `GET /contacts/{id}` should return 404 (not just soft-deleted).

---

## Authentication Header Format

**All Protected Endpoints Assumption:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If token is missing or malformed:**

- Expected: 401 Unauthorized
- NOT expected: Silently ignored, treated as anonymous

**How to test:**

```bash
# With valid token
curl -H "Authorization: Bearer <token>" https://.../contacts
# Expected: 200 OK with contacts

# Without token
curl https://.../contacts
# Expected: 401 Unauthorized

# With malformed token
curl -H "Authorization: Bearer invalid!!!" https://.../contacts
# Expected: 401 Unauthorized
```

---

## Email Uniqueness Enforcement

**Assumption:** Email addresses are unique per user account (registration only)

**For Contacts:** Email uniqueness NOT assumed (contacts can share emails)

**How to test:**

```bash
# Register User A with alice@test.com
POST /users { email: "alice@test.com", ... }
# Expected: 201

# Try to register User B with same email
POST /users { email: "alice@test.com", ... }
# Expected: 400 or 409 with "already in use" or similar error
```

---

## Error Response Format

**Assumption (flexible):**

```json
// Option 1: error field
{ "error": "Email address is already in use" }

// Option 2: message field
{ "message": "Email address is already in use" }

// Option 3: detailed validation
{ "errors": { "email": "Already in use", "password": "Too short" } }
```

**Current tests look for:** `error` OR `message` field containing relevant text

**If your app uses different format:** Update error assertions in test files

---

## Data Type Expectations

| Field | Type | Example | Validation |
| ------- | ------ | --------- | ----------- |
| IDs (`_id`, `owner`) | String | "507f1f77bcf86cd799439011" | MongoDB ObjectId format |
| Email | String | "<user@example.com>" | RFC 5321 |
| Phone | String | "555-0123" or "5550123" | No specific format assumed |
| Dates (`birthdate`) | String | "1990-01-15" | ISO 8601 (YYYY-MM-DD) |
| Version (`__v`) | Number | 0, 1, 2 | MongoDB versioning field |

---

## Known Limitations & Edge Cases

### 1. Field Length Limits

- Not documented in assumptions
- Tests send 5000-char strings to check behavior
- **Expected:** Either truncated, rejected (400), or accepted
- **NOT expected:** 500 Internal Server Error

### 2. Password Reset / Forgot Password

- **Assumption:** NOT implemented (out of scope for basic suite)
- If it exists, add separate test suite

### 3. Email Verification

- **Assumption:** NOT required (accounts active immediately after signup)
- If required, it's a finding worth documenting

### 4. Rate Limiting

- **Assumption:** NOT implemented on login endpoint
- If it exists, adjust tests to expect rate limit response (429 Too Many Requests)

### 5. CORS Policy

- **Assumption:** CORS headers allow same-origin requests (browser → API)
- If this is deployed, verify `Access-Control-Allow-Origin` headers

---

## Checklist: Before Running Full Suite

Use this checklist to verify assumptions before deploying tests:

- [ ] Verified password minimum length (assumed 7) via live API or docs
- [ ] Confirmed email validation format accepted (RFC 5321 assumed)
- [ ] Tested duplicate email handling (400 vs 409 response code)
- [ ] Confirmed JWT token structure includes iat, exp, userId (no password)
- [ ] Verified `Authorization: Bearer <token>` header format
- [ ] Confirmed required contact fields (firstName, lastName assumed)
- [ ] Tested GET /contacts isolation (User A can't see User B's contacts)
- [ ] Verified 404 response for IDOR attempts (not 200 with data)
- [ ] Checked logout behavior (client-side only vs server-side invalidation)
- [ ] Confirmed status codes (201 for create vs 200)
- [ ] Verified error message format (error vs message field)

---

## Updating This Document

As you discover actual API behavior:

1. **Test runs fail:** Note the expected vs actual
2. **Update assumption:** Change text to reflect reality
3. **Add note:** If surprising/important finding
4. **Re-run tests:** Ensure they now pass
5. **Commit:** Document the finding in git history

---

## Examples: Correcting Failed Assumptions

### Example 1: Password Minimum Length

**Original Assumption:** 7 characters
**Test Result:** REG-07 fails with 6-char password still accepted
**Finding:** Minimum is actually 6 characters
**Correction:**

```typescript
// In testData.ts
export const passwordBoundaryValues = {
  belowMinimum: 'Pass1!', // Changed from 6 to 5 chars
  atMinimum: 'Pass1!', // Changed from 7 to 6 chars
  // ...
};
```

### Example 2: Status Code for Create

**Original Assumption:** POST /contacts returns 201
**Test Result:** API-CON-01 receives 200 instead
**Finding:** App uses 200 for all successful operations
**Correction:**

```typescript
// In contacts.spec.ts
expect(response.status()).toBe(200); // Changed from 201
```

### Example 3: IDOR Handling

**Original Assumption:** 404 when User B accesses User A's contact
**Test Result:** API-SEC-IDOR-01 receives 200 with data (data leak!)
**Finding:** CRITICAL SECURITY BUG - IDOR vulnerability exists
**Action:**

- Stop running production tests
- Report as Critical severity finding
- File bug with app maintainers

---

**Document Last Updated:** 2026-08-03
**Playwright Version:** 1.48.0
**Node Version:** 18.0.0+
