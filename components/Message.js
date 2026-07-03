const ICONS = {
  ok: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 10.2L8.7 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  err: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M10 6V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="10" cy="14" r="0.9" fill="currentColor" /></svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 3.5L17.5 16H2.5L10 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M10 8.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="10" cy="14.2" r="0.9" fill="currentColor" /></svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M10 9V14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="10" cy="6" r="0.9" fill="currentColor" /></svg>
  ),
};

// type: "ok" | "err" | "warn" | "info"
export default function Message({ type = "info", children }) {
  if (!children) return null;
  return (
    <div className={`msg ${type}`} role={type === "err" ? "alert" : "status"} aria-live="polite">
      <span className="msg-icon">{ICONS[type]}</span>
      <span>{children}</span>
    </div>
  );
}
