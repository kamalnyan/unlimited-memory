// pdf-parser.ts
import fs from 'fs/promises';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep track of active workers and their tasks
const workers = new Map<string, { worker: Worker; resolve: Function; reject: Function }>();

// Create a worker for PDF parsing
function createPdfWorker(): Worker {
  return new Worker(path.join(__dirname, 'pdf-worker.js'));
}

// Get or create a worker
function getWorker(): Worker {
  // For now, we'll create a new worker for each request
  // In a production environment, you might want to implement a worker pool
  return createPdfWorker();
}

export async function parsePDF(input: Buffer | string): Promise<{ text: string }> {
  const documentId = uuidv4();
  console.log(`[Parser] Starting PDF parsing for document ${documentId}`);
  
  const worker = getWorker();
  console.log(`[Parser] Got worker for document ${documentId}`);

  try {
    // Convert file path string to buffer if needed
    let buffer: Buffer;
    if (typeof input === "string") {
      console.log(`[Parser] Reading file from path: ${input}`);
      buffer = await fs.readFile(input);
      console.log(`[Parser] File read successfully, size: ${buffer.length} bytes`);
    } else {
      buffer = input;
      console.log(`[Parser] Using provided buffer, size: ${buffer.length} bytes`);
    }

    // Create a promise to handle the worker response
    const result = await new Promise<{ text: string }>((resolve, reject) => {
      console.log(`[Parser] Setting up worker handlers for document ${documentId}`);
      
      // Store the worker and its callbacks
      workers.set(documentId, { worker, resolve, reject });

      // Set up message handler
      worker.on('message', (message) => {
        console.log(`[Parser] Received message from worker for document ${documentId}:`, {
          hasError: !!message.error,
          textLength: message.text?.length || 0
        });
        
        if (message.documentId === documentId) {
          if (message.error) {
            console.error(`[Parser] Worker reported error for document ${documentId}:`, message.error);
            reject(new Error(message.error));
          } else {
            console.log(`[Parser] Worker successfully processed document ${documentId}`);
            resolve({ text: message.text });
          }
          // Clean up
          console.log(`[Parser] Cleaning up worker for document ${documentId}`);
          workers.delete(documentId);
          worker.terminate();
        }
      });

      // Set up error handler
      worker.on('error', (error) => {
        console.error(`[Parser] Worker error for document ${documentId}:`, error);
        if (workers.has(documentId)) {
          workers.get(documentId)?.reject(error);
          workers.delete(documentId);
          worker.terminate();
        }
      });

      // Send the PDF buffer to the worker
      console.log(`[Parser] Sending buffer to worker for document ${documentId}`);
      worker.postMessage({ buffer, documentId });
    });

    console.log(`[Parser] Successfully parsed document ${documentId}`);
    return result;
  } catch (error) {
    // Clean up on error
    console.error(`[Parser] Error processing document ${documentId}:`, error);
    if (workers.has(documentId)) {
      console.log(`[Parser] Cleaning up worker after error for document ${documentId}`);
      workers.delete(documentId);
      worker.terminate();
    }
    throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Cleanup function to terminate all workers
export function cleanup() {
  for (const [documentId, { worker, reject }] of workers.entries()) {
    reject(new Error('Parser cleanup'));
    worker.terminate();
    workers.delete(documentId);
  }
}