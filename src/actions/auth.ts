"use server";

import { cookies } from "next/headers";
import type { MemberAuth } from "@/hooks/use-hosted-api";

/**
 * Store ConnectWise member authentication in cookies.
 * These cookies are used by the ConnectWise API client to
 * authenticate requests with the user's permissions.
 */
export async function setAuthCookies(auth: MemberAuth): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  
  const cookieOptions = {
    path: "/",
    expires: new Date(Date.now() + 1000 * 60 * 60 * 8), // 8 hours
    sameSite: "none" as const,
    secure: true,
    httpOnly: true,
  };

  cookieStore.set("memberContext", auth.memberContext, cookieOptions);
  cookieStore.set("memberId", auth.memberid, cookieOptions);
  cookieStore.set("memberHash", auth.memberHash, cookieOptions);
  cookieStore.set("companyName", auth.companyid, cookieOptions);
  cookieStore.set("memberEmail", auth.memberEmail, cookieOptions);
  
  if (auth.codeBase) {
    cookieStore.set("codeBase", auth.codeBase, cookieOptions);
  }

  return { success: true };
}

/**
 * Clear authentication cookies (logout).
 */
export async function clearAuthCookies(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  
  cookieStore.delete("memberContext");
  cookieStore.delete("memberId");
  cookieStore.delete("memberHash");
  cookieStore.delete("companyName");
  cookieStore.delete("memberEmail");
  cookieStore.delete("codeBase");

  return { success: true };
}

/**
 * Check if user is authenticated.
 */
export async function checkAuth(): Promise<{ authenticated: boolean; memberId?: string; email?: string; debug?: string }> {
  const cookieStore = await cookies();
  
  // Get all cookie names for debugging
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name).join(", ");
  
  const memberHash = cookieStore.get("memberHash");
  const memberId = cookieStore.get("memberId");
  const email = cookieStore.get("memberEmail");
  
  console.log("TicketWise checkAuth - cookies found:", cookieNames);
  console.log("TicketWise checkAuth - memberHash:", memberHash?.value?.slice(0, 10) + "...");
  console.log("TicketWise checkAuth - memberId:", memberId?.value);
  
  if (memberHash?.value && memberId?.value) {
    return {
      authenticated: true,
      memberId: memberId.value,
      email: email?.value,
      debug: `Found cookies: ${cookieNames}`,
    };
  }
  
  return { authenticated: false, debug: `Cookies found: ${cookieNames || "none"}` };
}
