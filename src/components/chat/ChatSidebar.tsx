/**
 * ChatSidebar.tsx
 * Sidebar component for the chat interface. Displays list of threads and thread management options.
 * Handles thread selection, creation, deletion, and renaming.
 * Features responsive design and collapsible functionality.
 */
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Trash, Settings, Loader2, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { useIsAdmin } from "@/lib/auth";
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactDOM from "react-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Thread = {
  id: string;
  title: string;
  updatedAt: Date;
};

type ChatSidebarProps = {
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => Promise<void>;
  onRenameThread: (threadId: string, newName: string) => Promise<void>;
  isLoading?: boolean;
  onToggleSidebar: () => void;
};

export default function ChatSidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  isLoading = false,
  onToggleSidebar,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Add useOnClickOutside for menu
  useOnClickOutside(menuRef, () => {
    if (menuOpen) {
      setMenuOpen(null);
      setMenuPosition(null);
    }
  });

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Rename logic
  const handleRename = (threadId: string, currentTitle: string) => {
    setRenamingId(threadId);
    setRenameValue(currentTitle);
    setMenuOpen(null);
    setMenuPosition(null);
  };

  const handleRenameSave = async (threadId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      setRenameValue("");
      return;
    }

    const currentThread = threads.find(t => t.id === threadId);
    if (trimmed === currentThread?.title) {
      setRenamingId(null);
      setRenameValue("");
      return;
    }

    try {
      setIsRenaming(threadId);
      await onRenameThread(threadId, trimmed);
    } catch (error) {
      console.error('Failed to rename thread:', error);
      // Optionally show an error toast here
    } finally {
      setIsRenaming(null);
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = async (threadId: string) => {
    try {
      setIsDeleting(threadId);
      await onDeleteThread(threadId);
    } catch (error) {
      console.error('Failed to delete thread:', error);
      // Optionally show an error toast here
    } finally {
      setIsDeleting(null);
      setDeleteDialogOpen(null);
    }
  };

  // Normalize thread IDs
  const normalizedThreads = threads.map(thread => ({
    ...thread,
    id: String(thread.id || (thread as any)._id),
  }));

  return (
    <div className="h-screen flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 min-h-[56px]">
        <button
          className="p-1 rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-xl-heavy"><path fillRule="evenodd" clipRule="evenodd" d="M8.85719 3H15.1428C16.2266 2.99999 17.1007 2.99998 17.8086 3.05782C18.5375 3.11737 19.1777 3.24318 19.77 3.54497C20.7108 4.02433 21.4757 4.78924 21.955 5.73005C22.2568 6.32234 22.3826 6.96253 22.4422 7.69138C22.5 8.39925 22.5 9.27339 22.5 10.3572V13.6428C22.5 14.7266 22.5 15.6008 22.4422 16.3086C22.3826 17.0375 22.2568 17.6777 21.955 18.27C21.4757 19.2108 20.7108 19.9757 19.77 20.455C19.1777 20.7568 18.5375 20.8826 17.8086 20.9422C17.1008 21 16.2266 21 15.1428 21H8.85717C7.77339 21 6.89925 21 6.19138 20.9422C5.46253 20.8826 4.82234 20.7568 4.23005 20.455C3.28924 19.9757 2.52433 19.2108 2.04497 18.27C1.74318 17.6777 1.61737 17.0375 1.55782 16.3086C1.49998 15.6007 1.49999 14.7266 1.5 13.6428V10.3572C1.49999 9.27341 1.49998 8.39926 1.55782 7.69138C1.61737 6.96253 1.74318 6.32234 2.04497 5.73005C2.52433 4.78924 3.28924 4.02433 4.23005 3.54497C4.82234 3.24318 5.46253 3.11737 6.19138 3.05782C6.89926 2.99998 7.77341 2.99999 8.85719 3ZM6.35424 5.05118C5.74907 5.10062 5.40138 5.19279 5.13803 5.32698C4.57354 5.6146 4.1146 6.07354 3.82698 6.63803C3.69279 6.90138 3.60062 7.24907 3.55118 7.85424C3.50078 8.47108 3.5 9.26339 3.5 10.4V13.6C3.5 14.7366 3.50078 15.5289 3.55118 16.1458C3.60062 16.7509 3.69279 17.0986 3.82698 17.362C4.1146 17.9265 4.57354 18.3854 5.13803 18.673C5.40138 18.8072 5.74907 18.8994 6.35424 18.9488C6.97108 18.9992 7.76339 19 8.9 19H9.5V5H8.9C7.76339 5 6.97108 5.00078 6.35424 5.05118ZM11.5 5V19H15.1C16.2366 19 17.0289 18.9992 17.6458 18.9488C18.2509 18.8994 18.5986 18.8072 18.862 18.673C19.4265 18.3854 19.8854 17.9265 20.173 17.362C20.3072 17.0986 20.3994 16.7509 20.4488 16.1458C20.4992 15.5289 20.5 14.7366 20.5 13.6V10.4C20.5 9.26339 20.4992 8.47108 20.4488 7.85424C20.3994 7.24907 20.3072 6.90138 20.173 6.63803C19.8854 6.07354 19.4265 5.6146 18.862 5.32698C18.5986 5.19279 18.2509 5.10062 17.6458 5.05118C17.0289 5.00078 16.2366 5 15.1 5H11.5ZM5 8.5C5 7.94772 5.44772 7.5 6 7.5H7C7.55229 7.5 8 7.94772 8 8.5C8 9.05229 7.55229 9.5 7 9.5H6C5.44772 9.5 5 9.05229 5 8.5ZM5 12C5 11.4477 5.44772 11 6 11H7C7.55229 11 8 11.4477 8 12C8 12.5523 7.55229 13 7 13H6C5.44772 13 5 12.5523 5 12Z" fill="currentColor"></path></svg>
        </button>
      </div>

      {/* Thread Actions (New Chat and Admin Dashboard stacked vertically for admins) */}
      <div className="p-3 mb-4 flex flex-col gap-2">
        <Button 
          onClick={onNewThread} 
          className="w-full"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          New Chat
        </Button>
        
        {/* Only show admin dashboard button if user is admin */}
        {!isAdminLoading && isAdmin && (
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => navigate("/dashboard")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Admin Dashboard
          </Button>
        )}
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : normalizedThreads.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            normalizedThreads.map((thread, idx) => {
              // Show menu upwards for the last 4 threads
              const openUp = idx >= normalizedThreads.length - 4;
              return (
                <div
                  key={thread.id}
                  className={`
                    px-4 py-3 text-sm mb-1 mx-2 rounded-md cursor-pointer
                    flex justify-between items-center
                    group relative
                    ${selectedThreadId === thread.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50 text-sidebar-foreground"}
                  `}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <span className="flex-1">
                    {renamingId === thread.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={renameInputRef}
                          className="w-full px-1 py-0.5 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary text-black dark:text-white bg-white dark:bg-[#222]"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSave(thread.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSave(thread.id);
                            if (e.key === 'Escape') handleRenameCancel();
                          }}
                        />
                        {isRenaming === thread.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <button
                            className="p-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded"
                            onClick={e => {
                              e.stopPropagation();
                              handleRenameCancel();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      thread.title && thread.title.length > 20
                        ? thread.title.slice(0, 20) + '...'
                        : thread.title
                    )}
                  </span>
                  <div className="relative">
                    <button
                      className="p-1 rounded-full hover:bg-muted focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => {
                        e.stopPropagation();
                        if (menuOpen === thread.id) {
                          setMenuOpen(null);
                          setMenuPosition(null);
                        } else {
                          setMenuOpen(thread.id);
                          // Get button position for portal menu
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          const windowHeight = window.innerHeight;
                          const menuHeight = 70; // Approximate menu height
                          // Calculate position to ensure menu stays in viewport
                          let top = rect.top;
                          if (openUp) {
                            top = Math.max(rect.top - menuHeight, 10);
                          } else {
                            top = Math.min(rect.top, windowHeight - menuHeight - 10);
                          }
                          setMenuPosition({
                            top,
                            left: rect.right + 8 // 8px gap
                          });
                        }
                      }}
                    >
                      {isDeleting === thread.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <MoreVertical className="w-5 h-5" />
                      )}
                    </button>
                    {menuOpen === thread.id && menuPosition && ReactDOM.createPortal(
                      <div
                        ref={menuRef}
                        className="fixed z-50 w-28 min-h-[70px] bg-white dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl py-2 px-1 flex flex-col gap-1 animate-fade-in"
                        style={{
                          top: menuPosition.top,
                          left: menuPosition.left + 2,
                          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)'
                        }}
                      >
                        <button
                          className="flex items-center justify-center gap-1.5 w-full text-left px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors text-sm"
                          onClick={e => { e.stopPropagation(); setMenuOpen(null); setMenuPosition(null); handleRename(thread.id, thread.title); }}
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                          <span>Rename</span>
                        </button>
                        <button
                          className="flex items-center justify-center gap-1.5 w-full text-left px-1.5 py-1 text-red-600 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors text-sm"
                          onClick={e => { e.stopPropagation(); setMenuOpen(null); setMenuPosition(null); setDeleteDialogOpen(thread.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialogOpen} onOpenChange={() => setDeleteDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this thread? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogOpen && handleDelete(deleteDialogOpen)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
