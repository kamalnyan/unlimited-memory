/**
 * MessageInput.tsx
 * Input component for sending new messages in the chat interface.
 * Features message composition, character limits, and send button.
 * Handles message submission and error states.
 */
import { useState, useRef, useEffect } from "react";
import { Send, Mic, Loader2, Paperclip, X, ArrowUp, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type MessageInputProps = {
  onSend: (message: string, files?: File[], isDocumentQuery?: boolean) => Promise<void>;
  disabled?: boolean;
  dark?: boolean;
  userId: string;
  threads: { id: string; title: string }[];
};

export default function MessageInput({ onSend, disabled = false, dark = false, userId, threads }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[]>([]);
  const [previewImage, setPreviewImage] = useState<{ file: File; preview: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDocumentQuery, setIsDocumentQuery] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [importedChat, setImportedChat] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [mappedMessages, setMappedMessages] = useState<any[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");

  // Helper function to check if a file is a supported document type
  const isSupportedDocument = (file: File): boolean => {
    const isPdfByType = file.type === 'application/pdf';
    const isPdfByExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdf = isPdfByType || isPdfByExt;

    const isWordByType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isWordByExt = file.name.toLowerCase().endsWith('.docx');
    const isWord = isWordByType || isWordByExt;

    const isSupported = isPdf || isWord;
    
    console.log("Document type check:", {
      name: file.name,
      type: file.type,
      isPdf,
      isWord,
      isSupported
    });
    
    return isSupported;
  };

  const handleSend = async () => {
    // Check if we have supported documents in the selection
    const hasSupportedDocs = selectedFiles.some(isSupportedDocument);
    
    // Update document query state based on supported documents
    setIsDocumentQuery(hasSupportedDocs);
    
    // Determine if this is a document query
    const isCurrentDocumentQuery = hasSupportedDocs && selectedFiles.length > 0;
    
    console.log("Sending message - Document query state:", {
      hasSupportedDocs,
      isDocumentQuery: hasSupportedDocs,
      isCurrentDocumentQuery,
      selectedFiles: selectedFiles.map(f => ({ 
        name: f.name, 
        type: f.type,
        isPdf: f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
        isWord: f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.toLowerCase().endsWith('.docx')
      })),
      messageLength: message.trim().length,
      totalFiles: selectedFiles.length
    });

    // Allow sending if there's a message, any selected files (including images), or if it's a determined document query
    if ((message.trim() || selectedFiles.length > 0 || selectedImages.length > 0 || isCurrentDocumentQuery) && !disabled && !isSending) {
      try {
        setIsSending(true);
        const allFiles = [
          ...selectedFiles,
          ...selectedImages.map(img => img.file)
        ];

        // Pass the document query state to onSend
        await onSend(message.trim(), allFiles.length > 0 ? allFiles : undefined, isCurrentDocumentQuery);
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Failed to send message",
          description: "Please try again",
          variant: "destructive"
        });
      } finally {
        setIsSending(false);
        // Reset states after sending is complete
        setMessage("");
        setSelectedFiles([]);
        setIsDocumentQuery(false);
        selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
        setSelectedImages([]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice recording handlers
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = handleStopRecording;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({
        title: "Microphone error",
        description: "Could not access microphone.",
        variant: "destructive"
      });
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsTranscribing(true);

    // Close the MediaRecorder properly
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    if (audioChunksRef.current.length === 0) {
      console.error("No audio data captured");
      setIsTranscribing(false);
      toast({
        title: "Recording error",
        description: "No audio was captured. Please try again.",
        variant: "destructive"
      });
      return;
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    console.log(`Audio blob created: ${audioBlob.size} bytes`);

    // Send audioBlob to backend for transcription
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      console.log("Sending audio to server for transcription...");
      const response = await fetch('/api/users/audio-to-text', {
        method: 'POST',
        body: formData
      });

      console.log("Server response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // If it's not valid JSON, just use the text
        }

        throw new Error((errorData as any)?.error || `Failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("Transcription result:", data);

      if (!data.text) {
        throw new Error('No transcription received');
      }

      setMessage((prev) => prev + (prev ? ' ' : '') + data.text);
    } catch (err) {
      console.error('Transcription error:', err);
      toast({
        title: "Transcription error",
        description: err instanceof Error ? err.message : "Could not transcribe audio.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
      audioChunksRef.current = [];
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      handleStartRecording();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);

      // Validate files - max 5 files, each max 10MB
      if (newFiles.length + selectedFiles.length > 5) {
        toast({
          title: "Too many files",
          description: "Maximum 5 files can be attached to a message",
          variant: "destructive"
        });
        return;
      }

      const oversizedFiles = newFiles.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast({
          title: "File too large",
          description: `Files must be under 10MB each: ${oversizedFiles.map(f => f.name).join(', ')}`,
          variant: "destructive"
        });
        return;
      }

      // Handle images separately
      const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
      const nonImageFiles = newFiles.filter(file => !file.type.startsWith('image/'));

      // Process images
      for (const file of imageFiles) {
        const preview = URL.createObjectURL(file);
        setSelectedImages(prev => [...prev, { file, preview }]);
      }

      // Add non-image files to selectedFiles
      setSelectedFiles(prev => [...prev, ...nonImageFiles]);
    }

    // Clear the input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Update document query state based on remaining files
      const hasRemainingDocs = newFiles.some(isSupportedDocument);
      setIsDocumentQuery(hasRemainingDocs);
      return newFiles;
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImagePreview = (image: { file: File; preview: string }) => {
    setPreviewImage(image);
    setIsPreviewOpen(true);
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Check total number of files (existing + new)
      const totalFiles = selectedFiles.length + newFiles.length;
      if (totalFiles > 2) {
        toast({
          title: "Too many files",
          description: "Maximum 2 documents can be uploaded at once",
          variant: "destructive"
        });
        return;
      }

      // Validate each new file
      const validFiles = newFiles.filter(file => {
        const isSupported = isSupportedDocument(file);

        if (!isSupported) {
          toast({
            title: "Unsupported file type",
            description: "Please upload PDF or Word documents only",
            variant: "destructive"
          });
          return false;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 10MB size limit`,
            variant: "destructive"
          });
          return false;
        }

        // Check if file is already selected
        if (selectedFiles.some(existingFile => existingFile.name === file.name)) {
          toast({
            title: "Duplicate file",
            description: `${file.name} is already selected`,
            variant: "destructive"
          });
          return false;
        }

        return true;
      });

      if (validFiles.length > 0) {
        // Add new valid files to existing selection
        const updatedFiles = [...selectedFiles, ...validFiles];
        setSelectedFiles(updatedFiles);
        
        // Set document query state based on supported documents
        const hasSupportedDocs = updatedFiles.some(isSupportedDocument);
        setIsDocumentQuery(hasSupportedDocs);
        
        console.log("Document selection updated:", {
          files: updatedFiles.map(f => ({
            name: f.name,
            type: f.type,
            isPdf: f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
            isWord: f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.toLowerCase().endsWith('.docx')
          })),
          isDocumentQuery: hasSupportedDocs
        });
        
        // Show success toast with total count
        const totalValidFiles = updatedFiles.length;
        toast({
          title: "Documents selected",
          description: totalValidFiles === 1 
            ? "Document ready for query" 
            : `${totalValidFiles} documents ready for query`,
          variant: "default"
        });
      } else {
        // If no valid files were added, show a general message
        toast({
          title: "No valid documents",
          description: "Please select PDF or Word documents for queries",
          variant: "destructive"
        });
      }
    }

    // Clear the input value to allow selecting the same file again
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const handleDocumentButtonClick = () => {
    documentInputRef.current?.click();
  };

  // Handler for Import Chat button
  const handleImportChatClick = () => {
    importFileInputRef.current?.click();
  };

  // Handler for file input change
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        console.log('Imported JSON structure:', {
          isArray: Array.isArray(json),
          keys: Object.keys(json),
          hasMapping: 'mapping' in json,
          type: typeof json
        });

        // If full export (array), pick the first or show list
        const isArrayExport = Array.isArray(json);
        const selected = isArrayExport ? json[0] : json;

        console.log('Selected conversation:', {
          keys: Object.keys(selected),
          hasMapping: 'mapping' in selected,
          type: typeof selected
        });

        // Check for both mapping and conversations property (newer ChatGPT exports)
        if (!selected.mapping && !selected.conversations) {
          setImportError('Invalid ChatGPT export: missing mapping or conversations property.');
          setImportedChat(null);
          return;
        }

        // Handle both old and new ChatGPT export formats
        const chatData = selected.mapping || selected.conversations;
        if (typeof chatData !== 'object') {
          setImportError('Invalid ChatGPT export: mapping/conversations is not an object.');
          setImportedChat(null);
          return;
        }

        setImportedChat(selected);
        setImportError(null);
        setIsImportPreviewOpen(true);
      } catch (err) {
        console.error('Error parsing JSON:', err);
        setImportError('Invalid JSON file.');
        setImportedChat(null);
      }
    };
    reader.readAsText(file);
  };

  // Map imported ChatGPT messages to app format
  const mapImportedMessages = (imported: any, threadId: string) => {
    if (!imported) return [];
    
    // Get the chat data from either mapping or conversations
    const chatData = imported.mapping || imported.conversations;
    if (!chatData || typeof chatData !== 'object') return [];

    // Handle both array and object formats
    const messages = Array.isArray(chatData) ? chatData : Object.values(chatData);

    return messages
      .filter((msg: any) => {
        // Handle both old and new message formats
        const content = msg.message?.content?.parts?.[0] || msg.content;
        return content && typeof content === 'string';
      })
      .map((msg: any) => {
        // Handle both old and new message formats
        const role = msg.message?.author?.role || msg.role;
        const content = msg.message?.content?.parts?.[0] || msg.content;
        const timestamp = msg.message?.create_time || msg.create_time || Date.now() / 1000;

        // Ensure content is properly formatted
        let formattedContent = content;
        if (typeof content === 'string') {
          // Remove any markdown code block markers if they're not properly formatted
          formattedContent = content.replace(/```\s*\n/g, '```\n').replace(/\n\s*```/g, '\n```');
        }

        return {
          threadId,
          sender: role === "user" ? userId : "system",
          content: formattedContent,
          createdAt: new Date(timestamp * 1000),
          updatedAt: new Date(timestamp * 1000),
          role: role === "user" ? "user" : "ai" // Add role field for proper display
        };
      });
  };

  // Handler for continuing import after preview
  const handleContinueImport = async () => {
    if (!selectedThreadId) {
      setImportError("Please select a thread to import into.");
      return;
    }
    const mapped = mapImportedMessages(importedChat, selectedThreadId);
    setMappedMessages(mapped);
    setIsImportPreviewOpen(false);

    try {
      // Send all messages in a batch to the backend
      const response = await fetch('/api/messages/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: selectedThreadId,
          messages: mapped,
          userId: userId
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to import messages: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('Import result:', result);

      // Get the first user message to use as thread title
      const firstUserMessage = mapped.find(msg => msg.sender === userId);
      if (firstUserMessage) {
        // Update thread title with first user message (truncated)
        const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        await fetch(`/api/threads/${selectedThreadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: userId,
            title: title
          })
        });
      }

      // Show success message
      toast({
        title: "Import Successful",
        description: `Successfully imported ${mapped.length} messages`,
        variant: "default"
      });

      // Clear the import state
      setImportedChat(null);
      setMappedMessages([]);
      setSelectedThreadId("");
      
      // Trigger a refresh of the messages in the parent component
      if (onSend) {
        await onSend("", [], false);
      }
    } catch (error) {
      console.error("Error importing messages:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import messages",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`flex flex-col gap-2 p-4 ${dark ? 'bg-gray-800' : 'bg-white'} border-t`}>
      {/* Import Chat Button and File Input */}
      <div className="flex items-center gap-2 mb-2">
        <Button type="button" variant="outline" onClick={handleImportChatClick} disabled={disabled}>
          Import Chat
        </Button>
        <input
          type="file"
          accept=".json"
          ref={importFileInputRef}
          style={{ display: 'none' }}
          onChange={handleImportFileChange}
        />
        {importError && <span className="text-red-500 text-xs ml-2">{importError}</span>}
      </div>
      {/* Preview Dialog for Imported Chat */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Imported Chat</DialogTitle>
            <DialogDescription>
              Review the imported messages before continuing. You can select a thread to import these messages into.
            </DialogDescription>
          </DialogHeader>
          {importedChat ? (
            <div className="max-h-64 overflow-y-auto text-sm">
              {Object.values(importedChat.mapping).slice(0, 5).map((msg: any, idx: number) => (
                <div key={msg.id || idx} className="mb-2 p-2 border-b last:border-b-0">
                  <div className="font-semibold">{msg.message?.author?.role || 'unknown'}</div>
                  <div>{msg.message?.content?.parts?.[0] || '[No content]'}</div>
                  <div className="text-xs text-gray-400">{msg.message?.create_time ? new Date(msg.message.create_time * 1000).toLocaleString() : ''}</div>
                </div>
              ))}
              {Object.values(importedChat.mapping).length > 5 && <div className="text-xs text-gray-400">...and more</div>}
            </div>
          ) : (
            <div>No valid chat data found.</div>
          )}
          {/* Thread selection dropdown (replace with real threads) */}
          <div className="mt-4">
            <label className="block text-xs mb-1">Select Thread to Import Into</label>
            <select
              className="w-full border rounded p-2 text-sm"
              value={selectedThreadId}
              onChange={e => setSelectedThreadId(e.target.value)}
            >
              <option value="">-- Select Thread --</option>
              {threads.map(thread => (
                <option key={thread.id} value={thread.id}>{thread.title}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsImportPreviewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={handleContinueImport}>
              Continue Import
            </Button>
          </div>
          {importError && <div className="text-red-500 text-xs mt-2">{importError}</div>}
        </DialogContent>
      </Dialog>
      {/* Selected files and images preview */}
      {(selectedFiles.length > 0 || selectedImages.length > 0) && (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {selectedImages.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image.preview}
                alt={`Preview ${index + 1}`}
                className="h-20 w-20 object-cover rounded cursor-pointer"
                onClick={() => handleImagePreview(image)}
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
            >
              <FileText className="h-4 w-4" />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept="image/*,.pdf,.txt,.doc,.docx"
        />
        <input
          type="file"
          ref={documentInputRef}
          onChange={handleDocumentSelect}
          className="hidden"
          accept=".pdf"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDocumentButtonClick}
          disabled={disabled || isSending}
          className="h-8 w-8"
        >
          <FileText className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFileButtonClick}
          disabled={disabled || isSending}
          className="h-8 w-8"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          className={`flex-1 ${dark ? 'bg-gray-700 text-white' : 'bg-gray-100'}`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMicClick}
          disabled={disabled || isSending}
          className={`text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${
            isRecording ? 'text-red-500' : ''
          }`}
        >
          {isTranscribing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Mic size={20} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSend}
          disabled={disabled || isSending || (!message.trim() && selectedFiles.length === 0 && selectedImages.length === 0)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {isSending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </Button>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative w-full h-[60vh]">
              <img
                src={previewImage.preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}