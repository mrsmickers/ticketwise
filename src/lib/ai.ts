import OpenAI from "openai";
import { env } from "./env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// ============ System Prompts ============

const SYSTEM_PROMPT = `You are TicketWise, an AI assistant for IT service desk technicians using ConnectWise PSA.

Your role is to help technicians work more efficiently by:
- Summarising tickets clearly and concisely
- Suggesting troubleshooting steps and solutions
- Identifying patterns from similar past tickets
- Highlighting important details they might miss
- Recommending next actions

CRITICAL RULES:
- ONLY use information explicitly stated in the ticket data provided.
- NEVER invent technician names, dates, steps taken, or details not in the data.
- If information is missing or unclear, say "Not stated in ticket" or "Unknown".
- Quote specific notes/entries when referencing what was tried or discussed.
- If asked about something not in the ticket, clearly state the information is not available.

Guidelines:
- Be concise but thorough. Technicians are busy.
- Use bullet points and clear structure.
- When suggesting solutions, prioritise quick wins first.
- Reference specific details from ticket NOTES, not just the summary.
- Consider the full conversation history in the notes.
- Use British English spelling (e.g. colour, prioritise, organisation).

Format your responses in Markdown for readability.`;

// ============ Slash Command Prompts ============

export const SLASH_COMMANDS: Record<string, { description: string; prompt: string }> = {
  "/summary": {
    description: "Summarise this ticket",
    prompt: "Provide a clear, concise summary of this ticket. Include: the core issue, what's been tried, current status, and any blockers.",
  },
  "/suggest": {
    description: "Suggest troubleshooting steps",
    prompt: "Based on this ticket, suggest the most likely troubleshooting steps to resolve the issue. Prioritise quick wins and common solutions first. Consider what's already been tried.",
  },
  "/next": {
    description: "Recommend next steps",
    prompt: "What should the technician do next with this ticket? Consider: urgency, what's pending, who needs to be contacted, and any escalation needs.",
  },
  "/similar": {
    description: "Analyse similar tickets for patterns",
    prompt: "Analyse the similar tickets provided. Look for: common causes, successful resolutions, recurring patterns, and any relevant knowledge that could help resolve the current ticket.",
  },
  "/config": {
    description: "Analyse configuration history",
    prompt: "Analyse the ticket history for this configuration/device. Look for: recurring issues, patterns, previous solutions that worked, and any underlying problems that might need addressing.",
  },
  "/draft": {
    description: "Draft a customer response",
    prompt: "Draft a professional, friendly response to send to the customer. Acknowledge their issue, explain what's being done or next steps, and set appropriate expectations.",
  },
  "/escalate": {
    description: "Prepare escalation notes",
    prompt: "Prepare concise escalation notes for this ticket. Include: issue summary, what's been tried, current findings, and specific questions for the escalation team.",
  },
  "/5whys": {
    description: "Root cause analysis (5 Whys)",
    prompt: `Perform a 5 Whys root cause analysis on this ticket to identify the underlying cause of the issue.

Structure your analysis as follows:

**Problem Statement:** Clearly state the problem from the ticket.

**The 5 Whys:**
1. **Why did [problem] occur?** → [Answer based on ticket evidence]
2. **Why did [answer 1] happen?** → [Answer based on ticket evidence or logical inference]
3. **Why did [answer 2] happen?** → [Continue drilling down]
4. **Why did [answer 3] happen?** → [Continue drilling down]
5. **Why did [answer 4] happen?** → [Root cause identified]

**Root Cause:** State the identified root cause clearly.

**Recommendations:** Based on this analysis, suggest:
- Immediate fix for this ticket
- Preventive measures to stop recurrence
- Any process/training improvements

IMPORTANT: Only use information from the ticket. Where you must infer or make assumptions, clearly state "Possible cause (not confirmed):" and explain your reasoning. If there isn't enough information to complete all 5 levels, stop where the evidence ends and note what additional investigation is needed.`,
  },
};

// ============ Chat Functions ============

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  ticketContext: string;
  similarTickets?: string;
  configHistory?: string;
  slashCommand?: string;
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions
): Promise<string> {
  // Build context message
  let contextMessage = `# Current Ticket\n\n${options.ticketContext}`;
  
  if (options.similarTickets) {
    contextMessage += `\n\n# Similar Tickets\n\n${options.similarTickets}`;
  }
  
  if (options.configHistory) {
    contextMessage += `\n\n# Configuration History\n\n${options.configHistory}`;
  }

  // Build messages array
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextMessage },
  ];

  // Add conversation history
  for (const msg of messages) {
    // If there's a slash command, inject its prompt
    if (msg.role === "user" && options.slashCommand && msg === messages[messages.length - 1]) {
      const command = SLASH_COMMANDS[options.slashCommand];
      if (command) {
        apiMessages.push({
          role: "user",
          content: `${command.prompt}\n\nUser query: ${msg.content || "(no additional context)"}`,
        });
        continue;
      }
    }
    
    apiMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: apiMessages,
    temperature: 0.3,
    max_completion_tokens: 2000,
  });

  return completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
}

/**
 * Stream chat response for real-time display.
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions
): AsyncGenerator<string> {
  // Build context message
  let contextMessage = `# Current Ticket\n\n${options.ticketContext}`;
  
  if (options.similarTickets) {
    contextMessage += `\n\n# Similar Tickets\n\n${options.similarTickets}`;
  }
  
  if (options.configHistory) {
    contextMessage += `\n\n# Configuration History\n\n${options.configHistory}`;
  }

  // Build messages array
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextMessage },
  ];

  // Add conversation history
  for (const msg of messages) {
    if (msg.role === "user" && options.slashCommand && msg === messages[messages.length - 1]) {
      const command = SLASH_COMMANDS[options.slashCommand];
      if (command) {
        apiMessages.push({
          role: "user",
          content: `${command.prompt}\n\nUser query: ${msg.content || "(no additional context)"}`,
        });
        continue;
      }
    }
    
    apiMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  const stream = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: apiMessages,
    temperature: 0.3,
    max_completion_tokens: 2000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
