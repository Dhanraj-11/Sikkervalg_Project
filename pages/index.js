import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { BrandMark } from "@/components/Brand";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      router.replace("/dashboard");
      return;
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="page">
        <Head><title>SikkerValg</title></Head>
        <div className="center-screen">
          <BrandMark />
          <div className="spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>SikkerValg — Sikker digital valggjennomføring</title>
        <meta name="description" content="Run verifiable, independently-approved workplace elections — from voter roll to final tally." />
      </Head>

      <nav className="site-nav">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">SikkerValg</span>
        </Link>
        <div className="site-nav-actions">
          <Link href="/login" className="btn-ghost-link">Log in</Link>
          <Link href="/signup" className="btn">Get started</Link>
        </div>
      </nav>

      <header className="hero">
        <BrandMark className="hero-seal" />
        <div className="hero-inner">
          <p className="eyebrow">Sikker digital valggjennomføring</p>
          <h1>Elections your workplace can trust — and prove.</h1>
          <p className="lede">
            SikkerValg runs the whole election protocol: a defined voter roll, an
            independent committee that has to sign off before anything opens, and
            a tally that any member of that committee can verify line by line.
          </p>
          <div className="hero-actions">
            <Link href="/signup" className="btn btn-lg">Set up an election</Link>
            <Link href="/login" className="btn btn-secondary btn-lg">Log in to HR dashboard</Link>
          </div>
          <div className="hero-proof">
            <span className="hero-proof-item">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 10.2L8.7 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Three-person committee approval
            </span>
            <span className="hero-proof-item">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 10.2L8.7 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              One link per voter, one vote each
            </span>
            <span className="hero-proof-item">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 10.2L8.7 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Auditable tally, start to finish
            </span>
          </div>
        </div>
      </header>

      <section className="flow-band">
        <ol className="flow-list">
          <li>
            <span className="flow-num">01</span>
            <h2>Build the roll</h2>
            <p>HR sets up the election and uploads who's eligible to vote.</p>
          </li>
          <li>
            <span className="flow-num">02</span>
            <h2>Committee reviews</h2>
            <p>Three independent members — including HR — each approve the roll.</p>
          </li>
          <li>
            <span className="flow-num">03</span>
            <h2>Voters get a link</h2>
            <p>Every voter receives a single-use, personal voting link by email.</p>
          </li>
          <li>
            <span className="flow-num">04</span>
            <h2>Tally is verified</h2>
            <p>Once voting closes, the result is computed and open to review.</p>
          </li>
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Why teams choose it</p>
          <h1 style={{ fontSize: 28 }}>Built like a protocol, not a poll.</h1>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2.5L16.5 5v4.5c0 4.14-2.79 7.44-6.5 8-3.71-.56-6.5-3.86-6.5-8V5L10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            </div>
            <h2>No single admin can open a vote</h2>
            <p>Activation requires sign-off from all three committee members, including HR — not one person's judgment call.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="8" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.4" /></svg>
            </div>
            <h2>Every ballot link works once</h2>
            <p>Voters get a personal, single-use link — so nobody can be double-counted or vote on someone's behalf.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 10h3l2 6 4-12 2 6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2>A tally anyone can check</h2>
            <p>Results are laid out clearly enough that the committee can verify the count themselves — not take it on faith.</p>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} SikkerValg</span>
        <div className="footer-links">
          <Link href="/login">Log in</Link>
          <Link href="/signup">Create an account</Link>
        </div>
      </footer>
    </div>
  );
}
