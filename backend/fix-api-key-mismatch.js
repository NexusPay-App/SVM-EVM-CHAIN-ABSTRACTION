#!/usr/bin/env node

/**
 * Fix API Key Mismatch Script
 * 
 * This script creates a proper API key for the myPulse project
 * to replace the mismatched API key that was causing authentication failures.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project');
const ProjectAPIKey = require('./models/ProjectAPIKey');
const User = require('./models/User');

async function fixAPIKeyMismatch() {
    try {
        console.log('🔧 Fixing API Key Mismatch...\n');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay');
        console.log('✅ Connected to database');
        
        // Find the myPulse project
        const myPulseProject = await Project.findOne({ 
            id: 'proj_1751544230530_8210d090',
            name: 'myPulse'
        });
        
        if (!myPulseProject) {
            console.log('❌ myPulse project not found!');
            process.exit(1);
        }
        
        console.log(`✅ Found myPulse project: ${myPulseProject.name}`);
        console.log(`   Project ID: ${myPulseProject.id}`);
        console.log(`   Chains: ${myPulseProject.chains.join(', ')}`);
        console.log(`   Owner ID: ${myPulseProject.owner_id}`);
        
        // Check if API key already exists for this project
        const existingAPIKey = await ProjectAPIKey.findOne({ 
            project_id: myPulseProject.id,
            status: 'active'
        });
        
        if (existingAPIKey) {
            console.log('\n🔑 Found existing API key for myPulse project:');
            console.log(`   Key ID: ${existingAPIKey.keyId}`);
            console.log(`   Preview: ${existingAPIKey.keyPreview}`);
            console.log(`   Status: ${existingAPIKey.status}`);
            console.log(`   Permissions: ${existingAPIKey.permissions.join(', ')}`);
            
            // Decrypt and show the full API key
            try {
                const fullAPIKey = existingAPIKey.decryptKey();
                console.log(`\n🎯 Your correct API key for myPulse project:`);
                console.log(`   ${fullAPIKey}`);
            } catch (error) {
                console.log(`⚠️ Could not decrypt existing API key: ${error.message}`);
                console.log('   Creating a new API key instead...');
                
                // Create new API key
                const newAPIKey = await createNewAPIKey(myPulseProject);
                console.log(`\n🎯 New API key created:`);
                console.log(`   ${newAPIKey}`);
            }
        } else {
            console.log('\n🔑 No existing API key found. Creating new one...');
            
            // Create new API key
            const newAPIKey = await createNewAPIKey(myPulseProject);
            console.log(`\n🎯 New API key created:`);
            console.log(`   ${newAPIKey}`);
        }
        
        console.log('\n✅ API Key mismatch fixed!');
        console.log('\n📋 Next steps:');
        console.log('1. Copy the API key shown above');
        console.log('2. Update your phone-wallet-demo config.js with the correct API key');
        console.log('3. Test the demo again');
        
    } catch (error) {
        console.error('❌ Failed to fix API key mismatch:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n💤 Database connection closed');
        process.exit(0);
    }
}

async function createNewAPIKey(project) {
    // Generate new API key
    const apiKey = ProjectAPIKey.generateAPIKey(project.id, 'production');
    
    // Create API key record
    const newApiKey = new ProjectAPIKey({
        project_id: project.id,
        name: 'Production API Key',
        keyType: 'production',
        permissions: ['wallets:create', 'wallets:deploy', 'wallets:read', 'transactions:execute'],
        createdBy: project.owner_id
    });
    
    // Encrypt and store the key
    newApiKey.encryptAndStoreKey(apiKey);
    
    // Save to database
    await newApiKey.save();
    
    console.log(`✅ New API key created successfully`);
    console.log(`   Key ID: ${newApiKey.keyId}`);
    console.log(`   Preview: ${newApiKey.keyPreview}`);
    console.log(`   Permissions: ${newApiKey.permissions.join(', ')}`);
    
    return apiKey;
}

// Run the fix
if (require.main === module) {
    fixAPIKeyMismatch().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = fixAPIKeyMismatch; 