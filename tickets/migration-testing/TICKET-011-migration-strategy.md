# 🎫 TICKET-011: Migration Strategy Implementation

**Priority**: 🔴 High  
**Estimate**: 6 hours  
**Phase**: Migration & Testing  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-008  
**Blocks**: TICKET-012  

---

## 📝 Description

Implement a safe, backwards-compatible migration strategy to transition existing users from the old scattered system to the new project-centric architecture without breaking existing integrations.

**Context**: We have existing users with old API keys and wallet integrations. Need seamless migration without service interruption.

---

## 🎯 Acceptance Criteria

- [ ] Existing API keys continue to work during transition
- [ ] Automatic project creation for existing users
- [ ] Data migration scripts complete successfully
- [ ] Backward compatibility maintained for 6 months
- [ ] Migration progress tracking implemented
- [ ] Rollback plan ready and tested

---

## ✅ Tasks

### **Backward Compatibility Layer**
- [ ] Create legacy API endpoint wrapper
- [ ] Map old API calls to new project-centric structure
- [ ] Maintain old response formats
- [ ] Add deprecation warnings to responses
- [ ] Implement automatic user/project creation

### **Data Migration Scripts**
- [ ] Create migration scripts for existing data
- [ ] Migrate existing API keys to project context
- [ ] Transfer wallet data to new schema
- [ ] Preserve user preferences and settings
- [ ] Validate data integrity after migration

### **Migration Monitoring**
- [ ] Track migration progress per user
- [ ] Monitor API usage patterns during transition
- [ ] Log migration errors and edge cases
- [ ] Create migration status dashboard
- [ ] Set up alerting for migration issues

### **Communication & Documentation**
- [ ] Create migration guide for existing users
- [ ] Send email notifications about changes
- [ ] Update documentation with migration timelines
- [ ] Provide support during transition period
- [ ] Create FAQ for common migration questions

---

## 🔄 Migration Strategy

### **Phase 1: Compatibility Layer (Week 1)**
```javascript
// Legacy API wrapper
app.use('/api/generate-api-key', async (req, res) => {
  console.warn('DEPRECATED: /api/generate-api-key is deprecated. Use /v1/projects/:projectId/api-keys');
  
  try {
    // Create or find default project for user
    const user = await findOrCreateLegacyUser(req.body.email);
    const project = await findOrCreateDefaultProject(user.id);
    
    // Create API key for project
    const apiKey = await createProjectAPIKey(project.id, {
      name: 'Legacy Migration Key',
      type: 'production',
      created_by: user.id
    });
    
    // Return old format response with new key
    res.json({
      success: true,
      apiKey: apiKey.key,
      projectId: project.id,
      message: 'This endpoint is deprecated. Please migrate to /v1/projects/:projectId/api-keys',
      migration_guide: 'https://docs.nexuspay.io/migration-guide'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy wallet creation wrapper
app.use('/api/auth/quick-setup', async (req, res) => {
  console.warn('DEPRECATED: /api/auth/quick-setup is deprecated. Use /v1/projects/:projectId/wallets/create');
  
  try {
    // Find or create user and project
    const user = await findOrCreateLegacyUser(req.body.email);
    const project = await findOrCreateDefaultProject(user.id);
    
    // Create wallet using new API
    const wallet = await createProjectWallet(project.id, {
      socialId: req.body.email,
      socialType: 'email',
      chains: ['ethereum', 'solana', 'arbitrum'],
      paymasterEnabled: true
    });
    
    // Return old format response
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddresses: wallet.addresses
      },
      message: 'This endpoint is deprecated. Please migrate to project-based API',
      new_api_example: {
        endpoint: `/v1/projects/${project.id}/wallets/create`,
        api_key: `npay_${project.id}_live_...`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### **Phase 2: Data Migration (Week 2)**
```javascript
// Migration script
async function migrateExistingData() {
  console.log('Starting migration of existing data...');
  
  // 1. Migrate existing API keys
  const oldApiKeys = await getOldAPIKeys();
  
  for (const oldKey of oldApiKeys) {
    try {
      // Create user if doesn't exist
      const user = await findOrCreateUser(oldKey.email);
      
      // Create default project
      const project = await createProject(user.id, {
        name: `${user.name || 'Legacy'} Project`,
        description: 'Migrated from legacy system',
        chains: ['ethereum', 'solana', 'arbitrum'],
        settings: {
          paymasterEnabled: true,
          rateLimit: 1000
        }
      });
      
      // Convert old key to new format
      const newApiKey = await createProjectAPIKey(project.id, {
        name: 'Legacy Migration Key',
        type: 'production',
        created_by: user.id,
        legacy_key_id: oldKey.id
      });
      
      // Map old key to new key
      await createKeyMapping(oldKey.key, newApiKey.key, project.id);
      
      console.log(`Migrated API key for ${oldKey.email}`);
    } catch (error) {
      console.error(`Failed to migrate key for ${oldKey.email}:`, error);
    }
  }
  
  // 2. Migrate existing wallets
  const existingWallets = await getExistingWallets();
  
  for (const wallet of existingWallets) {
    try {
      const project = await findProjectByLegacyData(wallet.socialId);
      
      if (project) {
        await migrateWalletToProject(wallet, project.id);
        console.log(`Migrated wallet ${wallet.id} to project ${project.id}`);
      }
    } catch (error) {
      console.error(`Failed to migrate wallet ${wallet.id}:`, error);
    }
  }
  
  console.log('Migration completed successfully');
}
```

### **Phase 3: Gradual Transition (Weeks 3-8)**
```javascript
// Feature flag system for gradual rollout
const FeatureFlags = {
  USE_NEW_API_STRUCTURE: 'new_api_structure',
  ENFORCE_PROJECT_CONTEXT: 'enforce_project_context',
  DEPRECATE_LEGACY_ENDPOINTS: 'deprecate_legacy'
};

