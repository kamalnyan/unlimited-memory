/**
 * Development server entry point
 * This file is used when running the server in development mode
 * It loads environment variables from .env and starts the server
 */

// Load environment variables from .env file
import 'dotenv/config';

// Import and start the server
import { startServer } from './index';

console.log('Starting server in development mode...');
console.log('Environment variables loaded from .env file');

// Log MongoDB connection string (sanitized)
const mongoUri = process.env.MONGODB_URI || '';
if (mongoUri) {
  // Extract and display only the host part of the MongoDB URI for safety
  try {
    const url = new URL(mongoUri);
    console.log(`MongoDB URI configured: ${url.protocol}//${url.host}${url.pathname}`);
  } catch (e) {
    console.log('MongoDB URI configured (malformed URL)');
  }
} else {
  console.error('WARNING: MONGODB_URI is not set in .env file');
}

// Start the server
startServer()
  .then(() => {
    console.log('Development server started successfully');
  })
  .catch((error) => {
    console.error('Failed to start development server:', error);
    process.exit(1);
  }); 