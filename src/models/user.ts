/**
 * user.ts
 * User model definition. Defines the schema and methods for user data.
 * Handles user authentication, profile information, and role management.
 * Integrates with Clerk for user data synchronization.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { compare, hash } from 'bcryptjs';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  password: string;
  name: string;
  username: string;
  bio?: string;
  avatar?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  isActive: boolean;
  lastSeen: Date;
  unreadMessages: number;
  notifications: {
    threadId: Types.ObjectId;
    count: number;
  }[];
  contacts: Types.ObjectId[];
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    sounds: boolean;
    messagePreview: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  markAsOnline(): Promise<void>;
  incrementUnreadMessages(threadId: Types.ObjectId): Promise<void>;
  resetNotifications(threadId: Types.ObjectId): Promise<void>;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    unreadMessages: {
      type: Number,
      default: 0,
    },
    notifications: [
      {
        threadId: {
          type: Schema.Types.ObjectId,
          ref: 'Thread',
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
    contacts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      sounds: {
        type: Boolean,
        default: true,
      },
      messagePreview: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for frequent query patterns - avoid duplicates with schema-level indexes
// Only create text index for search, email and username already have unique indexes
UserSchema.index({ name: 'text', username: 'text' });

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await hash(this.password, 12);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return compare(candidatePassword, this.password);
};

// Mark user as online and update lastSeen
UserSchema.methods.markAsOnline = async function (): Promise<void> {
  this.lastSeen = new Date();
  await this.save();
};

// Increment unread messages for a thread
UserSchema.methods.incrementUnreadMessages = async function (threadId: Types.ObjectId): Promise<void> {
  this.unreadMessages += 1;
  
  // Update notification count for specific thread
  const threadNotification = this.notifications.find(
    n => n.threadId.toString() === threadId.toString()
  );
  
  if (threadNotification) {
    threadNotification.count += 1;
  } else {
    this.notifications.push({
      threadId,
      count: 1,
    });
  }
  
  await this.save();
};

// Reset notifications for a thread
UserSchema.methods.resetNotifications = async function (threadId: Types.ObjectId): Promise<void> {
  const threadNotification = this.notifications.find(
    n => n.threadId.toString() === threadId.toString()
  );
  
  if (threadNotification) {
    // Subtract thread notifications from total unread count
    this.unreadMessages = Math.max(0, this.unreadMessages - threadNotification.count);
    
    // Remove the thread notification or reset its count
    this.notifications = this.notifications.filter(
      n => n.threadId.toString() !== threadId.toString()
    );
    
    await this.save();
  }
};

// Static method to find or create a user based on Clerk authentication
UserSchema.static('findOrCreateUser', async function({
  clerkId,
  email,
  firstName,
  lastName,
  imageUrl
}: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}) {
  // Try to find the user by clerkId
  let user = await this.findOne({ clerkId });
  
  // If user exists, update any changed fields
  if (user) {
    let isChanged = false;
    
    if (user.email !== email) {
      user.email = email;
      isChanged = true;
    }
    
    if (firstName && user.name !== `${firstName} ${lastName || ''}`.trim()) {
      user.name = `${firstName} ${lastName || ''}`.trim();
      isChanged = true;
    }
    
    if (imageUrl && user.avatar !== imageUrl) {
      user.avatar = imageUrl;
      isChanged = true;
    }
    
    // Update lastSeen timestamp
    user.lastSeen = new Date();
    isChanged = true;
    
    // Save changes if needed
    if (isChanged) {
      await user.save();
    }
    
    return user;
  }
  
  // Create a new user if not found
  return await this.create({
    clerkId,
    email,
    password: Math.random().toString(36).slice(-12), // Generate random password for OAuth users
    name: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
    username: email.split('@')[0] + Math.floor(Math.random() * 1000), // Generate a username
    avatar: imageUrl,
    isVerified: true, // Auto-verify since they're coming from Clerk
    lastSeen: new Date()
  });
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
