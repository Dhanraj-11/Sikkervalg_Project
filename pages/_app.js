import "@/styles/globals.css";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  // FE-18: one guard for the whole app, not per-page.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
      window.location.href = window.location.href.replace("http:", "https:");
    }
  }, []);
  return <Component {...pageProps} />;
}
