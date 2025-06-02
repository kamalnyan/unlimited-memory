/**
 * threads.ts
 * API routes for thread management. Handles CRUD operations for chat threads.
 * Implements thread creation, listing, updating, and deletion.
 * Manages thread permissions and user associations.
 */
import express, { Request, Response } from 'express';
import { Thread } from '@/models/thread';
import { Message } from '@/models/message';
import { withDatabase } from '@/lib/db';
import { 
  asyncHandler, 
  apiResponse, 
  ValidationError, 
  NotFoundError,
  UnauthorizedError,
  requireAdmin 
} from '../middleware';

const router = express.Router();

/**
 * GET /api/threads
 * 
 * Gets all threads for the authenticated user
 * Supports pagination and sorting
 * 
 * @param req.query.userId - The user's ID (required)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20)
 * @param req.query.sort - Sort field (default: updatedAt)
 * @param req.query.order - Sort order (default: desc)
 * 
 * @returns Paginated list of threads
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  
  // Validate required fields
  if (!userId) {
    throw new ValidationError('userId is required');
  }
  
  // Get pagination and sorting parameters
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');
  const sort = (req.query.sort as string) || 'updatedAt';
  const order = (req.query.order as string) === 'asc' ? 1 : -1;
  
  const result = await withDatabase(async () => {
    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [threads, total] = await Promise.all([
      Thread.find({ userId })
        .sort({ [sort]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      Thread.countDocuments({ userId })
    ]);
    
    // Transform threads to ensure consistent ID format
    const formattedThreads = threads.map(thread => ({
      id: thread._id.toString(),
      userId: thread.userId,
      title: thread.title || 'Untitled Chat',
      updatedAt: thread.updatedAt,
      createdAt: thread.createdAt,
      isActive: thread.isActive !== false
    }));
    
    return {
      threads: formattedThreads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  });
  
  return apiResponse(res, 200, result, 'Threads retrieved successfully');
}));

/**
 * POST /api/threads
 * 
 * Creates a new thread for the authenticated user
 * 
 * @param req.body.userId - User's ID (required)
 * @param req.body.title - Thread title (default: "New Chat")
 * @param req.body.email - User's email (for logging)
 * 
 * @returns The created thread object
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, title = 'New Chat', email } = req.body;
  
  // Validate required fields
  if (!userId) {
    throw new ValidationError('userId is required');
  }
  
  // Create the new thread
  const thread = await withDatabase(async () => {
    // Create thread with the provided data
    const newThread = await Thread.create({
      userId,
      title: title.trim() || 'New Chat',
      createdBy: userId, // Use the userId directly as string
      isActive: true
    });
    
    console.log(`Thread created for user ${userId} (${email || 'unknown'})`);
    
    // Return a response that matches what the front-end expects
    return {
      id: newThread._id.toString(),
      title: newThread.title,
      updatedAt: newThread.updatedAt,
      createdAt: newThread.createdAt,
      userId: newThread.userId
    };
  });
  
  return apiResponse(res, 201, thread, 'Thread created successfully');
}));

/**
 * GET /api/threads/:id
 * 
 * Gets a specific thread by ID
 * Validates that the requesting user owns the thread
 * 
 * @param req.params.id - Thread ID
 * @param req.query.userId - Requesting user's ID (for auth check)
 * 
 * @returns The thread object
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  
  // Validate request
  if (!userId) {
    throw new ValidationError('userId query parameter is required');
  }
  
  const thread = await withDatabase(async () => {
    const result = await Thread.findById(id).lean();
    
    if (!result) {
      throw new NotFoundError('Thread not found');
    }
    
    // Ensure the user has access to this thread
    if (result.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to access this thread');
    }
    
    // Format thread object for consistent frontend use
    return {
      id: result._id.toString(),
      userId: result.userId,
      title: result.title || 'Untitled Chat',
      updatedAt: result.updatedAt,
      createdAt: result.createdAt,
      isActive: result.isActive !== false
    };
  });
  
  return apiResponse(res, 200, thread, 'Thread retrieved successfully');
}));

/**
 * PUT /api/threads/:id
 * 
 * Updates a thread's title or metadata
 * 
 * @param req.params.id - Thread ID
 * @param req.body.userId - Requesting user's ID (for auth check)
 * @param req.body.title - New thread title (optional)
 * @param req.body.tags - Thread tags (optional)
 * @param req.body.metadata - Thread metadata (optional)
 * 
 * @returns The updated thread object
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, title } = req.body;
  
  // Validate request
  if (!userId) {
    throw new ValidationError('userId is required');
  }
  
  const updatedThread = await withDatabase(async () => {
    // First check if thread exists and belongs to user
    const thread = await Thread.findById(id);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Ensure the user has access to this thread
    if (thread.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to update this thread');
    }
    
    // Update only the provided fields
    if (title !== undefined) thread.title = title.trim();
    
    // Save the updated thread
    await thread.save();
    
    // Format response for frontend
    return {
      id: thread._id.toString(),
      userId: thread.userId,
      title: thread.title || 'Untitled Chat',
      updatedAt: thread.updatedAt,
      createdAt: thread.createdAt,
      isActive: thread.isActive !== false
    };
  });
  
  return apiResponse(res, 200, updatedThread, 'Thread updated successfully');
}));

/**
 * DELETE /api/threads/:id
 * 
 * Deletes a thread and all its messages
 * 
 * @param req.params.id - Thread ID
 * @param req.query.userId - Requesting user's ID (for auth check)
 * 
 * @returns Success message
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  
  // Validate request
  if (!userId) {
    throw new ValidationError('userId query parameter is required');
  }
  
  await withDatabase(async () => {
    // First check if thread exists and belongs to user
    const thread = await Thread.findById(id);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Ensure the user has access to this thread (or is admin)
    const isAdmin = (req as any).user?.role === 'admin';
    if (thread.userId !== userId && !isAdmin) {
      throw new UnauthorizedError('You do not have permission to delete this thread');
    }
    
    // Delete all messages associated with this thread
    await Message.deleteMany({ threadId: thread._id });
    // Delete the thread
    await thread.deleteOne();
  });
  
  return apiResponse(res, 200, null, 'Thread deleted successfully');
}));

/**
 * GET /api/threads/:id/messages
 * 
 * Gets all messages for a specific thread
 * Supports pagination and sorting
 * 
 * @param req.params.id - Thread ID
 * @param req.query.userId - Requesting user's ID (for auth check)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 50)
 * @param req.query.sort - Sort direction (default: asc)
 * 
 * @returns Paginated list of messages
 */
