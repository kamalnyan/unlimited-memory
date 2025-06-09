#STATUS 
main and deepakbuild branch are running in dev mode fine (ignore other branch)
build error issue : frontend and backend packages are conflicting 
Solution : split frontend and backend files and correct config files

# Chat Thread Nexus

A modern, real-time chat application with AI integration, built using React, Node.js, and MongoDB. Features include thread-based conversations, user authentication, and an admin dashboard.

## Features

- 🔐 **Authentication**: Secure user authentication using Clerk
- 💬 **Real-time Chat**: Thread-based conversations with AI responses
- 🎨 **Modern UI**: Clean, responsive interface with dark/light mode
- 📱 **Mobile Responsive**: Optimized for all device sizes
- 👥 **User Management**: User profiles and role-based access control
- 📊 **Admin Dashboard**: Analytics and thread management for administrators
- 🔄 **MongoDB Integration**: Persistent storage for messages and threads
- 🌙 **Theme Support**: Dark and light mode with system preference detection

## Tech Stack

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Clerk (Authentication)
- React Query
- React Router
- Lucide Icons

### Backend
- Node.js
- Express
- MongoDB
- Mongoose
- TypeScript

## Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account
- Clerk account for authentication
- Git

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Application
PORT=8082
NODE_ENV=development
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chat-thread-nexus.git
cd chat-thread-nexus
```

2. Install dependencies:
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env`
- Fill in your MongoDB and Clerk credentials

4. Start the development server:
```bash
# Start Both (from root directory)
npm run dev:all

# Start frontend (from root directory)
npm run dev

# Start backend (from server directory)
npm run dev
```

The application will be available at `http://localhost:8082`

## Project Structure

```
chat-thread-nexus/
├── src/
│   ├── components/     # React components
│   ├── lib/           # Utility functions and hooks
│   ├── models/        # MongoDB models
│   ├── pages/         # Page components
│   ├── server/        # Backend server code
│   └── styles/        # Global styles
├── public/            # Static assets
└── server/           # Backend server
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login

### Threads
- `GET /api/threads` - Get user's threads
- `POST /api/threads` - Create new thread
- `PUT /api/threads/:id` - Update thread
- `DELETE /api/threads/:id` - Delete thread

### Messages
- `GET /api/threads/:id/messages` - Get thread messages
- `POST /api/messages` - Send new message
- `POST /api/messages/generate` - Generate AI response

### Admin
- `GET /api/admin/threads` - Get all threads (admin only)
- `GET /api/admin/analytics` - Get usage analytics (admin only)

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build
```

## Deployment

1. Set up a MongoDB Atlas cluster
2. Configure Clerk for production
3. Deploy to Vercel:
```bash
vercel
```

## Semantic Search and RAG Features

EOXS AI now includes semantic search and Retrieval-Augmented Generation (RAG) capabilities that enhance the AI's responses with relevant context from previous conversations.

### How It Works

1. **Embedding Generation**: User messages are converted into vector embeddings that capture their semantic meaning.
2. **Semantic Search**: When a user asks a question, the system finds semantically similar past messages.
3. **Context Enhancement**: The AI uses this relevant context to generate more accurate and informed responses.
4. **User Interface**: Users can view the sources of context that informed the AI's responses.

### Configuration

To enable the embedding and RAG features, set the following environment variable:

```
EMBEDDING_API_URL=https://your-embedding-api-url.com
```

### Benefits

- More accurate and contextually relevant AI responses
- Better memory of past conversations and user preferences
- Transparent AI decision making with viewable context sources
