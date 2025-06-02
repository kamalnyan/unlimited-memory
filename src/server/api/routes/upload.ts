import express, { Request } from 'express';
import multer from 'multer';
import cloudinary from '../cloudinary';
import streamifier from 'streamifier';

// Define the type for multer request
interface MulterRequest extends Request {
  file?: multer.File;
}

const upload = multer();
const router = express.Router();

router.post('/upload', upload.single('file'), async (req: MulterRequest, res) => {
    try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create a promise to handle the Cloudinary upload
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'auto',
          folder: 'chat-attachments'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        }
      );

      // Pipe the file buffer to Cloudinary
      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    // Wait for Cloudinary upload to complete
    const result = await uploadPromise;
    const cloudinaryResult = result as any;

    // Return the file information
    res.json({
      filename: cloudinaryResult.public_id,
      url: cloudinaryResult.secure_url,
      thumbnailUrl: cloudinaryResult.secure_url,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message 
    });
  }
});

export default router; 