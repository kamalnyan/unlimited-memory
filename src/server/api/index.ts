/**
 * api/index.ts
 * API router configuration. Combines all route handlers and middleware.
 * Sets up authentication and error handling for all API endpoints.
 * Exports the main API router for use in the Express application.
 */
import express from 'express';
import { json, urlencoded } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware';
import { extractClerkUser } from './auth-middleware';

// Import route modules
import userRoutes from './routes/users';
import threadRoutes from './routes/threads';
import messageRoutes from './routes/messages';
import dbRoutes from './routes/db';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import aiVisionRoutes from './routes/aiVision';
import uploadRoutes from './routes/upload';
import adminUserSummaryRoutes from './routes/adminUserSummary';
import documentRoutes from './routes/document';
// Create Express router instance
const router = express.Router();

/**
 * Apply global middleware
 */
// Parse JSON and URL-encoded request bodies
router.use(json());
router.use(urlencoded({ extended: true }));

// Enable CORS
router.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  
  // Clone the original json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(body) {
    // Log the response (limited to prevent huge logs)
    if (body && body.data) {
      const sanitizedBody = { ...body };
      // Prevent logging large data payloads
      if (typeof sanitizedBody.data === 'object' && sanitizedBody.data !== null) {
        sanitizedBody.data = '[DATA]';
      }
      console.log(`[API] Response: ${res.statusCode} ${JSON.stringify(sanitizedBody)}`);
    } else {
      console.log(`[API] Response: ${res.statusCode}`, body ? '[BODY]' : '[NO BODY]');
    }
    
    // Call the original json method
    return originalJson.call(this, body);
  };
  
  next();
});

// Apply authentication extraction middleware to all routes
router.use(extractClerkUser);

/**
 * Root API route - Health check
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Chat Thread Nexus API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Register API route modules
 */
router.use('/users', userRoutes);
router.use('/threads', threadRoutes);
router.use('/messages', messageRoutes);
router.use('/db', dbRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiVisionRoutes);
router.use('/', uploadRoutes);
router.use('/adminUserSummary', adminUserSummaryRoutes);
router.use('/document', documentRoutes);
/**
 * 404 handler for API routes
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    data: null
  });
});

/**
 * Global error handler
 */
router.use(errorHandler);

export default router;