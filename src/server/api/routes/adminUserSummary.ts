import express from "express";
import { MongoClient } from "mongodb";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const openai = new OpenAI();

const MONGO_URI = process.env.MONGO_URI;

console.log(MONGO_URI);
const DB_NAME = "test";
const client = new MongoClient(MONGO_URI);

// Utility: Connect to MongoDB only if not already connected
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}
connectDB().catch((err) => {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
});

// Utility: Get all users (username, name, clerkId)
async function getAllUsers() {
  const db = client.db(DB_NAME);
  const usersCollection = db.collection("users");
  return usersCollection.find({}, { projection: { username: 1, name: 1, clerkId: 1 } }).toArray();
}

// Utility: Find user in prompt
async function extractUserFromPrompt(prompt) {
  const users = await getAllUsers();
  const promptLower = prompt.toLowerCase();
  // Try to find a user whose username or name appears in the prompt
  for (const user of users) {
    if (user.username && promptLower.includes(user.username.toLowerCase())) {
      return user;
    }
    if (user.name && promptLower.includes(user.name.toLowerCase())) {
      return user;
    }
  }
  // Try partial match (substring)
  for (const user of users) {
    if (user.username && user.username.length > 2 && promptLower.includes(user.username.slice(0, 3).toLowerCase())) {
      return user;
    }
    if (user.name && user.name.length > 2 && promptLower.includes(user.name.slice(0, 3).toLowerCase())) {
      return user;
    }
  }
  // Suggest closest match (by Levenshtein distance or just first user for now)
  if (users.length > 0) {
    return { suggestion: users[0].name || users[0].username };
  }
  return null;
}

// Utility: Get user conversation with system messages
async function getUserConversation(senderId) {
  const db = client.db(DB_NAME);
  const messagesCollection = db.collection("messages");

  const messages = await messagesCollection
    .find({
      $or: [{ sender: senderId }, { sender: "system" }],
    })
    .sort({ createdAt: 1 })
    .toArray();

  if (!messages.length) return "";

  return messages
    .map(
      (msg) => `[${msg.sender === senderId ? "user" : "system"}] ${msg.content}`
    )
    .join("\n");
}

// Route: Generate summary for user conversation
router.post("/user-summary", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt (string) is required." });
    }

    // Dynamically extract user from prompt
    const userOrSuggestion = await extractUserFromPrompt(prompt);
    if (!userOrSuggestion) {
      return res.status(404).json({ error: "No users found in the database." });
    }
    if ('suggestion' in userOrSuggestion) {
      return res.status(404).json({ error: `Could not find a user in the prompt. Did you mean \"${userOrSuggestion.suggestion}\"?` });
    }
    const user = userOrSuggestion;

    const senderId = user.clerkId;
    if (!senderId) {
      return res.status(404).json({ error: `User \"${user.name || user.username}\" does not have a clerkId.` });
    }

    // Get user's conversation
    const conversationText = await getUserConversation(senderId);
    if (!conversationText) {
      return res.status(404).json({ error: `No conversation history found for user: ${user.name || user.username}` });
    }

    // Dynamic system prompt referencing actual user data and admin's prompt
    const messages = [
      {
        role: "system" as const,
        content: `You are an admin assistant. Use the following chat history to answer the admin's prompt.\n\nUser: ${user.name || user.username}`,
      },
      {
        role: "user" as const,
        content: `Prompt: ${prompt}\n\nChat history:\n${conversationText}`,
      },
    ];

    // Get summary from OpenAI
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any, // Type assertion for compatibility
      temperature: 0.3,
      max_tokens: 500,
    });

    const summary =
      summaryResponse.choices?.[0]?.message?.content ?? "No summary generated.";

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error generating user summary:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;