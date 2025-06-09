/**
 * Chat.tsx
 * Main chat interface. Handles thread selection, message display, sending, and thread management.
 * Features real-time message updates, thread creation/deletion, and theme switching.
 * Integrates with MongoDB for persistent storage and Clerk for user authentication.
 */
import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApiCall } from "@/lib/userService";
import { Menu, Sun, Moon } from "lucide-react";

type Thread = {
  id: string;
  title: string;
  updatedAt: Date;
};

type FileAttachment = {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
};

type Message = {
  id: string;
  content: string;
  role: "user" | "ai";
  timestamp: Date;
  files?: FileAttachment[];
};

const Chat = () => {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });
  
  // Helper function to normalize message format
  const normalizeMessage = (msgData: any, isAI = false): Message => {
    const msg = msgData.data || msgData;
    return {
      id: msg._id || msg.id || generateMockId(),
      content: msg.content || "",
      role: isAI ? "ai" : "user",
      timestamp: new Date(msg.timestamp || msg.createdAt || Date.now()),
      files: undefined // AI and backend messages never have files now
    };
  };
  
  // Generate a mock ID for development testing
  const generateMockId = () => `mock_${Math.random().toString(36).substring(2, 9)}`;
  
  // Fetch user's threads
  const { 
    data: threads = [], 
    refetch: refetchThreads,
    isLoading: isThreadsLoading,
    error: threadsError 
  } = useQuery({
    queryKey: ['threads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log("Fetching threads for user:", user.id);
      
      const response = await fetch(`/api/threads?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threads: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log("Fetched threads response:", responseData);
      
      // Handle different response structures to ensure we get the threads array
      let threadsData = [];
      
      if (responseData.data && Array.isArray(responseData.data)) {
        // If data is directly an array
        threadsData = responseData.data;
      } else if (responseData.data && responseData.data.threads && Array.isArray(responseData.data.threads)) {
        // If data contains a threads property that is an array
        threadsData = responseData.data.threads;
      } else if (Array.isArray(responseData)) {
        // If the response itself is an array
        threadsData = responseData;
      } else {
        console.warn("Unexpected response format for threads:", responseData);
        threadsData = [];
      }
      
      // Transform the API thread format to our front-end format
      return threadsData.map((thread: any) => ({
        id: thread._id || thread.id,
        title: thread.title || 'New Chat',
        updatedAt: new Date(thread.updatedAt || Date.now())
      }));
    },
    enabled: !!user?.id
  });

  // Create a new thread
  const createThreadMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      console.log("Creating new thread with title:", title);
      
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          title,
          email: user.primaryEmailAddress?.emailAddress || 'unknown'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create thread: ${response.status} - ${errorData}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Thread created:", data);
      queryClient.invalidateQueries({ queryKey: ['threads', user?.id] });
      
      // Extract the ID correctly from the response structure
      const threadId = data.id || 
                      (data.data && data.data.id) || 
                      (data.data && data.data._id);
      
      if (!threadId) {
        console.error("Failed to get thread ID from response:", data);
        toast({
          title: "Failed to create conversation",
          description: "Invalid server response format",
          variant: "destructive"
        });
        setIsCreatingThread(false);
        return;
      }
      
      setSelectedThreadId(threadId);
      setMessages([]);
      setIsCreatingThread(false);
      
      // Add welcome message for new threads
      const welcomeMessage = {
        id: generateMockId(),
        content: "Hello! How can I help you today?",
        role: "ai" as const,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    },
    onError: (error) => {
      console.error('Error creating thread:', error);
      toast({
        title: "Failed to create conversation",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      setIsCreatingThread(false);
    }
  });

  // Delete a thread
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      try {
        console.log("Deleting thread:", threadId);
        let response;
        
        try {
          // Include userId as a query parameter as required by the API
          response = await fetch(`/api/threads/${threadId}?userId=${user?.id}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) throw new Error('Failed to delete thread');
          return threadId;
        } catch (e) {
          console.log("Using mock API for thread deletion");
          await new Promise(resolve => setTimeout(resolve, 300));
          return threadId;
        }
      } catch (error) {
        console.error("Error deleting thread:", error);
        return threadId; // For development, still return ID to remove from UI
      }
    },
    onSuccess: (threadId) => {
      queryClient.invalidateQueries({ queryKey: ['threads', user?.id] });
      
      const remainingThreads = threads.filter(thread => thread.id !== threadId);
      
      if (selectedThreadId === threadId) {
        setSelectedThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null);
        setMessages([]);
      }
      
      toast({
        title: "Conversation deleted",
      });
    },
    onError: (error) => {
      console.error('Error deleting thread:', error);
      toast({
        title: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  });

  // Update the updateThreadTitle function
  const updateThreadTitle = async (threadId: string, content: string) => {
    try {
      // Extract first 20 characters and add ellipsis if needed
      const threadTitle = content.trim().length > 20 
        ? content.trim().slice(0, 20) + '...'
        : content.trim();
      
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id,
          title: threadTitle
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update thread title');
      }
      
      // Invalidate threads query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['threads', user?.id] });
    } catch (error) {
      console.error('Error updating thread title:', error);
    }
  };

  // Update the sendMessageMutation to handle file uploads
  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content, files }: { threadId: string, content: string, files?: File[] }) => {
      const timestamp = new Date();
      // Check if this is the first message in the thread
      const thread = threads.find(t => t.id === threadId);
      if (thread && thread.title === 'New Chat') {
        await updateThreadTitle(threadId, content);
      }

      let fileAttachments: FileAttachment[] = [];
      let imageAnalysisResults: string[] = [];

      // If there are files, upload them first
      if (files && files.length > 0) {
        // Upload files to Cloudinary and get URLs
        console.log(`Attempting to upload ${files.length} file(s) to /api/upload`);
        const uploadPromises = files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          try {
            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            });

            console.log(`Upload response for ${file.name}: Status ${response.status}`);

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Failed to upload ${file.name}: Status ${response.status}, Error:`, errorData);
              throw new Error(`Failed to upload file: ${file.name}`);
            }

            const data = await response.json();
            console.log(`Successfully uploaded ${file.name}:`, data);
            return {
              filename: data.filename,
              originalName: file.name,
              mimetype: file.type,
              size: file.size,
              url: data.url,
              thumbnailUrl: data.thumbnailUrl
            };
          } catch (uploadError: any) {
            console.error(`Error during upload of ${file.name}:`, uploadError);
            throw new Error(`File upload failed for ${file.name}: ${uploadError.message}`);
          }
        });

        try {
          fileAttachments = await Promise.all(uploadPromises);
          console.log("All files uploaded successfully:", fileAttachments);
        } catch (allUploadError: any) {
          console.error("One or more file uploads failed:", allUploadError);
          throw new Error(`File upload process failed: ${allUploadError.message}`);
        }
      }

      // Create user message with file attachments first, without AI analysis
      const userMessage = {
        threadId: selectedThreadId,
        content: content,
        userId: user?.id,
        role: 'user',
        files: fileAttachments.length > 0 ? fileAttachments : undefined
      };

      console.log("Sending user message:", userMessage);

      // Save user message with files
      const userMsgResponse = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage)
      });

      if (!userMsgResponse.ok) {
        const errorData = await userMsgResponse.text();
        console.error("Failed to save user message:", {
          status: userMsgResponse.status,
          statusText: userMsgResponse.statusText,
          error: errorData
        });
        throw new Error(`Failed to save user message: ${userMsgResponse.status} - ${errorData}`);
      }

      const userMsgData = await userMsgResponse.json();
      setIsGeneratingResponse(true);

      // If there are image files, analyze them now
      const imageFiles = files?.filter(file => file.type.startsWith('image/')) || [];
      if (imageFiles.length > 0) {
        console.log(`Attempting to analyze ${imageFiles.length} image(s)`);
        const analysisPromises = imageFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);

          try {
            const response = await fetch('/api/ai', {
              method: 'POST',
              body: formData
            });

            console.log(`AI Vision response for ${file.name}: Status ${response.status}`);

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Failed to analyze image ${file.name}: Status ${response.status}, Error:`, errorData);
              throw new Error(`Failed to analyze image: ${file.name}`);
            }

            const data = await response.json();
            console.log(`Successfully analyzed ${file.name}:`, data);
            return data.result;
          } catch (analysisError: any) {
            console.error(`Error during analysis of ${file.name}:`, analysisError);
            throw new Error(`Image analysis failed for ${file.name}: ${analysisError.message}`);
          }
        });

        try {
          imageAnalysisResults = await Promise.all(analysisPromises);
          console.log("All images analyzed successfully:", imageAnalysisResults);
          
          // Create and add an AI message for each image analysis
          const analysisMessages = imageAnalysisResults.map((result, index) => ({
            id: `analysis_${Date.now()}_${index}`,
            content: result,
            role: "ai" as const,
            timestamp: new Date(),
            files: [fileAttachments[index]] // Link the analysis to the corresponding image
          }));
          
          // Add the analysis messages to the chat
          setMessages(prev => [...prev, ...analysisMessages]);
          
        } catch (allAnalysisError: any) {
          console.error("One or more image analyses failed:", allAnalysisError);
          throw new Error(`Image analysis process failed: ${allAnalysisError.message}`);
        }
      }

      // Get AI response with the image analysis results
      const aiResponse = await fetch('/api/messages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          threadId, 
          userMessage: content, // Don't include analysis results in the user message
          files: fileAttachments.length > 0 ? fileAttachments : undefined
        })
      });

      if (!aiResponse.ok) {
        const errorData = await aiResponse.text();
        throw new Error(`Failed to generate AI response: ${aiResponse.status} - ${errorData}`);
      }

      const aiResponseData = await aiResponse.json();
      console.log("Raw AI Response Data:", aiResponseData);

      // Extract the AI response content from the data structure
      let aiContent = "";
      if (aiResponseData?.data?.content) {
        aiContent = aiResponseData.data.content;
        console.log("Found content in standard format:", aiContent);
      } else if (aiResponseData?.data?.answer) {
        aiContent = aiResponseData.data.answer;
        console.log("Found answer in data:", aiContent);
      } else {
        console.error("Unexpected data format:", aiResponseData);
        throw new Error("Could not extract response content from API");
      }

      if (!aiContent) {
        console.error("Empty AI response content:", aiResponseData);
        throw new Error("Received empty response from API");
      }
      
      // Add AI response to the UI
      const aiMessage: Message = {
        id: aiResponseData.data.id || generateMockId(),
        content: aiContent,
        role: "ai",
        timestamp: new Date(aiResponseData.data.createdAt || Date.now()),
        files: undefined
      };
      setMessages(prev => [...prev, aiMessage]);

      // Update thread title if this is the first message
      if (messages.length === 0) {
        await updateThreadTitle(threadId, content.slice(0, 50) + "...");
      }

      return {
        userMessage: normalizeMessage(userMsgData, false),
        aiMessage: aiMessage
      };
    },
    onSuccess: (data) => {
      console.log("Message sent and received:", data);
      console.log("AI Message content received:", data.aiMessage.content);

      // Replace the temporary message with the real messages
      setMessages(prev => {
        // Remove the temporary message
        const filteredMessages = prev.filter(msg => !msg.id.startsWith('temp_'));
        // Add the real user and AI messages
        return [...filteredMessages, data.userMessage, data.aiMessage];
      });
      
      // Use the queryClient from the component scope
      queryClient.invalidateQueries({ queryKey: ['threads', user?.id] });
      setIsCreatingThread(false); // Ensure the creating thread flag is reset
      
      // Keep the generating state active for a moment to show the animation
      // The animation will stop once the message is fully displayed
      setTimeout(() => {
        setIsGeneratingResponse(false);
      }, 300);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')));
      setIsGeneratingResponse(false); // Reset the generating state on error
      setIsCreatingThread(false); // Ensure the creating thread flag is reset on error too
    }
  });

  // Fetch messages for selected thread
  const fetchMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    setIsLoading(true);
    
    try {
      console.log("Fetching messages for thread:", threadId);
      
      const response = await fetch(`/api/threads/${threadId}/messages?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Fetched messages:", data);
      
      // Handle both array and object API responses
      let messagesArray = [];
      if (Array.isArray(data.data)) {
        messagesArray = data.data;
      } else if (data.data && Array.isArray(data.data.messages)) {
        messagesArray = data.data.messages;
      } else {
        messagesArray = [];
      }
      
      // Transform the API message format to our front-end format
      const formattedMessages = messagesArray.map((msg: any) => ({
        id: msg._id || msg.id,
        content: msg.content,
        role: msg.role || (msg.sender === user?.id ? "user" : "ai"),
        timestamp: new Date(msg.timestamp || msg.createdAt),
        files: msg.files
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Failed to load messages",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Select first thread by default or when threads change
  useEffect(() => {
    if (threads?.length > 0 && !selectedThreadId && !isCreatingThread) {
      const firstThreadId = threads[0].id;
      console.log("Auto-selecting first thread:", firstThreadId);
      setSelectedThreadId(firstThreadId);
      fetchMessages(firstThreadId);
    }
  }, [threads, selectedThreadId, isCreatingThread]);

  const handleSelectThread = async (threadId: string) => {
    if (threadId !== selectedThreadId) {
      console.log("Manually selecting thread:", threadId);
      setSelectedThreadId(threadId);
      await fetchMessages(threadId);
    }
  };

  // Update handleNewThread to use 'New Chat'
  const handleNewThread = () => {
    console.log("Creating new thread");
    setIsCreatingThread(true);
    setSelectedThreadId(null);
    setMessages([]);
    
    // Create a thread with default title
    createThreadMutation.mutate('New Chat');
  };

  const handleDeleteThread = async (threadId: string): Promise<void> => {
    console.log("Deleting thread:", threadId);
    await deleteThreadMutation.mutateAsync(threadId);
  };

  // Update handleSendMessage to check for 'New Chat' title
  const handleSendMessage = async (content: string, files?: File[], isDocumentQuery?: boolean) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in to send messages",
        variant: "destructive"
      });
      return;
    }

    if (!selectedThreadId) {
      // Create a new thread if none is selected
      setIsCreatingThread(true);
      try {
        const response = await createThreadMutation.mutateAsync(content.slice(0, 50) + "...");
        // The thread creation mutation will handle setting selectedThreadId and messages
        return;
      } catch (error) {
        console.error("Failed to create thread:", error);
        return;
      }
    }

    setIsGeneratingResponse(true);

    try {
      let uploadedFiles: FileAttachment[] = [];
      
      console.log("handleSendMessage - isDocumentQuery:", isDocumentQuery);
      console.log("handleSendMessage - files:", files);
      console.log("handleSendMessage - files.length:", files?.length);
      
      // Upload files first if there are any
      if (files && files.length > 0) {
        console.log("Processing files:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));
        const uploadPromises = files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }

          const uploadData = await uploadResponse.json();
          return {
            filename: uploadData.filename,
            originalName: file.name,
            mimetype: file.type,
            size: file.size,
            url: uploadData.url,
            thumbnailUrl: uploadData.thumbnailUrl
          };
        });

        try {
          uploadedFiles = await Promise.all(uploadPromises);
          console.log("Files uploaded successfully:", uploadedFiles);
        } catch (uploadError) {
          throw new Error(`Failed to upload files: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      }

      // Add user message to the UI immediately
      const userMessage: Message = {
        id: generateMockId(),
        content,
        role: "user",
        timestamp: new Date(),
        files: uploadedFiles
      };
      setMessages(prev => [...prev, userMessage]);

      let response;
      let aiResponseData;
      
      if (isDocumentQuery && files && files.length > 0) {
        console.log("Processing document query with files:", files.map(f => f.name));
        // Handle document query
        const formData = new FormData();
        // The API expects 'files' as the field name and supports multiple files
        files.forEach(file => {
          console.log("Appending file to formData:", file.name);
          formData.append('files', file);
        });
        // The API expects 'question' as the field name
        formData.append('question', content);

        console.log("Sending document query to /api/document/ask-doc");
        try {
          response = await fetch('/api/document/ask-doc', {
            method: 'POST',
            body: formData
          });

          const responseData = await response.json();
          console.log("Document query response:", responseData);

          if (!response.ok) {
            console.error("Document query failed:", responseData);
            throw new Error(responseData.message || `Document query failed: ${response.status}`);
          }

          if (!responseData.success) {
            console.error("Document query returned unsuccessful:", responseData);
            throw new Error(responseData.message || "Document query was unsuccessful");
          }

          if (!responseData.data?.answer) {
            console.error("Document query response missing answer:", responseData);
            throw new Error("Invalid response format: missing answer");
          }

          // Update the AI response data with the document query response
          aiResponseData = {
            data: {
              content: responseData.data.answer,
              id: generateMockId(),
              createdAt: new Date().toISOString()
            }
          };

          console.log("Successfully processed document query:", {
            question: content,
            fileCount: files.length,
            fileNames: files.map(f => f.name),
            answerLength: responseData.data.answer.length
          });
        } catch (error) {
          console.error("Document query error:", error);
          throw error; // Re-throw the error to be handled by the outer catch block
        }
      } else {
        // Handle regular chat message
        console.log("Sending regular chat message");
        const messageData = {
          threadId: selectedThreadId,
          content: content,
          userId: user.id,
          files: uploadedFiles.length > 0 ? uploadedFiles : undefined
        };

        response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error("Message request failed:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(`Message request failed: ${response.status} - ${errorData}`);
        }

        // After sending the user message, get the AI response
        console.log("Getting AI response from /api/messages/generate");
        const aiResponse = await fetch('/api/messages/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: selectedThreadId,
            userMessage: content,
            userId: user.id,
            files: uploadedFiles.length > 0 ? uploadedFiles : undefined
          })
        });

        if (!aiResponse.ok) {
          const errorData = await aiResponse.text();
          console.error("AI response generation failed:", {
            status: aiResponse.status,
            statusText: aiResponse.statusText,
            error: errorData
          });
          throw new Error(`AI response generation failed: ${aiResponse.status} - ${errorData}`);
        }

        aiResponseData = await aiResponse.json();
        console.log("AI response:", aiResponseData);
      }

      // Extract the AI response content from the data structure
      let aiContent = "";
      if (aiResponseData?.data?.content) {
        aiContent = aiResponseData.data.content;
        console.log("Found content in standard format:", aiContent);
      } else if (aiResponseData?.data?.answer) {
        aiContent = aiResponseData.data.answer;
        console.log("Found answer in data:", aiContent);
      } else {
        console.error("Unexpected data format:", aiResponseData);
        throw new Error("Could not extract response content from API");
      }

      if (!aiContent) {
        console.error("Empty AI response content:", aiResponseData);
        throw new Error("Received empty response from API");
      }
      
      // Add AI response to the UI
      const aiMessage: Message = {
        id: aiResponseData.data.id || generateMockId(),
        content: aiContent,
        role: "ai",
        timestamp: new Date(aiResponseData.data.createdAt || Date.now()),
        files: undefined
      };
      setMessages(prev => [...prev, aiMessage]);

      // Update thread title if this is the first message
      if (messages.length === 0) {
        await updateThreadTitle(selectedThreadId, content.slice(0, 50) + "...");
      }

    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      
      // Only show error toast and message for actual API failures
      if (error instanceof Error && (
        error.message.includes("Failed to upload") ||
        error.message.includes("Document query failed") ||
        error.message.includes("Message request failed") ||
        error.message.includes("AI response generation failed")
      )) {
        toast({
          title: "Failed to process request",
          description: error.message,
          variant: "destructive"
        });

        // Add error message to the chat only for actual API failures
        const errorMessage: Message = {
          id: generateMockId(),
          content: "Sorry, I encountered an error processing your request. Please try again.",
          role: "ai",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        // For other errors, just log them but don't show to user
        console.error("Non-critical error in message handling:", error);
      }
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Add this useEffect to update titles when component mounts and when user ID changes
  useEffect(() => {
    if (user?.id) {
      updateAllThreadTitles(user.id);
    }
  }, [user?.id]);

  // Rename a thread
  const handleRenameThread = async (threadId: string, newName: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, title: newName })
      });
      if (!response.ok) throw new Error('Failed to rename thread');
      queryClient.invalidateQueries({ queryKey: ['threads', user?.id] });
      toast({ title: 'Thread renamed', description: `Conversation renamed to "${newName}"` });
    } catch (error) {
      toast({ title: 'Failed to rename thread', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // Add this function inside the component
  const updateAllThreadTitles = async (userId: string) => {
    try {
      const response = await fetch('/api/threads/update-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update thread titles');
      }
      
      const result = await response.json();
      console.log('Thread titles update result:', result);
      
      // Refresh threads list
      queryClient.invalidateQueries({ queryKey: ['threads', userId] });
    } catch (error) {
      console.error('Error updating thread titles:', error);
    }
  };

  return (
    <div className="flex h-screen font-inter">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 ${sidebarOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 pointer-events-none'} h-full`}
      >
        <ChatSidebar
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
          onRenameThread={handleRenameThread}
          isLoading={isThreadsLoading}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full transition-all duration-300 relative">
        {/* Sidebar Toggle Button (floating, when sidebar is hidden) */}
        {!sidebarOpen && (
          <button
            className="fixed top-4 left-4 z-50 p-1 rounded-lg bg-background shadow-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-xl-heavy"><path fillRule="evenodd" clipRule="evenodd" d="M8.85719 3H15.1428C16.2266 2.99999 17.1007 2.99998 17.8086 3.05782C18.5375 3.11737 19.1777 3.24318 19.77 3.54497C20.7108 4.02433 21.4757 4.78924 21.955 5.73005C22.2568 6.32234 22.3826 6.96253 22.4422 7.69138C22.5 8.39925 22.5 9.27339 22.5 10.3572V13.6428C22.5 14.7266 22.5 15.6008 22.4422 16.3086C22.3826 17.0375 22.2568 17.6777 21.955 18.27C21.4757 19.2108 20.7108 19.9757 19.77 20.455C19.1777 20.7568 18.5375 20.8826 17.8086 20.9422C17.1008 21 16.2266 21 15.1428 21H8.85717C7.77339 21 6.89925 21 6.19138 20.9422C5.46253 20.8826 4.82234 20.7568 4.23005 20.455C3.28924 19.9757 2.52433 19.2108 2.04497 18.27C1.74318 17.6777 1.61737 17.0375 1.55782 16.3086C1.49998 15.6007 1.49999 14.7266 1.5 13.6428V10.3572C1.49999 9.27341 1.49998 8.39926 1.55782 7.69138C1.61737 6.96253 1.74318 6.32234 2.04497 5.73005C2.52433 4.78924 3.28924 4.02433 4.23005 3.54497C4.82234 3.24318 5.46253 3.11737 6.19138 3.05782C6.89926 2.99998 7.77341 2.99999 8.85719 3ZM6.35424 5.05118C5.74907 5.10062 5.40138 5.19279 5.13803 5.32698C4.57354 5.6146 4.1146 6.07354 3.82698 6.63803C3.69279 6.90138 3.60062 7.24907 3.55118 7.85424C3.50078 8.47108 3.5 9.26339 3.5 10.4V13.6C3.5 14.7366 3.50078 15.5289 3.55118 16.1458C3.60062 16.7509 3.69279 17.0986 3.82698 17.362C4.1146 17.9265 4.57354 18.3854 5.13803 18.673C5.40138 18.8072 5.74907 18.8994 6.35424 18.9488C6.97108 18.9992 7.76339 19 8.9 19H9.5V5H8.9C7.76339 5 6.97108 5.00078 6.35424 5.05118ZM11.5 5V19H15.1C16.2366 19 17.0289 18.9992 17.6458 18.9488C18.2509 18.8994 18.5986 18.8072 18.862 18.673C19.4265 18.3854 19.8854 17.9265 20.173 17.362C20.3072 17.0986 20.3994 16.7509 20.4488 16.1458C20.4992 15.5289 20.5 14.7366 20.5 13.6V10.4C20.5 9.26339 20.4992 8.47108 20.4488 7.85424C20.3994 7.24907 20.3072 6.90138 20.173 6.63803C19.8854 6.07354 19.4265 5.6146 18.862 5.32698C18.5986 5.19279 18.2509 5.10062 17.6458 5.05118C17.0289 5.00078 16.2366 5 15.1 5H11.5ZM5 8.5C5 7.94772 5.44772 7.5 6 7.5H7C7.55229 7.5 8 7.94772 8 8.5C8 9.05229 7.55229 9.5 7 9.5H6C5.44772 9.5 5 9.05229 5 8.5ZM5 12C5 11.4477 5.44772 11 6 11H7C7.55229 11 8 11.4477 8 12C8 12.5523 7.55229 13 7 13H6C5.44772 13 5 12.5523 5 12Z" fill="currentColor"></path></svg>
          </button>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 min-h-[56px] bg-background">
          {/* Left: EoxsAI branding */}
          <div className={`flex items-center ${!sidebarOpen ? 'pl-10' : ''}`}>
            <button
              className="text-2xl font-bold tracking-tight text-primary focus:outline-none transition-colors px-3 py-1 rounded-lg hover:bg-muted"
              onClick={handleNewThread}
              aria-label="Start new chat"
            >
              EoxsAI
            </button>
          </div>
          {/* Right: Dark mode toggle and UserButton */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              className="p-2 rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Toggle dark mode"
              onClick={() => setIsDark((d) => !d)}
            >
              <span className="sr-only">Toggle dark mode</span>
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto">
          <MessageList 
            messages={messages} 
            isLoading={isLoading} 
            isGeneratingResponse={isGeneratingResponse}
          />
        </div>
        
        <MessageInput 
          onSend={handleSendMessage}
          disabled={(isLoading && !isCreatingThread) || isThreadsLoading || isGeneratingResponse}
          dark={isDark}
          userId={user?.id || ''}
          threads={threads}
        />
      </div>
    </div>
  );
};

export default Chat;