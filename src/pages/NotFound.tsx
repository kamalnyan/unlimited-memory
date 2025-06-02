/**
 * NotFound.tsx
 * 404 page for undefined routes. Offers navigation back to home or chat.
 * Provides a user-friendly error message and recovery options.
 */
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
        <div className="flex justify-center gap-4">
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
          <Link to="/chat">
            <Button variant="outline">Go to Chat</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
