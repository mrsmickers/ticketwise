import { cookies } from "next/headers";
import { env } from "./env";

/**
 * ConnectWise API client that uses API key authentication
 * with member impersonation based on the logged-in user's cookies.
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
  
  // Get the logged-in member's ID for impersonation
  const memberId = cookieStore.get("memberId")?.value;
  
  // Build Basic auth from API credentials
  // Format: companyId+publicKey:privateKey
  const authString = `${env.CW_COMPANY_ID}+${env.CW_PUBLIC_KEY}:${env.CW_PRIVATE_KEY}`;
  const basicAuth = Buffer.from(authString).toString("base64");
  
  const headers: HeadersInit = {
    "Authorization": `Basic ${basicAuth}`,
    "clientId": env.CW_CLIENT_ID,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  
  // Add member impersonation header if we have a logged-in member
  if (memberId) {
    headers["x-cw-usertype"] = "member";
    headers["x-cw-memberhash"] = memberId;
  }
  
  return headers;
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
  initialDescription?: string;
  initialInternalAnalysis?: string;
  initialResolution?: string;
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
  // Note: allNotes doesn't support orderBy, so we sort client-side
  const notes = await cwGet<CWTicketNote[]>(`/service/tickets/${ticketId}/allNotes`, {
    pageSize: 100,
  });
  
  // Sort by dateCreated ascending
  return notes.sort((a, b) => {
    const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
    const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
    return dateA - dateB;
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
  // CW API doesn't support searching tickets by configuration ID directly.
  // Instead: get the config details, then search tickets by config name/serial (like /similar does)
  
  // First get the configuration details
  const config = await getConfiguration(configId);
  
  // Build search terms from config identifiers
  const searchTerms: string[] = [];
  
  // Config name is usually the device hostname - most useful
  if (config.name && config.name.length > 2) {
    searchTerms.push(config.name);
  }
  
  // Serial number if present
  if (config.serialNumber && config.serialNumber.length > 3) {
    searchTerms.push(config.serialNumber);
  }
  
  // If no searchable terms, we can't find related tickets
  if (searchTerms.length === 0) {
    return [];
  }
  
  // Search for tickets mentioning any of these identifiers (same approach as /similar)
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - 180); // 6 months back
  const dateStr = dateThreshold.toISOString().split("T")[0];
  
  // Build condition: tickets from last 6 months containing config name or serial
  const keywordCondition = searchTerms.map(term => `summary like "%${term}%"`).join(" or ");
  const conditions = `dateEntered>=[${dateStr}] and (${keywordCondition})`;
  
  return searchTickets(conditions, {
    orderBy: "dateEntered desc",
    pageSize: 30,
    fields: ["id", "summary", "status", "company", "dateEntered", "type", "initialDescription", "initialResolution"],
  });
}

// Common words to exclude from keyword matching
const STOP_WORDS = new Set([
  "user", "issue", "problem", "help", "need", "please", "urgent", "asap",
  "working", "work", "able", "unable", "cannot", "error", "having", "getting",
  "need", "wants", "requested", "request", "support", "ticket", "client",
  "customer", "company", "staff", "employee", "team", "office", "site",
]);

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
  
  // Extract meaningful keywords (filter stop words)
  const keywords = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 4);
  
  // If no meaningful keywords, don't search
  if (keywords.length === 0) {
    return [];
  }
  
  let conditions = `dateEntered>=[${dateStr}]`;
  
  if (companyId) {
    conditions += ` and company/id=${companyId}`;
  }
  
  if (excludeTicketId) {
    conditions += ` and id!=${excludeTicketId}`;
  }
  
  // Add keyword search - CW uses 'like' for partial matches
  const keywordCondition = keywords.map(k => `summary like "%${k}%"`).join(" or ");
  conditions += ` and (${keywordCondition})`;
  
  // Fetch tickets - we'll sort to prioritise closed ones
  const tickets = await searchTickets(conditions, {
    orderBy: "dateEntered desc",
    pageSize: 20,
    fields: ["id", "summary", "status", "company", "dateEntered", "type", "initialDescription", "initialResolution"],
  });
  
  // Sort to put closed/resolved tickets first (they have solutions!)
  const closedStatuses = ["closed", "resolved", "completed"];
  return tickets.sort((a, b) => {
    const aIsClosed = closedStatuses.some(s => a.status?.name?.toLowerCase().includes(s));
    const bIsClosed = closedStatuses.some(s => b.status?.name?.toLowerCase().includes(s));
    if (aIsClosed && !bIsClosed) return -1;
    if (!aIsClosed && bIsClosed) return 1;
    return 0;
  });
}
