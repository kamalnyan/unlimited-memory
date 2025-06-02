/**
 * SignIn.tsx
 * Sign-in page using Clerk authentication. Redirects to chat if already signed in.
 * Provides a clean interface for user authentication with email/password or social login.
 */
import { useEffect } from 'react';
import { SignIn as ClerkSignIn, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const SignIn = () => {
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) {
      navigate('/chat');
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-100">
      <div className="w-full max-w-md p-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">Sign In to eoxsAI</h1>
          <p className="text-gray-600">Access your AI assistant</p>
        </div>
        
        <ClerkSignIn
          signUpUrl="/sign-up"
          afterSignInUrl="/chat"
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "shadow-lg rounded-lg border border-gray-200",
              headerTitle: "text-primary text-xl",
              headerSubtitle: "text-gray-500",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
            },
          }}
        />
      </div>
    </div>
  );
};

export default SignIn;
