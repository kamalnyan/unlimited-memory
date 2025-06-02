/**
 * utils.ts
 * Utility functions for the application. Provides common helper methods.
 * Includes string manipulation, type checking, and formatting utilities.
 * Used throughout the application for consistent data handling.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