function shouldUseNewAPI(apiKey) {
  // Check if user has been migrated
  const migration = getMigrationStatus(apiKey);
  
  if (migration.status === 'completed') {
    return true;
  }
  
  // Gradual rollout based on user segments
  const rolloutPercentage = getFeatureFlag(FeatureFlags.USE_NEW_API_STRUCTURE);
  const userHash = hashString(apiKey);
  
  return (userHash % 100) < rolloutPercentage;
}

// API endpoint with migration support
app.post('/api/wallets/create', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (shouldUseNewAPI(apiKey)) {
    // Use new project-centric flow
    const project = await getProjectFromAPIKey(apiKey);
    return handleNewWalletCreation(project.id, req.body, res);
  } else {
    // Use legacy flow with migration hints
    return handleLegacyWalletCreation(req.body, res);
  }
});
```

---

## 📊 Migration Progress Tracking

### **Migration Dashboard**
```javascript
// Migration status tracking
async function getMigrationStats() {
  return {
    total_users: await getUserCount(),
    migrated_users: await getMigratedUserCount(),
    migration_percentage: await getMigrationPercentage(),
    api_calls: {
      legacy_endpoints: await getLegacyAPICallCount(),
      new_endpoints: await getNewAPICallCount()
    },
    errors: {
      migration_failures: await getMigrationErrorCount(),
      api_compatibility_issues: await getCompatibilityErrorCount()
    },
    timeline: {
      migration_start: '2024-12-26',
      phase_1_complete: '2025-01-02',
      phase_2_complete: '2025-01-09',
      deprecation_start: '2025-02-01',
      legacy_shutdown: '2025-06-01'
    }
  };
}

// Real-time migration monitoring
function startMigrationMonitoring() {
  setInterval(async () => {
    const stats = await getMigrationStats();
    
    // Alert if migration rate is too slow
    if (stats.migration_percentage < 50 && isAfterDate('2025-01-15')) {
      await sendAlert('Migration progress is behind schedule', stats);
    }
    
    // Alert if too many errors
    if (stats.errors.migration_failures > 100) {
      await sendAlert('High migration failure rate detected', stats);
    }
    
    // Update dashboard
    await updateMigrationDashboard(stats);
  }, 5 * 60 * 1000); // Every 5 minutes
}
```

---

## 📧 User Communication Plan

### **Email Templates**
```html
<!-- Migration Announcement Email -->
<div class="migration-email">
  <h2>Important: NexusPay API Updates Coming</h2>
  
  <p>Hi {{user.name}},</p>
  
  <p>We're excited to announce major improvements to the NexusPay API that will give you better project organization, enhanced security, and more powerful features.</p>
  
  <h3>What's Changing?</h3>
  <ul>
    <li>🏗️ <strong>Project-based organization</strong> - Manage multiple apps easily</li>
    <li>🔑 <strong>Enhanced API keys</strong> - Better security and permissions</li>
    <li>📊 <strong>Advanced analytics</strong> - Track usage and costs per project</li>
    <li>⚡ <strong>Improved performance</strong> - Faster response times</li>
  </ul>
  
  <h3>What You Need to Do</h3>
  <p><strong>Good news: Nothing immediately!</strong> Your existing API keys will continue working.</p>
  
  <p>However, we recommend migrating to the new system to take advantage of the new features:</p>
  
  <ol>
    <li>Create an account: <a href="https://dashboard.nexuspay.io/register">Sign up here</a></li>
    <li>Create your first project</li>
    <li>Generate new project-based API keys</li>
    <li>Update your integration when convenient</li>
  </ol>
  
  <div class="timeline">
    <h3>Timeline</h3>
    <p>📅 <strong>January 15, 2025</strong> - New API available<br>
    📅 <strong>February 1, 2025</strong> - Legacy API deprecation notices begin<br>
    📅 <strong>June 1, 2025</strong> - Legacy API shutdown</p>
  </div>
  
  <p>Need help? Check out our <a href="https://docs.nexuspay.io/migration-guide">migration guide</a> or contact support.</p>
  
  <p>Thanks for being a valued NexusPay user!</p>
