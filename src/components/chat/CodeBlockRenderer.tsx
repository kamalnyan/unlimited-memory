import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark as darkStyle } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

const CodeBlockRenderer = ({
  node,
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'text';
  const codeContent = String(children).replace(/\n$/, '');

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return !inline ? (
    <div className="relative group rounded-lg overflow-hidden my-4 bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600">
      {/* Language indicator */}
      {lang && (
        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-800 dark:bg-gray-900 rounded-bl-lg">
          {lang}
        </div>
      )}
      
      <SyntaxHighlighter
        style={darkStyle}
        language={lang}
        PreTag="pre"
        {...props}
        customStyle={{
          margin: 0,
          padding: '1rem',
          backgroundColor: 'transparent',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {codeContent}
      </SyntaxHighlighter>

      {/* Copy button */}
      <button 
        className={cn(
          "absolute top-2 right-2 p-2 rounded-md transition-all duration-200",
          "bg-gray-800/80 dark:bg-gray-700/80 hover:bg-gray-700 dark:hover:bg-gray-600",
          "text-gray-400 hover:text-white dark:text-gray-500 dark:hover:text-white",
          "opacity-0 group-hover:opacity-100",
          "flex items-center gap-1.5 text-xs font-medium"
        )}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-400" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  ) : (
    <code className={cn(
      "px-1.5 py-0.5 rounded-md text-sm",
      "bg-gray-100 dark:bg-gray-800",
      "text-gray-800 dark:text-gray-200",
      "font-mono"
    )} {...props}>
      {codeContent}
    </code>
  );
};

export default CodeBlockRenderer; 