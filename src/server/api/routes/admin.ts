/**
 * admin.ts
 * Admin API routes for dashboard data. Handles fetching users, threads, and analytics.
 * Only accessible to admin users.
 */
import express, { Request, Response } from 'express';
import { User } from '@/models/user';
import { Thread } from '@/models/thread';
import { Message } from '@/models/message';
import { withDatabase } from '@/lib/db';
import { 
  asyncHandler, 
  apiResponse, 
  ValidationError
} from '../middleware';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/admin/users
 * Fetches all users with their details for the admin dashboard
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const result = await withDatabase(async () => {
    const users = await User.find({})
      .select('name email username bio avatar role isActive lastSeen unreadMessages createdAt')
      .lean();

    // Get today's date with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    // Get thread counts, last message, and status for each user
    const usersWithThreads = await Promise.all(
      users.map(async (user) => {
        // Find threads for this user
        const threads = await Thread.find({ userId: user._id })
          .select('_id title')
          .lean();
        const threadIds = threads.map(thread => thread._id);

        // Find last message sent by this user (by _id, email, username, or clerkId)
        const senderIds = [user._id.toString()];
        if (user.email) senderIds.push(user.email);
        if (user.username) senderIds.push(user.username);
        if (user.clerkId) senderIds.push(user.clerkId);
        const lastMessage = await Message.findOne({ sender: { $in: senderIds } })
          .sort({ createdAt: -1 })
          .lean();
        let status = 'Inactive';
        if (lastMessage) {
          const lastMsgDate = new Date(lastMessage.createdAt);
          if (lastMsgDate.toDateString() === today.toDateString()) status = 'Active Today';
          else if (lastMsgDate >= weekAgo) status = 'Active This Week';
        }

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username || user.email.split('@')[0],
          bio: user.bio || "This user hasn't added a bio yet.",
          avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
          role: user.role,
          isActive: status === 'Active Today',
          status,
          lastSeen: user.lastSeen,
          unreadMessages: user.unreadMessages,
          createdAt: user.createdAt,
          threads: threads.map(thread => ({
            id: thread._id,
            title: thread.title || 'Untitled Thread',
            messageCount: 0 // We'll update this in the next query
          })),
        };
      })
    );

    // Get message counts for each thread
    for (const user of usersWithThreads) {
      for (const thread of user.threads) {
        const messageCount = await Message.countDocuments({ threadId: thread.id });
        thread.messageCount = messageCount;
      }
    }

    return usersWithThreads;
  });

  return apiResponse(res, 200, result, 'Users fetched successfully');
}));

/**
 * GET /api/admin/users/:id
 * Fetches detailed information about a specific user for the admin dashboard
 * Including their bio, designation, activity status, and clerk profile info
 */
router.get('/users/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await withDatabase(async () => {
    const user = await User.findById(id)
      .select('name email username bio avatar role isActive lastSeen createdAt')
      .lean();
      
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    // Get today's date with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    
    // Get threads created by this user
    const threads = await Thread.find({ userId: id })
      .select('_id title createdAt')
      .lean();
      
    const threadIds = threads.map(thread => thread._id);
    
    // Find last message sent by this user (by _id, email, username, or clerkId)
    const senderIds = [user._id.toString()];
    if (user.email) senderIds.push(user.email);
    if (user.username) senderIds.push(user.username);
    if (user.clerkId) senderIds.push(user.clerkId);
    const lastMessage = await Message.findOne({ sender: { $in: senderIds } })
      .sort({ createdAt: -1 })
      .lean();
    let status = 'Inactive';
    let lastThreadTitle = null;
    if (lastMessage) {
      const lastMsgDate = new Date(lastMessage.createdAt);
      if (lastMsgDate.toDateString() === today.toDateString()) status = 'Active Today';
      else if (lastMsgDate >= weekAgo) status = 'Active This Week';
      // Find the thread title for the last message
      const lastThread = await Thread.findById(lastMessage.threadId).select('title').lean();
      lastThreadTitle = lastThread ? lastThread.title || 'Untitled Thread' : null;
    }
    
    // For demo purpose, generate a random designation if not available
    const designations = ["Software Engineer", "Product Manager", "UX Designer", "Marketing Specialist", "Sales Representative", "Customer Support", "Data Analyst"];
    const randomDesignation = designations[Math.floor(Math.random() * designations.length)];
    
    // Get message counts for each thread
    const threadsWithCounts = await Promise.all(
      threads.map(async (thread) => {
        const messageCount = await Message.countDocuments({ threadId: thread._id });
        
        // Get the latest message in the thread
        const latestMessage = await Message.findOne({ threadId: thread._id })
          .sort({ createdAt: -1 })
          .lean();
          
        return {
          id: thread._id,
          title: thread.title || 'Untitled Thread',
          messageCount,
          lastActive: latestMessage?.createdAt || thread.createdAt
        };
      })
    );
    
    // Sort threads by last activity date (most recent first)
    const sortedThreads = threadsWithCounts.sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
    
    // Enhance user object with additional information
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      bio: user.bio || "This user hasn't added a bio yet.",
      designation: user.role === 'admin' ? "CEO" : randomDesignation, // Admin users are CEOs
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      role: user.role,
      isActive: status === 'Active Today',
      status,
      lastSeen: user.lastSeen,
      unreadMessages: 0,
      threads: sortedThreads,
      createdAt: user.createdAt,
      lastThreadTitle,
    };
  });
  
  return apiResponse(res, 200, result, 'User details fetched successfully');
}));

