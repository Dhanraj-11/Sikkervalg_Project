import { useState } from "react";
import Head from "next/head";
import Brand from "@/components/Brand";
import Message from "@/components/Message";
import IdChip from "@/components/IdChip";

export default function Verify() {
  const [trackerId, setTrackerId] = useState("");
  const [result, setResult] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [networkErr, setNetworkErr] = useState("");

  async function check(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setNetworkErr("");
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(trackerId.trim())}`);
      const data = await res.json();
      setResult(data);
      setChecked(true);
    } catch {
      setNetworkErr("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page page-narrow">
      <Head><title>Verify a ballot — SikkerValg</title></Head>
      <Brand eyebrow="Sikker digital valggjennomføring" />

      <div style={{ marginTop: 32 }}>
        <h1>Verify a ballot</h1>
        <p className="lede">
          Enter the tracker ID you were shown when you voted to confirm it exists in the public
          ledger. This only works once the election has closed, and never reveals who or what you voted for.
        </p>

        <form onSubmit={check} noValidate>
          <div className="field">
            <label htmlFor="trackerId">Tracker ID</label>
            <input
              id="trackerId"
              placeholder="TRK-89A2-BC4D"
              value={trackerId}
              onChange={(e) => setTrackerId(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <Message type="err">{networkErr}</Message>

          <button type="submit" className="btn-block" disabled={loading || !trackerId.trim()}>
            {loading && <span className="spinner" />}
            {loading ? "Checking…" : "Check"}
          </button>
        </form>

        {checked && result && (
          <div style={{ marginTop: 20 }}>
            {result.found ? (
              <Message type="ok">
                <div>
                  Found in the public ledger.
                  <div style={{ marginTop: 8 }}>
                    <IdChip value={result.hash} label="ballot hash" />
                  </div>
                </div>
              </Message>
            ) : (
              <Message type="warn">{result.message || "Not found. Double-check the tracker ID and try again."}</Message>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
