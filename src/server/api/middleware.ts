import { Request, Response, NextFunction } from 'express';

/**
 * middleware.ts
 * API middleware configuration. Sets up request processing and error handling.
 * Implements authentication, logging, and request validation.
 * Provides utility functions for common middleware operations.
 */

/**
 * Standard API response format to ensure consistency across all endpoints
 * 
 * @param res - Express response object
 * @param status - HTTP status code
 * @param data - Response data payload
 * @param message - Optional response message
 */
export function apiResponse(
  res: Response, 
  status: number, 
  data: any = null, 
  message: string = ''
) {
  return res.status(status).json({
    success: status >= 200 && status < 300,
    message,
    data
  });
}

/**
 * Global error handler middleware for consistent API error responses
 * 
 * @param err - Error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function errorHandler(
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  console.error('API Error:', err);
  
  // Determine status code based on error type
  let statusCode = 500;
  let message = 'Internal Server Error';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  }
  
  return apiResponse(res, statusCode, null, err.message || message);
}

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Async handler to simplify error handling in async route handlers
 * This wraps async route handlers and forwards errors to the error middleware
 * 
 * @param fn - Async route handler function
 */
export const asyncHandler = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user has admin role
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // The user should be attached to req by the auth middleware
  const user = (req as any).user;
  
  if (!user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  if (user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  
  next();
} 