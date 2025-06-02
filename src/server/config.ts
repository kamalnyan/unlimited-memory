/**
 * config.ts
 * Simple configuration file that loads environment variables
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });

// Simple configuration object with environment variables
const config = {
  // Server settings
  port: process.env.PORT || 8082,
  corsOrigin: process.env.CORS_ORIGIN ,
  baseUrl: process.env.BASE_URL ,

  // Database
  mongodbUri: process.env.MONGO_URI ,

  // Authentication
  clerkKey: process.env.CLERK_PUBLISHABLE_KEY,
  clerkSecret: process.env.CLERK_SECRET_KEY,

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },

  // OpenAI
  openaiKey: process.env.OPENAI_API_KEY,

  // JWT
  jwtSecret: process.env.JWT_SECRET ,
  jwtExpiry: parseInt(process.env.JWT_EXPIRY_HOURS ),

  // Admin emails (comma-separated in env)
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean)
};

// Export config
export default config; 