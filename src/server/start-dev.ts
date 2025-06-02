/**
 * Development server startup script
 * Starts both the Node.js API server and the Vite dev server
 */

import { startServer } from './index';
import { spawn } from 'child_process';
import path from 'path';

async function startDevelopmentServer() {
  console.log('Starting development server...');
  
  // Start the API server
  try {
    console.log('Starting API server...');
    await startServer();
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
  
  // Start the Vite development server
  console.log('Starting Vite development server...');
  const viteProcess = spawn('npm', ['run', 'vite'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../../')
  });
  
  viteProcess.on('error', (error) => {
    console.error('Failed to start Vite server:', error);
    process.exit(1);
  });
  
  // Handle termination signals
  process.on('SIGINT', () => {
    console.log('Shutting down development servers...');
    viteProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down development servers...');
    viteProcess.kill('SIGTERM');
    process.exit(0);
  });
}

// Start development server
startDevelopmentServer().catch(error => {
  console.error('Uncaught error in development server:', error);
  process.exit(1);
}); 