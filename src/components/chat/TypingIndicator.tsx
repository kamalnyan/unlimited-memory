/**
 * TypingIndicator.tsx
 * Component that shows a typing animation when AI is generating a response.
 * Displays bouncing dots to indicate ongoing activity.
 */
import { cn } from "@/lib/utils";
import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex items-center justify-start space-x-1.5 px-3 py-2">
      <div className="text-sm text-muted-foreground">AI is typing</div>
      <div className="flex space-x-1">
        <div className="h-2 w-2 rounded-full bg-primary typing-indicator-dot"></div>
        <div className="h-2 w-2 rounded-full bg-primary typing-indicator-dot"></div>
        <div className="h-2 w-2 rounded-full bg-primary typing-indicator-dot"></div>
      </div>
    </div>
  );
} 