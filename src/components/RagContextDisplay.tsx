/**
 * RagContextDisplay.tsx
 * A component for displaying RAG context when available
 */
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';

interface RagContextDisplayProps {
  context?: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export function RagContextDisplay({
  context,
  isVisible = false,
  onToggleVisibility,
}: RagContextDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!context) return null;
  
  // Format the context by splitting on the "---" separator
  const contextItems = context
    .split('---')
    .map(item => item.trim())
    .filter(Boolean);
  
  return (
    <div className={`rag-context-display transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 hidden'}`}>
      <Card className="bg-muted/30 border-muted">
        <CardHeader className="py-2 px-4 flex flex-row justify-between items-center">
          <CardTitle className="text-sm font-medium flex items-center">
            <Info size={14} className="mr-2" />
            AI Context Sources
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onToggleVisibility}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="py-2 px-4 text-xs">
            <div className="max-h-40 overflow-y-auto">
              {contextItems.length > 0 ? (
                <ul className="space-y-1 list-disc pl-4">
                  {contextItems.map((item, index) => (
                    <li key={index} className="text-muted-foreground">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground italic">No specific context sources available</p>
              )}
            </div>
          </CardContent>
        )}
        
        <CardFooter className="py-1 px-4 text-xs text-muted-foreground">
          <span>Powered by semantic search</span>
        </CardFooter>
      </Card>
    </div>
  );
}