/**
 * GET /api/admin/threads
 * Fetches all threads with their messages for the admin dashboard
 */
router.get('/threads', asyncHandler(async (req: Request, res: Response) => {
  const result = await withDatabase(async () => {
    // Populate userId as a full user object
    const threads = await Thread.find().lean();
    // Get all userIds
    const userIds = Array.from(new Set(threads.map(t => t.userId)));
    const objectIdUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => id.toString());
    const stringUserIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id) && !!id);

    // Find users by _id (ObjectId) and by clerkId (string)
    const usersById = objectIdUserIds.length
      ? await User.find({ _id: { $in: objectIdUserIds } }).select('name email username clerkId').lean()
      : [];
    const usersByClerkId = stringUserIds.length
      ? await User.find({ clerkId: { $in: stringUserIds } }).select('name email username clerkId').lean()
      : [];

    const userMap = {};
    usersById.forEach(u => { userMap[u._id.toString()] = u; });
    usersByClerkId.forEach(u => { userMap[u.clerkId] = u; });

    const threadsWithMessages = await Promise.all(
      threads.map(async (thread) => {
        // Find the most recent user message (not AI)
        const lastUserMessage = await Message.findOne({ threadId: thread._id, sender: { $ne: 'ai' } })
          .sort({ createdAt: -1 })
          .lean();
        const messageCount = await Message.countDocuments({ threadId: thread._id });
        const user = userMap[thread.userId?.toString()] || {};
        return {
          id: thread._id,
          title: thread.title,
          createdBy: user.name || thread.userId?.toString() || 'Unknown',
          createdByEmail: user.email || '',
          createdByUsername: user.username || '',
          messageCount,
          lastMessage: lastUserMessage ? {
            content: lastUserMessage.content,
            timestamp: lastUserMessage.createdAt,
            userName: user.name || ''
          } : null
        };
      })
    );
    return threadsWithMessages;
  });
  return apiResponse(res, 200, result, 'Threads fetched successfully');
}));

/**
 * GET /api/admin/threads/:id/messages
 * Fetches all messages for a specific thread (admin access)
 */
router.get('/threads/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await withDatabase(async () => {
    const thread = await Thread.findById(id);
    if (!thread) {
      throw new ValidationError('Thread not found');
    }

    // Fetch all messages for the thread
    const messages = await Message.find({ threadId: id }).sort({ createdAt: 1 }).lean();

    // Only use valid ObjectIds for lookup
    const userIds = Array.from(new Set(messages.map(msg => msg.sender).filter(s => s && s !== 'ai' && s !== 'system')));
    const objectIdUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const users = objectIdUserIds.length
      ? await User.find({ _id: { $in: objectIdUserIds } }).select('name').lean()
      : [];
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name]));

    const formatted = messages.map(msg => ({
      id: msg._id.toString(),
      content: msg.content,
      createdAt: msg.createdAt,
      userId: msg.sender?.toString() || '',
      userName:
        msg.sender === 'ai' || msg.sender === 'system'
          ? 'AI Assistant'
          : userMap[msg.sender?.toString()] || msg.sender?.toString() || 'Unknown',
      role: msg.sender === 'ai' || msg.sender === 'system' ? 'ai' : 'user',
    }));

    return formatted;
  });

  return apiResponse(res, 200, result, 'Thread messages fetched successfully');
}));

