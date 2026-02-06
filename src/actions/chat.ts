"use server";

import { cookies } from "next/headers";
import { chat, SLASH_COMMANDS, type ChatMessage } from "@/lib/ai";
import {
  getTicketContext,
  findSimilarCompanyTickets,
  findSimilarGlobalTickets,
  getConfigTicketHistory,
} from "./ticket";
import { formatTicketForAI, formatSimilarTickets, formatSimilarTicketsWithNotes } from "@/lib/format";
import type { CWTicket } from "@/lib/connectwise";

// Simple in-memory rate limiter
// In production, consider using Redis for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

export interface ChatRequest {
  ticketId: number;
  messages: ChatMessage[];
  userMessage: string;
}

export interface ChatResponse {
  message: string;
  slashCommand?: string;
}

/**
 * Detect slash command in user message.
 */
function detectSlashCommand(message: string): { command: string | null; content: string } {
  const trimmed = message.trim();
  
  for (const cmd of Object.keys(SLASH_COMMANDS)) {
    if (trimmed.toLowerCase().startsWith(cmd)) {
      const content = trimmed.slice(cmd.length).trim();
      return { command: cmd, content };
    }
  }
  
  return { command: null, content: message };
}

/**
 * Process a chat message and return AI response.
 */
export async function processChat(request: ChatRequest): Promise<ChatResponse> {
  // Rate limiting based on member ID
  const cookieStore = await cookies();
  const memberId = cookieStore.get("memberId")?.value || "anonymous";
  const { allowed, remaining } = checkRateLimit(memberId);
  
  if (!allowed) {
    return {
      message: "Rate limit exceeded. Please wait a moment before sending more messages.",
      slashCommand: undefined,
    };
  }
  
  const { ticketId, messages, userMessage } = request;
  
  // Detect slash command
  const { command, content } = detectSlashCommand(userMessage);
  
  // Get ticket context
  const ticketContext = await getTicketContext(ticketId);
  const ticketText = formatTicketForAI(ticketContext);
  
  // Prepare chat options
  const chatOptions: Parameters<typeof chat>[1] = {
    ticketContext: ticketText,
    slashCommand: command || undefined,
  };
  
  // Add additional context based on slash command
  if (command === "/similar") {
    // Get similar tickets from same company first (prioritise closed/resolved)
    const companyTickets = await findSimilarCompanyTickets(
      ticketId,
      ticketContext.ticket.summary,
      ticketContext.ticket.company?.id || 0
    );
    
    // If not enough from company, search globally but only recent
    let globalTickets: CWTicket[] = [];
    if (companyTickets.length < 3) {
      globalTickets = await findSimilarGlobalTickets(
        ticketId,
        ticketContext.ticket.summary
      );
    }
    
    const allSimilar = [...companyTickets, ...globalTickets.slice(0, 5 - companyTickets.length)];
    
    // If no similar tickets found, short-circuit with a quick response
    if (allSimilar.length === 0) {
      return {
        message: "No similar tickets found for this specific issue.",
        slashCommand: command,
      };
    }
    
    // For closed/resolved tickets, fetch their notes to find the actual resolution
    // (resolution is often in notes, not the initialResolution field)
    const ticketsWithNotes = await Promise.all(
      allSimilar.slice(0, 5).map(async (ticket) => {
        const isClosed = ["closed", "resolved", "completed"].some(
          s => ticket.status?.name?.toLowerCase().includes(s)
        );
        // Only fetch notes for closed tickets (they have solutions)
        if (isClosed) {
          const { getTicketNotes } = await import("@/lib/connectwise");
          const notes = await getTicketNotes(ticket.id);
          return { ticket, notes };
        }
        return { ticket, notes: [] };
      })
    );
    
    chatOptions.similarTickets = formatSimilarTicketsWithNotes(ticketsWithNotes);
  }
  
  if (command === "/config") {
    // Get config history if configurations are attached
    if (ticketContext.configurations.length > 0) {
      const configTickets: CWTicket[] = [];
      for (const config of ticketContext.configurations.slice(0, 3)) {
        const history = await getConfigTicketHistory(config.id);
        configTickets.push(...history.filter(t => t.id !== ticketId));
      }
      
      if (configTickets.length > 0) {
        chatOptions.configHistory = formatSimilarTickets(configTickets);
      }
    }
  }
  
  // Build messages array with user's message
  const allMessages: ChatMessage[] = [
    ...messages,
    { role: "user" as const, content: content || userMessage },
  ];
  
  // Get AI response
  const response = await chat(allMessages, chatOptions);
  
  return {
    message: response,
    slashCommand: command || undefined,
  };
}

/**
 * Get available slash commands.
 */
export async function getSlashCommands(): Promise<Array<{ command: string; description: string }>> {
  return Object.entries(SLASH_COMMANDS).map(([cmd, info]) => ({
    command: cmd,
    description: info.description,
  }));
}
