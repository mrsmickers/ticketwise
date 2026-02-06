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
  screenObject: ScreenObject | null;
  frameId: string | null;
  requestAuth: () => void;
  requestScreenObject: () => void;
  refreshScreen: () => void;
}

export function useHostedApi(options: UseHostedApiOptions = {}): UseHostedApiReturn {
  const [isReady, setIsReady] = useState(false);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [auth, setAuth] = useState<MemberAuth | null>(null);
  const [screenObject, setScreenObject] = useState<ScreenObject | null>(null);
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  
  const { onReady, onAuth, onError } = options;

  // Post message to parent ConnectWise window
  const postToParent = useCallback((message: object) => {
    if (typeof window === "undefined" || window === window.parent) {
      console.warn("TicketWise: Not running in iframe");
      return;
    }
    
    const payload = { ...message, frameID: frameId };
    console.log("TicketWise: Sending to parent", JSON.stringify(payload));
    // Send as plain object - CW expects object, not JSON string
    window.parent.postMessage(payload, "*");
  }, [frameId]);

  // Request member authentication from CW
  const requestAuth = useCallback(() => {
    postToParent({ hosted_request: "getMemberAuthentication" });
  }, [postToParent]);

  // Request screen object (record ID, screen type)
  const requestScreenObject = useCallback(() => {
    console.log("TicketWise: Requesting screen object");
    postToParent({ hosted_request: "getScreenObject" });
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
        
        // Debug: log all messages from parent
        console.log("TicketWise: Message received", JSON.stringify(data));
        
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
        
        // Handle screen object response
        if (data.response === "getscreenobject" && data.data) {
          console.log("TicketWise: Screen object received", data.data);
          const parsed = ScreenObjectSchema.safeParse(data.data);
          if (parsed.success) {
            setScreenObject(parsed.data);
          } else {
            console.error("TicketWise: Invalid screen object", parsed.error, data.data);
            // Try to extract manually if schema doesn't match exactly
            if (data.data.id || data.data.recordId) {
              setScreenObject({
                id: data.data.id || data.data.recordId,
                screen: data.data.screen || "ticket",
                hostedAs: data.data.hostedAs || "pod",
              } as ScreenObject);
            }
          }
          return;
        }
        
        // Handle events (onLoad, beforeSave)
        if (data.event) {
          console.log("TicketWise: Event received", data.event, data.data);
          
          // Extract screenObject from onLoad event
          if (data.event === "onLoad" && data.data?.screenObject) {
            console.log("TicketWise: Got screen object from onLoad", data.data.screenObject);
            const parsed = ScreenObjectSchema.safeParse(data.data.screenObject);
            if (parsed.success) {
              setScreenObject(parsed.data);
            } else {
              // Fallback: use raw data
              setScreenObject({
                id: data.data.screenObject.id,
                screen: data.data.screenObject.screen || "ticket",
                hostedAs: data.data.screenObject.hostedAs || "pod",
              } as ScreenObject);
            }
          }
          
          // Acknowledge the event
          window.parent.postMessage({
            event: data.event,
            _id: data._id,
            result: "success",
          }, "*");
        }
      } catch (e) {
        // Not a JSON message or not for us - ignore
      }
    };

    messageListenerRef.current = handleMessage;
    window.addEventListener("message", handleMessage);

    // Send ready message to parent
    if (window !== window.parent) {
      console.log("TicketWise: Sending ready message");
      window.parent.postMessage({ message: "ready" }, "*");
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
    screenObject,
    frameId,
    requestAuth,
    requestScreenObject,
    refreshScreen,
  };
}
