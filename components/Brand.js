import Link from "next/link";

// A simple seal-and-check mark — read as "verified ballot" at a glance,
// reused everywhere the wordmark appears instead of a generic logo.
export function BrandMark({ className }) {
  return (
    <svg className={className || "brand-mark"} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 14.5L12 18L20 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Brand({ href = "/", eyebrow }) {
  return (
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Link href={href} className="brand">
        <BrandMark />
        <span className="brand-name">SikkerValg</span>
      </Link>
    </div>
  );
}
