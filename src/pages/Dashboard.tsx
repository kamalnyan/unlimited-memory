"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { FaMoon, FaSun } from "react-icons/fa";

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
    }, 10);

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

  const handleThemeToggle = () => {
    const newTheme = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#121212] text-white' : 'bg-[#f7f8f9] text-gray-900'}`}>
      <header className={`fixed top-0 left-0 w-full px-6 py-4 z-50 border-b shadow-sm transition-all ${isDark ? 'bg-[#181818] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">eoxsAI Admin Dashboard</h1>
          <button
            onClick={handleThemeToggle}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#222] transition"
            aria-label="Toggle dark mode"
          >
            {isDark ? <FaSun size={20} /> : <FaMoon size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-28 pb-10">
        <section className={`rounded-2xl border shadow-lg transition-all p-6 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
          <h2 className="text-xl font-semibold mb-1">User Summary (Admin Only)</h2>
          <p className="text-sm text-muted-foreground mb-5">Ask about a user's daily activity summary like: <em>"What has Gaurav done today?"</em></p>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about a user's activity..."
              className={`flex-1 rounded-lg px-4 py-2 text-sm border transition-all focus:outline-none focus:ring-2 ${isDark
                ? 'bg-[#222] text-white border-[#444] focus:ring-[#10a37f]'
                : 'bg-white border-gray-300 text-black focus:ring-[#10a37f]'}`}
              value={adminSummaryPrompt}
              onChange={(e) => setAdminSummaryPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdminUserSummary(); }}
              disabled={isAdminSummarizing}
            />
            <Button
              onClick={handleAdminUserSummary}
              disabled={isAdminSummarizing || !adminSummaryPrompt.trim()}
              className={`rounded-lg px-6 font-medium ${isAdminSummarizing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isAdminSummarizing ? "Thinking..." : "Ask"}
            </Button>
          </div>

          <div className="mt-6 min-h-[80px]">
            {isAdminSummarizing ? (
              <TypingIndicator />
            ) : finalSummary ? (
              <div className={`px-5 py-4 rounded-md text-sm transition-all duration-300 ease-in-out shadow-sm border ${isDark ? 'bg-[#2b2b2b] text-white border-[#444]' : 'bg-gray-50 text-gray-800 border-gray-200'}`}>
                <strong className="block mb-2 text-gray-500">Summary</strong>
                <p className="whitespace-pre-wrap leading-relaxed">{finalSummary}</p>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
