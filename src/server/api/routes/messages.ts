/**
 * messages.ts
 * API routes for message management. Handles CRUD operations for chat messages.
 * Implements message sending, listing, updating, and deletion.
 * Manages message threading and user associations.
 */
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message, IMessage } from '../../../models/message.js';
import { Thread } from '../../../models/thread.js';
import { withDatabase } from '../../../lib/db.js';
import { 
  asyncHandler, 
  apiResponse, 
  ValidationError, 
  NotFoundError,
  UnauthorizedError 
} from '../middleware.js';
import { isTrivialMessage } from '../../../utils/messageUtils.js';
import { embeddingService, openaiService } from '../index.js';

const router = express.Router();

/**
 * POST /api/messages
 * Create a new message in a thread
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { threadId, content, userId } = req.body;
  
  if (!threadId || !content) {
    throw new ValidationError('threadId and content are required fields');
  }
  
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw new ValidationError('Invalid thread ID format');
  }
  
  console.log(`Creating message in thread ${threadId}`, { userId });
  
  const message = await withDatabase(async () => {
    // Find the thread to ensure it exists
    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Create the user message
    const newMessage = await Message.create({
      threadId,
      content,
      sender: userId || 'user',
      files: req.body.files || []
    });
    
    console.log('Message saved:', newMessage._id.toString());
    
    // Check if this is a trivial message (greeting, etc.)
    const skipEmbedding = isTrivialMessage(content);
    
    if (skipEmbedding) {
      console.log(`Skipping embedding for trivial message: "${content}"`);
      
      // For trivial messages, just generate a simple response without RAG
      const context = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();
      const aiResponseContent = await openaiService.generateResponse(
        thread._id.toString(),
        content,
        context
      );

      const aiMessage = await Message.create({
        threadId,
        content: aiResponseContent,
        sender: 'system',
      });

      return {
        id: newMessage._id.toString(),
        threadId: newMessage.threadId.toString(),
        content: newMessage.content,
        sender: newMessage.sender?.toString(),
        files: newMessage.files,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
        aiResponse: {
          id: aiMessage._id.toString(),
          content: aiMessage.content,
          sender: aiMessage.sender,
          createdAt: aiMessage.createdAt
        },
        skippedEmbedding: true
      };
    }

    try {
      // Store message embedding
      if (embeddingService.isEnabled()) {
        console.log('Creating embedding for message');
        await embeddingService.createEmbedding(
          thread.userId,
          content,
          thread._id.toString(),
          newMessage._id.toString()
        );
        console.log('Message embedding created successfully');

        // Get context-enhanced response using RAG
        console.log('Getting RAG-enhanced response');
        const ragResponse = await embeddingService.getRAGResponse(
          thread.userId,
          content,
          thread._id.toString()
        );
        console.log('RAG results received successfully');

        // Get conversation context
        const context = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();

        // Enhanced prompt with RAG context
        const enhancedPrompt = await embeddingService.enhancePromptWithRAG(
          thread.userId,
          content,
          thread._id.toString(),
          context
        );

        // Generate AI response using OpenAI with enhanced context
        const aiResponseContent = await openaiService.generateResponse(
          thread._id.toString(),
          enhancedPrompt, // Use the enhanced prompt
          context
        );

        // Create AI message
        const aiMessage = await Message.create({
          threadId,
          content: aiResponseContent,
          sender: 'system',
        });

        // Store embedding for AI response too if it's substantial
        if (aiResponseContent.length > 20) {
          await embeddingService.createEmbedding(
            thread.userId,
            aiResponseContent,
            thread._id.toString()
          );
        }

        return {
          id: newMessage._id.toString(),
          threadId: newMessage.threadId.toString(),
          content: newMessage.content,
          sender: newMessage.sender?.toString(),
          files: newMessage.files,
          createdAt: newMessage.createdAt,
          updatedAt: newMessage.updatedAt,
          aiResponse: {
            id: aiMessage._id.toString(),
            content: aiMessage.content,
            sender: aiMessage.sender,
            createdAt: aiMessage.createdAt
          }
        };
      } else {
        throw new Error('Embedding service not available');
      }
    } catch (error) {
      console.error('Error in embedding/RAG processing:', error);
      
      // Fall back to basic OpenAI response if embedding API fails
      const context = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();
      const aiResponseContent = await openaiService.generateResponse(
        thread._id.toString(),
        content,
        context
      );
      
      const aiMessage = await Message.create({
        threadId,
        content: aiResponseContent,
        sender: 'system',
      });
      
      return {
        id: newMessage._id.toString(),
        threadId: newMessage.threadId.toString(),
        content: newMessage.content,
        sender: newMessage.sender?.toString(),
        files: newMessage.files,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
        aiResponse: {
          id: aiMessage._id.toString(),
          content: aiMessage.content,
          sender: aiMessage.sender,
          createdAt: aiMessage.createdAt
        },
        warning: 'Embedding service unavailable, using basic response'
      };
    }
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
 * Always uses RAG and embedding for all messages
 * 
 * @param req.body.threadId - Thread ID
 * @param req.body.userMessage - User message content
 * 
 * @returns Generated AI message with context
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { threadId, userMessage } = req.body;

  if (!threadId || !userMessage) {
    throw new ValidationError('threadId and userMessage are required fields');
  }

  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw new ValidationError('Invalid thread ID format');
  }

  console.log('Embedding service enabled:', embeddingService.isEnabled());

  const responsePayload = await withDatabase(async () => {
    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    // Store the user message first
    const userMessageDoc = await Message.create({
      threadId,
      content: userMessage,
      sender: thread.userId || 'user', // fallback
    });

    try {
      if (embeddingService.isEnabled()) {
        console.log('Creating embedding for user message');
        // Create embedding for the user message
        await embeddingService.createEmbedding(
          thread.userId,
          userMessage,
          thread._id.toString(),
          userMessageDoc._id.toString()
        );
        console.log('User message embedding created');

        // Get conversation context
        const context = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();
        
        // Get enhanced prompt with RAG context
        const enhancedPrompt = await embeddingService.enhancePromptWithRAG(
          thread.userId,
          userMessage,
          thread._id.toString(),
          context
        );
        console.log('Enhanced prompt with RAG context');

        // Generate AI response using OpenAI with enhanced context
        const aiContent = await openaiService.generateResponse(
          threadId, 
          enhancedPrompt, 
          context
        );

        // Create AI message
        const aiMessageDoc = await Message.create({
          threadId,
          content: aiContent,
          sender: 'system',
        });

        // Store embedding for AI response too if it's substantial
        if (aiContent.length > 20) {
          await embeddingService.createEmbedding(
            thread.userId,
            aiContent,
            thread._id.toString()
          );
        }

        return {
          id: aiMessageDoc._id.toString(),
          threadId: aiMessageDoc.threadId.toString(),
          content: aiMessageDoc.content,
          sender: aiMessageDoc.sender,
          createdAt: aiMessageDoc.createdAt,
          updatedAt: aiMessageDoc.updatedAt,
        };
      } else {
        throw new Error('Embedding service not available');
      }
    } catch (error) {
      console.error('Error in RAG-enhanced response generation:', error);

      // Fall back to basic OpenAI response if embedding API fails
      const context = await Message.find({ threadId }).sort({ createdAt: 1 }).limit(10).lean();
      const fallbackResponse = await openaiService.generateResponse(threadId, userMessage, context);

      const fallbackMsg = await Message.create({
        threadId,
        content: fallbackResponse,
        sender: 'system',
      });

      return {
        id: fallbackMsg._id.toString(),
        threadId: fallbackMsg.threadId.toString(),
        content: fallbackMsg.content,
        sender: fallbackMsg.sender,
        createdAt: fallbackMsg.createdAt,
        updatedAt: fallbackMsg.updatedAt,
        warning: 'Fallback response used due to embedding service failure',
      };
    }
  });

  return apiResponse(res, 201, responsePayload, 'AI response generated successfully');
}));

export default router; 