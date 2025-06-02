/**
 * openai.ts
 * OpenAI service for handling GPT integration.
 * Manages API calls, conversation context, and response generation.
 */
import OpenAI from 'openai';
import { IMessage } from '@/models/message';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// ES Module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpenAIService {
  private openai: OpenAI | null = null;
  private model: string;
  private useMockResponses: boolean = false;

  constructor(apiKey?: string) {
    // Get the API key or use a development fallback
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    if (apiKey) {
      try {
        console.log('Initializing OpenAI service');
        this.openai = new OpenAI({ 
          apiKey,
          dangerouslyAllowBrowser: true // Allow running in browser environments
        });
        
        // Don't test the API key immediately - it can cause server startup issues
        // Just assume it's valid and handle errors when generating responses
        console.log('OpenAI service initialized with provided API key');
      } catch (error) {
        console.warn('Failed to initialize OpenAI client, falling back to mock responses:', error);
        this.useMockResponses = true;
        this.openai = null;
      }
    } else {
      console.warn('OpenAI API key not provided, using mock responses');
      this.useMockResponses = true;
    }
  }

  private async testApiKey(): Promise<boolean> {
    if (!this.openai) return false;
    
    try {
      // Make a simple models list request to validate the API key
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.warn('OpenAI API key validation failed:', error);
      this.useMockResponses = true;
      return false;
    }
  }

  /**
   * Generates an AI response based on conversation context and user message
   * 
   * @param threadId The thread ID
   * @param userMessage The user's message (including image analysis if any)
   * @param context Previous messages for context
   * @returns Generated AI response
   */
  public async generateResponse(
    threadId: string | mongoose.Types.ObjectId,
    userMessage: string,
    context: (IMessage | any)[]
  ): Promise<string> {
    try {
      // If openai is not available, use mock response
      if (this.useMockResponses || !this.openai) {
        console.log('Using mock response because OpenAI is not configured');
        // Only use mock response if user message doesn't contain image analysis
        if (!userMessage.includes('This image contains:') && !userMessage.includes('Text in the image:') && !userMessage.includes('Objects detected:')) {
             return this.generateMockResponse(userMessage);
        } else {
             // If image analysis is present, provide a simple confirmation in mock mode
             return 'Image analysis received. Generating response based on the description.';
        }
      }

      const MAX_CONTEXT_LENGTH = 4000; // Prevent token limit issues
      
      // Prepare system message
      const systemMessage = {
        role: 'system',
        content: 'You are a helpful and friendly AI assistant. If the user has provided image analysis results in their message, use that information to answer their query. Be concise and clear in your responses.'
      };
      
      // Format conversation history
      const messages = [systemMessage];
      
      // Add context (previous messages)
      for (const msg of context) {
        // Use the message content, including potential image analysis results
        let content = msg.content || '';
        // Truncate content if it's too long
        if (content.length > MAX_CONTEXT_LENGTH) {
          content = content.substring(0, MAX_CONTEXT_LENGTH) + '... [content truncated]';
        }
        messages.push({
          role: msg.sender === 'system' ? 'assistant' : 'user',
          content
        });
      }
      
      // Add current user message at the end
      messages.push({
        role: 'user',
        content: userMessage
      });
      
      console.log('Sending to OpenAI:', {
        model: this.model,
        messagesCount: messages.length
      });
      
      // Validate API key before making request (if not already validated)
      // Note: Frequent API key validation on every request can be slow. 
      // Consider validating once on startup or periodically.
      // For now, removed explicit testApiKey call here.
      
      try {
        // Call OpenAI API to generate response
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: messages as any,
          max_tokens: 1000,
          temperature: 0.7,
        });
        
        // Extract response
        const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
        
        console.log('OpenAI response:', { 
          responseLength: response.length,
          tokensUsed: completion.usage?.total_tokens || 0
        });
        
        return response;
      } catch (apiError: any) {
        console.error('OpenAI API request failed:', apiError.response?.data || apiError.message);
        // If the API request fails, try once with a simpler context
        if (messages.length > 2) {
          console.log('Retrying with simplified context...');
          // Just keep the system message and the user's most recent message
          const simplifiedMessages = [
            messages[0], // system message
            messages[messages.length - 1] // user message
          ];
          
          try {
            const completion = await this.openai.chat.completions.create({
              model: this.model,
              messages: simplifiedMessages as any,
              max_tokens: 1000,
              temperature: 0.7,
            });
            
            return completion.choices[0]?.message?.content || 
              'I apologize, but I was unable to process your request with the full context. Here is a response to your most recent message.';
          } catch (retryError: any) {
            console.error('OpenAI API retry failed:', retryError.response?.data || retryError.message);
            return this.generateMockResponse(userMessage);
          }
        }
        
        // If we can't retry, fall back to a more informative mock response
         if (userMessage.includes('This image contains:') || userMessage.includes('Text in the image:') || userMessage.includes('Objects detected:')) {
             return 'I was unable to process the image analysis results with the AI. Please try again or provide a text description.';
         }
        return this.generateMockResponse(userMessage);
      }
    } catch (error: any) {
      console.error('OpenAI service error:', error);
      // Use mock response as fallback when API fails
      return this.generateMockResponse(userMessage);
    }
  }

  /**
   * Generates a mock response for development when OpenAI API is not available
   */
  private generateMockResponse(userMessage: string): string {
    // Basic mock response system
    const message = userMessage.toLowerCase();
    
    // Removed the generic file handling mock here as it's handled above

    if (message.includes('hello') || message.includes('hi')) {
      return 'Hello! How can I assist you today?';
    } else if (message.includes('help')) {
      return 'I\'m here to help! What specific information are you looking for?';
    } else if (message.includes('bye') || message.includes('goodbye')) {
      return 'Goodbye! Feel free to return if you have more questions.';
    } else if (message.includes('thanks') || message.includes('thank you')) {
      return 'You\'re welcome! Is there anything else I can help with?';
    } else if (message.length < 10) {
      return 'Could you please provide more details so I can better assist you?';
    } else {
      return 'I received your message.';
    }
  }

  /**
   * Transcribes audio using OpenAI Whisper API
   */
  async transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
    if (this.useMockResponses || !this.openai) {
      console.log('Using mock transcription because OpenAI is not configured');
      return 'This is a mock transcription.';
    }
    
    // Use a unique filename to prevent conflicts
    const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 10000)}-${filename}`;
    let tempPath = '';
    
    try {
      console.log('Transcribing audio with OpenAI Whisper API...');
      
      // Create a temporary directory in the project root instead of relative to __dirname
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Write buffer to a temporary file
      tempPath = path.join(tmpDir, uniqueFilename);
      fs.writeFileSync(tempPath, fileBuffer);
      
      console.log(`Written temp file at ${tempPath}, size: ${fileBuffer.length} bytes`);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath) as any,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en',
      });

      console.log('Successfully received transcription from OpenAI');
      
      // Convert to string properly
      const transcriptionText = typeof transcription === 'string' 
        ? transcription 
        : (transcription as any)?.text || 'No text in transcription result';
      
      return transcriptionText;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error; // Re-throw to handle in the route
    } finally {
      // Clean up the temporary file in finally block
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
          console.log(`Deleted temp file: ${tempPath}`);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary audio file:', cleanupError);
        }
      }
    }
  }
} 