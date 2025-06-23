#!/usr/bin/env node

/**
 * NexusSDK Free Hosting Deployment Guide
 * This script provides guidance for deploying to free hosting platforms
 */

const fs = require('fs');
const path = require('path');

console.log(`
🚀 NexusSDK Free Hosting Deployment Guide
=========================================

You're building the "ThirdWeb Killer" - let's get it deployed for free!

📋 Current Status:
- ✅ Smart contracts deployed (EVM + SVM)
- ✅ SDK built and ready
- ⏳ Need to deploy backend and frontend

🎯 Recommended Free Hosting Stack:
- Backend: Railway.app (500 hours/month free)
- Frontend: Vercel.com (unlimited for personal)
- Database: Supabase.com (500MB free)
- Domain: Use free subdomain initially

`);

// Check if backend exists
const backendExists = fs.existsSync(path.join(__dirname, '../backend/server.js'));
const packageExists = fs.existsSync(path.join(__dirname, '../backend/package.json'));

console.log('🔍 Backend Check:');
console.log(`- server.js exists: ${backendExists ? '✅' : '❌'}`);
console.log(`- package.json exists: ${packageExists ? '✅' : '❌'}`);

if (!backendExists) {
  console.log(`
❌ Backend not found!
Create a simple Express server in backend/server.js:

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nexus-api' });
});

// Wallet creation endpoint
app.post('/api/wallets', async (req, res) => {
  try {
    const { socialId, socialType, chains } = req.body;
    
    // TODO: Implement wallet creation logic
    // For now, return mock data
    const wallet = {
      socialId,
      socialType,
      addresses: {
        ethereum: '0x' + Math.random().toString(16).substr(2, 40),
        polygon: '0x' + Math.random().toString(16).substr(2, 40),
        solana: Math.random().toString(36).substr(2, 44)
      },
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(\`NexusAPI running on port \${PORT}\`);
});
`);
}

console.log(`
🎯 Deployment Steps:

1️⃣ DEPLOY BACKEND TO RAILWAY.APP
--------------------------------
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and deploy
6. Get your URL: https://your-app.railway.app

2️⃣ DEPLOY FRONTEND TO VERCEL
-----------------------------
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "New Project"
4. Import your repository
5. Framework Preset: Next.js
6. Deploy automatically
7. Get your URL: https://your-app.vercel.app

3️⃣ UPDATE SDK CONFIGURATION
----------------------------
Update your SDK config to use deployed URLs:

// config/production-config.ts
export const productionConfig = {
  apiKey: 'your-production-key',
  chains: ['ethereum', 'polygon', 'arbitrum', 'base', 'solana'],
  endpoints: {
    api: 'https://your-app.railway.app',
    websocket: 'wss://your-app.railway.app'
  }
};

4️⃣ OPTIONAL: CUSTOM DOMAIN
---------------------------
Free options:
- Freenom.com: Free .tk, .ga, .cf domains (1 year)
- GitHub Student Pack: Free .me domain (if student)
- Start with subdomains: your-app.vercel.app

5️⃣ ENVIRONMENT VARIABLES
-------------------------
Set these in Railway.app dashboard:
- NODE_ENV=production
- DATABASE_URL=your-supabase-url (if using database)
- CORS_ORIGIN=https://your-app.vercel.app

Set these in Vercel dashboard:
- NEXT_PUBLIC_API_URL=https://your-app.railway.app
- NEXT_PUBLIC_WS_URL=wss://your-app.railway.app

`);

// Check if git repo is ready
const gitExists = fs.existsSync(path.join(__dirname, '../.git'));
console.log(`📁 Git Repository: ${gitExists ? '✅ Ready' : '❌ Initialize with: git init'}`);

if (gitExists) {
  console.log(`
✅ Your repository is ready for deployment!

🚀 Quick Deploy Commands:
------------------------
git add .
git commit -m "Deploy NexusSDK - ThirdWeb Killer"
git push origin main

Then follow the Railway.app and Vercel.com steps above.

💡 Pro Tips:
- Use Railway for backend (great for Node.js + PostgreSQL)
- Use Vercel for frontend (perfect for Next.js)
- Start with free tiers, upgrade when you get users
- Your cross-chain EVM-SVM feature is your killer advantage

🎯 After deployment, you'll have:
- Public API at: https://your-app.railway.app
- Frontend at: https://your-app.vercel.app  
- Real working SDK that beats ThirdWeb

Ready to conquer the world? 💪
`);
} else {
  console.log(`
❌ Initialize git repository first:
git init
git add .
git commit -m "Initial NexusSDK commit"
git branch -M main
git remote add origin https://github.com/your-username/nexus-sdk.git
git push -u origin main
`);
}

console.log(`
📚 Resources:
- Railway.app docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs
- Local Development Guide: ./sdk/LOCAL_DEVELOPMENT_GUIDE.md

Questions? Check the guides or ask for help!
`); 