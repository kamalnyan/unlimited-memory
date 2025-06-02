/**
 * messages.ts
 * API routes for message management. Handles CRUD operations for chat messages.
 * Implements message sending, listing, updating, and deletion.
 * Manages message threading and user associations.
 */
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message, IFileAttachment } from '@/models/message';
import { Thread } from '@/models/thread';
import { withDatabase } from '@/lib/db';
import { OpenAIService } from '@/server/services/openai';
import { 
  asyncHandler, 
  apiResponse, 
  ValidationError, 
  NotFoundError,
  UnauthorizedError 
} from '../middleware';

const router = express.Router();

// Initialize OpenAI service
const openaiService = new OpenAIService(process.env.OPENAI_API_KEY );

/**
 * POST /api/messages
 * 
 * Creates a new message in a thread
 * 
 * @param req.body.threadId - Thread ID (required)
 * @param req.body.content - Message content (required)
 * @param req.body.userId - User ID for ownership validation
 * @param req.body.files - Array of file attachments (optional)
 * 
 * @returns The created message object
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { threadId, content, userId, files } = req.body;
  
  // Validate required fields
  if (!threadId || !content) {
    throw new ValidationError('threadId and content are required fields');
  }
  
  // Check if the thread ID is valid
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw new ValidationError('Invalid thread ID format');
  }
  
  const message = await withDatabase(async () => {
    // First check if thread exists and user has access
    const thread = await Thread.findById(threadId);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // If userId is provided, verify ownership
    if (userId && thread.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to add messages to this thread');
    }
    
    // Determine sender: prefer req.user.clerkId, else userId, else 'system'
    const reqAny = req as any;
    let sender = 'system';
    if (reqAny.user && reqAny.user.clerkId) sender = reqAny.user.clerkId;
    else if (userId) sender = userId;
    else if (reqAny.user && reqAny.user.email) sender = reqAny.user.email;
    else if (reqAny.user && reqAny.user.username) sender = reqAny.user.username;

    // Create the message with optional files
    const messageData: any = {
      threadId,
      content,
      sender,
    };
    
    // Add files if provided
    if (files && Array.isArray(files) && files.length > 0) {
      messageData.files = files;
    }
    
    const newMessage = await Message.create(messageData);
    
    // Fetch previous messages for context
    const context = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();

    // After creating the user message, generate AI response
    const aiResponseContent = await openaiService.generateResponse(newMessage.threadId, newMessage.content, context);
    
    // Create AI message
    const aiMessage = await Message.create({
      threadId,
      content: aiResponseContent,
      sender: 'system',
    });
    
    // Format message for frontend
    return {
      id: newMessage._id.toString(),
      threadId: newMessage.threadId.toString(),
      content: newMessage.content,
      sender: newMessage.sender?.toString(),
      files: newMessage.files,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
    };
  });
  
  return apiResponse(res, 201, message, 'Message created successfully');
}));

/**
 * GET /api/messages/:id
 * 
 * Gets a specific message by ID
 * Also verifies that the requesting user has access to the thread
 * 
 * @param req.params.id - Message ID
 * @param req.query.userId - User ID for ownership validation
 * 
 * @returns The message object
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  
  // Check if the message ID is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid message ID format');
  }
  
  const message = await withDatabase(async () => {
    // Find the message
    const msg = await Message.findById(id);
    
    if (!msg) {
      throw new NotFoundError('Message not found');
    }
    
    // If userId is provided, verify thread ownership
    if (userId) {
      const thread = await Thread.findById(msg.threadId);
      
      if (!thread) {
        throw new NotFoundError('Thread not found');
      }
      
      if (thread.userId !== userId) {
        throw new UnauthorizedError('You do not have permission to access this message');
      }
    }
    
    // Format message for frontend
    return {
      id: msg._id.toString(),
      threadId: msg.threadId.toString(),
      content: msg.content,
      sender: msg.sender?.toString(),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };
  });
  
  return apiResponse(res, 200, message, 'Message retrieved successfully');
}));

/**
 * PUT /api/messages/:id
 * 
 * Updates a message (for edits, version control)
 * 
 * @param req.params.id - Message ID
 * @param req.body.content - New message content
 * @param req.body.userId - User ID for ownership validation
 * 
 * @returns The updated message
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, userId } = req.body;
  
  // Validate required fields
  if (!content) {
    throw new ValidationError('content is required');
  }
  
  // Check if the message ID is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid message ID format');
  }
  
  const updatedMessage = await withDatabase(async () => {
    // Find the message
    const message = await Message.findById(id);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // If userId is provided, verify thread ownership
    if (userId) {
      const thread = await Thread.findById(message.threadId);
      
      if (!thread) {
        throw new NotFoundError('Thread not found');
      }
      
      if (thread.userId !== userId) {
        throw new UnauthorizedError('You do not have permission to update this message');
      }
    }
    
    // Update the message
    message.content = content;
    await message.save();
    
    // Format message for frontend
    return {
      id: message._id.toString(),
      threadId: message.threadId.toString(),
      content: message.content,
      sender: message.sender?.toString(),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  });
  
  return apiResponse(res, 200, updatedMessage, 'Message updated successfully');
}));

/**
 * DELETE /api/messages/:id
 * 
 * Deletes a message
 * Also verifies that the requesting user has access to the thread
 * 
 * @param req.params.id - Message ID
 * @param req.query.userId - User ID for ownership validation
 * 
 * @returns Success message
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  
  // Check if the message ID is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid message ID format');
  }
  
  const result = await withDatabase(async () => {
    // Find the message
    const message = await Message.findById(id);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // If userId is provided, verify thread ownership
    if (userId) {
      const thread = await Thread.findById(message.threadId);
      
      if (!thread) {
        throw new NotFoundError('Thread not found');
      }
      
      if (thread.userId !== userId) {
        throw new UnauthorizedError('You do not have permission to delete this message');
      }
    }
    
    // Get the thread ID before deleting the message
    const threadId = message.threadId;
    
    // Delete the message
    await Message.findByIdAndDelete(id);
    
    // Return the deleted message ID in consistent format
    return {
      id: id,
      threadId: threadId.toString(),
      success: true,
      message: 'Message deleted successfully'
    };
  });
  
  return apiResponse(res, 200, result, 'Message deleted successfully');
}));

/**
 * POST /api/messages/batch
 * 
 * Creates multiple messages at once (for importing conversations)
 * 
 * @param req.body.threadId - Thread ID
 * @param req.body.messages - Array of message objects
 * @param req.body.userId - User ID for ownership validation
 * 
 * @returns The created messages
 */
