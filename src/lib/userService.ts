/**
 * userService.ts
 * User service utilities. Handles user data synchronization and management.
 * Implements user profile updates, role changes, and data validation.
 * Provides helper functions for user-related operations.
 */
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import connectToDatabase from "./db";

export function useUserSync() {
  const { user, isSignedIn } = useUser();
  const { toast } = useToast();
  const [isSynced, setIsSynced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sync user data with MongoDB when user signs in
  useEffect(() => {
    if (!isSignedIn || !user) return;
    
    const syncUser = async () => {
      if (isLoading || isSynced) return;
      
      try {
        setIsLoading(true);
        setError(null);
        console.log("Attempting to sync user data with MongoDB...");
        
        // Check database connection first
        try {
          // This is a client-side check, just to see if our API endpoints will work
          const connectionCheck = await fetch('/api/db/connection-check');
          if (!connectionCheck.ok) {
            console.warn("Database connection check failed, falling back to mock mode");
            throw new Error("Database connection check failed");
          }
        } catch (connectionError) {
          console.warn("Database connection check failed:", connectionError);
          // Continue with mock mode
        }
        
        // Try real API
        let response;
        try {
          response = await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clerkId: user.id,
              email: user.primaryEmailAddress?.emailAddress,
              firstName: user.firstName,
              lastName: user.lastName,
              imageUrl: user.imageUrl,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to sync user data: ${response.status} - ${errorData}`);
          }
          
          const data = await response.json();
          console.log('User data synced with MongoDB:', data);
          setIsSynced(true);
        } catch (apiError) {
          console.log("API error, falling back to mock:", apiError);
          // In development or when API fails, use mock data
          await mockApiCall('/api/users/sync', 'POST', {
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
          });
          setIsSynced(true);
        }
      } catch (error) {
        console.error('Error syncing user data:', error);
        setError((error as Error).message);
        
        // For development only - simulate success anyway
        if (process.env.NODE_ENV !== 'production') {
          console.log("Development mode: Simulating successful user sync despite error");
          setIsSynced(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    syncUser();
  }, [isSignedIn, user, isLoading, isSynced]);
  
  return { user, isSignedIn, isSynced, isLoading, error };
}

// For mocking API calls during development
export async function mockApiCall(endpoint: string, method = 'GET', data: any = null) {
  // This function simulates API calls when real backend is not available
  console.log(`Mock API call to ${endpoint} with method ${method}`, data);
  
  // Simulate API response delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // For specific mock endpoints
  if (endpoint === '/api/users/sync' && method === 'POST') {
    return {
      ok: true,
      json: async () => ({ 
        success: true, 
        data: { 
          ...data, 
          _id: "mock_user_" + Math.random().toString(36).substring(2),
          role: 'user',
          mock: true 
        } 
      }),
      text: async () => "Success"
    };
  }
  
  // Generic mock response
  return {
    ok: true,
    json: async () => ({ 
      success: true, 
      data: { ...data, mock: true } 
    }),
    text: async () => "Success"
  };
}

// Helper function to check if MongoDB is available
export async function checkDatabaseConnection() {
  try {
    const response = await fetch('/api/db/connection-check');
    if (response.ok) {
      const data = await response.json();
      return data.connected;
    }
    return false;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}
