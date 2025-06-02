/**
 * db.ts
 * Database utility routes. Provides endpoints for database maintenance and monitoring.
 * Implements database health checks and connection status.
 * Handles database initialization and cleanup operations.
 */
import express, { Request, Response } from 'express';
import { checkDatabaseConnection } from '@/lib/db';
import { asyncHandler, apiResponse } from '../middleware';

const router = express.Router();

/**
 * GET /api/db/connection-check
 * 
 * Checks if the MongoDB connection is established and working
 * Used by frontend to determine if real API calls can be made or if mock data should be used
 * 
 * @returns Connection status information
 */
router.get('/connection-check', asyncHandler(async (req: Request, res: Response) => {
  // Check database connection
  const connectionStatus = await checkDatabaseConnection();
  
  // Log the connection status
  if (connectionStatus.connected) {
    console.log('Database connection check: Connected');
  } else {
    console.warn(`Database connection check: ${connectionStatus.status} (${connectionStatus.readyState})`);
  }
  
  return apiResponse(res, 200, connectionStatus, 
    connectionStatus.connected ? 'Database connection successful' : 'Database connection failed');
}));

export default router; 