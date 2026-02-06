"use server";

import { chat, SLASH_COMMANDS, type ChatMessage } from "@/lib/ai";
import {
  getTicketContext,
  findSimilarCompanyTickets,
  findSimilarGlobalTickets,
  getConfigTicketHistory,
  formatTicketForAI,
} from "./ticket";
import type { CWTicket } from "@/lib/connectwise";

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
 * Format similar tickets for AI context.
 */
function formatSimilarTickets(tickets: CWTicket[]): string {
  if (tickets.length === 0) return "";
  
  let text = "";
  for (const ticket of tickets.slice(0, 10)) {
    text += `## Ticket #${ticket.id}: ${ticket.summary}\n`;
    text += `- Status: ${ticket.status?.name || "Unknown"}\n`;
    text += `- Company: ${ticket.company?.name || "Unknown"}\n`;
    text += `- Date: ${ticket.dateEntered || "Unknown"}\n`;
    text += `- Type: ${ticket.type?.name || "Unknown"}\n\n`;
  }
  return text;
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
    // Get similar tickets from same company first
    const companyTickets = await findSimilarCompanyTickets(
      ticketId,
      ticketContext.ticket.summary,
      ticketContext.ticket.company?.id || 0
    );
    
    // If not enough, search globally
    let globalTickets: CWTicket[] = [];
    if (companyTickets.length < 5) {
      globalTickets = await findSimilarGlobalTickets(
        ticketId,
        ticketContext.ticket.summary
      );
    }
    
    const allSimilar = [...companyTickets, ...globalTickets.slice(0, 5 - companyTickets.length)];
    if (allSimilar.length > 0) {
      chatOptions.similarTickets = formatSimilarTickets(allSimilar);
    }
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
