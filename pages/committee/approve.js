import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand from "@/components/Brand";
import Message from "@/components/Message";
import IdChip from "@/components/IdChip";

export default function CommitteeApprove() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [electionId, setElectionId] = useState("");
  const [prefilled, setPrefilled] = useState(false);
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

  // Prefill from a shared link, e.g. /committee/approve?electionId=... —
  // this is now how joining actually gets here (see pages/committee/join.js),
  // so in the normal flow the person never has to find or paste an ID
  // themselves.
  useEffect(() => {
    if (router.query.electionId) {
      setElectionId(String(router.query.electionId));
      setPrefilled(true);
    }
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
          Review and approve the voter roll. Once all three committee members approve, the
          election opens for voting automatically.
        </p>

        <form onSubmit={approve} noValidate>
          {prefilled ? (
            <div className="field">
              <label>Election</label>
              <div className="static-value" style={{ padding: "10px 12px", border: "1px solid var(--border, #ddd)", borderRadius: 8 }}>
                <IdChip value={electionId} />
              </div>
              <button
                type="button"
                className="link-btn"
                style={{ marginTop: 4 }}
                onClick={() => { setPrefilled(false); }}
              >
                Not the right election? Enter a different ID
              </button>
            </div>
          ) : (
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
          )}

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
