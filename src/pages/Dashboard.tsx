"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TypingIndicator from "@/components/chat/TypingIndicator"; // ✅ Import

const Dashboard = () => {
  const { toast } = useToast();
  const [adminSummaryPrompt, setAdminSummaryPrompt] = useState('');
  const [adminSummaryResult, setAdminSummaryResult] = useState('');
  const [finalSummary, setFinalSummary] = useState('');
  const [isAdminSummarizing, setIsAdminSummarizing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (!adminSummaryResult) return;

    setFinalSummary('');
    setIsTyping(true);

    let i = 0;
    const interval = setInterval(() => {
      if (i < adminSummaryResult.length) {
        setFinalSummary(prev => prev + adminSummaryResult.charAt(i));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 10); // ✅ Fast typing speed (10ms)

    return () => clearInterval(interval);
  }, [adminSummaryResult]);

  const handleAdminUserSummary = async () => {
    if (!adminSummaryPrompt.trim()) return;

    setIsAdminSummarizing(true);
    setFinalSummary('');
    setAdminSummaryResult('');

    try {
      const response = await fetch('/api/adminUserSummary/user-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: adminSummaryPrompt }),
      });
      const data = await response.json();
      if (data.success) {
        setAdminSummaryResult(data.summary);
      } else {
        setAdminSummaryResult('No summary available.');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to fetch summary',
        variant: 'destructive',
      });
      setAdminSummaryResult('Error fetching summary.');
    }

    setIsAdminSummarizing(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#121212] text-white' : 'bg-[#f9f9f9] text-gray-900'}`}>
      <div className={`fixed top-0 left-0 w-full px-6 py-4 z-50 border-b shadow-sm transition-all ${isDark ? 'bg-[#181818] border-[#333]' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-24">
        <div className={`rounded-xl border shadow-lg transition-all p-6 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
          <h2 className="text-lg font-semibold mb-1">User Summary (Admin Only)</h2>
          <p className="text-sm text-muted-foreground mb-4">E.g., “What has Gaurav done today?”</p>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about a user's activity..."
              className={`flex-1 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary border transition-colors ${isDark ? 'bg-[#222] text-white border-[#333]' : 'bg-white border-gray-300 text-black'}`}
              value={adminSummaryPrompt}
              onChange={(e) => setAdminSummaryPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdminUserSummary(); }}
              disabled={isAdminSummarizing}
            />
            <Button
              onClick={handleAdminUserSummary}
              disabled={isAdminSummarizing || !adminSummaryPrompt.trim()}
              className="whitespace-nowrap"
            >
              {isAdminSummarizing ? "Thinking..." : "Ask"}
            </Button>
          </div>

          {/* Typing Indicator or Final Summary */}
          <div className="mt-6 min-h-[60px]">
            {isAdminSummarizing ? (
              <TypingIndicator />
            ) : finalSummary ? (
              <div className={`px-4 py-3 rounded-md text-sm transition-all duration-500 ease-in-out ${isDark ? 'bg-[#2c2c2c] text-white' : 'bg-gray-100 text-gray-800'}`}>
                <strong className="block mb-1">Summary:</strong>
                <p className="whitespace-pre-wrap">{finalSummary}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
