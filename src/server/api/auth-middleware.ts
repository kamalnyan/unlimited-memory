/**
 * auth-middleware.ts
 * Authentication middleware for API routes. Verifies user sessions and permissions.
 * Integrates with Clerk for user authentication and role management.
 * Handles token validation and user context injection.
 */
import { Request, Response, NextFunction } from 'express';
import { User } from '@/models/user';
import { UnauthorizedError } from './middleware';
import config from '../config';

/**
 * Middleware to extract Clerk user ID from auth headers
 * This attaches the userId to the request object for downstream middleware/handlers
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export async function extractClerkUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract the Authorization header
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without user info
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // In a real implementation, you would validate the token with Clerk SDK
    // For this implementation, we'll use a placeholder
    // This should be replaced with actual Clerk token validation
    
    // Mock verification for development
    // In production, use Clerk's SDK to verify tokens
    if (config.app.isProduction) {
      // Production verification would use Clerk SDK:
      // const { userId } = await clerk.verifyToken(token);
      // if (!userId) throw new UnauthorizedError('Invalid token');
      
      // Placeholder until Clerk SDK is properly integrated:
      console.warn('Production token verification not implemented');
      return next();
    } else {
      // Development mode - extract userId from query param for testing
      const userId = req.query.userId as string || req.body.userId;
      if (userId) {
        (req as any).auth = { userId };
        
        // Optionally, load user from database to attach to request
        try {
          const user = await User.findOne({ clerkId: userId }).lean();
          if (user) {
            (req as any).user = user;
          }
        } catch (error) {
          console.error('Error loading user from database:', error);
        }
      }
    }
    
    next();
  } catch (error) {
    next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Middleware to require authentication
 * This should be used after extractClerkUser middleware
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).auth?.userId) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  next();
}

/**
 * Function to check if an email is in the admin list
 * 
 * @param email - Email to check
 * @returns boolean indicating if the email is an admin
 */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  
  // Convert email to lowercase for case-insensitive comparison
  const lowerEmail = email.toLowerCase();
  
  // Get admin emails from config
  const adminEmails = config.auth.adminEmails.map(e => e.toLowerCase());
  
  // Check if the email is in the admin list
  return adminEmails.includes(lowerEmail);
} 
