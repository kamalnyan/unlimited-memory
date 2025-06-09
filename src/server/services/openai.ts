/**
 * openai.ts
 * OpenAI service for handling GPT integration.
 * Adds memory recall from past MongoDB messages using simple keyword-based search.
 * Now integrates with EmbeddingService for RAG-enhanced responses.
 */

import OpenAI from 'openai';
import { IMessage, Message } from '../../models/message.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { EmbeddingService } from './embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpenAIService {
  private openai: OpenAI | null = null;
  private model: string;
  private useMockResponses: boolean = false;
  private embeddingService: EmbeddingService;

  constructor(apiKey?: string, embeddingApiUrl?: string) {
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    // Initialize embedding service
    this.embeddingService = new EmbeddingService(embeddingApiUrl);

    if (apiKey) {
      try {
        this.openai = new OpenAI({
          apiKey,
          dangerouslyAllowBrowser: true
        });
      } catch (error) {
        console.warn('OpenAI init failed, using mock:', error);
        this.useMockResponses = true;
        this.openai = null;
      }
    } else {
      this.useMockResponses = true;
    }
  }

  public async generateResponse(
    threadId: string | mongoose.Types.ObjectId,
    userMessage: string,
    context: (IMessage | any)[]
  ): Promise<string> {
    try {
      if (this.useMockResponses || !this.openai) {
        return this.generateMockResponse(userMessage);
      }

      const MAX_CONTEXT_LENGTH = 4000;
      const threadIdStr = threadId.toString();
      
      // Extract user ID from the context if available
      let userId = '';
      const firstUserMessage = context.find(msg => msg.userId);
      if (firstUserMessage) {
        userId = firstUserMessage.userId;
      }
      
      let enhancedPrompt = userMessage;
      
      // Use RAG enhancement if embedding service is enabled and userId is available
      if (this.embeddingService.isEnabled() && userId) {
        try {
          // Attempt to enhance the prompt with RAG context
          enhancedPrompt = await this.embeddingService.enhancePromptWithRAG(
            userId, 
            userMessage, 
            threadIdStr,
            context
          );
          console.log('Using RAG-enhanced prompt');
        } catch (ragError) {
          console.error('Failed to enhance prompt with RAG:', ragError);
          // Fall back to traditional memory if RAG fails
          enhancedPrompt = userMessage;
        }
      }

      // 🧠 Traditional memory injection as fallback
      const memorySnippets = await this.getRelevantMemory(threadIdStr, userMessage);
      const memoryContext = memorySnippets.length > 0
        ? `Here are some things the user said previously:\n${memorySnippets.join('\n')}`
        : '';

      const systemMessage = {
        role: 'system',
        content: `You are a helpful and friendly AI assistant.${memoryContext ? `\n\n${memoryContext}` : ''}`
      };

      const messages = [systemMessage];

      // Add conversation context
      for (const msg of context) {
        let content = msg.content || '';
        if (content.length > MAX_CONTEXT_LENGTH) {
          content = content.substring(0, MAX_CONTEXT_LENGTH) + '... [content truncated]';
        }
        messages.push({
          role: msg.sender === 'system' ? 'assistant' : 'user',
          content
        });
      }

      // Use the enhanced prompt instead of the raw user message
      messages.push({ role: 'user', content: enhancedPrompt });

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages as any,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'I could not generate a response.';

      // Store the embedding for the AI response if embedding service is enabled and userId is available
      if (this.embeddingService.isEnabled() && userId) {
        try {
          // Store embeddings for meaningful AI responses
          if (response.length > 20) {
            await this.embeddingService.createEmbedding(
              userId,
              response,
              threadIdStr
            );
          }
        } catch (embedError) {
          console.error('Failed to create embedding for AI response:', embedError);
          // Non-critical error, continue without embedding
        }
      }

      return response;
    } catch (error: any) {
      console.error('OpenAI error:', error);
      return this.generateMockResponse(userMessage);
    }
  }

  private generateMockResponse(userMessage: string): string {
    const message = userMessage.toLowerCase();

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

  private async getRelevantMemory(threadId: string, userMessage: string): Promise<string[]> {
    const triggers = ['what did i say', 'earlier', 'before', 'previous', 'remind me', 'last time'];
    const queryLower = userMessage.toLowerCase();
    const shouldRecall = triggers.some(trigger => queryLower.includes(trigger));
    if (!shouldRecall) return [];

    const words = queryLower.split(/\s+/);
    const keywords = words.filter(w => !['what', 'did', 'i', 'say', 'about', 'the', 'last', 'time', 'you'].includes(w));
    const lastKeyword = keywords.pop() || '';
    if (!lastKeyword) return [];

    const regex = new RegExp(lastKeyword, 'i');

    const pastMessages = await Message.find({
      threadId: new mongoose.Types.ObjectId(threadId),
      sender: { $ne: 'system' },
      content: { $regex: regex }
    }).sort({ createdAt: -1 }).limit(3).lean().exec();

    return pastMessages.map(msg => `• ${msg.content}`);
  }

  public async transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
    if (this.useMockResponses || !this.openai) return 'This is a mock transcription.';

    const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 10000)}-${filename}`;
    const tmpDir = path.join(process.cwd(), 'tmp');
    const tempPath = path.join(tmpDir, uniqueFilename);

    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tempPath, fileBuffer);

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath) as any,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en',
      });

      return typeof transcription === 'string'
        ? transcription
        : (transcription as any)?.text || 'No text in transcription result';
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.warn('Temp file cleanup failed:', cleanupError);
      }
    }
  }
}
