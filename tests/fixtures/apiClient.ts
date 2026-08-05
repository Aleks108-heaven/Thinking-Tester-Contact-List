import { Page, APIRequestContext } from '@playwright/test';

/**
 * Authenticated API Client - Reusable Helper for API Tests
 * 
 * This class wraps Playwright's request context to handle:
 * - Authentication token management
 * - Automatic Authorization header injection
 * - Base URL and consistent request formatting
 * - Common assertions for status codes
 * 
 * Why we need this: Avoids repeating login logic in every test file and reduces code duplication.
 * DRY principle applies to test code too!
 */
export class ApiClient {
  private token: string | null = null;
  private baseUrl: string;

  /**
   * Initialize the API client with a base URL.
   * Token is not set yet; call login() first to authenticate.
   */
  constructor(baseUrl: string, private context: APIRequestContext) {
    this.baseUrl = baseUrl;
  }

  /**
   * Authenticate by calling POST /users/login and storing the returned JWT token.
   * All subsequent requests will include this token in the Authorization header.
   * 
   * @param email User email
   * @param password User password
   * @throws If login fails (unexpected status code)
   */
  async login(email: string, password: string): Promise<void> {
    const response = await this.context.post(`${this.baseUrl}/users/login`, {
      data: { email, password },
    });

    if (!response.ok()) {
      throw new Error(
        `Login failed with status ${response.status()}: ${await response.text()}`
      );
    }

    const data = await response.json() as { token: string };
    this.token = data.token;
  }

  /**
   * Check if client is currently authenticated (has a token).
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Get the current token (useful for assertions or manual verification).
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Clear the token (simulate logout or between test cases).
   */
  clearToken(): void {
    this.token = null;
  }

  /**
   * Helper: Build Authorization header if token is set.
   */
  private getAuthHeader(): Record<string, string> {
    if (!this.token) {
      return {};
    }
    return { Authorization: `Bearer ${this.token}` };
  }

  /**
   * POST request (typically for create/register/login operations).
   */
  async post(endpoint: string, data?: Record<string, unknown>) {
    return this.context.post(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeader(),
      data,
    });
  }

  /**
   * GET request (typically for retrieve/read operations).
   */
  async get(endpoint: string) {
    return this.context.get(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeader(),
    });
  }

  /**
   * PUT request (typically for full replace/update operations).
   */
  async put(endpoint: string, data?: Record<string, unknown>) {
    return this.context.put(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeader(),
      data,
    });
  }

  /**
   * PATCH request (typically for partial updates).
   */
  async patch(endpoint: string, data?: Record<string, unknown>) {
    return this.context.patch(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeader(),
      data,
    });
  }

  /**
   * DELETE request (typically for removal operations).
   */
  async delete(endpoint: string) {
    return this.context.delete(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeader(),
    });
  }

  /**
   * Register a new user account.
   * This is a common setup step in tests, so providing a dedicated method reduces boilerplate.
   */
  async registerUser(
    email: string,
    password: string,
    firstName: string = 'QA',
    lastName: string = 'Tester'
  ) {
    return this.post('/users', {
      email,
      password,
      firstName,
      lastName,
    });
  }

  /**
   * Get the currently authenticated user's profile (if logged in).
   */
  async getCurrentUser() {
    return this.get('/users/me');
  }

  /**
   * Logout the current session.
   * Note: In JWT-based apps, logout is often just client-side token removal.
   * The JWT itself may remain valid server-side until expiry. This is a common finding to document.
   */
  async logout() {
    const response = await this.post('/users/logout');
    // Clear the local token after logout request completes
    if (response.ok()) {
      this.clearToken();
    }
    return response;
  }

  /**
   * Create a new contact.
   * Requires authentication; will fail with 401 if token is not set.
   */
  async createContact(contactData: Record<string, unknown>) {
    return this.post('/contacts', contactData);
  }

  /**
   * List all contacts for the authenticated user.
   */
  async listContacts() {
    return this.get('/contacts');
  }

  /**
   * Get a single contact by ID.
   */
  async getContact(contactId: string) {
    return this.get(`/contacts/${contactId}`);
  }

  /**
   * Update a contact by ID.
   */
  async updateContact(contactId: string, contactData: Record<string, unknown>) {
    return this.put(`/contacts/${contactId}`, contactData);
  }

  /**
   * Delete a contact by ID.
   */
  async deleteContact(contactId: string) {
    return this.delete(`/contacts/${contactId}`);
  }
}

/**
 * Test fixture factory: Creates an ApiClient bound to a Playwright APIRequestContext.
 * Usage in tests:
 *   const api = createApiClient(context, 'https://example.com');
 *   await api.registerUser('test@test.com', 'password123');
 *   await api.login('test@test.com', 'password123');
 *   const response = await api.listContacts();
 */
export function createApiClient(
  context: APIRequestContext,
  baseUrl: string = 'https://thinking-tester-contact-list.herokuapp.com'
): ApiClient {
  return new ApiClient(baseUrl, context);
}
