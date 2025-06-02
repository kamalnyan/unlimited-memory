/**
 * auth.ts
 * Authentication utilities. Provides functions for user authentication and authorization.
 * Implements role checking, permission validation, and user context management.
 * Integrates with Clerk for authentication state management.
 */

import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

// Admin emails list
export const ADMIN_EMAIL = [
  "shandilyadeep090@gmail.com",
  "shaurayaaditya0404@gmail.com",
  "nitibhatia2004@gmail.com",
  "gaurav.singh345@gmail.com",
  "deepankarsingh1@gmail.com",
  "deepankarsingheoxs@gmail.com"
];

/**
 * useIsAdmin
 * Custom React hook to check if the current user is an admin.
 */

//DEV : deeepak 
export function useIsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    async function checkAdmin() {
      const email = user.primaryEmailAddress?.emailAddress ?? "";

      // Check metadata role, email match, or email containing "admin"
      const hasAdminRole = user.publicMetadata?.role === "admin";
      const isWhitelistedEmail = ADMIN_EMAIL.includes(email);
      const isDevEmail = email.includes("admin");

      if (!cancelled) {
        setIsAdmin(hasAdminRole || isWhitelistedEmail || isDevEmail);
      }
    }

    setIsAdmin(null); // set loading before check
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    isAdmin,
    isLoading: isAdmin === null,
  };
}

/**
 * isAdmin
 * Utility function to check if a given email has admin privileges.
 */
export function isAdmin(email: string) {
  if (!email) return false;
  return ADMIN_EMAIL.includes(email) || email.includes("admin");
}
