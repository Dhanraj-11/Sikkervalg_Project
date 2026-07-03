import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand, { BrandMark } from "@/components/Brand";
import Message from "@/components/Message";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      const { token } = await api("/auth/signup", form);
      localStorage.setItem("token", token);
      router.push("/dashboard");
    } catch (e) {
      setErr(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <Head><title>Create HR account — SikkerValg</title></Head>

      <div className="auth-side">
        <BrandMark className="auth-side-seal" />
        <Brand eyebrow="Sikker digital valggjennomføring" />
        <p className="auth-side-quote">
          “Set up the roll, invite the committee, <span>let the process do the trusting.</span>”
        </p>
        <p className="auth-side-foot">Committee-approved elections, start to finish.</p>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-inner">
          <h1>Create an HR account</h1>
          <p className="lede">Set up your organization and start administering an election.</p>

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                placeholder="Kari Nordmann"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
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
                placeholder="At least 8 characters"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <Message type="err">{err}</Message>

            <button type="submit" className="btn-block" disabled={submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-soft)" }}>
            Already have an account? <a href="/login">Log in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
