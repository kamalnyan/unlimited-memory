import express, { Request } from "express";
import multer from "multer";
import axios from "axios";
import cloudinary from "../cloudinary";
import streamifier from "streamifier";

// Define the type for multer request
interface MulterRequest extends Request {
  file?: multer.File;
}

const upload = multer();
const router = express.Router();

router.post("/", upload.single("image"), async (req: MulterRequest, res) => {
  try {
    console.log("Received request for AI Vision API");

    if (!req.file || !req.file.buffer) {
      console.log("No image file uploaded");
      return res.status(400).json({ error: "No image file uploaded" });
    }
    
    console.log("File received:", req.file.originalname, req.file.mimetype, req.file.size);

    // Create a promise to handle the Cloudinary upload
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "image" },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error("Cloudinary upload failed"));
            return;
          }
          console.log("Cloudinary upload successful:", result);
          resolve(result);
        }
      );

      // Pipe the image buffer to Cloudinary
      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    // Wait for Cloudinary upload to complete
    const cloudinaryResult = await uploadPromise;
    const imageUrl = (cloudinaryResult as any).secure_url;

    console.log("Image uploaded to Cloudinary:", imageUrl);

    // Call OpenAI Vision API
    console.log("Calling OpenAI Vision API with image URL:", imageUrl);
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What is in this image? Please provide a detailed description." },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 500
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY }`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("Raw OpenAI API response status:", response.status);
      console.log("Raw OpenAI API response data:", JSON.stringify(response.data, null, 2));

      if (response.data.error) {
        console.error("OpenAI API returned an error:", response.data.error);
        throw new Error(`OpenAI API error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
      }

      const aiMessage = response.data.choices[0].message.content;
      console.log("OpenAI Vision API response content:", aiMessage);

      res.json({ result: aiMessage });
    } catch (error: any) {
      console.error("Vision API request error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // Provide more specific error messages
      if (error.response?.data?.error) {
        console.error("OpenAI specific error:", error.response.data.error);
        return res.status(error.response.status).json({ 
          error: `OpenAI API error: ${error.response.data.error.message || error.response.data.error}` 
        });
      }

      console.error("Generic Vision API error:", error);
      res.status(500).json({ 
        error: "Failed to analyze image",
        details: error.message
      });
    }
  } catch (error: any) {
    console.error("Vision API request error details:", error.response?.data || error.message);

    // Provide more specific error messages
    if (error.response?.data?.error) {
      console.error("OpenAI specific error:", error.response.data.error);
      return res.status(error.response.status).json({ 
        error: `OpenAI API error: ${error.response.data.error.message || error.response.data.error}` 
      });
    }

    console.error("Generic Vision API error:", error);
    res.status(500).json({ 
      error: "Failed to analyze image",
      details: error.message
    });
  }
});

export default router; 