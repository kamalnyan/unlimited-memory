/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    
    // OpenAI API
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    
    // MongoDB connection
    MONGODB_URI?: string;
    MONGODB_DB_NAME?: string;
    
    // Clerk authentication
    CLERK_PUBLISHABLE_KEY?: string;
    CLERK_SECRET_KEY?: string;
    
    // Embedding/RAG API URL
    EMBEDDING_API_URL?: string;
    
    // File storage
    BUCKET_NAME?: string;
    BUCKET_ENDPOINT?: string;
    BUCKET_ACCESS_KEY?: string;
    BUCKET_SECRET_KEY?: string;
    BUCKET_REGION?: string;
    
    // Other
    CORS_ORIGIN?: string;
    PUBLIC_URL?: string;
  }
}