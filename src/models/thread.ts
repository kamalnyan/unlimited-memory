/**
 * thread.ts
 * Thread model definition. Defines the schema and methods for chat threads.
 * Handles thread creation, message associations, and user permissions.
 * Manages thread metadata and relationships.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IThread extends Document {
  title?: string;
  userId: string;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
  {
    title: {
      type: String,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ThreadSchema.index({ userId: 1 });
ThreadSchema.index({ createdBy: 1 });
ThreadSchema.index({ updatedAt: -1 });

export const Thread = mongoose.models.Thread || mongoose.model<IThread>('Thread', ThreadSchema);