router.get('/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  
  // Validate request
  if (!userId) {
    throw new ValidationError('userId query parameter is required');
  }
  
  // Get pagination and sorting parameters
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '50');
  const sortDirection = (req.query.sort as string) === 'desc' ? -1 : 1;
  
  const result = await withDatabase(async () => {
    // First check if thread exists and belongs to user
    const thread = await Thread.findById(id);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Ensure the user has access to this thread
    if (thread.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to access this thread');
    }
    
    // Get messages with pagination
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      Message.find({ threadId: id })
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ threadId: id })
    ]);
    
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      threadId: msg.threadId.toString(),
      content: msg.content,
      sender: msg.sender?.toString(),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
    
    return {
      messages: formattedMessages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  });
  
  return apiResponse(res, 200, result, 'Messages retrieved successfully');
}));

/**
 * GET /api/threads/admin/all
 * 
 * Admin only: Gets all threads across all users
 * Supports pagination, filtering and sorting
 * 
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20)
 * @param req.query.sort - Sort field (default: updatedAt)
 * @param req.query.order - Sort order (default: desc)
 * @param req.query.userId - Filter by user ID (optional)
 * 
 * @returns Paginated list of all threads
 */
router.get('/admin/all', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  // Get pagination and sorting parameters
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');
  const sort = (req.query.sort as string) || 'updatedAt';
  const order = (req.query.order as string) === 'asc' ? 1 : -1;
  const userId = req.query.userId as string;
  
  // Prepare filter
  const filter: any = {};
  if (userId) {
    filter.userId = userId;
  }
  
  const result = await withDatabase(async () => {
    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [threads, total] = await Promise.all([
      Thread.find(filter)
        .sort({ [sort]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      Thread.countDocuments(filter)
    ]);
    
    return {
      threads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  });
  
  return apiResponse(res, 200, result, 'All threads retrieved successfully');
}));

/**
 * POST /api/threads/update-titles
 * 
 * Updates titles for all threads that have the default title
 * Uses the first message content as the new title
 * 
 * @param req.body.userId - User ID for ownership validation
 * 
 * @returns Summary of updates performed
 */
router.post('/update-titles', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;
  
  // Validate request
  if (!userId) {
    throw new ValidationError('userId is required');
  }
  
  const result = await withDatabase(async () => {
    // Find all threads for the user that have default titles
    const threads = await Thread.find({ 
      userId,
      $or: [
        { title: { $exists: false } },
        { title: null },
        { title: '' },
        { title: 'New Chat' },
        { title: 'Untitled Chat' }
      ]
    });
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each thread
    for (const thread of threads) {
      // Find the first message in the thread
      const firstMessage = await Message.findOne({ 
        threadId: thread._id 
      }).sort({ createdAt: 1 });
      
      if (firstMessage) {
        // Extract first 20 characters and add ellipsis if needed
        const content = firstMessage.content.trim();
        const newTitle = content.length > 20 
          ? content.slice(0, 20) + '...'
          : content;
        
        // Update thread title
        thread.title = newTitle;
        await thread.save();
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
    
    return {
      totalThreads: threads.length,
      updatedCount,
      skippedCount,
      message: `Updated ${updatedCount} thread titles, skipped ${skippedCount} threads with no messages`
    };
  });
  
  return apiResponse(res, 200, result, 'Thread titles updated successfully');
}));

export default router; 