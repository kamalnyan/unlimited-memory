/**
 * TypeAnimation.tsx
 * Component for rendering AI responses with a typing animation effect.
 * Simulates the appearance of text being typed in real-time.
 * Provides a typing indicator and supports markdown content.
 */
import { useEffect, useState } from "react";

interface TypeAnimationProps {
  content: string;
  speed?: number;
  onComplete?: () => void;
}

export default function TypeAnimation({
  content,
  speed = 30, // Characters per second
  onComplete,
}: TypeAnimationProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset when content changes
    setDisplayedContent("");
    setIsComplete(false);
    
    if (!content) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    let currentIndex = 0;
    
    // Adaptive speed - type faster for longer content
    const effectiveSpeed = content.length > 500 ? speed * 3 : 
                           content.length > 200 ? speed * 2 : 
                           speed;
    
    const delay = 1000 / effectiveSpeed;
    
    // Function to add the next chunk of characters
    const addNextCharacters = () => {
      if (currentIndex < content.length) {
        // Determine how many characters to add in this chunk
        // Add more characters at a time for longer messages
        const chunkSize = content.length > 500 ? 12 : 
                         content.length > 200 ? 6 : 3;
        
        const nextIndex = Math.min(currentIndex + chunkSize, content.length);
        setDisplayedContent(content.substring(0, nextIndex));
        currentIndex = nextIndex;
        
        // If we're not at the end yet, schedule the next update
        if (currentIndex < content.length) {
          timeoutId = setTimeout(addNextCharacters, delay);
        } else {
          setIsComplete(true);
          onComplete?.();
        }
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };
    
    // Start the animation after a small initial delay
    let timeoutId = setTimeout(addNextCharacters, 100);
    
    // Clean up the timeout on unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [content, speed, onComplete]);

  return (
    <div className="typing-animation">
      <div className="text-sm whitespace-pre-wrap">{displayedContent}</div>
      {!isComplete && (
        <span className="animate-pulse ml-1">▋</span>
      )}
    </div>
  );
} 