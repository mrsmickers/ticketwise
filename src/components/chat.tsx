"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { processChat, getSlashCommands } from "@/actions/chat";
import type { ChatMessage } from "@/lib/ai";

interface ChatProps {
  ticketId: number;
  isAuthenticated: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  slashCommand?: string;
}

interface SlashCommand {
  command: string;
  description: string;
}

export function Chat({ ticketId, isAuthenticated }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load slash commands
  useEffect(() => {
    getSlashCommands().then(setCommands);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show commands dropdown when typing /
  useEffect(() => {
    setShowCommands(input.startsWith("/") && input.length > 0);
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isAuthenticated) return;
    
    const userMessage = input.trim();
    setInput("");
    setError(null);
    setShowCommands(false);
    
    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    
    setIsLoading(true);
    
    try {
      // Convert messages to API format
      const chatHistory: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      const response = await processChat({
        ticketId,
        messages: chatHistory,
        userMessage,
      });
      
      // Add assistant message
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        slashCommand: response.slashCommand,
      };
      setMessages(prev => [...prev, assistantMsg]);
      
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommandClick = (cmd: string) => {
    setInput(cmd + " ");
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const filteredCommands = commands.filter(c => 
    c.command.toLowerCase().includes(input.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Authenticating with ConnectWise...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            <p className="font-medium mb-2">Welcome to TicketWise</p>
            <p>Ask me anything about this ticket, or try:</p>
            <div className="flex flex-wrap justify-center gap-1 mt-2">
              {commands.slice(0, 4).map(cmd => (
                <button
                  key={cmd.command}
                  onClick={() => handleCommandClick(cmd.command)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
                >
                  {cmd.command}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-[#222E40] text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {msg.slashCommand && (
                <div className="text-xs opacity-60 mb-1">
                  {msg.slashCommand}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="text-red-500 text-sm text-center">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="border-t p-2 relative">
        {/* Commands dropdown */}
        {showCommands && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredCommands.map(cmd => (
              <button
                key={cmd.command}
                onClick={() => handleCommandClick(cmd.command)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="font-mono text-sm text-[#222E40]">{cmd.command}</span>
                <span className="text-xs text-gray-500">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this ticket... (try /summary)"
            disabled={isLoading}
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#222E40] focus:border-transparent disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[#222E40] text-white rounded-lg text-sm font-medium hover:bg-[#1a2433] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