</div>
```

### **Migration Guide Document**
```markdown
# Migration Guide: Legacy to Project-Based API

## Overview
This guide helps you migrate from the legacy NexusPay API to our new project-based system.

## Quick Migration Checklist
- [ ] Create NexusPay account
- [ ] Create your first project  
- [ ] Generate new API key
- [ ] Update API endpoints in your code
- [ ] Test new integration
- [ ] Deploy updated code
- [ ] Deactivate old API key

## Code Changes Required

### Before (Legacy)
```javascript
// Old API key generation
const response = await fetch('https://backend-amber-zeta-94.vercel.app/api/generate-api-key', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@company.com' })
});

// Old wallet creation
const wallet = await fetch('https://backend-amber-zeta-94.vercel.app/api/auth/quick-setup', {
  method: 'POST',
  headers: { 'X-API-Key': oldApiKey },
  body: JSON.stringify({
    email: 'user@company.com',
    name: 'John Doe'
  })
});
```

### After (New Project-Based)
```javascript
// New project-based wallet creation
const wallet = await fetch('https://api.nexuspay.io/v1/projects/proj_abc123/wallets/create', {
  method: 'POST',
  headers: { 
    'X-API-Key': 'npay_proj_abc123_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    socialId: 'user@company.com',
    socialType: 'email',
    chains: ['ethereum', 'solana'],
    paymasterEnabled: true
  })
});
```

## SDK Changes
```bash
# Update SDK to latest version
npm install @nexuspay/sdk@latest

# Update your code
import { NexusSDK } from '@nexuspay/sdk';

const nexus = new NexusSDK({
  apiKey: 'npay_proj_abc123_live_...'
});

const wallet = await nexus.wallets.create({
  socialId: 'user@company.com',
  socialType: 'email',
  chains: ['ethereum', 'solana']
});
```
```

---

## 🧪 Testing & Validation

### **Migration Testing Scenarios**
```javascript
// Test suite for migration compatibility
describe('Migration Compatibility', () => {
  test('Legacy API key still works', async () => {
    const response = await fetch('/api/generate-api-key', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deprecated')).toBe('true');
  });
  
  test('Legacy wallet creation creates project automatically', async () => {
    const response = await fetch('/api/auth/quick-setup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        name: 'Test User'
      })
    });
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.new_api_example).toBeDefined();
  });
  
  test('Migrated user can use both old and new endpoints', async () => {
    const user = await createMigratedTestUser();
    
    // Old endpoint should work
    const legacyResponse = await callLegacyEndpoint(user.oldApiKey);
    expect(legacyResponse.success).toBe(true);
    
    // New endpoint should work
    const newResponse = await callNewEndpoint(user.project.apiKey);
    expect(newResponse.success).toBe(true);
  });
});
```

---

## 📊 Success Metrics

- [ ] 100% of existing users successfully migrated
- [ ] 0% service interruption during migration
- [ ] <1% increase in support tickets during transition
- [ ] 95% user satisfaction with migration process
- [ ] Legacy API usage drops to <10% within 3 months

---

## 🚀 Rollback Plan

### **Emergency Rollback Procedure**
```javascript
// Rollback script if migration fails
async function emergencyRollback() {
  console.log('EMERGENCY ROLLBACK: Reverting to legacy system');
  
  // 1. Disable new API endpoints
  await setFeatureFlag(FeatureFlags.USE_NEW_API_STRUCTURE, 0);
  
  // 2. Route all traffic to legacy endpoints
  await updateLoadBalancer('legacy-only');
  
  // 3. Notify team
  await sendSlackAlert('🚨 EMERGENCY ROLLBACK ACTIVATED');
  
  // 4. Restore database from backup if needed
  if (await detectDataCorruption()) {
    await restoreFromBackup(getLatestBackup());
  }
  
  console.log('Rollback completed');
}
```

---

## 📝 Notes

- Maintain detailed logs of all migration activities
- Keep daily database backups during migration period
- Have 24/7 support coverage during critical migration phases
- Test rollback procedures before starting migration
- Monitor system performance closely during transition 