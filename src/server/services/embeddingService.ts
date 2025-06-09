/**
 * embeddingService.ts
 * Service for handling embeddings, semantic search, and RAG operations.
 * Provides integration with external embedding APIs for enhanced AI responses.
 */

import axios from 'axios';
import { IMessage } from '../../models/message.js';

export interface EmbeddingResponse {
  status: string;
  vector?: number[];
  error?: string;
}

export interface RAGResponse {
  answer: string;
  context: string;
  matches?: {
    content: string;
    score: number;
  }[];
}

export class EmbeddingService {
  private apiUrl: string | undefined;
  private enabled: boolean;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.EMBEDDING_API_URL;
    this.enabled = !!this.apiUrl;
    
    if (this.enabled) {
      console.log(`Embedding Service initialized with API URL: ${this.apiUrl}`);
    } else {
      console.warn('Embedding Service disabled: No API URL provided in environment variables or constructor');
    }
  }

  /**
   * Checks if the embedding service is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Creates an embedding for the given text
   * @param userId User ID for tracking embeddings
   * @param content Text to embed
   * @param threadId Optional thread ID for context
   * @param messageId Optional message ID for reference
   * @returns Response from the embedding API
   */
  public async createEmbedding(
    userId: string,
    content: string,
    threadId?: string,
    messageId?: string
  ): Promise<EmbeddingResponse> {
    if (!this.enabled) {
      console.warn('Embedding Service is disabled: No API URL available');
      return { status: 'error', error: 'Embedding Service is disabled: No API URL available' };
    }

    try {
      console.log(`Creating embedding for message: ${messageId || 'unknown'}`);
      const response = await axios.post(`${this.apiUrl}/embed`, {
        userId,
        threadId,
        content,
        messageId
      });
      
      console.log(`Embedding created successfully for message: ${messageId || 'unknown'}`);
      return response.data;
    } catch (error) {
      console.error('Error creating embedding:', error);
      if (axios.isAxiosError(error)) {
        return { 
          status: 'error',
          error: `API error: ${error.response?.status || 'unknown'} - ${error.message}` 
        };
      }
      return { status: 'error', error: 'Failed to create embedding' };
    }
  }

  /**
   * Retrieves RAG-enhanced response for a query
   * @param userId User ID for context
   * @param query The question or query text
   * @param threadId Optional thread ID for context
   * @returns RAG-enhanced response with context
   */
  public async getRAGResponse(
    userId: string, 
    query: string,
    threadId?: string
  ): Promise<RAGResponse> {
    if (!this.enabled) {
      console.warn('Embedding Service is disabled: No API URL available');
      return {
        answer: "I couldn't access my extended knowledge at the moment. The embedding service is not configured.",
        context: "Embedding Service disabled: No API URL available"
      };
    }

    try {
      console.log(`Getting RAG response for query: "${query.substring(0, 50)}..."`);
      const response = await axios.post(`${this.apiUrl}/rag-generate`, {
        userId,
        threadId,
        query
      });
      
      console.log('RAG response received successfully');
      return response.data;
    } catch (error) {
      console.error('Error getting RAG response:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });
      }
      
      return {
        answer: "I couldn't retrieve relevant information at the moment. How else can I assist you?",
        context: "Error retrieving context"
      };
    }
  }
  
  /**
   * Enhances a user query with RAG context for improved AI response generation
   * @param userId User ID for context
   * @param query User's original query
   * @param threadId Thread ID for context
   * @param context Optional existing conversation context
   * @returns Enhanced prompt with RAG context
   */
  public async enhancePromptWithRAG(
    userId: string,
    query: string,
    threadId: string,
    context: (IMessage | any)[] = []
  ): Promise<string> {
    if (!this.enabled || !this.shouldUseSemanticSearch(query)) {
      // Return a basic prompt without RAG enhancement
      return query;
    }
    
    try {
      const ragResponse = await this.getRAGResponse(userId, query, threadId);
      
      // Extract only the most relevant context to avoid prompt overflow
      const relevantContext = ragResponse.context || '';
      
      // Format the enhanced prompt
      const enhancedPrompt = [
        "### Relevant Previous Information:",
        relevantContext,
        "\n### Current User Query:",
        query
      ].join("\n");
      
      return enhancedPrompt;
    } catch (error) {
      console.error('Error enhancing prompt with RAG:', error);
      return query; // Fall back to the original query
    }
  }
  
  /**
   * Checks if a message should use semantic search based on content
   * @param content Message content
   * @returns Boolean indicating if semantic search is beneficial
   */
  private shouldUseSemanticSearch(content: string): boolean {
    // Skip semantic search for very short queries
    if (content.trim().length < 10) return false;
    
    // Skip semantic search for trivial messages
    if (this.isTrivialMessage(content)) return false;
    
    // Check if it's likely a question or request for information
    const questionIndicators = [
      '?', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can you', 'could you', 
      'tell me', 'explain', 'describe', 'find', 'search', 'help me with'
    ];
    
    return questionIndicators.some(indicator => 
      content.toLowerCase().includes(indicator));
  }
  
  /**
   * Simple implementation of isTrivialMessage
   */
  private isTrivialMessage(content: string): boolean {
    const trivialPatterns = [
      /^hi+$/i,
      /^hello+$/i,
      /^hey+$/i,
      /^yo+$/i,
      /^sup+$/i,
      /^how are you\??$/i,
      /^what's up\??$/i,
      /^ok+$/i,
      /^okay+$/i,
      /^test+$/i,
      /^ping$/i
    ];

    const trimmed = content.trim().toLowerCase();
    return trivialPatterns.some((pattern) => pattern.test(trimmed));
  }
} 