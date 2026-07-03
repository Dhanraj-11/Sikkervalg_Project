import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand from "@/components/Brand";
import Message from "@/components/Message";

export default function CommitteeApprove() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [electionId, setElectionId] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return router.replace("/login");
    setToken(t);
    setCheckingAuth(false);
  }, []);

  // Prefill from a shared link, e.g. /committee/approve?electionId=...
  useEffect(() => {
    if (router.query.electionId) setElectionId(String(router.query.electionId));
  }, [router.query.electionId]);

  async function approve(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      setResult(await api("/committee/approve", { electionId }, token));
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="page page-narrow">
        <div className="center-screen">
          <div className="spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <Head><title>Committee approval — SikkerValg</title></Head>
      <Brand eyebrow="Sikker digital valggjennomføring" />

      <div style={{ marginTop: 32 }}>
        <h1>Committee approval</h1>
        <p className="lede">
          Enter the Election ID given to you by HR, review, and approve the voter roll. Once all
          three committee members approve, the election opens for voting automatically.
        </p>

        <form onSubmit={approve} noValidate>
          <div className="field">
            <label htmlFor="electionId">Election ID</label>
            <input
              id="electionId"
              placeholder="Paste the Election ID here"
              required
              value={electionId}
              onChange={(e) => setElectionId(e.target.value)}
            />
          </div>

          <Message type="err">{err}</Message>

          <button type="submit" className="btn-block" disabled={submitting || !electionId}>
            {submitting && <span className="spinner" />}
            {submitting ? "Approving…" : "Approve voter roll"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 20 }}>
            <Message type="ok">
              Approved. {result.approvedCount}/3 committee members have approved.
              {result.active && " The election is now active and ready for voting."}
            </Message>
          </div>
        )}
      </div>
    </div>
  );
}
