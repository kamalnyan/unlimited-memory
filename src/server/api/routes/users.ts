/**
 * users.ts
 * API routes for user management. Handles user profile and authentication operations.
 * Implements user creation, profile updates, and role management.
 * Integrates with Clerk for authentication and user data synchronization.
 */
import express, { Request, Response } from 'express';
import { User } from '@/models/user';
import { withDatabase } from '@/lib/db';
import { 
  asyncHandler, 
  apiResponse, 
  ValidationError, 
  requireAdmin 
} from '../middleware';
import multer from 'multer';
import { OpenAIService } from '@/server/services/openai';
import dotenv from "dotenv";

dotenv.config();

// Define custom request type with multer file
interface MulterRequest extends Request {
  file?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination?: string;
    filename?: string;
    path?: string;
    buffer: Buffer;
  }
}

const router = express.Router();

const upload = multer();
// Initialize OpenAI service
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
/**
 * POST /api/users/sync
 * 
 * Synchronizes user data from Clerk authentication with our MongoDB
 * Creates a new user record if it doesn't exist, or updates existing user
 * 
 * @param req.body.clerkId - Clerk user ID (required)
 * @param req.body.email - User's email address (required)
 * @param req.body.firstName - User's first name (optional)
 * @param req.body.lastName - User's last name (optional)
 * @param req.body.imageUrl - User's profile image URL (optional)
 * 
 * @returns The created or updated user object
 */
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { clerkId, email, firstName, lastName, imageUrl } = req.body;
  
  // Validate required fields
  if (!clerkId || !email) {
    throw new ValidationError('clerkId and email are required fields');
  }
  
  // Use withDatabase to ensure connection is established
  const result = await withDatabase(async () => {
    const user = await User.findOrCreateUser({
      clerkId,
      email,
      firstName,
      lastName,
      imageUrl
    });
    
    return user;
  });
  
  // Return the synchronized user data
  return apiResponse(res, 200, result, 'User data synchronized successfully');
}));

/**
 * GET /api/users/profile
 * 
 * Gets the current user's profile data
 * This is meant to be called with an authenticated user
 * 
 * @param req.user - The authenticated user (attached by auth middleware)
 * 
 * @returns The user's profile data
 */
router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const clerkId = (req as any).auth?.userId;
  
  if (!clerkId) {
    throw new ValidationError('User ID is required');
  }
  
  const user = await withDatabase(async () => {
    return await User.findOne({ clerkId });
  });
  
  if (!user) {
    return apiResponse(res, 404, null, 'User not found');
  }
  
  return apiResponse(res, 200, user, 'User profile retrieved successfully');
}));

/**
 * GET /api/users
 * 
 * Admin only: Gets a list of all users
 * Supports pagination and filtering
 * 
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20)
 * @param req.query.sort - Sort field (default: createdAt)
 * @param req.query.order - Sort order (default: desc)
 * @param req.query.search - Search term for email/name (optional)
 * 
 * @returns Paginated list of users
 */
router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');
  const sort = (req.query.sort as string) || 'createdAt';
  const order = (req.query.order as string) === 'asc' ? 1 : -1;
  const search = req.query.search as string;
  
  // Create sort and filter objects
  const sortOption: Record<string, number> = { [sort]: order };
  let filter: any = {};
  
  // Add search filtering if provided
  if (search) {
    filter = {
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ]
    };
  }
  
  const users = await withDatabase(async () => {
    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [results, total] = await Promise.all([
      User.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select('-metadata -__v')
        .lean(),
      User.countDocuments(filter)
    ]);
    
    return {
      users: results,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  });
  
  return apiResponse(res, 200, users, 'Users retrieved successfully');
}));

/**
 * PUT /api/users/:id/role
 * 
 * Admin only: Updates a user's role
 * 
 * @param req.params.id - User ID
 * @param req.body.role - New role ('user' or 'admin')
 * 
 * @returns The updated user object
 */
router.put('/:id/role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  
  // Validate role value
  if (!role || !['user', 'admin'].includes(role)) {
    throw new ValidationError('Valid role is required (user or admin)');
  }
  
  const updatedUser = await withDatabase(async () => {
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );
    
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    return user;
  });
  
  return apiResponse(res, 200, updatedUser, `User role updated to ${role}`);
}));

/**
 * POST /api/users/audio-to-text
 * Accepts an audio file and returns the transcription using OpenAI Whisper
 */
router.post('/audio-to-text', upload.single('audio'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      console.error('No audio file uploaded');
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('Received audio file:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const text = await openaiService.transcribeAudio(req.file.buffer, req.file.originalname);
    
    if (!text) {
      console.error('No transcription returned from OpenAI');
      return res.status(500).json({ error: 'Failed to get transcription from OpenAI' });
    }

    console.log('Successfully transcribed audio');
    res.json({ text });
  } catch (error) {
    console.error('Audio transcription error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to transcribe audio'
    });
  }
});

export default router; 
