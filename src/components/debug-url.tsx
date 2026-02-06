"use client";

import { useEffect, useState } from "react";

export function DebugUrl() {
  const [url, setUrl] = useState("");
  
  useEffect(() => {
    setUrl(window.location.href);
  }, []);
  
  return (
    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800 font-mono break-all">
      <strong>Full URL:</strong> {url || "Loading..."}
    </div>
  );
}
