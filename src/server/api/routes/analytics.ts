/**
 * analytics.ts
 * API routes for analytics data. Provides insights into app usage and performance.
 * Implements endpoints for user statistics, message counts, and thread analytics.
 * Handles data aggregation and reporting for the admin dashboard.
 */
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '@/models/user';
import { Thread } from '@/models/thread';
import { Message } from '@/models/message';
import { withDatabase } from '@/lib/db';
import { 
  asyncHandler, 
  apiResponse, 
  requireAdmin 
} from '../middleware';

const router = express.Router();

/**
 * All routes require admin access
 */
router.use(requireAdmin);

/**
 * GET /api/analytics/overview
 * 
 * Gets high-level stats for the admin dashboard
 * 
 * @returns Object with total users, threads, messages counts and other metrics
 */
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const overview = await withDatabase(async () => {
    // Run multiple aggregations in parallel for efficiency
    const [
      { totalUsers = 0 } = {},
      { totalThreads = 0 } = {},
      { totalMessages = 0 } = {},
      { totalTokensUsed = 0 } = {}
    ] = await Promise.all([
      User.aggregate([{ $count: 'totalUsers' }]).then(res => res[0] || { totalUsers: 0 }),
      Thread.aggregate([{ $count: 'totalThreads' }]).then(res => res[0] || { totalThreads: 0 }),
      Message.aggregate([{ $count: 'totalMessages' }]).then(res => res[0] || { totalMessages: 0 }),
      Message.aggregate([
        { $group: { _id: null, totalTokensUsed: { $sum: '$tokensUsed' } } }
      ]).then(res => res[0] || { totalTokensUsed: 0 })
    ]);
    
    // Calculate active users in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: sevenDaysAgo }
    });
    
    // Calculate new users in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });
    
    // Calculate messages per user
    const messagesPerUser = totalUsers > 0 ? totalMessages / totalUsers : 0;
    
    return {
      totalUsers,
      activeUsers,
      newUsers,
      totalThreads,
      totalMessages,
      messagesPerUser,
      totalTokensUsed,
      lastUpdated: new Date()
    };
  });
  
  return apiResponse(res, 200, overview, 'Analytics overview retrieved successfully');
}));

/**
 * GET /api/analytics/users
 * 
 * Gets detailed user analytics
 * 
 * @returns Object with user growth, activity stats
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const analytics = await withDatabase(async () => {
    // Get user growth by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usersByDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Get active users count
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: sevenDaysAgo }
    });
    
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get new users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Get user roles distribution
    const userRoles = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      usersByDay,
      userRoles: userRoles.reduce((acc, role) => {
        acc[role._id] = role.count;
        return acc;
      }, {} as Record<string, number>)
    };
  });
  
  return apiResponse(res, 200, analytics, 'User analytics retrieved successfully');
}));

/**
 * GET /api/analytics/messages
 * 
 * Gets detailed message analytics
 * 
 * @returns Object with message metrics, patterns, volume
 */
router.get('/messages', asyncHandler(async (req: Request, res: Response) => {
  const analytics = await withDatabase(async () => {
    // Get total messages
    const totalMessages = await Message.countDocuments();
    
    // Get total users with messages
    const totalUsers = await User.countDocuments({ totalMessages: { $gt: 0 } });
    
    // Calculate messages per user
    const messagesPerUser = totalUsers > 0 ? totalMessages / totalUsers : 0;
    
    // Get messages by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const messagesByDay = await Message.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
          },
          count: { $sum: 1 },
          tokensUsed: { $sum: '$tokensUsed' }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, tokensUsed: 1, _id: 0 } }
    ]);
    
    // Get distribution by role
    const messagesByRole = await Message.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get top 5 users by message count
    const topUsersByMessages = await User.find()
      .sort({ totalMessages: -1 })
      .limit(5)
      .select('firstName lastName email totalMessages')
      .lean();
    
    return {
      totalMessages,
      messagesPerUser,
      messagesByDay,
      messagesByRole: messagesByRole.reduce((acc, role) => {
        acc[role._id] = role.count;
        return acc;
      }, {} as Record<string, number>),
      topUsersByMessages
    };
  });
  
  return apiResponse(res, 200, analytics, 'Message analytics retrieved successfully');
}));

/**
 * GET /api/analytics/threads
 * 
 * Gets detailed thread analytics
 * 
 * @returns Object with thread metrics and patterns
 */
router.get('/threads', asyncHandler(async (req: Request, res: Response) => {
  const analytics = await withDatabase(async () => {
    // Get total threads
    const totalThreads = await Thread.countDocuments();
    
    // Get threads by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const threadsByDay = await Thread.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Get threads by message count distribution
    const threadsByMessageCount = await Thread.aggregate([
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$messageCount', 5] }, then: '1-5' },
                { case: { $lte: ['$messageCount', 10] }, then: '6-10' },
                { case: { $lte: ['$messageCount', 20] }, then: '11-20' },
                { case: { $lte: ['$messageCount', 50] }, then: '21-50' },
              ],
              default: '50+'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get top 5 users by thread count
    const topUsersByThreads = await User.find()
      .sort({ activeThreads: -1 })
      .limit(5)
      .select('firstName lastName email activeThreads')
      .lean();
    
    return {
      totalThreads,
      threadsByDay,
      threadsByMessageCount: threadsByMessageCount.reduce((acc, group) => {
        acc[group._id] = group.count;
        return acc;
      }, {} as Record<string, number>),
      topUsersByThreads,
      threadsPerUser: totalThreads / await User.countDocuments()
    };
  });
  
  return apiResponse(res, 200, analytics, 'Thread analytics retrieved successfully');
}));

export default router; 
