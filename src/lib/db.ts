/**
 * db.ts
 * Database utilities. Manages MongoDB connection and operations.
 * Implements connection pooling, error handling, and query optimization.
 * Provides helper functions for common database operations.
 */
import mongoose from 'mongoose';
import config from '../server/config';

// MongoDB connection options
const options = {
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
};

// Connect to MongoDB
export async function connectToDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('Already connected to MongoDB');
      return mongoose;
    }

    if (!config.mongodbUri) {
      throw new Error('MongoDB URI is not configured');
    }

    await mongoose.connect(config.mongodbUri, options);
    console.log('Connected to MongoDB successfully');
    return mongoose;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Disconnect from MongoDB
export async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

// Database operation wrapper
export async function withDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await connectToDatabase();
    return await operation();
  } finally {
    // Don't disconnect after each operation to maintain connection pool
    // await disconnectFromDatabase();
  }
}

// Helper to check database connection status
export async function checkDatabaseConnection(): Promise<{ 
  connected: boolean;
  status: string;
  readyState: number;
}> {
  try {
    await connectToDatabase();
    const readyState = mongoose.connection.readyState;
    
    // Convert readyState to a human-readable status
    const statusMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    
    return { 
      connected: readyState === 1, 
      status: statusMap[readyState] || 'unknown',
      readyState
    };
  } catch (error) {
    console.error('Database connection check failed:', error);
    return { 
      connected: false, 
      status: 'error', 
      readyState: 0
    };
  }
}

// Export mongoose instance
export default mongoose;
