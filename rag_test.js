import axios from 'axios';

const RAG_API_URL = 'https://f004-2404-7c80-5c-24b6-a48c-55fc-fe65-3417.ngrok-free.app/rag-generate';

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