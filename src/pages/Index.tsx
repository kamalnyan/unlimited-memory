/**
 * Index.tsx
 * Landing page for the app. Redirects signed-in users to chat, otherwise shows sign-in/sign-up options.
 * Provides a welcoming interface with clear call-to-action buttons for authentication.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();

  useEffect(() => {
    // Redirect to chat if already signed in
    if (isSignedIn) {
      navigate("/chat");
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-gray-100">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-4xl font-bold mb-4 text-primary">Welcome to eoxsAI</h1>
        <p className="text-xl text-gray-600 mb-8">
          Your company's intelligent assistant powered by AI
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => navigate("/sign-in")} 
            className="px-8 py-6"
            size="lg"
          >
            Sign In
          </Button>
          <Button 
            onClick={() => navigate("/sign-up")} 
            variant="outline" 
            className="px-8 py-6"
            size="lg"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
