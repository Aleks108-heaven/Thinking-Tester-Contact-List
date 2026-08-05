import { test, expect } from '@playwright/test';
import { createApiClient } from '../fixtures/apiClient';
import {
  generateTestUser,
  generateTestContact,
  generateTestContacts,
  xssPayloads,
} from '../fixtures/testData';

/**
 * Contacts API Tests
 * 
 * This suite covers CRUD operations on contacts: Create, Read, Update, Delete.
 * 
 * Key risks being tested:
 * 1. Missing required field validation → data integrity issues
 * 2. Invalid email format accepted in contacts → data quality
 * 3. Unauthenticated requests access contacts → authorization bypass
 * 4. IDOR (Insecure Direct Object Reference) → cross-user data leakage (CRITICAL)
 * 5. Stored XSS in contact fields → security/malware
 * 6. Extreme input values (very long strings, special chars) → buffer overflow, DB errors
 * 7. Duplicate/concurrent modifications → race conditions, data loss
 * 8. Cleanup/cascade delete → orphaned data, resource leaks
 */

test.describe('Contacts API - CRUD Operations', () => {
  let api = null as any;
  let testUser = null as any;
  let createdContactIds: string[] = [];

  test.beforeEach(async ({ request }) => {
    // Initialize fresh API client and register/login a test user
    api = createApiClient(request, 'https://thinking-tester-contact-list.herokuapp.com');
    testUser = generateTestUser();
    
    const regResponse = await api.registerUser(
      testUser.email,
      testUser.password,
      testUser.firstName,
      testUser.lastName
    );
    expect(regResponse.status()).toBe(201);
    
    // Login to get auth token
    await api.login(testUser.email, testUser.password);
    expect(api.isAuthenticated()).toBe(true);
    
    // Reset createdContactIds for this test
    createdContactIds = [];
  });

  test.afterEach(async () => {
    // CRITICAL CLEANUP: Delete all created contacts to avoid shared-environment pollution.
    // This is essential on a public demo app where other testers are running concurrent tests.
    for (const contactId of createdContactIds) {
      try {
        const deleteResponse = await api.deleteContact(contactId);
        expect([200, 204]).toContain(deleteResponse.status());
      } catch (err) {
        console.warn(`Failed to cleanup contact ${contactId}:`, err);
      }
    }
  });

  test('API-CON-01: Create contact with all valid fields (happy path)', async () => {
    // Risk: Basic CRUD must work; if create fails, entire suite is broken
    const contactData = generateTestContact(0);
    
    const response = await api.createContact(contactData);
    
    expect(response.status()).toBe(201);
    const contact = await response.json();
    expect(contact).toHaveProperty('_id');
    createdContactIds.push(contact._id);
    
    // Verify all fields are stored correctly
    expect(contact.firstName).toBe(contactData.firstName);
    expect(contact.lastName).toBe(contactData.lastName);
    expect(contact.email).toBe(contactData.email);
    expect(contact.phone).toBe(contactData.phone);
    expect(contact.street1).toBe(contactData.street1);
    expect(contact.city).toBe(contactData.city);
    expect(contact.stateProvince).toBe(contactData.stateProvince);
    expect(contact.postalCode).toBe(contactData.postalCode);
    expect(contact.country).toBe(contactData.country);
    
    // Verify object metadata
    expect(contact.owner).toBeDefined(); // Should reference the creating user
    expect(contact.__v).toBeDefined(); // MongoDB version field
  });

  test('API-CON-02: Create contact with only required fields (minimal)', async () => {
    // Risk: If optional fields are required, API contract is poorly designed
    // First, determine what's actually required by trying minimal payload
    const minimalContact = {
      firstName: 'John',
      lastName: 'Doe',
    };
    
    const response = await api.createContact(minimalContact);
    
    // Accept 201 or 200; verify success indicates optional fields are truly optional
    if (response.ok()) {
      expect([201, 200]).toContain(response.status());
      const contact = await response.json();
      createdContactIds.push(contact._id);
      expect(contact._id).toBeDefined();
    } else {
      // If this fails, the test indicates that the app requires more fields than documented
      expect(response.status()).toBe(400);
      console.warn(
        'API requires additional fields beyond firstName/lastName. Update test data generator if this is expected.'
      );
    }
  });

  test('API-CON-03: Create contact fails without firstName (required field)', async () => {
    // Risk: Missing validation → garbage data in database
    const contactData = generateTestContact(0);
    delete (contactData as any).firstName;
    
    const response = await api.createContact(contactData);
    
    expect(response.status()).toBe(400);
    const error = await response.json();
    // Error shape: {errors: {fieldName: {message: "..."}}, _message: "..."}  
    expect(JSON.stringify(error)).toContain('firstName');
  });

  test('API-CON-04: Create contact fails without lastName (required field)', async () => {
    // Risk: Missing validation
    const contactData = generateTestContact(0);
    delete (contactData as any).lastName;
    
    const response = await api.createContact(contactData);
    
    expect(response.status()).toBe(400);
  });

  test('API-CON-05: Create contact fails with invalid email format', async () => {
    // Risk: Invalid emails → broken communication, data quality
    const contactData = generateTestContact(0);
    contactData.email = 'not-a-valid-email'; // Missing @
    
    const response = await api.createContact(contactData);
    
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(JSON.stringify(error)).toContain('email');
  });

  test('API-CON-06: Create 11 contacts and verify all are unique (volume test)', async () => {
    // Risk: Duplicate IDs or data loss in bulk operations
    // This also tests the app's ability to handle moderate data volumes
    const contactsData = generateTestContacts(11);
    const createdContacts = [];
    
    for (const contactData of contactsData) {
      const response = await api.createContact(contactData);
      expect(response.status()).toBe(201);
      const contact = await response.json();
      createdContacts.push(contact);
      createdContactIds.push(contact._id);
    }
    
    // Verify all 11 have unique IDs
    const ids = createdContacts.map(c => c._id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(11);
    
    // Verify list endpoint returns all 11
    const listResponse = await api.listContacts();
    expect(listResponse.status()).toBe(200);
    const contactsList = await listResponse.json();
    
    for (const createdContact of createdContacts) {
      const found = (contactsList as any[]).find(c => c._id === createdContact._id);
      expect(found).toBeDefined();
    }
  });

  test('API-CON-07: Create contact with XSS payload in firstName', async () => {
    // Risk: Stored XSS → malware delivery, credential theft, session hijacking
    const contactData = generateTestContact(0);
    contactData.firstName = xssPayloads[0]; // '<script>alert("xss")</script>'
    
    const response = await api.createContact(contactData);
    
    if (response.ok()) {
      // If accepted, must be sanitized (no raw script tags)
      const contact = await response.json();
      createdContactIds.push(contact._id);
      expect(contact.firstName).not.toContain('<script>');
      expect(contact.firstName).not.toContain('alert');
    } else {
      // Or rejected (also acceptable)
      expect(response.status()).toBe(400);
    }
  });

  test('API-CON-08: Get all contacts for authenticated user', async () => {
    // Risk: Ensure list endpoint works and returns only user's own contacts
    // Create a few contacts first
    const contactsData = generateTestContacts(3);
    for (const contactData of contactsData) {
      const response = await api.createContact(contactData);
      expect(response.status()).toBe(201);
      const contact = await response.json();
      createdContactIds.push(contact._id);
    }
    
    // Retrieve list
    const listResponse = await api.listContacts();
    expect(listResponse.status()).toBe(200);
    const contacts = await listResponse.json();
    
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts.length).toBeGreaterThanOrEqual(3);
  });

  test('API-CON-09: Get single contact by valid ID', async () => {
    // Risk: Ensure retrieval works
    const contactData = generateTestContact(0);
    const createResponse = await api.createContact(contactData);
    const contact = await createResponse.json();
    createdContactIds.push(contact._id);
    
    // Retrieve it
    const getResponse = await api.getContact(contact._id);
    expect(getResponse.status()).toBe(200);
    const retrieved = await getResponse.json();
    
    expect(retrieved._id).toBe(contact._id);
    expect(retrieved.firstName).toBe(contactData.firstName);
  });

  test('API-CON-10: Get contact with non-existent ID returns 404', async () => {
    // Risk: Graceful error handling (not 500 crash)
    const fakeId = '000000000000000000000000'; // MongoDB object ID format
    const response = await api.getContact(fakeId);
    
    expect(response.status()).toBe(404);
  });

  test('API-CON-11: Update contact with valid new data', async () => {
    // Risk: Ensure update persists and doesn't corrupt other contacts
    const contactData = generateTestContact(0);
    const createResponse = await api.createContact(contactData);
    const contact = await createResponse.json();
    createdContactIds.push(contact._id);
    
    // Update it
    const updatedData = {
      firstName: 'UpdatedName',
      lastName: 'UpdatedLast',
      email: 'updated@test.com',
      phone: '5559999999',
    };
    
    const updateResponse = await api.updateContact(contact._id, updatedData);
    expect([200, 201]).toContain(updateResponse.status());
    
    // Verify update persisted
    const getResponse = await api.getContact(contact._id);
    const retrieved = await getResponse.json();
    expect(retrieved.firstName).toBe(updatedData.firstName);
    expect(retrieved.email).toBe(updatedData.email);
  });

  test('API-CON-12: Update non-existent contact returns 404', async () => {
    // Risk: Ensure graceful error
    const fakeId = '000000000000000000000000';
    // PUT requires all required fields; include lastName to avoid 400 from validation
    const response = await api.updateContact(fakeId, { firstName: 'Test', lastName: 'User' });
    
    expect(response.status()).toBe(404);
  });

  test('API-CON-13: Delete contact removes it from database', async () => {
    // Risk: Ensure delete actually removes, not just marks as deleted
    const contactData = generateTestContact(0);
    const createResponse = await api.createContact(contactData);
    const contact = await createResponse.json();
    createdContactIds.push(contact._id);
    
    // Delete it
    const deleteResponse = await api.deleteContact(contact._id);
    expect([200, 204]).toContain(deleteResponse.status());
    
    // Verify it's gone
    const getResponse = await api.getContact(contact._id);
    expect(getResponse.status()).toBe(404);
    
    // Remove from cleanup list since we've verified it's deleted
    createdContactIds = createdContactIds.filter(id => id !== contact._id);
  });

  test('API-CON-14: Delete non-existent contact (idempotency check)', async () => {
    // Risk: Idempotent operations are better; repeated delete shouldn't crash
    const fakeId = '000000000000000000000000';
    const response = await api.deleteContact(fakeId);
    
    // Accept 404 (not found) or 200 (idempotent); reject 500 (crash)
    expect([200, 204, 404]).toContain(response.status());
  });

  test('API-CON-15: Very long string in contact field (boundary test)', async () => {
    // Risk: Extreme input → buffer overflow, DB field overflow, 500 error
    const contactData = generateTestContact(0);
    contactData.firstName = 'A'.repeat(5000); // 5000 chars
    
    const response = await api.createContact(contactData);
    
    // Should either truncate gracefully or reject with 400, never crash (500)
    if (response.ok()) {
      expect([201, 200]).toContain(response.status());
      const contact = await response.json();
      createdContactIds.push(contact._id);
      // Verify it was either truncated or stored as-is (acceptable either way)
      expect(contact.firstName).toBeDefined();
    } else {
      expect([400, 413, 422]).toContain(response.status());
    }
  });

  test('API-CON-16: Invalid data type in field (number instead of string)', async () => {
    // Risk: Type confusion can bypass validation, cause DB errors
    const contactData = generateTestContact(0);
    (contactData as any).phone = 5551234567; // Number instead of string
    
    const response = await api.createContact(contactData);
    
    // Should either coerce to string or reject
    if (response.ok()) {
      const contact = await response.json();
      createdContactIds.push(contact._id);
      expect(typeof contact.phone === 'string' || typeof contact.phone === 'number').toBe(true);
    } else {
      expect([400, 422]).toContain(response.status());
    }
  });

  test('API-CON-17: Contact fields are independent (no cross-contamination)', async () => {
    // Risk: Ensure updating one contact doesn't affect others
    const contact1Data = generateTestContact(1);
    const contact2Data = generateTestContact(2);
    
    const c1Response = await api.createContact(contact1Data);
    const contact1 = await c1Response.json();
    createdContactIds.push(contact1._id);
    
    const c2Response = await api.createContact(contact2Data);
    const contact2 = await c2Response.json();
    createdContactIds.push(contact2._id);
    
    // Update contact 1
    await api.updateContact(contact1._id, {
      firstName: 'UpdatedContact1',
    });
    
    // Verify contact 2 is unchanged
    const c2GetResponse = await api.getContact(contact2._id);
    const contact2Updated = await c2GetResponse.json();
    expect(contact2Updated.firstName).toBe(contact2Data.firstName);
  });
});

