/**
 * messageUtils.ts
 * Utility functions for message processing and validation
 */

const trivialPatterns = [
  /^hi+$/i,
  /^hello+$/i,
  /^hey+$/i,
  /^yo+$/i,
  /^sup+$/i,
  /^how are you\??$/i,
  /^what's up\??$/i,
  /^ok+$/i,
  /^okay+$/i,
  /^test+$/i,
  /^ping$/i
];

/**
 * Checks if a message is trivial (e.g. greetings, simple acknowledgments)
 * @param content The message content to check
 * @returns boolean indicating if the message is trivial
 */
export function isTrivialMessage(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return trivialPatterns.some((pattern) => pattern.test(trimmed));
} 