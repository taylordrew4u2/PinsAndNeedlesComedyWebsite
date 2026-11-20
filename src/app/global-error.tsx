"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/ErrorReporter";

/** The last resort, when even the site's frame fails to draw: a plain page with a reload, and a report home. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportClientError(error, error.digest ? `global ${error.digest}` : "global");
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0a0a0a", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong.</h1>
        <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>It has been reported. Reload to try again.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "8px 20px", borderRadius: 6, border: 0, background: "#fff", color: "#000", fontWeight: 600 }}>Reload</button>
      </body>
    </html>
  );
}
