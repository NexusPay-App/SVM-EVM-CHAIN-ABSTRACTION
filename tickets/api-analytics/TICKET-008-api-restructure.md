# 🎫 TICKET-008: API Restructure & Consolidation

**Priority**: 🔴 High  
**Estimate**: 12 hours  
**Phase**: API & Analytics  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-005  
**Blocks**: TICKET-009, TICKET-011  

---

## 📝 Description

Completely restructure the API architecture to be project-centric, consistent, and enterprise-ready. Remove legacy endpoints, standardize responses, and implement proper error handling.

**Context**: Current API is scattered with inconsistent patterns. Third-party developers struggle with integration due to poor API design.

---

## 🎯 Acceptance Criteria

- [ ] All endpoints follow consistent project-centric structure
- [ ] Standardized response formats across all endpoints
- [ ] Comprehensive error handling and status codes
- [ ] Proper API versioning implemented
- [ ] Rate limiting and authentication unified
- [ ] OpenAPI specification generated

---

## ✅ Tasks

### **API Architecture Redesign**
- [ ] Remove legacy endpoints (old API key generation, etc.)
- [ ] Implement project-centric URL structure
- [ ] Standardize request/response formats
- [ ] Add consistent error handling
- [ ] Implement API versioning (/v1/, /v2/)

### **Authentication & Authorization**
- [ ] Unify authentication across all endpoints
- [ ] Implement project-based authorization
- [ ] Add permission-based access control
- [ ] Create middleware for consistent auth
- [ ] Add API rate limiting per project

### **Wallet Operations Restructure**
- [ ] Move wallet endpoints under project scope
- [ ] Standardize wallet creation/deployment flow
- [ ] Add proper status tracking for async operations
- [ ] Implement webhook notifications
- [ ] Add batch operations support

### **Documentation & Specification**
- [ ] Generate OpenAPI/Swagger specification
- [ ] Create comprehensive API documentation
- [ ] Add interactive API explorer
- [ ] Provide code examples for all endpoints
- [ ] Create Postman collection

---

## 🏗️ New API Structure

### **Authentication & Projects**
```
POST   /v1/auth/register
POST   /v1/auth/login
GET    /v1/auth/profile
PUT    /v1/auth/profile

GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/:projectId
PUT    /v1/projects/:projectId
DELETE /v1/projects/:projectId

GET    /v1/projects/:projectId/members
POST   /v1/projects/:projectId/members
PUT    /v1/projects/:projectId/members/:userId
DELETE /v1/projects/:projectId/members/:userId
```

### **API Key Management**
```
GET    /v1/projects/:projectId/api-keys
POST   /v1/projects/:projectId/api-keys
PUT    /v1/projects/:projectId/api-keys/:keyId
DELETE /v1/projects/:projectId/api-keys/:keyId
POST   /v1/projects/:projectId/api-keys/:keyId/rotate
GET    /v1/projects/:projectId/api-keys/:keyId/usage
```

### **Wallet Operations**
```
POST   /v1/projects/:projectId/wallets/create
POST   /v1/projects/:projectId/wallets/deploy
GET    /v1/projects/:projectId/wallets/:walletId
PUT    /v1/projects/:projectId/wallets/:walletId
GET    /v1/projects/:projectId/wallets

POST   /v1/projects/:projectId/wallets/batch/create
GET    /v1/projects/:projectId/wallets/batch/:batchId/status

POST   /v1/projects/:projectId/transactions/send
GET    /v1/projects/:projectId/transactions/:txId
GET    /v1/projects/:projectId/transactions
```

### **Paymaster & Funding**
```
GET    /v1/projects/:projectId/paymaster/balance
GET    /v1/projects/:projectId/paymaster/addresses
POST   /v1/projects/:projectId/paymaster/fund
GET    /v1/projects/:projectId/paymaster/transactions
```

### **Analytics & Reporting**
```
GET    /v1/projects/:projectId/analytics/overview
GET    /v1/projects/:projectId/analytics/transactions
GET    /v1/projects/:projectId/analytics/users
GET    /v1/projects/:projectId/analytics/costs
GET    /v1/projects/:projectId/analytics/export
```

---

## 📋 Standardized Response Format

### **Success Response**
```javascript
{
  "success": true,
  "data": {
    // Actual response data
  },
  "meta": {
    "timestamp": "2024-12-26T10:00:00Z",
    "request_id": "req_abc123",
    "api_version": "v1",
    "rate_limit": {
      "limit": 1000,
      "remaining": 995,
      "reset": "2024-12-26T11:00:00Z"
    }
  }
}
```

### **Error Response**
```javascript
{
  "success": false,
  "error": {
    "code": "WALLET_CREATION_FAILED",
    "message": "Unable to create wallet on specified chain",
    "details": "Insufficient paymaster balance for gas fees",
    "field": "chain", // if applicable
    "documentation_url": "https://docs.nexuspay.io/errors/wallet-creation-failed"
  },
  "meta": {
    "timestamp": "2024-12-26T10:00:00Z",
    "request_id": "req_abc123",
    "api_version": "v1"
  }
}
```

### **Pagination Response**
```javascript
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25,
    "has_more": true,
    "next_page": "/v1/projects/proj_abc123/wallets?page=2&limit=50",
    "prev_page": null
  },
  "meta": {
    "timestamp": "2024-12-26T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

---

## 🔧 Implementation Details

### **Middleware Stack**
```javascript
// API middleware stack
app.use('/v1', [
  cors(),
  helmet(),
  compression(),
  requestId(),
  requestLogger(),
  apiVersioning(),
  authentication(),
  projectAuthorization(),
  rateLimiting(),
  validation(),
  errorHandler()
]);

