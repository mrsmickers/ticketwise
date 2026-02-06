import { z } from "zod";

const envSchema = z.object({
  // ConnectWise
  CW_CLIENT_ID: z.string().min(1, "ConnectWise Client ID required"),
  CW_COMPANY_URL: z.string().min(1, "ConnectWise Company URL required"),
  CW_CODE_BASE: z.string().default("v4_6_release"),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key required"),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Validate at runtime
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