/**
 * PUT /api/admin/users/:id
 * Updates a user's role or activation status
 */
router.put('/users/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, value } = req.body;
  
  if (!['activate', 'deactivate', 'makeAdmin', 'makeUser'].includes(action)) {
    throw new ValidationError('Invalid action provided');
  }
  
  const result = await withDatabase(async () => {
    const user = await User.findById(id);
    
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    switch (action) {
      case 'activate':
        // For demo purposes, when activating a user, we'll create a dummy message for today
        // to ensure they appear as "Active Today"
        user.lastSeen = new Date();
        
        // Find or create a thread for this user
        let existingThread = await Thread.findOne({ userId: id });
        
        if (!existingThread) {
          // Create a new thread for this user if none exists
          existingThread = await Thread.create({
            title: 'System Thread',
            userId: id,
            createdBy: id,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        // Create a dummy message in the thread to make user appear active
        const today = new Date();
        await Message.create({
          threadId: existingThread._id,
          sender: id.toString(),
          content: 'User was activated by admin',
          createdAt: today,
          updatedAt: today
        });
        break;
      case 'deactivate':
        // Mark as inactive
        user.isActive = false;
        break;
      case 'makeAdmin':
        user.role = 'admin';
        break;
      case 'makeUser':
        user.role = 'user';
        break;
    }
    
    await user.save();
    
    return {
      id: user._id,
      message: `User ${action} successful`
    };
  });
  
  return apiResponse(res, 200, result, `User ${action} successful`);
}));

/**
 * GET /api/admin/analytics
 * Fetches dashboard analytics and statistics
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const result = await withDatabase(async () => {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalThreads = await Thread.countDocuments();
    const totalMessages = await Message.countDocuments();

    // Get recent activity (last 10 actions)
    const recentMessages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('threadId', 'title')
      .lean();

    const recentThreads = await Thread.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name')
      .lean();

    const recentActivity = [
      ...recentMessages.map(msg => ({
        type: 'message' as const,
        action: `New message in "${msg.threadId.title}"`,
        timestamp: msg.createdAt
      })),
      ...recentThreads.map(thread => ({
        type: 'thread' as const,
        action: `New thread created by ${thread.userId.name}`,
        timestamp: thread.createdAt
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
     .slice(0, 10);

    return {
      totalUsers,
      activeUsers,
      totalThreads,
      totalMessages,
      recentActivity
    };
  });

  return apiResponse(res, 200, result, 'Analytics fetched successfully');
}));

/**
 * GET /api/admin/debug-active/:id
 * Diagnostic endpoint to check why active status detection isn't working
 */
router.get('/debug-active/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const debug = await withDatabase(async () => {
    // Get the user
    const user = await User.findById(id)
      .select('name email username role isActive lastSeen')
      .lean();
    
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    // Get today's date with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all messages from this user (not just today's)
    const allMessages = await Message.find({
      sender: id.toString(),
    }).lean();
    
    // Get today's messages with detailed debugging
    const todaysMessages = await Message.find({
      sender: id.toString(),
      createdAt: { $gte: today }
    }).lean();
    
    // Get all threads by this user
    const threads = await Thread.find({ userId: id })
      .select('_id title')
      .lean();
    
    // Get message counts for each thread
    const threadsWithMessages = await Promise.all(
      threads.map(async (thread) => {
        const messages = await Message.find({ 
          threadId: thread._id 
        }).lean();
        
        const todayThreadMessages = await Message.find({ 
          threadId: thread._id,
          createdAt: { $gte: today }
        }).lean();
        
        return {
          thread: thread,
          messageCount: messages.length,
          todayMessageCount: todayThreadMessages.length,
          messages: messages.map(m => ({
            id: m._id,
            content: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
            sender: m.sender,
            createdAt: m.createdAt
          }))
        };
      })
    );
    
    return {
      user: user,
      todayDate: today,
      messageCount: {
        total: allMessages.length,
        today: todaysMessages.length
      },
      threads: threadsWithMessages,
      rawMessages: todaysMessages.map(m => ({
        id: m._id,
        content: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
        sender: m.sender,
        sender_type: typeof m.sender,
        createdAt: m.createdAt
      }))
    };
  });
  
  return apiResponse(res, 200, debug, 'Debug information for active status');
}));

export default router; 