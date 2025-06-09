import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Messages data
const messages = [
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "my name is gaurav and i have made eoxs ai",
    "messageId": "msg_001"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "eoxs ai can handle multiple queries efficiently",
    "messageId": "msg_002"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "embedding testing is crucial for better search results",
    "messageId": "msg_003"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "AI models require lots of data to learn",
    "messageId": "msg_004"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Gaurav is passionate about AI development",
    "messageId": "msg_005"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "The future of AI looks promising",
    "messageId": "msg_006"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "I enjoy working on natural language processing",
    "messageId": "msg_007"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Data embedding helps in semantic search",
    "messageId": "msg_008"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Testing embeddings can improve AI accuracy",
    "messageId": "msg_009"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "I have trained eoxs ai on diverse datasets",
    "messageId": "msg_010"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "AI can assist in automating tasks",
    "messageId": "msg_011"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Gaurav loves exploring new AI technologies",
    "messageId": "msg_012"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Understanding embeddings is key for AI search",
    "messageId": "msg_013"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Testing AI with multiple queries is essential",
    "messageId": "msg_014"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "The eoxs ai project is continuously evolving",
    "messageId": "msg_015"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Embeddings represent semantic meaning of text",
    "messageId": "msg_016"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "AI model training requires patience and effort",
    "messageId": "msg_017"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Semantic search improves user experience",
    "messageId": "msg_018"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "I am testing embedding queries to improve results",
    "messageId": "msg_019"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Gaurav's AI system handles complex requests",
    "messageId": "msg_020"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "AI embedding vectors store text meaning",
    "messageId": "msg_021"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "I have integrated embedding features into eoxs ai",
    "messageId": "msg_022"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "AI is transforming how we interact with data",
    "messageId": "msg_023"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Embeddings help cluster similar text content",
    "messageId": "msg_024"
  },
  {
    "userId": "user_2xdTnz6ZkFCbDxHWRMOzVY3XP6K",
    "threadId": "6834becca32a04b1e44f1d17",
    "content": "Thanks for helping me test AI embeddings",
    "messageId": "msg_025"
  }
];

// Get the API URL from environment variables or use a default
const API_URL = process.env.EMBEDDING_API_URL ? `${process.env.EMBEDDING_API_URL}/embed` : 'http://localhost:3000/embed';

async function embedMessages() {
  console.log(`Starting to embed ${messages.length} messages...`);
  console.log(`Using API URL: ${API_URL}`);
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    try {
      console.log(`Processing message ${i+1}/${messages.length}: ${message.messageId}`);
      const response = await axios.post(API_URL, message);
      console.log(`Success: ${message.messageId} - Status: ${response.status}, Data:`, response.data);
    } catch (error) {
      console.error(`Error embedding message ${message.messageId}:`, error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    }
    
    // Add a small delay between requests to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('Batch embedding completed!');
}

// Execute the function
embedMessages().catch(err => {
  console.error('Fatal error:', err);
}); 