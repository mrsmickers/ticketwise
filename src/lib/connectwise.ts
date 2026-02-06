import { cookies } from "next/headers";
import { env } from "./env";

/**
 * ConnectWise API client that uses the user's session cookies
 * for authentication - inherits their permissions automatically.
 */

type CWRequestOptions = {
  conditions?: string;
  orderBy?: string;
  pageSize?: number;
  page?: number;
  fields?: string[];
};

function buildUrl(endpoint: string, options?: CWRequestOptions): string {
  const base = `https://${env.CW_COMPANY_URL}/${env.CW_CODE_BASE}/apis/3.0`;
  const url = new URL(`${base}${endpoint}`);
  
  if (options?.conditions) {
    url.searchParams.set("conditions", options.conditions);
  }
  if (options?.orderBy) {
    url.searchParams.set("orderBy", options.orderBy);
  }
  if (options?.pageSize) {
    url.searchParams.set("pageSize", String(options.pageSize));
  }
  if (options?.page) {
    url.searchParams.set("page", String(options.page));
  }
  if (options?.fields?.length) {
    url.searchParams.set("fields", options.fields.join(","));
  }
  
  return url.toString();
}

async function getHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  return {
    "clientId": env.CW_CLIENT_ID,
    "Cookie": cookieStore.toString(),
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

export async function cwGet<T>(endpoint: string, options?: CWRequestOptions): Promise<T> {
  const url = buildUrl(endpoint, options);
  const headers = await getHeaders();
  
  const response = await fetch(url, { headers, cache: "no-store" });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ConnectWise API error (${response.status}): ${error}`);
  }
  
  return response.json();
}

export async function cwPost<T>(endpoint: string, body: unknown): Promise<T> {
  const url = buildUrl(endpoint);
  const headers = await getHeaders();
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ConnectWise API error (${response.status}): ${error}`);
  }
  
  return response.json();
}

// ============ Ticket Types ============

export interface CWTicket {
  id: number;
  summary: string;
  board?: { id: number; name: string };
  status?: { id: number; name: string };
  priority?: { id: number; name: string };
  company?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  contactName?: string;
  contactPhoneNumber?: string;
  contactEmailAddress?: string;
  type?: { id: number; name: string };
  subType?: { id: number; name: string };
  item?: { id: number; name: string };
  resources?: string;
  owner?: { id: number; identifier: string; name: string };
  dateEntered?: string;
  lastUpdated?: string;
  requiredDate?: string;
  budgetHours?: number;
  actualHours?: number;
  recordType?: string;
  severity?: string;
  impact?: string;
  externalXRef?: string;
  poNumber?: string;
  customFields?: Array<{ id: number; caption: string; value: string }>;
  _info?: { lastUpdated: string };
}

export interface CWTicketNote {
  id: number;
  ticketId: number;
  text: string;
  detailDescriptionFlag?: boolean;
  internalAnalysisFlag?: boolean;
  resolutionFlag?: boolean;
  issueFlag?: boolean;
  member?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  customerUpdatedFlag?: boolean;
  processNotifications?: boolean;
  dateCreated?: string;
  createdBy?: string;
  internalFlag?: boolean;
  externalFlag?: boolean;
}

export interface CWConfiguration {
  id: number;
  name: string;
  type?: { id: number; name: string };
  status?: { id: number; name: string };
  company?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  site?: { id: number; name: string };
  serialNumber?: string;
  modelNumber?: string;
  tagNumber?: string;
  vendorNotes?: string;
  notes?: string;
  lastLoginName?: string;
  osType?: string;
  osInfo?: string;
  cpuSpeed?: string;
  ram?: string;
  localHardDrives?: string;
  questions?: Array<{ questionId: number; question: string; answer: string }>;
}

// ============ API Functions ============

export async function getTicket(ticketId: number): Promise<CWTicket> {
  return cwGet<CWTicket>(`/service/tickets/${ticketId}`);
}

export async function getTicketNotes(ticketId: number): Promise<CWTicketNote[]> {
  // Use allNotes endpoint to get all note types (description, internal, resolution, etc.)
  return cwGet<CWTicketNote[]>(`/service/tickets/${ticketId}/allNotes`, {
    orderBy: "dateCreated asc",
    pageSize: 100,
  });
}

export async function getTicketConfigurations(ticketId: number): Promise<CWConfiguration[]> {
  return cwGet<CWConfiguration[]>(`/service/tickets/${ticketId}/configurations`);
}

export async function searchTickets(conditions: string, options?: Omit<CWRequestOptions, "conditions">): Promise<CWTicket[]> {
  return cwGet<CWTicket[]>("/service/tickets", { conditions, ...options });
}

export async function getConfiguration(configId: number): Promise<CWConfiguration> {
  return cwGet<CWConfiguration>(`/company/configurations/${configId}`);
}

export async function getConfigurationTickets(configId: number): Promise<CWTicket[]> {
  // Search tickets that have this configuration attached
  return searchTickets(`configurations/id=${configId}`, {
    orderBy: "dateEntered desc",
    pageSize: 50,
  });
}

export async function searchSimilarTickets(
  summary: string,
  companyId?: number,
  excludeTicketId?: number,
  daysBack: number = 90
): Promise<CWTicket[]> {
  // Build conditions - search in summary and look for similar issues
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysBack);
  const dateStr = dateThreshold.toISOString().split("T")[0];
  
  // Extract key terms from summary (simplified - could use NLP)
  const keywords = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5);
  
  let conditions = `dateEntered>=[${dateStr}]`;
  
  if (companyId) {
    conditions += ` and company/id=${companyId}`;
  }
  
  if (excludeTicketId) {
    conditions += ` and id!=${excludeTicketId}`;
  }
  
  // Add keyword search - CW uses 'like' for partial matches
  if (keywords.length > 0) {
    const keywordCondition = keywords.map(k => `summary like "%${k}%"`).join(" or ");
    conditions += ` and (${keywordCondition})`;
  }
  
  return searchTickets(conditions, {
    orderBy: "dateEntered desc",
    pageSize: 20,
  });
}
