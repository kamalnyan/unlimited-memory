/**
 * index.ts
 * Model exports file. Centralizes and exports all database models.
 * Provides a single entry point for model imports throughout the application.
 * Ensures consistent model usage across the codebase.
 */
import { Thread } from './thread';
import { Message } from './message';
import { User } from './user';

export { Thread, Message, User }; 