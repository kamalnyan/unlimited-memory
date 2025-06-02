// Simple script to check environment variables
// Run with: node -r dotenv/config env-check.js
console.log('Environment variable check:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
if (process.env.MONGODB_URI) {
  console.log('MONGODB_URI value:', process.env.MONGODB_URI);
  // Only show part of sensitive credentials
  console.log('MONGODB_URI length:', process.env.MONGODB_URI.length);
}
console.log('CLERK_PUBLISHABLE_KEY exists:', !!process.env.CLERK_PUBLISHABLE_KEY);
console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY); 