/**
 * main.tsx
 * Entry point for the React app. Mounts the App component to the DOM and imports global styles.
 * Initializes the React application with the root element.
 */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