router.post('/batch', asyncHandler(async (req: Request, res: Response) => {
  const { threadId, messages, userId } = req.body;
  
  // Validate required fields
  if (!threadId || !Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError('threadId and non-empty messages array are required');
  }
  
  // Check if the thread ID is valid
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw new ValidationError('Invalid thread ID format');
  }
  
  const result = await withDatabase(async () => {
    // First check if thread exists and user has access
    const thread = await Thread.findById(threadId);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // If userId is provided, verify ownership
    if (userId && thread.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to add messages to this thread');
    }
    
    // Prepare messages for insertion
    const messagesToInsert = messages.map(msg => ({
      threadId,
      content: msg.content,
      sender: msg.sender || userId || 'system',
    }));
    
    // Create all messages
    const createdMessages = await Message.insertMany(messagesToInsert);
    
    // Format messages for frontend
    return createdMessages.map(msg => ({
      id: msg._id.toString(),
      threadId: msg.threadId.toString(),
      content: msg.content,
      sender: msg.sender?.toString(),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
  });
  
  return apiResponse(res, 201, result, 'Messages created successfully');
}));

/**
 * POST /api/messages/generate
 * 
 * Generates an AI response to a user message
 * 
 * @param req.body.threadId - Thread ID
 * @param req.body.userMessage - User message content
 * 
 * @returns Generated AI message
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { threadId, userMessage } = req.body;
  
  // Validate required fields
  if (!threadId || !userMessage) {
    throw new ValidationError('threadId and userMessage are required fields');
  }
  
  // Check if the thread ID is valid
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw new ValidationError('Invalid thread ID format');
  }
  
  const aiMessage = await withDatabase(async () => {
    // First check if thread exists
    const thread = await Thread.findById(threadId);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Get conversation context (last 10 messages in chronological order)
    // Using proper sort order with Mongoose - oldest messages first
    const context = await Message.find({ threadId })
      .sort({ createdAt: 1 }) // 1 = ascending, oldest first
      .limit(10)
      .lean() // Use lean() to get plain objects instead of Mongoose documents
      .exec();
    
    console.log(`Generating AI response for thread ${threadId} with ${context.length} context messages`);
    
    // Generate AI response using OpenAI with file content included
    const aiContent = await openaiService.generateResponse(threadId, userMessage, context);
    
    // Create and save the AI response message
    const newMessage = await Message.create({
      threadId,
      content: aiContent,
      sender: 'system',
    });
    
    // Format message for frontend
    return {
      id: newMessage._id.toString(),
      threadId: newMessage.threadId.toString(),
      content: newMessage.content,
      sender: newMessage.sender?.toString(),
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
    };
  });
  
  return apiResponse(res, 201, aiMessage, 'AI response generated successfully');
}));

export default router; 