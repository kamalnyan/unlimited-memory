/**
 * MessageList.tsx
 * Component for displaying a list of chat messages.
 * Supports user and AI messages, message formatting, and loading states.
 * Features message timestamps and copy functionality.
 */
import { useEffect, useRef, useState } from "react";
import { Copy, ChevronDown, FileText, Image, Link, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import TypeAnimation from "./TypeAnimation";
import TypingIndicator from "./TypingIndicator";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlockRenderer from './CodeBlockRenderer';

type FileAttachment = {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
};

type Message = {
  id: string;
  content: string;
  role: "user" | "ai";
  timestamp: Date;
  files?: FileAttachment[];
};

type MessageListProps = {
  messages: Message[];
  isLoading?: boolean;
  isGeneratingResponse?: boolean;
  className?: string;
};

export default function MessageList({ 
  messages, 
  isLoading = false,
  isGeneratingResponse = false,
  className = ""
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [currentlyAnimatingId, setCurrentlyAnimatingId] = useState<string | null>(null);
  const previousMessagesLengthRef = useRef<number>(messages.length);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track when a new AI message is added and set it to animate
  useEffect(() => {
    if (messages.length > previousMessagesLengthRef.current) {
      // A new message was added
      const newMessage = messages[messages.length - 1];
      if (newMessage.role === "ai" && isGeneratingResponse) {
        setCurrentlyAnimatingId(newMessage.id);
      }
    }
    previousMessagesLengthRef.current = messages.length;
  }, [messages, isGeneratingResponse]);

  // Show scroll-to-bottom button if not at bottom
  useEffect(() => {
    const handleScroll = () => {
      const el = scrollAreaRef.current;
      if (!el) return;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setShowScrollButton(!atBottom);
    };
    const el = scrollAreaRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      handleScroll();
    }
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
    };
  }, [messages]);

  // Handle completion of animation
  const handleAnimationComplete = () => {
    setCurrentlyAnimatingId(null);
  };

  // Render file attachments
  const renderFiles = (files: FileAttachment[]) => {
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {files.map((file, index) => {
          // Check if it's an image
          const isImage = file.mimetype.startsWith('image/');
          // Check if it's a PDF
          const isPdf = file.mimetype === 'application/pdf';
          
          return (
            <div 
              key={`${file.filename}-${index}`} 
              className="border rounded-lg overflow-hidden bg-background/80 flex flex-col"
            >
              {isImage ? (
                // Image preview
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={file.thumbnailUrl || file.url} 
                    alt={file.originalName}
                    className="max-w-[200px] max-h-[150px] object-contain"
                  />
                </a>
              ) : (
                // File icon for non-images
                <div className="p-4 flex items-center justify-center">
                  {isPdf ? (
                    <FileText className="h-12 w-12 text-primary/70" />
                  ) : (
                    <FileIcon className="h-12 w-12 text-primary/70" />
                  )}
                </div>
              )}
              
              {/* File name and download link */}
              <div className="p-2 bg-muted/50 text-xs flex flex-col">
                <span className="truncate max-w-[180px] font-medium">{file.originalName}</span>
                <span className="text-muted-foreground text-[10px]">
                  {(file.size / 1024).toFixed(1)}KB
                </span>
                <a 
                  href={file.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center text-primary hover:underline"
                >
                  <Link className="h-3 w-3 mr-1" />
                  Open
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
        <div className="flex flex-col p-4 space-y-6 pb-20">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <TypingIndicator />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">No messages yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start the conversation by sending a message
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, idx) => {
                const isLast = idx === messages.length - 1;
                const isUser = message.role === "user";
                const shouldAnimate = !isUser && message.id === currentlyAnimatingId;
                
                return (
                  <div key={message.id} className={cn("flex flex-col items-end w-full group", isUser ? "items-end" : "items-start")}> 
                    <div
                      className={cn(
                        "relative px-5 py-3 rounded-2xl max-w-[75%] shadow-sm mb-1",
                        isUser
                          ? "ml-8 bg-muted/80 text-foreground"
                          : "mr-8 ai-plain-text"
                      )}
                    >
                      <div className="space-y-2">
                        {shouldAnimate ? (
                          <TypeAnimation 
                            content={message.content} 
                            speed={30}
                            onComplete={handleAnimationComplete}
                          />
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: CodeBlockRenderer as any,
                              p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                              a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                              h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 mt-6" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3 mt-5" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2 mt-4" {...props} />,
                              h4: ({ node, ...props }) => <h4 className="text-base font-bold mb-2 mt-3" {...props} />,
                              blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-600 dark:text-gray-400" {...props} />
                              ),
                              table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700" {...props} />
                                </div>
                              ),
                              thead: ({ node, ...props }) => (
                                <thead className="bg-gray-100 dark:bg-gray-800" {...props} />
                              ),
                              tbody: ({ node, ...props }) => (
                                <tbody className="divide-y divide-gray-300 dark:divide-gray-700" {...props} />
                              ),
                              tr: ({ node, ...props }) => (
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50" {...props} />
                              ),
                              th: ({ node, ...props }) => (
                                <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-700" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="px-4 py-2 border border-gray-300 dark:border-gray-700" {...props} />
                              ),
                              hr: ({ node, ...props }) => (
                                <hr className="my-4 border-t border-gray-300 dark:border-gray-700" {...props} />
                              ),
                              img: ({ node, ...props }) => (
                                <img className="max-w-full h-auto rounded-lg my-4" {...props} />
                              ),
                              pre: ({ node, ...props }) => (
                                <pre className="mb-4" {...props} />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                        
                        {/* Render file attachments if present */}
                        {message.files && message.files.length > 0 && renderFiles(message.files)}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isUser && (
                        <span className="text-xs opacity-70 mr-2">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <button
                        className={cn(
                          "p-1 rounded hover:bg-muted transition-opacity",
                          isLast ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        title={copiedId === message.id ? "Copied!" : "Copy"}
                        onClick={() => {
                          navigator.clipboard.writeText(message.content);
                          setCopiedId(message.id);
                          setTimeout(() => setCopiedId(null), 1200);
                        }}
                      >
                        <Copy className={cn("h-4 w-4", copiedId === message.id ? "text-green-500" : "")} />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {/* Show typing indicator when generating a response and there's no AI message yet */}
              {isGeneratingResponse && !currentlyAnimatingId && (
                <div className="flex items-start w-full">
                  <div className="mr-8 bg-muted/50 rounded-2xl">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      
      {showScrollButton && (
        <button
          className="absolute right-6 bottom-8 z-10 p-2 rounded-full bg-background shadow-lg border border-border hover:bg-muted transition-colors"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
