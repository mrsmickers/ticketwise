"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { z } from "zod";

// ============ Type Definitions ============

const MemberAuthSchema = z.object({
  codeBase: z.string().optional(),
  companyid: z.string(),
  memberContext: z.string(),
  memberEmail: z.string(),
  memberid: z.string(),
  memberHash: z.string(),
  site: z.string(),
  ssoAccessToken: z.string().optional(),
  ssoIdToken: z.string().optional(),
});

export type MemberAuth = z.infer<typeof MemberAuthSchema>;

const ScreenObjectSchema = z.object({
  hostedAs: z.enum(["pod", "tab"]),
  id: z.union([z.string(), z.number()]),
  screen: z.enum(["ticket", "company", "contact", "salesorder"]),
});

export type ScreenObject = z.infer<typeof ScreenObjectSchema>;

// ============ Hook ============

interface UseHostedApiOptions {
  onReady?: () => void;
  onAuth?: (auth: MemberAuth) => void;
  onError?: (error: Error) => void;
}

interface UseHostedApiReturn {
  isReady: boolean;
  isAuthenticated: boolean;
  auth: MemberAuth | null;
  frameId: string | null;
  requestAuth: () => void;
  refreshScreen: () => void;
}

export function useHostedApi(options: UseHostedApiOptions = {}): UseHostedApiReturn {
  const [isReady, setIsReady] = useState(false);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [auth, setAuth] = useState<MemberAuth | null>(null);
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  
  const { onReady, onAuth, onError } = options;

  // Post message to parent ConnectWise window
  const postToParent = useCallback((message: object) => {
    if (typeof window === "undefined" || window === window.parent) {
      console.warn("TicketWise: Not running in iframe");
      return;
    }
    
    const payload = { ...message, frameID: frameId };
    window.parent.postMessage(JSON.stringify(payload), "*");
  }, [frameId]);

  // Request member authentication from CW
  const requestAuth = useCallback(() => {
    postToParent({ hosted_request: "getMemberAuthentication" });
    
    // Also send without frameID for Nilear compatibility
    if (typeof window !== "undefined" && window !== window.parent) {
      window.parent.postMessage(
        JSON.stringify({ hosted_request: "getMemberAuthentication" }),
        "*"
      );
    }
  }, [postToParent]);

  // Request screen refresh
  const refreshScreen = useCallback(() => {
    postToParent({ hosted_request: "refreshScreen" });
  }, [postToParent]);

  // Set up message listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Don't re-add listener
    if (messageListenerRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        // Handle frame ID assignment
        if (data.MessageFrameID) {
          setFrameId(data.MessageFrameID);
          setIsReady(true);
          onReady?.();
          return;
        }
        
        // Handle auth response
        if (data.response === "getmemberauthentication" && data.data) {
          const parsed = MemberAuthSchema.safeParse(data.data);
          if (parsed.success) {
            setAuth(parsed.data);
            onAuth?.(parsed.data);
          } else {
            console.error("TicketWise: Invalid auth data", parsed.error);
            onError?.(new Error("Invalid authentication data from ConnectWise"));
          }
          return;
        }
        
        // Handle events (onLoad, beforeSave)
        if (data.event) {
          console.log("TicketWise: Event received", data.event);
          // Acknowledge the event
          window.parent.postMessage(
            JSON.stringify({
              event: data.event,
              _id: data._id,
              result: "success",
            }),
            "*"
          );
        }
      } catch (e) {
        // Not a JSON message or not for us - ignore
      }
    };

    messageListenerRef.current = handleMessage;
    window.addEventListener("message", handleMessage);

    // Send ready message to parent
    if (window !== window.parent) {
      window.parent.postMessage(JSON.stringify({ message: "ready" }), "*");
    }

    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener("message", messageListenerRef.current);
        messageListenerRef.current = null;
      }
    };
  }, [onReady, onAuth, onError]);

  return {
    isReady,
    isAuthenticated: auth !== null,
    auth,
    frameId,
    requestAuth,
    refreshScreen,
  };
}
