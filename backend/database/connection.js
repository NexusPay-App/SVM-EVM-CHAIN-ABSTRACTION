const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay';
      
      console.log('Connecting to MongoDB...');
      
      this.connection = await mongoose.connect(mongoUri, {
        maxPoolSize: 10, // Maximum number of connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      });

      console.log('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('📤 Disconnected from MongoDB');
    }
  }

  getConnection() {
    return this.connection;
  }

  async healthCheck() {
    try {
      if (!this.connection) {
        return { status: 'disconnected', error: 'No connection established' };
      }

      // Check if we can perform a simple operation
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'connected',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection; 