# Semantic Search in EOXS AI

This document explains how semantic search and Retrieval-Augmented Generation (RAG) work in the EOXS AI system.

## Overview

EOXS AI implements semantic search using vector embeddings to enhance the quality of AI responses. Instead of relying solely on keyword matching, the system understands the meaning and context of user queries, providing more relevant and accurate responses.

## How Semantic Search Works

1. **Embedding Generation**: When users send messages, the content is sent to an embedding API (`/embed` endpoint) that transforms the text into high-dimensional vector representations (embeddings). These vectors capture the semantic meaning of the text.

2. **Vector Storage**: The embeddings are stored alongside the messages, allowing for efficient retrieval based on semantic similarity.

3. **Retrieval**: When a new query is received, it is also converted to a vector embedding and compared with previously stored embeddings to find semantically similar content.

4. **Augmentation**: The system retrieves the most relevant past messages and uses them to enhance the context provided to the AI model.

5. **Generation**: The AI model generates responses using the augmented context, resulting in more relevant and informed answers.

## Technical Implementation

### API Endpoints

- `/embed`: Processes text and creates embeddings for storage
- `/rag-generate`: Receives a query, finds relevant past messages using vector similarity, and generates enhanced responses

### Integration Flow

```
User Query → Embedding Generation → Similarity Search → Context Retrieval → AI Response Generation
```

### Fallback Mechanisms

The system includes fallback mechanisms:

- For trivial messages (like "hi" or "hello"), the system skips the embedding process and provides a standard response
- If the embedding service is unavailable, the system falls back to basic response generation using recent message history

## Benefits of Semantic Search in EOXS AI

- **Improved Relevance**: Responses are based on meaning rather than just keyword matching
- **Better Context Understanding**: The AI can draw from relevant past interactions
- **Enhanced User Experience**: Users receive more accurate and helpful responses

## Example of RAG in Action

When a user asks "How does semantic search work in EOXS AI?", the system:

1. Converts the query to an embedding
2. Finds similar past messages about semantic search, embeddings, and AI functionality
3. Combines these relevant messages with the current conversation context
4. Generates a comprehensive response that incorporates all available knowledge

This approach allows the AI to provide deeper, more contextually relevant answers by drawing on the knowledge contained in previous conversations. 