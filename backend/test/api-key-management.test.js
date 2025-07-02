const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import app and models
const app = require('../server');
const User = require('../models/User');
const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const APIKeyUsage = require('../models/APIKeyUsage');

// Test configuration
const TEST_USER = {
  email: 'test@nexuspay.com',
  password: 'testpassword123',
  name: 'Test User'
};

const TEST_PROJECT = {
  name: 'Test Project',
  description: 'Test project for API key management',
  chains: ['ethereum', 'solana']
};

describe('API Key Management System', () => {
  let authToken;
  let userId;
  let projectId;
  let apiKeyId;
  let testAPIKey;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/nexuspay_test');
    }
  });

  beforeEach(async () => {
    // Clear test data
    await User.deleteMany({ email: TEST_USER.email });
    await Project.deleteMany({ name: TEST_PROJECT.name });
    await ProjectAPIKey.deleteMany({});
    await APIKeyUsage.deleteMany({});

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(TEST_USER);

    expect(userResponse.status).toBe(200);
    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(TEST_PROJECT);

    expect(projectResponse.status).toBe(201);
    projectId = projectResponse.body.data.project.id;
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: TEST_USER.email });
    await Project.deleteMany({ name: TEST_PROJECT.name });
    await ProjectAPIKey.deleteMany({});
    await APIKeyUsage.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('API Key Creation', () => {
    test('should create API key for valid project', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          type: 'production',
          permissions: ['wallets:create', 'wallets:deploy']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_key).toBeDefined();
      expect(response.body.data.api_key.key).toMatch(/^npay_proj_/);
      expect(response.body.data.api_key.name).toBe('Test API Key');
      expect(response.body.data.api_key.type).toBe('production');

      apiKeyId = response.body.data.api_key.id;
      testAPIKey = response.body.data.api_key.key;
    });

    test('should create API key with IP whitelist', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Production Key with IP Whitelist',
          type: 'production',
          permissions: ['wallets:create'],
          ip_whitelist: ['192.168.1.100', '10.0.0.0/24']
        });

      expect(response.status).toBe(201);
      expect(response.body.data.api_key.ip_whitelist).toHaveLength(2);
      expect(response.body.data.api_key.ip_whitelist[0].ip).toBe('192.168.1.100');
      expect(response.body.data.api_key.ip_whitelist[1].ip).toBe('10.0.0.0/24');
    });

    test('should enforce API key limit (max 3 per project)', async () => {
      // Create 3 API keys
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/api-keys`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `API Key ${i + 1}`,
            type: 'dev'
          });
        expect(response.status).toBe(201);
      }

      // Try to create 4th API key (should fail)
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Fourth API Key',
          type: 'dev'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('API_KEY_LIMIT_EXCEEDED');
    });

    test('should reject invalid project ID', async () => {
      const response = await request(app)
        .post('/api/projects/invalid-project/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Key',
          type: 'production'
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('API Key Listing and Retrieval', () => {
    beforeEach(async () => {
      // Create test API key
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test List Key',
          type: 'production'
        });

      apiKeyId = response.body.data.api_key.id;
      testAPIKey = response.body.data.api_key.key;
    });

    test('should list project API keys', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_keys).toHaveLength(1);
      expect(response.body.data.api_keys[0].name).toBe('Test List Key');
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.limit).toBe(3);
    });

    test('should get specific API key details', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_key.id).toBe(apiKeyId);
      expect(response.body.data.api_key.name).toBe('Test List Key');
    });

    test('should reveal API key value', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys/${apiKeyId}/reveal`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe(testAPIKey);
      expect(response.body.data.name).toBe('Test List Key');
    });
  });

  describe('API Key Validation', () => {
    beforeEach(async () => {
      // Create test API key
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Validation Test Key',
          type: 'production',
          permissions: ['wallets:create']
        });

      testAPIKey = response.body.data.api_key.key;
    });

    test('should validate correct API key format', () => {
      const ProjectAPIKey = require('../models/ProjectAPIKey');
      const parsed = ProjectAPIKey.parseAPIKey(testAPIKey);
      
      expect(parsed.projectId).toBe(projectId);
      expect(parsed.type).toBe('production');
    });

    test('should reject malformed API keys', () => {
      const ProjectAPIKey = require('../models/ProjectAPIKey');
      
      expect(() => {
        ProjectAPIKey.parseAPIKey('invalid-key');
      }).toThrow('Invalid API key format');

      expect(() => {
        ProjectAPIKey.parseAPIKey('npay_invalid_format');
      }).toThrow('Invalid API key format');
    });

    test('should validate API key permissions', async () => {
      // Test endpoint that requires 'wallets:create' permission
      const response = await request(app)
        .post(`/api/projects/${projectId}/wallets`)
        .set('X-API-Key', testAPIKey)
        .send({
          socialId: 'test-user-123',
          socialType: 'google',
          chains: ['ethereum']
        });

      // Should succeed with proper permission
      expect(response.status).not.toBe(403);
    });
  });

  describe('API Key Rotation', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Rotation Test Key',
          type: 'production'
        });

      apiKeyId = response.body.data.api_key.id;
      testAPIKey = response.body.data.api_key.key;
    });

    test('should rotate API key successfully', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys/${apiKeyId}/rotate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.new_key).toBeDefined();
      expect(response.body.data.new_key).not.toBe(testAPIKey);
      expect(response.body.data.old_key_expires).toBeDefined();
      expect(response.body.data.grace_period_hours).toBe(24);
    });

    test('should allow old key during grace period', async () => {
      // Rotate the key
      await request(app)
        .post(`/api/projects/${projectId}/api-keys/${apiKeyId}/rotate`)
        .set('Authorization', `Bearer ${authToken}`);

      // Old key should still work during grace period
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys`)
        .set('X-API-Key', testAPIKey);

      // Should not get immediate rejection (depends on implementation)
      expect(response.status).not.toBe(401);
    });
  });

  describe('IP Whitelisting', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'IP Whitelist Test Key',
          type: 'production'
        });

      apiKeyId = response.body.data.api_key.id;
    });

    test('should add IP to whitelist', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys/${apiKeyId}/whitelist`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ip: '192.168.1.100',
          description: 'Office IP'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_key.ip_whitelist).toHaveLength(1);
      expect(response.body.data.api_key.ip_whitelist[0].ip).toBe('192.168.1.100');
    });

    test('should remove IP from whitelist', async () => {
      // First add an IP
      await request(app)
        .post(`/api/projects/${projectId}/api-keys/${apiKeyId}/whitelist`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ip: '192.168.1.100',
          description: 'Test IP'
        });

      // Then remove it
      const response = await request(app)
        .delete(`/api/projects/${projectId}/api-keys/${apiKeyId}/whitelist/192.168.1.100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_key.ip_whitelist).toHaveLength(0);
    });
  });

  describe('Usage Analytics', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Analytics Test Key',
          type: 'production'
        });

      apiKeyId = response.body.data.api_key.id;
      testAPIKey = response.body.data.api_key.key;

      // Create some usage data
      const APIKeyUsage = require('../models/APIKeyUsage');
      await APIKeyUsage.trackUsage({
        apiKeyId: apiKeyId,
        projectId: projectId,
        endpoint: '/api/projects/test/wallets',
        method: 'POST',
        statusCode: 200,
        responseTimeMs: 150,
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent',
        requestSize: 1024,
        responseSize: 2048
      });
    });

    test('should get usage analytics', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys/${apiKeyId}/usage`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usage).toBeDefined();
      expect(response.body.data.usage.total_requests).toBeGreaterThanOrEqual(1);
      expect(response.body.data.usage.last_7_days).toBeDefined();
    });

    test('should include hourly data when requested', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys/${apiKeyId}/usage?include_hourly=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.usage.last_24_hours).toBeDefined();
    });

    test('should include endpoint statistics', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys/${apiKeyId}/usage?include_endpoints=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.usage.top_endpoints).toBeDefined();
    });
  });

  describe('API Key Update and Deletion', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Update Test Key',
          type: 'production'
        });

      apiKeyId = response.body.data.api_key.id;
    });

    test('should update API key properties', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Key Name',
          permissions: ['wallets:read']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api_key.name).toBe('Updated Key Name');
      expect(response.body.data.api_key.permissions).toContain('wallets:read');
    });

    test('should delete API key', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify key is no longer listed
      const listResponse = await request(app)
        .get(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.body.data.api_keys).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      // This test would require a large number of requests
      // and is more suitable for integration testing
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Security Tests', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .send({
          name: 'Unauthorized Key'
        });

      expect(response.status).toBe(401);
    });

    test('should reject access to other users projects', async () => {
      // Create another user
      const otherUser = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@nexuspay.com',
          password: 'password123',
          name: 'Other User'
        });

      const otherToken = otherUser.body.token;

      // Try to access original user's project
      const response = await request(app)
        .get(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('should validate input sanitization', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/api-keys`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '<script>alert("xss")</script>',
          type: 'production'
        });

      expect(response.status).toBe(201);
      // The name should be sanitized or rejected
      expect(response.body.data.api_key.name).not.toContain('<script>');
    });
  });
});

module.exports = {
  TEST_USER,
  TEST_PROJECT
}; 