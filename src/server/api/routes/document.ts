import express from "express";
import multer from "multer";
import { OpenAI } from "openai";
import { parsePDF } from "../../lib/pdf-parser";
import mammoth from "mammoth";
import { Request, Response } from "express";

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('Processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    // Accept both PDF and DOCX files
    if (file.mimetype === "application/pdf" || 
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word (DOCX) files are allowed"));
    }
  }
}).any(); // Use .any() to accept any field name

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MulterRequest extends Request {
  files?: multer.File[];
}

// Function to parse Word documents
async function parseWordDoc(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    // mammoth returns an object with a value property containing the text
    // and messages for any warnings
    if (result.messages && result.messages.length > 0) {
      console.log('Word document parsing warnings:', result.messages);
    }
    // The value property contains the extracted text
    const text = result.value;
    if (typeof text === 'string') {
      return text;
    } else if (typeof text === 'object' && text !== null && 'text' in text) {
      return text.text;
    } else {
      throw new Error('Unexpected text format from mammoth');
    }
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error('Failed to parse Word document');
  }
}

// Function to parse document based on file type
async function parseDocument(file: multer.File): Promise<string> {
  if (file.mimetype === "application/pdf") {
    return await parsePDF(file.buffer);
  } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return await parseWordDoc(file.buffer);
  } else {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
}

// Use upload middleware
router.post("/ask-doc", (req: Request, res: Response, next: express.NextFunction) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        data: null
      });
    } else if (err) {
      console.error('Unknown error:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null
      });
    }
    next();
  });
}, async (req: MulterRequest, res: Response) => {
  try {
    // Log the request for debugging
    console.log('Files received:', req.files?.map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype
    })));
    console.log('Question received:', req.body.question);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No files uploaded",
        data: null
      });
    }

    // Validate file count
    if (req.files.length > 2) {
      return res.status(400).json({
        success: false,
        message: "Maximum 2 files allowed",
        data: null
      });
    }

    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ 
        success: false,
        message: "Question is required",
        data: null
      });
    }

    // Process each file sequentially and combine their content
    let combinedText = "";
    for (const file of req.files) {
      try {
        const text = await parseDocument(file);
        if (text) {
          // Ensure text is a string and add clear document separation
          const textContent = typeof text === 'string' ? text : JSON.stringify(text);
          combinedText += `\n\n=== Document: ${file.originalname} (${file.mimetype}) ===\n\n${textContent}`;
          
          // Log a preview of the actual content for debugging
          console.log(`Content preview for ${file.originalname}:`, {
            fileType: file.mimetype,
            firstFewLines: textContent.split('\n').slice(0, 5).join('\n'),
            totalLength: textContent.length
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        return res.status(400).json({ 
          success: false,
          message: `Error processing file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: null
        });
      }
    }

    if (!combinedText.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "No text could be extracted from the provided documents",
        data: null
      });
    }

    // Create a prompt that includes both documents' content
    const prompt = `You are a helpful assistant that analyzes technical documents and code examples. Please analyze the following documents and provide a detailed summary of their content, focusing on the actual code examples and implementations shown.

Documents:
${combinedText}

Question: ${question}

Please provide a detailed analysis that:
1. Identifies the specific programming concepts and algorithms demonstrated in each document
2. Explains the code examples and their implementations
3. Highlights any practical exercises or problems solved
4. Describes the input/output behavior of the programs
5. Notes any specific programming language features or techniques used

Focus on the actual content shown in the documents, not general assumptions about what might be in them. If you see code examples, explain what they do and how they work.

Answer:`;

    // Log a preview of the actual content being sent
    console.log('Sending prompt to OpenAI:', {
      promptLength: prompt.length,
      question,
      documentCount: req.files.length,
      documentNames: req.files.map(f => f.originalname),
      contentPreview: combinedText.split('\n').slice(0, 10).join('\n') + '...' // Show first 10 lines
    });

    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k", // Using 16k model for longer documents
      messages: [
        {
          role: "system",
          content: "You are a technical document analyzer that focuses on explaining code examples and implementations. When you see code, explain what it does, how it works, and its key features. Be specific about the actual content shown in the documents.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000, // Increased token limit for more detailed analysis
      temperature: 0.3, // Lower temperature for more focused analysis
    });

    console.log('Received response from OpenAI:', {
      responseLength: completion.choices[0]?.message?.content?.length,
      finishReason: completion.choices[0]?.finish_reason,
      usage: completion.usage
    });

    const answer = completion.choices[0]?.message?.content || "No answer generated";

    res.json({ 
      success: true,
      message: "Successfully processed documents",
      data: { answer }
    });
  } catch (error) {
    console.error("Error processing documents:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Error processing documents",
      data: null
    });
  }
});

export default router;