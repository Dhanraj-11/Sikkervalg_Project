/** @type {import('next').NextConfig} */
module.exports = {
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      // Next.js dev-mode Fast Refresh uses eval() to apply hot updates, so
      // 'unsafe-eval' is required in dev. Production keeps the strict policy.
      isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // inline styles used by a few components
      "frame-ancestors 'none'", // FE-06: clickjacking defense
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" }, // FE-06, legacy-browser fallback
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }, // OP-12
        ],
      },
    ];
  },
};
