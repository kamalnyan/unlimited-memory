/**
 * MessageView.tsx
 * Component for displaying chat messages with optional RAG context
 */
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { format } from 'date-fns';
import { Bot, FileText, User } from 'lucide-react';
import { RagContextDisplay } from '../RagContextDisplay';

export interface MessageViewProps {
  content: string;
  sender: string;
  timestamp: Date;
  files?: Array<{
    filename: string;
    originalName: string;
    url: string;
    mimetype: string;
  }>;
  context?: string;
}

export function MessageView({ content, sender, timestamp, files, context }: MessageViewProps) {
  const [showContext, setShowContext] = useState(false);
  const isAI = sender === 'system' || sender === 'ai';
  
  return (
    <div className={`message-container py-6 ${isAI ? 'bg-muted/30' : ''}`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-4">
          <div className="message-avatar">
            <Avatar>
              {isAI ? (
                <AvatarFallback>AI</AvatarFallback>
              ) : (
                <AvatarFallback>
                  <User size={18} />
                </AvatarFallback>
              )}
              {isAI && <AvatarImage src="/ai-avatar.png" alt="AI" />}
            </Avatar>
          </div>
          
          <div className="message-content flex-1">
            <div className="message-header flex items-center justify-between mb-1">
              <div className="message-sender font-medium">
                {isAI ? 'AI Assistant' : 'You'}
              </div>
              <div className="message-timestamp text-xs text-muted-foreground">
                {format(new Date(timestamp), 'MMM d, h:mm a')}
              </div>
            </div>
            
            {/* File attachments */}
            {files && files.length > 0 && (
              <div className="message-files mb-3">
                <div className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                    >
                      <FileText size={14} />
                      <span className="max-w-[150px] truncate">{file.originalName}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {/* Message text content */}
            <div className="message-text prose prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            
            {/* RAG context info button (only for AI messages with context) */}
            {isAI && context && (
              <div className="mt-2 flex items-center">
                <button
                  onClick={() => setShowContext(!showContext)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Bot size={12} />
                  <span>{showContext ? 'Hide context sources' : 'Show context sources'}</span>
                </button>
              </div>
            )}
            
            {/* RAG context display */}
            {isAI && context && (
              <div className="mt-2">
                <RagContextDisplay
                  context={context}
                  isVisible={showContext}
                  onToggleVisibility={() => setShowContext(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 