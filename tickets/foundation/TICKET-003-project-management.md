# 🎫 TICKET-003: Project Management System

**Priority**: 🔴 High  
**Estimate**: 12 hours  
**Phase**: Foundation  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-002  
**Blocks**: TICKET-004, TICKET-005, TICKET-007, TICKET-008  

---

## 📝 Description

Implement a project-based organization system where users can create multiple projects, each with its own settings, API keys, and wallets. This is the core of the enterprise restructuring.

**Context**: Currently everything is tied to `socialId + socialType`. We need proper project organization so companies can manage multiple applications/environments.

---

## 🎯 Acceptance Criteria

- [ ] Users can create/manage multiple projects
- [ ] Each project gets unique ID (e.g., `proj_abc123def456`)
- [ ] Project ownership and permissions working
- [ ] Project settings configurable (chains, features enabled)
- [ ] Project deletion with safety checks implemented
- [ ] Project collaboration (team members) functional

---

## ✅ Tasks

### **Database Schema Design**
- [ ] Create projects table with all required fields
- [ ] Create project_members table for collaboration
- [ ] Create project_settings table for configuration
- [ ] Add foreign key relationships and constraints
- [ ] Create indexes for performance

### **Project CRUD Operations**
- [ ] Implement `POST /projects` (create project)
- [ ] Implement `GET /projects` (list user's projects)
- [ ] Implement `GET /projects/:projectId` (get project details)
- [ ] Implement `PUT /projects/:projectId` (update project)
- [ ] Implement `DELETE /projects/:projectId` (delete with safety checks)

### **Project Membership System**
- [ ] Implement `POST /projects/:projectId/members` (invite member)
- [ ] Implement `GET /projects/:projectId/members` (list members)
- [ ] Implement `PUT /projects/:projectId/members/:userId` (update role)
- [ ] Implement `DELETE /projects/:projectId/members/:userId` (remove member)
- [ ] Add role-based permissions (owner, admin, developer, viewer)

### **Project Settings**
- [ ] Implement chain selection (ETH, SOL, ARB only)
- [ ] Add paymaster configuration
- [ ] Add webhook configuration
- [ ] Add rate limiting settings
- [ ] Add notification preferences

---

## 🔌 API Endpoints

### **Project Management**
```javascript
// Create project
POST /projects
Headers: { Authorization: "Bearer jwt_token" }
{
  "name": "My DeFi App",
  "description": "Cross-chain DeFi application",
  "website": "https://mydefi.app",
  "chains": ["ethereum", "solana", "arbitrum"],
  "settings": {
    "paymasterEnabled": true,
    "webhookUrl": "https://myapi.com/webhooks",
    "rateLimit": 1000
  }
}

Response:
{
  "success": true,
  "project": {
    "id": "proj_abc123def456",
    "name": "My DeFi App",
    "slug": "my-defi-app",
    "owner": "user_xyz789",
    "created_at": "2024-12-26T10:00:00Z"
  }
}

// List projects
GET /projects
Response:
{
  "projects": [
    {
      "id": "proj_abc123def456",
      "name": "My DeFi App", 
      "role": "owner",
      "chains": ["ethereum", "solana"],
      "created_at": "2024-12-26T10:00:00Z"
    }
  ]
}
```

### **Project Collaboration**
```javascript
// Invite team member
POST /projects/proj_abc123def456/members
{
  "email": "developer@company.com",
  "role": "developer"
}

// Update member role
PUT /projects/proj_abc123def456/members/user_def456
{
  "role": "admin"
}
```

---

## 💾 Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  website VARCHAR(255),
  owner_id VARCHAR(50) REFERENCES users(id) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project members and permissions
CREATE TABLE project_members (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- owner, admin, developer, viewer
  invited_by VARCHAR(50) REFERENCES users(id),
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Project settings and configuration
CREATE TABLE project_settings (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  chains TEXT, -- JSON array: ["ethereum", "solana", "arbitrum"]
  paymaster_enabled BOOLEAN DEFAULT true,
  webhook_url VARCHAR(255),
  webhook_secret VARCHAR(255),
  rate_limit_per_minute INTEGER DEFAULT 100,
  features TEXT, -- JSON object with feature flags
  notifications TEXT, -- JSON object with notification settings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project activity log
CREATE TABLE project_activity (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- created, updated, member_added, etc.
  details TEXT, -- JSON with action details
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Permission System

### **Role Definitions**
```javascript
const PERMISSIONS = {
  owner: [
    'project:read', 'project:update', 'project:delete',
    'members:read', 'members:invite', 'members:remove', 'members:update',
    'settings:read', 'settings:update',
    'api-keys:read', 'api-keys:create', 'api-keys:delete',
    'wallets:read', 'wallets:create', 'wallets:deploy',
    'analytics:read', 'billing:read', 'billing:update'
  ],
  admin: [
    'project:read', 'project:update',
    'members:read', 'members:invite', 'members:update',
    'settings:read', 'settings:update',
    'api-keys:read', 'api-keys:create', 'api-keys:delete',
    'wallets:read', 'wallets:create', 'wallets:deploy',
    'analytics:read'
  ],
  developer: [
    'project:read',
    'members:read',
    'settings:read',
    'api-keys:read', 'api-keys:create',
    'wallets:read', 'wallets:create', 'wallets:deploy',
    'analytics:read'
  ],
  viewer: [
    'project:read',
    'members:read',
    'settings:read',
    'wallets:read',
    'analytics:read'
  ]
};
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] Project creation with unique ID generation
- [ ] Project slug generation and uniqueness
- [ ] Permission system validation
- [ ] Member invitation and role assignment
- [ ] Project settings validation

### **Integration Tests**
- [ ] Full project creation → member invitation → collaboration flow
- [ ] Project deletion with safety checks
- [ ] Role-based access control enforcement
- [ ] Project settings updates
- [ ] Activity logging

---

## 🔧 Implementation Notes

### **Project ID Generation**
```javascript
// Generate unique project ID
function generateProjectId() {
  const prefix = 'proj_';
  const random = crypto.randomBytes(16).toString('hex');
  return prefix + random;
}

// Generate URL-friendly slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}
```

### **Middleware for Project Access**
```javascript
// Validate project access and permissions
const validateProjectAccess = (requiredPermission) => {
  return async (req, res, next) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    // Check if user has access to project
    const membership = await getProjectMembership(projectId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied to project' });
    }
    
    // Check specific permission
    if (!hasPermission(membership.role, requiredPermission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.project = membership.project;
    req.userRole = membership.role;
    next();
  };
};
```

---

## 📊 Success Metrics

- [ ] Project creation time < 2 seconds
- [ ] Permission checks < 100ms
- [ ] Member invitation emails delivered > 95%
- [ ] No unauthorized access possible
- [ ] Project deletion safety checks prevent accidents

---

## 🚀 Next Steps

**After completion**:
1. Update all wallet operations to require project context
2. Implement project-based API keys (TICKET-005)
3. Create project paymaster wallets (TICKET-004)
4. Add project analytics dashboard

---

## 📝 Notes

- Project names must be unique per user
- Project slugs must be globally unique
- Soft delete projects (don't actually delete, just mark inactive)
- Log all project activity for audit purposes
- Implement proper cascade deletes for data consistency 