/**
 * index.ts
 * Main server entry point. Sets up Express server, middleware, and API routes.
 * Configures CORS, authentication, and error handling.
 * Initializes MongoDB connection and starts the server.
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { connectToDatabase } from './lib/db';
import config from './config';
import apiRoutes from './api';

/**
 * Initialize the Express application server
 */
const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Register the API routes
 */
app.use('/api', apiRoutes);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Start the server
 */
async function startServer() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Start listening
    const PORT = config.port;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const fallbackPort = 8083;
        console.log(`Port ${PORT} is in use, trying fallback port ${fallbackPort}`);
        server.listen(fallbackPort, () => {
          console.log(`Server running on fallback port ${fallbackPort}`);
          console.log(`API available at http://localhost:${fallbackPort}/api`);
        });
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Handle server shutdown gracefully
 */
function handleShutdown() {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

// Handle termination signals
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  handleShutdown();
});

// Start the server if this file is run directly
// In ES modules, we use import.meta.url to check if file is run directly
const isMainModule = import.meta.url.endsWith('index.ts') || 
                     import.meta.url.endsWith('index.js');
if (isMainModule) {
  startServer();
}

export { app, server, startServer }; 