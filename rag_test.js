import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the RAG API URL from environment variables or use a default
const RAG_API_URL = process.env.EMBEDDING_API_URL ? `${process.env.EMBEDDING_API_URL}/rag-generate` : 'http://localhost:3000/rag-generate';

// Test queries to demonstrate the RAG system
const testQueries = [
  {
    userId: 'user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K',
    query: 'How are embeddings used in AI?'
  },
  {
    userId: 'user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K',
    query: 'Who created EOXS AI?'
  },
  {
    userId: 'user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K',
    query: 'What makes semantic search better than traditional search?'
  },
  {
    userId: 'user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K',
    query: 'How does EOXS AI handle multiple queries?'
  }
];

async function testRagWithQuery(query) {
  try {
    console.log(`\n=== Querying RAG API with "${query.query}" ===`);
    console.log(`Using API URL: ${RAG_API_URL}`);
    
    const response = await axios.post(RAG_API_URL, query);
    
    console.log('RAG API Response:');
    console.log('Answer:', response.data.answer);
    console.log('Context:', response.data.context);
    
    return true;
  } catch (error) {
    console.error('Error querying RAG API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function runAllTests() {
  console.log('Starting RAG API tests...');
  
  for (const query of testQueries) {
    await testRagWithQuery(query);
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\nAll tests completed!');
}

runAllTests();