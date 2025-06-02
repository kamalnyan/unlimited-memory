import mongoose from 'mongoose';
import config from '../config';

// MongoDB connection options
const options = {
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let isConnected = false;

// Connect to MongoDB
export async function connectToDatabase() {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    if (!config.mongodbUri) {
      throw new Error('MongoDB URI is not configured');
    }

    await mongoose.connect(config.mongodbUri, options);
    console.log('Connected to MongoDB successfully');
    isConnected = true;
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
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}

// Export mongoose instance
export default mongoose; 