import express from "express";
import { MongoClient } from "mongodb";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const openai = new OpenAI();

const MONGO_URI = process.env.MONGO_URI;
console.log(MONGO_URI);
//   "mongodb+srv://innovationcelleoxs19:AkMuA3cN2tsMllAx@cluster0.cywqo3w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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

// Utility: Find user by username or name, with fallback suggestion
async function findUserOrSuggest(identifier) {
  const db = client.db(DB_NAME);
  const usersCollection = db.collection("users");

  // Exact match by username
  let user = await usersCollection.findOne({
    username: new RegExp(`^${identifier}$`, "i"),
  });

  // If not exact match, try exact name
  if (!user) {
    user = await usersCollection.findOne({
      name: new RegExp(`^${identifier}$`, "i"),
    });
  }

  if (user) return { user };

  // Fallback: Partial/fuzzy search for closest match by username or name
  const similarUser = await usersCollection.findOne({
    $or: [
      { username: new RegExp(identifier, "i") },
      { name: new RegExp(identifier, "i") },
    ],
  });

  if (similarUser) {
    // Suggest either the name or the username, whichever is more user-friendly
    const suggestedName = similarUser.name || similarUser.username;
    return { suggestion: suggestedName };
  }

  // Nothing found
  return {};
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

    // Extract identifier (username or name) from prompt
    const match = prompt.toLowerCase().match(/what\s+(.+?)\s+is\s+doing/);
    if (!match) {
      return res.status(400).json({
        error:
          "Could not extract username or name from prompt. Use format: 'what <username or name> is doing'.",
      });
    }

    const identifier = match[1].trim();

    // Search user by exact username/name, fallback to partial
    const { user, suggestion } = await findUserOrSuggest(identifier);

    if (!user && suggestion) {
      return res.status(404).json({
        error: `No exact match for "${identifier}". Did you mean "${suggestion}"?`,
      });
    }

    if (!user) {
      return res.status(404).json({
        error: `No user found matching "${identifier}".`,
      });
    }

    const senderId = user.clerkId;
    if (!senderId) {
      return res.status(404).json({
        error: `User "${
          user.name || user.username || identifier
        }" does not have a clerkId.`,
      });
    }

    // Get user's conversation
    const conversationText = await getUserConversation(senderId);
    if (!conversationText) {
      return res.status(404).json({
        error: `No conversation history found for user: ${
          user.name || user.username || identifier
        }`,
      });
    }

    // Dynamic system prompt referencing actual user data
    const messages = [
      {
        role: "system",
        content: `You are an admin assistant. Summarize the activities and main points of the user named "${
          user.name || user.username || identifier
        }" based on their chat conversation below.`,
      },
      {
        role: "user",
        content: conversationText,
      },
    ];

    // Get summary from OpenAI
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
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