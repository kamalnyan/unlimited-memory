/**
 * App.tsx
 * Main application component. Sets up Clerk authentication, React Query, routing, and global providers.
 * Handles protected routes (chat, dashboard), redirects, and admin checks.
 * Manages user authentication state and syncs with MongoDB.
 */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import { RequireAuth } from "./components/auth/RequireAuth";
import { useUserSync } from "./lib/userService";
import clientConfig from './lib/client-config';

// Use client-side config for Clerk key
const PUBLISHABLE_KEY = clientConfig.clerkKey;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

const queryClient = new QueryClient();

function UserSyncer() {
  useUserSync();
  return null;
}

const App = () => (
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserSyncer />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Auth Routes */}
            <Route path="/sign-in/*" element={<SignIn />} />
            <Route path="/sign-up/*" element={<SignUp />} />
            
            {/* Protected Routes */}
            <Route 
              path="/chat" 
              element={
                <RequireAuth>
                  <Chat />
                </RequireAuth>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <RequireAuth adminOnly>
                  <Dashboard />
                </RequireAuth>
              } 
            />
            
            {/* API Routes will be handled by backend */}
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

export default App;
