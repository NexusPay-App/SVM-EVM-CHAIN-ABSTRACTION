const mongoose = require('mongoose');

// Set up test environment
beforeAll(async () => {
  // Increase timeout for database operations
  jest.setTimeout(30000);
  
  // Connect to test database if not already connected
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/nexuspay_test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Test database connected');
    } catch (error) {
      console.warn('⚠️ Test database connection failed, tests may timeout:', error.message);
    }
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    // Clean up test data
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      if (collection.collectionName.includes('test')) {
        await collection.deleteMany({});
      }
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Test database disconnected');
  } catch (error) {
    console.warn('⚠️ Test cleanup warning:', error.message);
  }
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.warn('⚠️ Unhandled test rejection:', err.message);
});

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
}); 