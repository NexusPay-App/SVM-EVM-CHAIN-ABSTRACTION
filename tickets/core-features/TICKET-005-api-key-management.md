# 🎫 TICKET-005: Project-Based API Keys

**Priority**: 🔴 High  
**Estimate**: 6 hours  
**Phase**: Core Features  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-003  
**Blocks**: TICKET-008  

---

## 📝 Description

Replace the current open API key generation with project-scoped API keys. Users must have a project before they can generate API keys, and each key is tied to a specific project with proper scoping and permissions.

**Context**: Currently anyone can generate API keys. We need project-based keys for proper access control and usage tracking.

---

## 🎯 Acceptance Criteria

- [ ] API keys can only be generated for existing projects
- [ ] Each API key tied to specific project ID
- [ ] Usage tracking and rate limiting per project working
- [ ] Key rotation functionality implemented
- [ ] Different key types (dev, production, restricted) supported
- [ ] Key permissions and scoping functional

---

## ✅ Tasks

### **API Key System Redesign**
- [ ] Remove current open API key generation
- [ ] Create project_api_keys table with proper schema
- [ ] Implement key generation tied to project ownership
- [ ] Add key scoping and permission levels
- [ ] Create key expiration and rotation system

### **Key Management Endpoints**
- [ ] Implement `POST /projects/:projectId/api-keys`
- [ ] Implement `GET /projects/:projectId/api-keys`
- [ ] Implement `PUT /projects/:projectId/api-keys/:keyId`
- [ ] Implement `DELETE /projects/:projectId/api-keys/:keyId`
- [ ] Implement `POST /projects/:projectId/api-keys/:keyId/rotate`

### **Usage Analytics**
- [ ] Track API calls per key/project
- [ ] Implement rate limiting per project
- [ ] Add usage reporting and analytics
- [ ] Create billing-ready usage metrics
- [ ] Add abuse detection and alerting

### **Security & Validation**
- [ ] Update API validation middleware
- [ ] Add project context to all API calls
- [ ] Implement key-based permissions
- [ ] Add IP whitelisting for production keys
- [ ] Create audit logging for key usage

---

## 🔌 API Endpoints

```javascript
// Create API key for project
POST /projects/proj_abc123/api-keys
Headers: { Authorization: "Bearer jwt_token" }
{
  "name": "Production API Key",
  "type": "production", // dev, production, restricted
  "permissions": ["wallets:create", "wallets:deploy", "payments:send"],
  "ip_whitelist": ["192.168.1.0/24"],
  "expires_at": "2025-12-26T00:00:00Z" // optional
}

Response:
{
  "success": true,
  "api_key": {
    "id": "key_xyz789",
    "key": "npay_proj_abc123_live_1234567890abcdef...", 
    "name": "Production API Key",
    "type": "production",
    "project_id": "proj_abc123",
    "created_at": "2024-12-26T10:00:00Z",
    "expires_at": "2025-12-26T00:00:00Z"
  },
  "warning": "Save this key securely - it won't be shown again"
}

// List project API keys
GET /projects/proj_abc123/api-keys
Response:
{
  "api_keys": [
    {
      "id": "key_xyz789",
      "name": "Production API Key",
      "type": "production", 
      "key_preview": "npay_proj_abc123_live_1234...",
      "last_used": "2024-12-26T09:30:00Z",
      "usage_count": 1247,
      "created_at": "2024-12-26T10:00:00Z"
    }
  ]
}

// Get key usage analytics
GET /projects/proj_abc123/api-keys/key_xyz789/usage
Response:
{
  "usage": {
    "total_requests": 1247,
    "requests_today": 45,
    "rate_limit": 1000,
    "rate_limit_remaining": 955,
    "last_24h": [
      { "hour": "2024-12-26T09:00:00Z", "requests": 12 },
      { "hour": "2024-12-26T10:00:00Z", "requests": 33 }
    ]
  }
}

// Rotate API key
POST /projects/proj_abc123/api-keys/key_xyz789/rotate
Response:
{
  "success": true,
  "new_key": "npay_proj_abc123_live_newkey1234...",
  "old_key_expires": "2024-12-27T10:00:00Z", // 24h grace period
  "warning": "Update your applications within 24 hours"
}
```

---

## 💾 Database Schema

