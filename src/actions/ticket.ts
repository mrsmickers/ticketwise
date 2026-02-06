"use server";

import {
  getTicket,
  getTicketNotes,
  getTicketConfigurations,
  searchSimilarTickets,
  getConfigurationTickets,
  type CWTicket,
} from "@/lib/connectwise";
import type { TicketContext } from "@/lib/format";

export type { TicketContext };

/**
 * Get full ticket context including notes and configurations.
 */
export async function getTicketContext(ticketId: number): Promise<TicketContext> {
  console.log(`TicketWise: Fetching context for ticket ${ticketId}`);
  
  const [ticket, notes, configurations] = await Promise.all([
    getTicket(ticketId),
    getTicketNotes(ticketId),
    getTicketConfigurations(ticketId),
  ]);

  console.log(`TicketWise: Got ${notes.length} notes, ${configurations.length} configs`);
  
  return { ticket, notes, configurations };
}

/**
 * Search for similar tickets at the same company.
 */
export async function findSimilarCompanyTickets(
  ticketId: number,
  summary: string,
  companyId: number
): Promise<CWTicket[]> {
  return searchSimilarTickets(summary, companyId, ticketId, 90);
}

/**
 * Search for similar tickets across all companies (recent).
 */
export async function findSimilarGlobalTickets(
  ticketId: number,
  summary: string
): Promise<CWTicket[]> {
  return searchSimilarTickets(summary, undefined, ticketId, 14);
}

/**
 * Get ticket history for a configuration.
 */
export async function getConfigTicketHistory(configId: number): Promise<CWTicket[]> {
  return getConfigurationTickets(configId);
}