test.describe('Contacts API - Authorization & Security', () => {
  let api = null as any;
  let user1 = null as any;
  let user2 = null as any;
  let user1Api = null as any;
  let user2Api = null as any;
  let user1ContactId = null as any;
  let createdIds: any = {};

  test.beforeEach(async ({ request }) => {
    // Set up two separate users to test cross-user access
    api = createApiClient(request, 'https://thinking-tester-contact-list.herokuapp.com');
    
    // User 1: register and login
    user1 = generateTestUser();
    await api.registerUser(user1.email, user1.password, user1.firstName, user1.lastName);
    user1Api = createApiClient(request, 'https://thinking-tester-contact-list.herokuapp.com');
    await user1Api.login(user1.email, user1.password);
    
    // User 2: register and login
    user2 = generateTestUser();
    await api.registerUser(user2.email, user2.password, user2.firstName, user2.lastName);
    user2Api = createApiClient(request, 'https://thinking-tester-contact-list.herokuapp.com');
    await user2Api.login(user2.email, user2.password);
    
    // User 1 creates a contact
    const contactData = generateTestContact(0);
    const response = await user1Api.createContact(contactData);
    user1ContactId = (await response.json())._id;
    
    createdIds = { user1: user1ContactId };
  });

  test.afterEach(async () => {
    // Cleanup: delete contacts created during test
    if (user1Api && createdIds.user1) {
      try {
        await user1Api.deleteContact(createdIds.user1);
      } catch (e) {
        console.warn('Cleanup failed for user1 contact:', e);
      }
    }
    if (user2Api && createdIds.user2) {
      try {
        await user2Api.deleteContact(createdIds.user2);
      } catch (e) {
        console.warn('Cleanup failed for user2 contact:', e);
      }
    }
  });

  test('API-SEC-IDOR-01: User cannot access another user\'s contact (CRITICAL)', async () => {
    // Risk: CRITICAL SEVERITY - IDOR is OWASP API Security #1
    // If User B can access User A's contact by guessing/knowing the ID, it's a critical data leak
    // This test MUST pass; failure means unauthorized data access vulnerability
    
    // User 2 attempts to GET User 1's contact by ID
    const response = await user2Api.getContact(user1ContactId);
    
    // Should NOT succeed (not 200)
    expect(response.status()).not.toBe(200);
    // Must be 404 (not found for this user) or 403 (forbidden), not 200 with data
    expect([403, 404]).toContain(response.status());
  });

  test('API-SEC-IDOR-02: User cannot update another user\'s contact', async () => {
    // Risk: IDOR exploitation for data modification (critical)
    // Include lastName so the body passes validation and auth is the deciding factor
    const response = await user2Api.updateContact(user1ContactId, {
      firstName: 'HackedName',
      lastName: 'User',
    });
    
    expect(response.status()).not.toBe(200);
    expect([403, 404]).toContain(response.status());
    
    // Verify User 1's contact is unchanged
    const verifyResponse = await user1Api.getContact(user1ContactId);
    const contact = await verifyResponse.json();
    expect(contact.firstName).not.toBe('HackedName');
  });

  test('API-SEC-IDOR-03: User cannot delete another user\'s contact', async () => {
    // Risk: IDOR for data deletion (critical)
    const deleteResponse = await user2Api.deleteContact(user1ContactId);
    expect([403, 404]).toContain(deleteResponse.status());
    
    // Verify contact still exists for User 1
    const getResponse = await user1Api.getContact(user1ContactId);
    expect(getResponse.status()).toBe(200);
  });

  test('API-SEC-AUTH-01: Unauthenticated request to /contacts returns 401', async () => {
    // Risk: CRITICAL - If unauth users can read contacts, it's a major breach
    const unauthApi = createApiClient(
      api.context,
      'https://thinking-tester-contact-list.herokuapp.com'
    );
    // Don't login
    unauthApi.clearToken();
    
    const response = await unauthApi.listContacts();
    expect(response.status()).toBe(401);
  });

  test('API-SEC-AUTH-02: Unauthenticated create contact returns 401', async () => {
    // Risk: If anyone can create contacts, it's spam/resource exhaustion risk
    const unauthApi = createApiClient(
      api.context,
      'https://thinking-tester-contact-list.herokuapp.com'
    );
    unauthApi.clearToken();
    
    const response = await unauthApi.createContact(generateTestContact(0));
    expect(response.status()).toBe(401);
  });

  test('API-SEC-AUTH-03: User list includes only their own contacts', async () => {
    // Risk: Ensure data isolation between users
    // User 1 creates a second contact
    const contact2Data = generateTestContact(1);
    const c2Response = await user1Api.createContact(contact2Data);
    const contact2Id = (await c2Response.json())._id;
    createdIds.user2_contact = contact2Id;
    
    // User 2 creates their own contact
    const user2ContactData = generateTestContact(2);
    const u2Response = await user2Api.createContact(user2ContactData);
    const user2ContactId = (await u2Response.json())._id;
    createdIds.user2 = user2ContactId;
    
    // User 1 lists their contacts
    const user1ListResponse = await user1Api.listContacts();
    const user1Contacts = await user1ListResponse.json() as any[];
    const user1Ids = user1Contacts.map(c => c._id);
    
    // Should include User 1's contacts
    expect(user1Ids).toContain(user1ContactId);
    expect(user1Ids).toContain(contact2Id);
    
    // Should NOT include User 2's contact
    expect(user1Ids).not.toContain(user2ContactId);
  });
});
