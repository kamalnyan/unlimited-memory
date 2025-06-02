// pdf-worker.js
import { parentPort } from 'worker_threads';
import PDFParser from 'pdf2json';

// Keep track of active parsing tasks
const activeTasks = new Map();

// Helper function to check PDF header
function isValidPdfHeader(buffer) {
  // PDF header should start with %PDF-
  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF- in hex
  if (buffer.length < 5) return false;
  
  // Compare first 5 bytes
  for (let i = 0; i < 5; i++) {
    if (buffer[i] !== header[i]) return false;
  }
  return true;
}

// Handle messages from the main thread
parentPort.on('message', async ({ buffer, documentId }) => {
  console.log(`[Worker] Starting to process document ${documentId}`);
  console.log(`[Worker] Buffer size: ${buffer.length} bytes`);
  
  if (!buffer || buffer.length === 0) {
    console.error('[Worker] Received empty buffer');
    parentPort.postMessage({ 
      documentId,
      error: 'Empty PDF buffer received'
    });
    return;
  }

  // Validate PDF header
  if (!isValidPdfHeader(buffer)) {
    console.error('[Worker] Invalid PDF header. First 5 bytes:', Array.from(buffer.slice(0, 5)));
    parentPort.postMessage({ 
      documentId,
      error: 'Invalid PDF file: File may be corrupted or not a valid PDF'
    });
    return;
  }
  
  try {
    // Create a new PDFParser instance for this document
    const pdfParser = new PDFParser(null, 1); // Verbose level 1 for more logging
    console.log('[Worker] Created PDFParser instance');
    
    // Store the task promise
    const taskPromise = new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        console.log(`[Worker] PDF data ready for document ${documentId}`);
        
        if (!pdfData || !pdfData.Pages || !Array.isArray(pdfData.Pages)) {
          console.error('[Worker] Invalid PDF data structure:', pdfData);
          reject(new Error('Invalid PDF data structure'));
          return;
        }

        console.log(`[Worker] Number of pages: ${pdfData.Pages.length}`);
        if (pdfData.Pages.length === 0) {
          console.error('[Worker] PDF has no pages');
          reject(new Error('PDF has no pages'));
          return;
        }
        
        // Extract text from all pages
        const text = pdfData.Pages.map((page, pageIndex) => {
          console.log(`[Worker] Processing page ${pageIndex + 1}`);
          
          if (!page.Texts || !Array.isArray(page.Texts)) {
            console.error(`[Worker] Invalid page structure on page ${pageIndex + 1}`);
            return '';
          }

          const pageText = page.Texts.map((text, textIndex) => {
            try {
              if (!text.R || !Array.isArray(text.R) || text.R.length === 0) {
                console.error(`[Worker] Invalid text structure on page ${pageIndex + 1}, text ${textIndex}`);
                return '';
              }
              const decodedText = decodeURIComponent(text.R[0].T);
              console.log(`[Worker] Decoded text on page ${pageIndex + 1}, text ${textIndex}:`, decodedText.substring(0, 50));
              return decodedText;
            } catch (error) {
              console.error(`[Worker] Error decoding text on page ${pageIndex + 1}, text ${textIndex}:`, error);
              return '';
            }
          }).join(' ');

          console.log(`[Worker] Page ${pageIndex + 1} text length: ${pageText.length}`);
          if (pageText.length === 0) {
            console.warn(`[Worker] No text extracted from page ${pageIndex + 1}`);
          }
          return pageText;
        }).join('\n');

        const finalText = text.trim();
        console.log(`[Worker] Total extracted text length: ${finalText.length}`);
        
        if (finalText.length === 0) {
          console.error('[Worker] No text could be extracted from the PDF');
          reject(new Error('No text could be extracted from the PDF'));
          return;
        }

        console.log(`[Worker] First 100 chars of text: ${finalText.substring(0, 100)}`);
        console.log(`[Worker] Last 100 chars of text: ${finalText.substring(finalText.length - 100)}`);
        
        resolve({ text: finalText });
      });

      pdfParser.on('pdfParser_dataError', (error) => {
        console.error('[Worker] PDF parsing error:', error);
        reject(new Error(`PDF parsing error: ${error.message || 'Unknown error'}`));
      });

      // Start parsing
      console.log('[Worker] Starting PDF parsing');
      try {
        pdfParser.parseBuffer(buffer);
      } catch (parseError) {
        console.error('[Worker] Error during parseBuffer:', parseError);
        reject(new Error(`Error during PDF parsing: ${parseError.message || 'Unknown error'}`));
      }
    });

    // Store the task
    activeTasks.set(documentId, taskPromise);

    // Wait for the task to complete
    const result = await taskPromise;
    console.log(`[Worker] Successfully processed document ${documentId}`);

    // Send the result back to the main thread
    parentPort.postMessage({ 
      documentId,
      text: result.text 
    });

    // Clean up
    activeTasks.delete(documentId);

  } catch (error) {
    console.error(`[Worker] Error processing document ${documentId}:`, error);
    // Send any errors back to the main thread
    parentPort.postMessage({ 
      documentId,
      error: error.message || 'Unknown error during PDF parsing'
    });
    
    // Clean up on error
    activeTasks.delete(documentId);
  }
});

// Handle cancellation requests
parentPort.on('cancel', (documentId) => {
  console.log(`[Worker] Received cancel request for document ${documentId}`);
  if (activeTasks.has(documentId)) {
    // Note: We can't actually cancel the PDF parsing, but we can clean up
    activeTasks.delete(documentId);
    parentPort.postMessage({ 
      documentId,
      error: 'Parsing cancelled' 
    });
  }
});

// Handle cleanup
process.on('exit', () => {
  console.log('[Worker] Worker process exiting, cleaning up tasks');
  // Clean up any remaining tasks
  activeTasks.clear();
});