/**
 * Database Connection Check Script
 * 
 * This script tests the MongoDB connection and reports status
 * It can be used to verify configuration before starting the server
 * 
 * Usage:
 * npm run db-check
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { checkDatabaseConnection } from '../../lib/db';

async function checkDatabase() {
  console.log('🔍 Testing database connection...');
  console.log('====================================');
  
  try {
    // Log MongoDB URI (sanitized)
    const mongoUri = process.env.MONGODB_URI || '';
    if (mongoUri) {
      // Extract and display only the host part of the MongoDB URI for safety
      try {
        const url = new URL(mongoUri);
        console.log(`🔌 MongoDB URI: ${url.protocol}//${url.host}${url.pathname}`);
      } catch (e) {
        console.log('🔌 MongoDB URI configured (malformed URL)');
      }
    } else {
      console.error('❌ ERROR: MONGODB_URI is not set in .env file');
      process.exit(1);
    }
    
    // Check connection status
    const status = await checkDatabaseConnection();
    
    if (status.connected) {
      console.log('✅ Database connection: SUCCESSFUL');
      console.log(`🔄 Connection state: ${status.status} (${status.readyState})`);
      
      // Get server information
      const admin = mongoose.connection.db.admin();
      const serverInfo = await admin.serverInfo();
      
      console.log(`🧩 MongoDB version: ${serverInfo.version}`);
      
      // Get database stats
      const stats = await mongoose.connection.db.stats();
      
      console.log(`📊 Database stats:`);
      console.log(`   - Collections: ${stats.collections}`);
      console.log(`   - Documents: ${stats.objects}`);
      console.log(`   - Storage size: ${formatBytes(stats.storageSize)}`);
      
      // List collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      if (collections.length > 0) {
        console.log('📚 Collections:');
        for (const collection of collections) {
          console.log(`   - ${collection.name}`);
        }
      } else {
        console.log('📚 No collections found (empty database)');
      }
    } else {
      console.error(`❌ Database connection FAILED: ${status.status}`);
      console.error('Please check your MongoDB configuration and make sure the database server is running.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking database connection:');
    console.error(error);
    process.exit(1);
  } finally {
    // Close connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
    console.log('====================================');
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the check
checkDatabase(); 