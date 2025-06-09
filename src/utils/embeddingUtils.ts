/**
 * embeddingUtils.ts
 * Utility functions for handling embeddings, semantic search, and RAG operations.
 */

import axios from 'axios';

// Get embedding API URL from environment or use default
export const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'https://f004-2404-7c80-5c-24b6-a48c-55fc-fe65-3417.ngrok-free.app';

/**
 * Interface for the response from the embedding API
 */
export interface EmbeddingResponse {
  status: string;
  vector?: number[];
  error?: string;
}

/**
 * Interface for the RAG response from the API
 */
export interface RAGResponse {
  answer: string;
  context: string;
  matches?: {
    content: string;
    score: number;
  }[];
}

/**
 * Creates an embedding for the given text
 * @param userId User ID for tracking embeddings
 * @param content Text to embed
 * @param threadId Optional thread ID for context
 * @param messageId Optional message ID for reference
 * @returns Response from the embedding API
 */
export async function createEmbedding(
  userId: string,
  content: string,
  threadId?: string,
  messageId?: string
): Promise<EmbeddingResponse> {
  try {
    const response = await axios.post(`${EMBEDDING_API_URL}/embed`, {
      userId,
      threadId,
      content,
      messageId
    });
    
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
export async function getRAGResponse(
  userId: string, 
  query: string,
  threadId?: string
): Promise<RAGResponse> {
  try {
    const response = await axios.post(`${EMBEDDING_API_URL}/rag-generate`, {
      userId,
      threadId,
      query
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting RAG response:', error);
    return {
      answer: "I couldn't retrieve relevant information at the moment. How else can I assist you?",
      context: "Error retrieving context"
    };
  }
}

/**
 * Checks if message should use semantic search based on content
 * @param content Message content
 * @returns Boolean indicating if semantic search is beneficial
 */
export function shouldUseSemanticSearch(content: string): boolean {
  // Skip semantic search for very short queries
  if (content.trim().length < 10) return false;
  
  // Skip semantic search for trivial messages
  if (isTrivialMessage(content)) return false;
  
  // Check if it's likely a question or request for information
  const questionIndicators = [
    '?', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can you', 'could you', 
    'tell me', 'explain', 'describe', 'find', 'search', 'help me with'
  ];
  
  return questionIndicators.some(indicator => 
    content.toLowerCase().includes(indicator));
}

/**
 * Simple implementation of isTrivialMessage to avoid circular dependency
 */
function isTrivialMessage(content: string): boolean {
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