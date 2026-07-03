import { useState } from "react";

export default function IdChip({ value, label }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browsers, permissions) —
      // fail silently rather than throwing an error at the user for a
      // convenience action.
    }
  }

  return (
    <span className="id-chip" role="group" aria-label={label || "Identifier"}>
      {value}
      <button
        type="button"
        className="copy-btn"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${label || "value"}`}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10.5L8 14.5L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M13 7V4.5C13 3.67 12.33 3 11.5 3H4.5C3.67 3 3 3.67 3 4.5V11.5C3 12.33 3.67 13 4.5 13H7" stroke="currentColor" strokeWidth="1.5" /></svg>
        )}
      </button>
    </span>
  );
}
