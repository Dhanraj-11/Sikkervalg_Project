import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand, { BrandMark } from "@/components/Brand";
import Message from "@/components/Message";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      const { token } = await api("/auth/login", form);
      localStorage.setItem("token", token);
      router.push("/dashboard");
      // Intentionally leave submitting=true here: the button should stay
      // disabled/loading through the redirect rather than flash back to
      // an enabled state right before the page changes.
    } catch (e) {
      setErr(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <Head><title>Log in — SikkerValg</title></Head>

      <div className="auth-side">
        <BrandMark className="auth-side-seal" />
        <Brand eyebrow="Sikker digital valggjennomføring" />
        <p className="auth-side-quote">
          “Three independent people have to say yes before <span>anything opens.</span> That's the whole point.”
        </p>
        <p className="auth-side-foot">Committee-approved elections, start to finish.</p>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-inner">
          <h1>Log in</h1>
          <p className="lede">Access your HR dashboard to administer elections.</p>

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                placeholder="you@company.com"
                type="email"
                autoComplete="username"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <Message type="err">{err}</Message>

            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-soft)" }}>
            New HR account? <a href="/signup">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
