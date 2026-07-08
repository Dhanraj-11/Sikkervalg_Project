import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand from "@/components/Brand";
import Message from "@/components/Message";

export default function CommitteeJoin() {
  const router = useRouter();
  const { token: joinToken } = router.query;
  const [form, setForm] = useState({ name: "", password: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      const { token, electionId } = await api("/committee/join", { token: joinToken, ...form });
      localStorage.setItem("token", token);
      router.push(electionId ? `/committee/approve?electionId=${electionId}` : "/committee/approve");
    } catch (e) {
      setErr(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <Head><title>Join committee — SikkerValg</title></Head>
      <Brand eyebrow="Sikker digital valggjennomføring" />

      <div style={{ marginTop: 32 }}>
        <h1>Committee member setup</h1>

        {!router.isReady ? (
          <div className="center-screen" style={{ minHeight: 160 }}>
            <div className="spinner-lg" />
          </div>
        ) : !joinToken ? (
          <Message type="err">This invite link is missing its identifier — ask HR to resend it.</Message>
        ) : (
          <>
            <p className="lede">
              You've been invited to join an election committee (Valgstyre). Set a password to
              continue — you'll use it to log in and approve the voter roll.
            </p>
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
                <label htmlFor="password">Choose a password</label>
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
                {submitting ? "Setting up…" : "Create account & continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