```sql
-- Project API keys
CREATE TABLE project_api_keys (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_preview VARCHAR(50) NOT NULL, -- First and last 4 chars for display
  type VARCHAR(50) NOT NULL, -- dev, production, restricted
  permissions TEXT, -- JSON array of permissions
  ip_whitelist TEXT, -- JSON array of allowed IPs
  rate_limit_per_minute INTEGER DEFAULT 100,
  created_by VARCHAR(50) REFERENCES users(id),
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active', -- active, revoked, expired
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API key usage tracking
CREATE TABLE api_key_usage (
  id VARCHAR(50) PRIMARY KEY,
  api_key_id VARCHAR(50) REFERENCES project_api_keys(id) ON DELETE CASCADE,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting (in-memory cache in production)
CREATE TABLE api_rate_limits (
  id VARCHAR(50) PRIMARY KEY,
  api_key_id VARCHAR(50) REFERENCES project_api_keys(id) ON DELETE CASCADE,
  requests_count INTEGER DEFAULT 0,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(api_key_id)
);
```

---

## 🔐 API Key Format & Security

### **Key Format**
```javascript
// New format: npay_{project_id}_{type}_{random}
// Examples:
// npay_proj_abc123_dev_1234567890abcdef
// npay_proj_abc123_live_fedcba0987654321  
// npay_proj_abc123_test_abcdef1234567890

function generateAPIKey(projectId, type) {
  const prefix = 'npay';
  const random = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${projectId}_${type}_${random}`;
}

function parseAPIKey(apiKey) {
  const parts = apiKey.split('_');
  if (parts.length !== 4 || parts[0] !== 'npay') {
    throw new Error('Invalid API key format');
  }
  
  return {
    projectId: parts[1] + '_' + parts[2], // proj_abc123
    type: parts[3],
    random: parts[4]
  };
}
```

### **Key Validation Middleware**
```javascript
const validateProjectAPIKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apikey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  try {
    // Parse key to get project ID
    const keyInfo = parseAPIKey(apiKey);
    
    // Validate key in database
    const dbKey = await getAPIKeyByHash(hashKey(apiKey));
    if (!dbKey || dbKey.status !== 'active') {
      return res.status(401).json({ 
        error: 'Invalid or revoked API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Check expiration
    if (dbKey.expires_at && new Date() > dbKey.expires_at) {
      return res.status(401).json({ 
        error: 'API key expired',
        code: 'EXPIRED_API_KEY'
      });
    }
    
    // Check rate limiting
    if (await isRateLimited(dbKey.id)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED'
      });
    }
    
    // Add project context to request
    req.project = dbKey.project;
    req.apiKey = dbKey;
    req.permissions = JSON.parse(dbKey.permissions || '[]');
    
    // Track usage
    await trackAPIUsage(dbKey.id, req);
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid API key format',
      code: 'MALFORMED_API_KEY'
    });
  }
};
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] API key generation and format validation
- [ ] Key parsing and project extraction
- [ ] Permission checking logic
- [ ] Rate limiting implementation
- [ ] Key rotation functionality

### **Integration Tests**
- [ ] Project creation → API key generation → API call flow
- [ ] Key rotation with grace period
- [ ] Rate limiting enforcement
- [ ] Permission-based access control
- [ ] Usage tracking accuracy

### **Security Tests**
- [ ] Key brute force protection
- [ ] Permission escalation prevention
- [ ] Rate limit bypass attempts
- [ ] Malformed key handling
- [ ] Expired key rejection

---

## 🔧 Implementation Notes

### **Migration Strategy**
```javascript
// Migrate existing API keys to new format
async function migrateExistingAPIKeys() {
  const existingKeys = await getOldAPIKeys();
  
  for (const oldKey of existingKeys) {
    // Create default project for existing key holders
    const project = await createMigrationProject(oldKey);
    
    // Convert old key to new format
    await createNewProjectAPIKey(project.id, oldKey);
    
    // Mark old key as deprecated
    await markOldKeyDeprecated(oldKey.id);
  }
}
```

### **Rate Limiting Strategy**
```javascript
// Redis-based rate limiting for production
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const createProjectRateLimit = (apiKey) => {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: `rl:${apiKey.project_id}:`
    }),
    max: apiKey.rate_limit_per_minute,
    windowMs: 60 * 1000, // 1 minute
    message: {
      error: 'Rate limit exceeded for project',
      limit: apiKey.rate_limit_per_minute,
      window: '1 minute'
    }
  });
};
```

---

## 📊 Success Metrics

- [ ] API key validation time < 50ms
- [ ] Rate limiting accuracy > 99.9%
- [ ] Zero unauthorized project access
- [ ] Key rotation success rate > 99%
- [ ] Usage tracking accuracy > 99.9%

---

## 🚀 Next Steps

**After completion**:
1. Update SDK to use new API key format
2. Create API key management dashboard
3. Implement billing based on usage metrics
4. Add webhook notifications for key events

---

## 📝 Notes

- Provide 30-day notice before removing old API key support
- Create migration guide for existing users
- Implement gradual rollout with feature flags
- Monitor usage patterns during migration
- Set up alerting for authentication failures 