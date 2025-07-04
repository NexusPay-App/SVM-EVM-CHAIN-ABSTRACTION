const mongoose = require('mongoose');

async function createOptimizedIndexes() {
  try {
    const db = mongoose.connection.db;
    
    console.log('🚀 Creating optimized database indexes...');
    
    // Users collection indexes
    await db.collection('users').createIndex({ id: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Projects collection indexes  
    await db.collection('projects').createIndex({ owner_id: 1, createdAt: -1 });
    await db.collection('projects').createIndex({ id: 1, owner_id: 1 }, { unique: true });
    
    // API Keys collection indexes
    await db.collection('api_keys_v2').createIndex({ project_id: 1, status: 1 });
    await db.collection('api_keys_v2').createIndex({ keyId: 1 }, { unique: true });
    await db.collection('api_keys_v2').createIndex({ project_id: 1, status: 1, createdAt: -1 });
    
    // Paymaster collection indexes
    await db.collection('project_paymasters').createIndex({ project_id: 1, status: 1 });
    await db.collection('project_paymasters').createIndex({ project_id: 1, chain: 1 });
    
    // Balances collection indexes
    await db.collection('paymaster_balances').createIndex({ project_id: 1, chain: 1 });
    await db.collection('paymaster_balances').createIndex({ project_id: 1, last_updated: -1 });
    
    // Transaction logs indexes
    await db.collection('project_transaction_logs').createIndex({ project_id: 1, createdAt: -1 });
    await db.collection('project_transaction_logs').createIndex({ project_id: 1, status: 1 });
    
    // User activity indexes
    await db.collection('project_user_activity').createIndex({ project_id: 1, createdAt: -1 });
    
    console.log('✅ Database indexes created successfully');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

module.exports = { createOptimizedIndexes }; 