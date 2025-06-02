/**
 * Script to create an admin user in the database
 * This is useful for initial setup or when you need to promote a user to admin
 * 
 * Usage:
 * npm run create-admin -- --email=admin@example.com --clerkId=user_123456
 * 
 * Or with environment variables:
 * ADMIN_EMAIL=admin@example.com CLERK_USER_ID=user_123456 npm run create-admin
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectToDatabase from '../../lib/db';
import { User } from '../../models/user';

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    acc[key] = value;
  }
  return acc;
}, {} as Record<string, string>);

// Get parameters from command line args or environment variables
const email = args.email || process.env.ADMIN_EMAIL;
const clerkId = args.clerkId || process.env.CLERK_USER_ID;
const firstName = args.firstName || process.env.ADMIN_FIRST_NAME || 'Admin';
const lastName = args.lastName || process.env.ADMIN_LAST_NAME || 'User';

async function createAdminUser() {
  if (!email || !clerkId) {
    console.error('Error: Both email and clerkId are required');
    console.log('Usage:');
    console.log('  npm run create-admin -- --email=admin@example.com --clerkId=user_123456');
    console.log('  ADMIN_EMAIL=admin@example.com CLERK_USER_ID=user_123456 npm run create-admin');
    process.exit(1);
  }

  try {
    // Connect to the database
    await connectToDatabase();
    console.log('Connected to MongoDB');

    // Check if user exists
    const existingUser = await User.findOne({ clerkId });

    if (existingUser) {
      // Update user role to admin
      await User.findOneAndUpdate(
        { clerkId },
        { 
          role: 'admin',
          email,
          firstName,
          lastName 
        }
      );
      console.log(`User ${email} (${clerkId}) updated to admin role`);
    } else {
      // Create new admin user
      await User.create({
        clerkId,
        email,
        firstName,
        lastName,
        role: 'admin',
        imageUrl: '',
        activeThreads: 0,
        totalMessages: 0,
        totalTokensUsed: 0,
        lastActive: new Date(),
        lastLogin: new Date(),
        metadata: {}
      });
      console.log(`Admin user created: ${email} (${clerkId})`);
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser(); 
