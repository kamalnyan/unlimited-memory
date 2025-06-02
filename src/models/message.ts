/**
 * message.ts
 * Message model definition. Defines the schema and methods for chat messages.
 * Handles message content, timestamps, and thread associations.
 * Manages message metadata, file attachments, and user relationships.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

// Define the interface for file attachments
export interface IFileAttachment {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  content?: string; // Extracted content from the file
}

// Create a schema for file attachments
const FileAttachmentSchema = new Schema<IFileAttachment>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  content: { type: String } // Extracted content from the file
});

export interface IMessage extends Document {
  threadId: Types.ObjectId;
  sender: string;
  content: string;
  files?: IFileAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: 'Thread',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    files: {
      type: [FileAttachmentSchema],
      default: undefined
    }
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ threadId: 1, createdAt: 1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ content: 'text' });

export const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