// Project context middleware
const projectContext = async (req, res, next) => {
  const { projectId } = req.params;
  
  if (projectId) {
    const project = await getProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }
    
    req.project = project;
  }
  
  next();
};
```

### **Error Handling**
```javascript
// Centralized error handler
const errorHandler = (err, req, res, next) => {
  const errorResponse = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: err.details || null,
      field: err.field || null,
      documentation_url: `https://docs.nexuspay.io/errors/${err.code?.toLowerCase()}`
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
      api_version: req.apiVersion || 'v1'
    }
  };
  
  // Log error for debugging
  logger.error('API Error', {
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  });
  
  res.status(err.statusCode || 500).json(errorResponse);
};

// Common error types
class APIError extends Error {
  constructor(code, message, statusCode = 400, details = null, field = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.field = field;
  }
}

class ValidationError extends APIError {
  constructor(field, message) {
    super('VALIDATION_ERROR', message, 400, null, field);
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401);
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Insufficient permissions') {
    super('INSUFFICIENT_PERMISSIONS', message, 403);
  }
}
```

### **Request Validation**
```javascript
// Input validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const field = error.details[0].path.join('.');
      const message = error.details[0].message;
      
      throw new ValidationError(field, message);
    }
    
    req.validatedBody = value;
    next();
  };
};

// Example schema for wallet creation
const walletCreationSchema = Joi.object({
  socialId: Joi.string().required(),
  socialType: Joi.string().valid('email', 'twitter', 'discord', 'gameId').required(),
  chains: Joi.array().items(Joi.string().valid('ethereum', 'solana', 'arbitrum')).min(1).required(),
  paymasterEnabled: Joi.boolean().default(true),
  metadata: Joi.object().optional()
});
```

---

## 🔌 Updated Wallet Creation Endpoint

### **New Project-Centric Wallet Creation**
```javascript
POST /v1/projects/:projectId/wallets/create
Headers: {
  "Authorization": "Bearer jwt_token",
  "X-API-Key": "npay_proj_abc123_live_...",
  "Content-Type": "application/json"
}

Body:
{
  "socialId": "user123@email.com",
  "socialType": "email",
  "chains": ["ethereum", "solana", "arbitrum"],
  "paymasterEnabled": true,
  "metadata": {
    "environment": "production",
    "source": "mobile_app"
  }
}

Response:
{
  "success": true,
  "data": {
    "walletId": "wallet_def456",
    "addresses": {
      "ethereum": "0x123...",
      "solana": "G1RD...",
      "arbitrum": "0x456..."
    },
    "status": "created",
    "deployment_status": {
      "ethereum": "pending",
      "solana": "pending", 
      "arbitrum": "pending"
    },
    "webhook_url": "https://your-app.com/webhooks/wallet-updates",
    "created_at": "2024-12-26T10:00:00Z"
  },
  "meta": {
    "timestamp": "2024-12-26T10:00:00Z",
    "request_id": "req_abc123",
    "project": {
      "id": "proj_abc123",
      "name": "My DeFi App"
    }
  }
}
```

---

## 📚 OpenAPI Specification

### **Generated Documentation Structure**
```yaml
openapi: 3.0.0
info:
  title: NexusPay Wallet API
  description: Enterprise-grade cross-chain wallet infrastructure
  version: 1.0.0
  contact:
    name: NexusPay Support
    url: https://docs.nexuspay.io
    email: support@nexuspay.io

servers:
  - url: https://api.nexuspay.io/v1
    description: Production server
  - url: https://staging-api.nexuspay.io/v1
    description: Staging server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    Project:
      type: object
      properties:
        id:
          type: string
          example: "proj_abc123def456"
        name:
          type: string
          example: "My DeFi App"
        created_at:
          type: string
          format: date-time

paths:
  /projects/{projectId}/wallets/create:
    post:
      summary: Create cross-chain wallets
      security:
        - BearerAuth: []
        - ApiKeyAuth: []
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] Request validation for all endpoints
- [ ] Error handling consistency
- [ ] Response format standardization
- [ ] Authentication and authorization flows
- [ ] Rate limiting enforcement

### **Integration Tests**
- [ ] End-to-end API flows
- [ ] Project-centric operations
- [ ] Cross-endpoint consistency
- [ ] Webhook delivery
- [ ] Batch operation handling

### **API Contract Tests**
- [ ] OpenAPI specification compliance
- [ ] Response schema validation
- [ ] Breaking change detection
- [ ] Backward compatibility verification

---

## 📊 Success Metrics

- [ ] API response time < 200ms average
- [ ] Error rate < 1% for valid requests
- [ ] Documentation completeness > 95%
- [ ] Third-party integration time < 30 minutes
- [ ] API consistency score > 90%

---

## 🚀 Next Steps

**After completion**:
1. Update SDK to use new API structure
2. Create migration guide for existing users
3. Set up API monitoring and alerting
4. Implement API analytics and usage tracking

---

## 📝 Notes

- Maintain backward compatibility during transition
- Implement comprehensive logging for debugging
- Use feature flags for gradual rollout
- Monitor API usage patterns during migration
- Provide clear deprecation timeline for old endpoints 