import type { CWTicket, CWTicketNote, CWConfiguration } from "./connectwise";

export interface TicketContext {
  ticket: CWTicket;
  notes: CWTicketNote[];
  configurations: CWConfiguration[];
}

/**
 * Format ticket context as text for AI prompt.
 */
export function formatTicketForAI(context: TicketContext): string {
  const { ticket, notes, configurations } = context;
  
  let text = `# Ticket #${ticket.id}: ${ticket.summary}\n\n`;
  
  // Ticket metadata
  text += `## Details\n`;
  text += `- **Company:** ${ticket.company?.name || "Unknown"}\n`;
  text += `- **Contact:** ${ticket.contactName || ticket.contact?.name || "Unknown"}\n`;
  text += `- **Board:** ${ticket.board?.name || "Unknown"}\n`;
  text += `- **Status:** ${ticket.status?.name || "Unknown"}\n`;
  text += `- **Priority:** ${ticket.priority?.name || "Unknown"}\n`;
  text += `- **Type:** ${ticket.type?.name || "Unknown"}${ticket.subType ? ` > ${ticket.subType.name}` : ""}\n`;
  text += `- **Assigned To:** ${ticket.resources || ticket.owner?.name || "Unassigned"}\n`;
  text += `- **Created:** ${ticket.dateEntered || "Unknown"}\n`;
  text += `- **Last Updated:** ${ticket.lastUpdated || ticket._info?.lastUpdated || "Unknown"}\n`;
  
  if (ticket.budgetHours) {
    text += `- **Budget Hours:** ${ticket.budgetHours}\n`;
  }
  if (ticket.actualHours) {
    text += `- **Actual Hours:** ${ticket.actualHours}\n`;
  }
  
  // Custom fields
  if (ticket.customFields?.length) {
    text += `\n### Custom Fields\n`;
    for (const field of ticket.customFields) {
      if (field.value) {
        text += `- **${field.caption}:** ${field.value}\n`;
      }
    }
  }
  
  // Notes/conversation
  if (notes.length > 0) {
    text += `\n## Ticket Notes (${notes.length})\n\n`;
    
    for (const note of notes) {
      const noteType = note.detailDescriptionFlag ? "Description" :
                       note.internalAnalysisFlag ? "Internal" :
                       note.resolutionFlag ? "Resolution" : "Note";
      const author = note.member?.name || note.contact?.name || note.createdBy || "Unknown";
      const date = note.dateCreated ? new Date(note.dateCreated).toLocaleString() : "";
      
      text += `### ${noteType} by ${author}${date ? ` (${date})` : ""}\n`;
      text += `${note.text || "(empty)"}\n\n`;
    }
  }
  
  // Configurations
  if (configurations.length > 0) {
    text += `\n## Attached Configurations (${configurations.length})\n\n`;
    
    for (const config of configurations) {
      text += `### ${config.name} (${config.type?.name || "Unknown type"})\n`;
      text += `- **Status:** ${config.status?.name || "Unknown"}\n`;
      if (config.serialNumber) text += `- **Serial:** ${config.serialNumber}\n`;
      if (config.modelNumber) text += `- **Model:** ${config.modelNumber}\n`;
      if (config.osType || config.osInfo) text += `- **OS:** ${config.osType || ""} ${config.osInfo || ""}\n`;
      if (config.lastLoginName) text += `- **Last Login:** ${config.lastLoginName}\n`;
      if (config.notes) text += `- **Notes:** ${config.notes}\n`;
      text += `\n`;
    }
  }
  
  return text;
}

/**
 * Format similar tickets for AI context.
 */
export function formatSimilarTickets(tickets: CWTicket[]): string {
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
