import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { BrandMark } from "@/components/Brand";
import Message from "@/components/Message";
import IdChip from "@/components/IdChip";

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export default function Vote() {
  const router = useRouter();
  const { token } = router.query;

  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [declared, setDeclared] = useState(false); // FE-02: legal gate
  const [choice, setChoice] = useState(""); // candidateId or "blank"
  const [submitting, setSubmitting] = useState(false);
  const [tracker, setTracker] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(300); // FE-24: 5-minute session countdown
  const lastSubmitAt = useRef(0);
  const website = useRef(""); // FE-15: honeypot, never rendered visibly, never touched by real users

  // FE-24: hard 5-minute session cap on the ballot view. Not reset by
  // activity on purpose — a fixed ceiling is simpler to reason about for a
  // legal record than an idle timer, and still forces re-entry via a fresh link.
  useEffect(() => {
    if (!info || tracker) return;
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? (clearInterval(id), 0) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [info, tracker]);

  // FE-05: block back/forward and tab-close mid-vote.
  useEffect(() => {
    function onBeforeUnload(e) {
      if (declared && !tracker) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    function onRouteChangeStart() {
      if (declared && !tracker && !window.confirm("Leave this page? Your vote has not been submitted yet.")) {
        router.events.emit("routeChangeError");
        throw "routeChange aborted (expected — user chose to stay)";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    router.events.on("routeChangeStart", onRouteChangeStart);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      router.events.off("routeChangeStart", onRouteChangeStart);
    };
  }, [declared, tracker, router.events]);

  useEffect(() => {
    if (!token) return;
    post("/api/vote/info", { token })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);

  // FE-04 (simplified): if the tab is hidden mid-vote before submission,
  // drop the in-progress selection so nothing lingers if the device is shared.
  useEffect(() => {
    function onVis() {
      if (document.hidden && !tracker) setChoice("");
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [tracker]);

  async function submit(e) {
    e.preventDefault();
    if (!choice || secondsLeft <= 0) return;
    // FE-19: hard debounce — refuses re-submission for 5s regardless of
    // network speed, closing the multi-tap race window a `submitting` flag
    // alone can't (a flag resets the instant the response lands).
    const now = Date.now();
    if (now - lastSubmitAt.current < 5000) return;
    lastSubmitAt.current = now;

    setSubmitting(true);
    setError("");
    try {
      const body = {
        token,
        website: website.current, // FE-15: honeypot, always empty for real voters
        ...(choice === "blank" ? { blank: true } : { candidateId: choice }),
      };
      const { trackerId } = await post("/api/vote/cast", body);
      setTracker(trackerId); // FE-07: shown exactly once, never persisted client-side
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const pageHead = (
    <Head><title>Cast your vote — SikkerValg</title></Head>
  );

  if (error && !info) {
    return (
      <div className="page page-narrow">
        {pageHead}
        <div className="center-screen">
          <BrandMark />
          <Message type="err">{error}</Message>
        </div>
      </div>
    );
  }

  if (tracker) {
    return (
      <div className="page page-narrow vote-shell" style={{ userSelect: "none" }}>
        {pageHead}
        <div className="center-screen" style={{ minHeight: "auto", paddingTop: 24 }}>
          <BrandMark />
          <h1 style={{ marginTop: 4 }}>Your vote was recorded</h1>
          <p>Save this tracker ID to verify your ballot is in the public ledger later. It will not be shown again.</p>
          <div className="card" style={{ width: "100%" }}>
            <div className="tracker-display">{tracker}</div>
            <IdChip value={tracker} label="tracker id" />
          </div>
          <p className="helper-text">You may close this page. Once this election has closed, you can check your ballot at <a href="/verify">{typeof window !== "undefined" ? window.location.origin : ""}/verify</a>.</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="page page-narrow">
        {pageHead}
        <div className="center-screen">
          <BrandMark />
          <div className="spinner-lg" />
          <p className="helper-text" style={{ margin: 0 }}>Loading your ballot…</p>
        </div>
      </div>
    );
  }

  if (secondsLeft <= 0 && !tracker) {
    return (
      <div className="page page-narrow">
        {pageHead}
        <div className="center-screen">
          <BrandMark />
          <Message type="err">Session expired for your safety. Please re-open your voting link to continue.</Message>
        </div>
      </div>
    );
  }

  const isLow = secondsLeft <= 30;

  return (
    <div className="page page-narrow vote-shell">
      {pageHead}
      <BrandMark />
      <h1 style={{ marginTop: 10 }}>{info.electionName}</h1>
      <p className="lede" style={{ marginBottom: 6 }}>Your vote weight: <strong>{info.weight}</strong></p>
      <p className={`session-timer ${isLow ? "is-low" : ""}`} style={{ marginBottom: 24 }}>
        Session expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
      </p>

      {!declared ? (
        <div className="card">
          <h2>Legal declaration</h2>
          <p>
            By proceeding, you confirm that you are the individual to whom this voting link was
            issued, that you meet the statutory qualifications to vote in this election under
            Arbeidsmiljøloven, and that you understand submitting a ballot is final and cannot be
            changed or withdrawn afterwards. Providing a false declaration may constitute a
            violation of company policy and applicable regulation.
          </p>
          <label className="option-row">
            <input type="checkbox" onChange={(e) => setDeclared(e.target.checked)} />
            <span>I confirm the above statement is true.</span>
          </label>
        </div>
      ) : (
        <form onSubmit={submit} autoComplete="off">
          {/* FE-15: honeypot — hidden from sighted users and screen readers, invisible to humans, catnip for bots */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            onChange={(e) => (website.current = e.target.value)}
          />
          <div className="card">
            <h2>Cast your vote</h2>
            <fieldset>
              {info.candidates.map((c) => (
                <label key={c._id} className={`option-row ${choice === c._id ? "checked" : ""}`}>
                  <input
                    type="radio"
                    name="choice"
                    value={c._id}
                    checked={choice === c._id}
                    onChange={() => setChoice(c._id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              <label className={`option-row ${choice === "blank" ? "checked" : ""}`}>
                <input
                  type="radio"
                  name="choice"
                  value="blank"
                  checked={choice === "blank"}
                  onChange={() => setChoice("blank")}
                />
                <span>Blank stemme (blank vote)</span>
              </label>
            </fieldset>

            <Message type="err">{error}</Message>

            <button type="submit" className="btn-block" disabled={!choice || submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? "Submitting…" : "Submit vote"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
