import { useIsAdmin } from "@/lib/auth";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

interface RequireAuthProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function RequireAuth({ children, adminOnly = false }: RequireAuthProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isAdmin, isLoading } = useIsAdmin();
  const location = useLocation();

  // Show nothing while loading
  if (!isLoaded || isLoading) {
    return null;
  }

  // Redirect to sign in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // If admin only route and user is not admin, redirect to chat
  if (adminOnly && !isAdmin) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
} 