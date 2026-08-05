/**
 * Test Data Utilities - Dynamic Test Data Generation
 * 
 * CRITICAL FOR SHARED ENVIRONMENT:
 * The Thinking Tester Contact List is a public, shared demo app used by many testers.
 * Hardcoding test email addresses will cause test failures due to duplicate-email errors
 * from other testers' runs. Instead, ALWAYS generate unique identifiers using timestamps.
 * 
 * This file provides reusable generators for test data that must be unique per run.
 */

/**
 * Generates a unique email address using the current timestamp.
 * Format: qa.test.{timestamp}@test.com
 * 
 * Example output: qa.test.1722609834123@test.com
 * This ensures zero collision risk even on a shared, concurrent environment.
 */
export function generateUniqueEmail(): string {
  const timestamp = Date.now();
  return `qa.test.${timestamp}@test.com`;
}

/**
 * Generates a unique email using an optional prefix and timestamp.
 * Useful for creating semantically readable test user names.
 * 
 * Example:
 *   generateUniqueEmailWithPrefix('alice')
 *   Output: qa.alice.1722609834123@test.com
 */
export function generateUniqueEmailWithPrefix(prefix: string): string {
  const timestamp = Date.now();
  return `qa.${prefix}.${timestamp}@test.com`;
}

/**
 * Standard test user credentials.
 * Password meets typical app requirements: 7+ chars, alphanumeric + special char.
 */
export const testPassword = 'Passw0rd1!';

/**
 * Generates a complete test user object with unique email.
 */
export function generateTestUser() {
  return {
    firstName: 'QA',
    lastName: 'Tester',
    email: generateUniqueEmail(),
    password: testPassword,
  };
}

/**
 * Generates a complete test user with custom first/last names.
 */
export function generateTestUserWithName(firstName: string, lastName: string) {
  return {
    firstName,
    lastName,
    email: generateUniqueEmail(),
    password: testPassword,
  };
}

/**
 * Generates a contact payload with unique email (contacts should not share emails with users,
 * but also shouldn't collide with each other in the same test run).
 */
export function generateTestContact(index: number = 0) {
  const timestamp = Date.now();
  const suffix = index > 0 ? `-${index}` : '';
  return {
    firstName: `Contact${suffix}`,
    lastName: `Test${suffix}`,
    email: `contact.${timestamp}${suffix}@test.com`,
    phone: `555999${String(index).padStart(4, '0')}`,
    street1: `${100 + index} Test Ave`,
    street2: '',
    city: 'Springfield',
    stateProvince: 'IL',
    postalCode: '62701',
    country: 'USA',
    birthdate: '1990-01-01',
  };
}

/**
 * Utility to generate N test contacts with unique identifiers.
 * Used in volume tests (e.g., create 11 contacts, verify uniqueness).
 */
export function generateTestContacts(count: number) {
  return Array.from({ length: count }, (_, i) => generateTestContact(i));
}

/**
 * XSS injection payloads for testing input sanitization.
 * These are SAFE to send to the app for testing; they should be escaped/rejected.
 * Why we test these: Prevents stored XSS, DOM XSS, and other injection attacks (OWASP Top 10).
 */
export const xssPayloads = [
  '<script>alert("xss")</script>',
  '"><script>alert("xss")</script>',
  '<img src=x onerror="alert(\'xss\')">',
  '<svg onload=alert("xss")>',
  'javascript:alert("xss")',
  '<iframe src="javascript:alert(\'xss\')"></iframe>',
];

/**
 * SQL injection-like payloads for testing input validation.
 * Why we test these: Prevents authentication bypass and data leakage.
 */
export const sqlInjectionPayloads = [
  "' OR '1'='1",
  "' OR '1'='1' --",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM users --",
  "1'; DELETE FROM contacts; --",
];

/**
 * Boundary test values for password length.
 * Adjust these if you determine the app's actual min/max via the live Swagger docs.
 */
export const passwordBoundaryValues = {
  belowMinimum: 'Pass1!', // 6 chars (assuming min is 7)
  atMinimum: 'Passwrd1', // 7 chars
  aboveMinimum: 'Passw0rd1!', // 10 chars
  veryLong: 'A'.repeat(500) + 'b1!', // 503 chars (test DB/field limits)
};

/**
 * Email validation boundary/edge cases.
 * These explore the email parser's handling of valid RFC 5321 emails.
 */
export const emailBoundaryValues = [
  'user@test.com', // Valid: standard format
  'user.name@test.com', // Valid: dot in local part
  'user+tag@test.com', // Valid: plus addressing (common real-world pattern)
  'user@test.co.uk', // Valid: multi-level TLD
  'usertest.com', // Invalid: missing @
  'user@', // Invalid: missing domain
  '@test.com', // Invalid: missing local part
  'user@@test.com', // Invalid: double @
  '', // Invalid: empty
  '   ', // Invalid: whitespace only
  'user@.com', // Invalid: domain starts with dot
  'user..name@test.com', // Edge case: consecutive dots
];
