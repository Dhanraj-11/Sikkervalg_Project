import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import Brand from "@/components/Brand";
import Message from "@/components/Message";
import IdChip from "@/components/IdChip";

const STATUS_LABEL = { DRAFT: "Draft", ACTIVE: "Active", CLOSED: "Closed" };

function StatusBadge({ status }) {
  if (!status) return null;
  const cls = status === "ACTIVE" ? "badge-active" : status === "CLOSED" ? "badge-closed" : "badge-draft";
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------- Small inline icon set (kept in this file — no icon package dependency) ----------

const Icon = {
  building: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><path d="M8 7h1M8 11h1M8 15h1M15 7h1M15 11h1M15 15h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M10 21v-3.5a2 2 0 0 1 4 0V21" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  ballot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4" width="17" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><path d="M7.5 9.5L9.5 11.5L14 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M7.5 15.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5.5 7.5L10 12L14.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
};

// ---------- "Select workspace" screens: choose org / choose election ----------

function SelectScreen({ eyebrow, title, lede, items, renderCard, onCreateNew, createLabel, breadcrumb, msg }) {
  return (
    <div className="select-screen">
      <Head><title>{title} — SikkerValg</title></Head>
      <div className="select-screen-inner">
        <Brand eyebrow={eyebrow} />
        {breadcrumb}
        <h1 style={{ marginTop: 20 }}>{title}</h1>
        <p className="lede">{lede}</p>
        <Message type={msg?.type}>{msg?.text}</Message>

        <div className="select-grid">
          {items.map(renderCard)}
          <div
            className="select-card select-card-new"
            onClick={onCreateNew}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onCreateNew()}
          >
            <div className="select-card-icon">{Icon.plus}</div>
            <div className="select-card-info">
              <div className="select-card-title">{createLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Collapsible step row (the main workspace building block) ----------

function StepRow({ id, num, title, sub, done, locked, isOpen, onToggle, children }) {
  return (
    <div className={`step-row ${done ? "is-done" : ""} ${isOpen ? "is-open" : ""} ${locked ? "is-locked" : ""}`}>
      <button type="button" className="step-row-head" onClick={() => onToggle(id)}>
        <div className="step-row-icon">{done ? "✓" : num}</div>
        <div className="step-row-title">
          <div className="name">{title}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <div className="step-row-chevron">{Icon.chevron}</div>
      </button>
      {isOpen && <div className="step-row-body">{children}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // stage: "loading" | "org-picker" | "org-form" | "election-picker" | "election-form" | "workspace"
  const [stage, setStage] = useState("loading");

  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState(null);

  const [elections, setElections] = useState([]);
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [votersTotal, setVotersTotal] = useState(0);
  const [votersLinkSent, setVotersLinkSent] = useState(0);

  const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }
  const [pending, setPending] = useState(null); // name of the in-flight action, or null
  const [openStep, setOpenStep] = useState("committee");
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return router.replace("/login");
    setToken(t);
    setCheckingAuth(false);
  }, []);

  // Kick off the resume flow as soon as we have a token — this is what
  // replaces "refresh silently drops you into a blank create form": we
  // always ask the backend what already exists first.
  useEffect(() => {
    if (token) loadOrgs();
  }, [token]);

  function ok(text) { setMsg({ type: "ok", text }); }
  function fail(text) { setMsg({ type: "err", text }); }

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  // ---------- Loaders (these are what makes state survive a refresh) ----------

  async function loadOrgs() {
    setPending("loadOrgs");
    setMsg(null);
    try {
      const { orgs } = await api("/org/list", {}, token);
      setOrgs(orgs);
      setOrg(null);
      // One HR account can only ever own one organization now, so there's
      // nothing to actually "pick" in the normal case — skip straight to
      // that org's elections. The picker screen only still shows up if
      // there happen to be multiple orgs on file (e.g. from before this
      // rule existed), as a safe fallback rather than a hard crash.
      if (orgs.length === 1) {
        await loadElections(orgs[0]);
      } else {
        setStage(orgs.length ? "org-picker" : "org-form");
      }
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function loadElections(chosenOrg) {
    setPending("loadElections");
    setMsg(null);
    try {
      const { elections } = await api("/election/list", { organizationId: chosenOrg._id }, token);
      setOrg(chosenOrg);
      setElections(elections);
      setElection(null);
      setStage(elections.length ? "election-picker" : "election-form");
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function loadSummary(electionId) {
    setPending("loadSummary");
    setMsg(null);
    try {
      const data = await api("/election/summary", { electionId }, token);
      setElection(data.election);
      setOrg(data.org);
      setCandidates(data.candidates);
      setCommittee(data.committee);
      setVotersTotal(data.votersTotal);
      setVotersLinkSent(data.votersLinkSent);
      setStage("workspace");
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  function reloadSummary() {
    if (election) return loadSummary(election._id);
  }

  // ---------- Mutations ----------

  async function createOrg(e) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.target);
    setPending("org");
    setMsg(null);
    try {
      const newOrg = await api("/org/create", { name: f.get("name"), orgNumber: f.get("orgNumber") }, token);
      ok("Organization created.");
      setOrgs((o) => [newOrg, ...o]);
      setOrg(newOrg);
      setElections([]);
      setElection(null);
      setStage("election-form");
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function createElection(e) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.target);
    setPending("election");
    setMsg(null);
    try {
      const newElection = await api("/election/create", { organizationId: org._id, name: f.get("name"), type: f.get("type") }, token);
      ok("Election created as a draft.");
      setElections((els) => [newElection, ...els]);
      setElection(newElection);
      setCandidates([]);
      setCommittee([]);
      setVotersTotal(0);
      setVotersLinkSent(0);
      setOpenStep("committee");
      setStage("workspace");
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function inviteCommittee(e) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.target);
    const emails = f.get("emails").split(",").map((s) => s.trim()).filter(Boolean);
    setPending("committee");
    setMsg(null);
    try {
      await api("/committee/invite", { electionId: election._id, emails }, token);
      ok(`Invited ${emails.length} committee member${emails.length === 1 ? "" : "s"}. Open the Dev inbox to click through their join links.`);
      e.target.reset();
      await reloadSummary();
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function addCandidate(e) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.target);
    const name = f.get("name");
    setPending("candidate");
    setMsg(null);
    try {
      await api("/candidate/create", { electionId: election._id, name }, token);
      ok(`Candidate "${name}" added.`);
      e.target.reset();
      await reloadSummary();
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function uploadVoters(e) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.target);
    setPending("voters");
    setMsg(null);
    try {
      const { count } = await api("/voters/upload", { electionId: election._id, csv: f.get("csv") }, token);
      ok(`${count} voter${count === 1 ? "" : "s"} uploaded.`);
      await reloadSummary();
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function refreshStatus() {
    if (pending) return;
    setPending("refresh");
    setMsg(null);
    try {
      await reloadSummary();
      ok(`Status refreshed.`);
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function sendLinks() {
    if (pending) return;
    setPending("links");
    setMsg(null);
    try {
      const { sent } = await api("/election/send-links", { electionId: election._id }, token);
      ok(`${sent} voting link${sent === 1 ? "" : "s"} generated. Open the Dev inbox to click through them.`);
      await reloadSummary();
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function downloadProtocol() {
    if (pending) return;
    setPending("protocol");
    setMsg(null);
    try {
      const { pdfBase64, hash } = await api("/election/protocol", { electionId: election._id }, token);
      const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `valgprotokoll-${election._id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      ok(`Protocol downloaded. SHA-256: ${hash}`);
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  async function closeElection() {
    if (pending) return;
    if (!confirm("Close this election permanently and compute the final tally? This cannot be undone.")) return;
    setPending("close");
    setMsg(null);
    try {
      await api("/election/close", { electionId: election._id }, token);
      ok("Election closed. Tally computed below.");
      await reloadSummary();
    } catch (e) { fail(e.message); } finally { setPending(null); }
  }

  // Auto-advance the open accordion step to the first incomplete one — but
  // only the first time we land on a given election (initial load/resume),
  // not every time committee/candidates/voters change. Without the guard,
  // adding one candidate (or one committee invite, or one voter) would
  // immediately bounce the user forward to the next step the instant it had
  // *any* items, making it impossible to add several candidates, several
  // committee members, etc. in a row without manually scrolling back each
  // time.
  const autoAdvancedKey = useRef(null);
  useEffect(() => {
    if (stage !== "workspace" || !election) return;
    // Re-run on election switch AND on status transitions (e.g. the moment
    // it goes DRAFT -> ACTIVE after the 3rd approval, it's worth jumping to
    // "links"). It deliberately does NOT re-run just because
    // committee/candidates/votersTotal changed within the same status, so
    // adding a 2nd/3rd item in a row doesn't yank the user away.
    const key = `${election._id}:${election.status}`;
    if (autoAdvancedKey.current === key) return;
    autoAdvancedKey.current = key;
    const s3 = committee.length > 0;
    const s4 = candidates.length > 0;
    const s5 = votersTotal > 0;
    const s6 = election.status === "ACTIVE" || election.status === "CLOSED";
    const s7 = votersLinkSent > 0;
    if (!s3) return setOpenStep("committee");
    if (!s4) return setOpenStep("candidates");
    if (!s5) return setOpenStep("voters");
    if (!s6) return setOpenStep("approval");
    if (election.status === "ACTIVE" && !s7) return setOpenStep("links");
    if (election.status === "ACTIVE") return setOpenStep("close");
    setOpenStep("close");
  }, [stage, election, committee, candidates, votersTotal, votersLinkSent]);

  if (checkingAuth || !token || stage === "loading") {
    return (
      <div className="page">
        <div className="center-screen">
          <div className="spinner-lg" />
        </div>
      </div>
    );
  }

  // ---------- Stage: choose an organization ----------

  if (stage === "org-picker") {
    return (
      <SelectScreen
        eyebrow="Step 1 of 2"
        title="Choose an organization"
        lede="You already have organizations on file. Continue one, or set up a new one."
        items={orgs}
        createLabel="Set up a new organization"
        onCreateNew={() => setStage("org-form")}
        msg={msg}
        renderCard={(o) => (
          <div className="select-card" key={o._id}>
            <div className="select-card-icon">{Icon.building}</div>
            <div className="select-card-info">
              <div className="select-card-title">{o.name}</div>
              <div className="select-card-sub">org.nr {o.orgNumber} · created {fmtDate(o.createdAt)}</div>
            </div>
            <button type="button" className="btn-sm" disabled={pending === "loadElections"} onClick={() => loadElections(o)}>
              {pending === "loadElections" && <span className="spinner" />}
              Continue
            </button>
          </div>
        )}
      />
    );
  }

  // ---------- Stage: create an organization ----------

  if (stage === "org-form") {
    return (
      <div className="select-screen">
        <Head><title>New organization — SikkerValg</title></Head>
        <div className="select-screen-inner">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Brand eyebrow="Step 1 of 2" />
            <button type="button" className="btn-ghost" onClick={logout}>Log out</button>
          </div>

          {orgs.length > 0 && (
            <div className="breadcrumb-bar" style={{ marginTop: 20 }}>
              <button type="button" className="link-btn" onClick={loadOrgs}>← Back to your organizations</button>
            </div>
          )}

          <h1 style={{ marginTop: 20 }}>Set up your organization</h1>
          <p className="lede">This only needs to be done once per company — every future election reuses it.</p>
          <Message type={msg?.type}>{msg?.text}</Message>

          <div className="card">
            <form onSubmit={createOrg}>
              <div className="field">
                <label htmlFor="orgName">Organization name</label>
                <input id="orgName" name="name" placeholder="e.g. Nordlys AS" required />
              </div>
              <div className="field">
                <label htmlFor="orgNumber">Org number (Organisasjonsnummer)</label>
                <input id="orgNumber" name="orgNumber" placeholder="9 digits" required />
              </div>
              <button type="submit" className="btn-block" disabled={pending === "org"}>
                {pending === "org" && <span className="spinner" />}
                {pending === "org" ? "Creating…" : "Create organization"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Stage: choose an election ----------

  if (stage === "election-picker") {
    return (
      <SelectScreen
        eyebrow="Step 2 of 2"
        title={`Elections at ${org.name}`}
        lede="Continue an election already in progress, or start a new one."
        items={elections}
        createLabel="Start a new election"
        onCreateNew={() => setStage("election-form")}
        msg={msg}
        breadcrumb={
          <div className="breadcrumb-bar" style={{ marginTop: 20 }}>
            <button type="button" className="link-btn" onClick={loadOrgs}>← Change organization</button>
            <span>/</span>
            <span className="current">{org.name}</span>
          </div>
        }
        renderCard={(el) => (
          <div className="select-card" key={el._id}>
            <div className="select-card-icon">{Icon.ballot}</div>
            <div className="select-card-info">
              <div className="select-card-title">{el.name}</div>
              <div className="select-card-sub">{el.type || "Election"} · created {fmtDate(el.createdAt)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusBadge status={el.status} />
              <button type="button" className="btn-sm" disabled={pending === "loadSummary"} onClick={() => loadSummary(el._id)}>
                {pending === "loadSummary" && <span className="spinner" />}
                Continue
              </button>
            </div>
          </div>
        )}
      />
    );
  }

  // ---------- Stage: create an election ----------

  if (stage === "election-form") {
    return (
      <div className="select-screen">
        <Head><title>New election — SikkerValg</title></Head>
        <div className="select-screen-inner">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Brand eyebrow="Step 2 of 2" />
            <button type="button" className="btn-ghost" onClick={logout}>Log out</button>
          </div>

          <div className="breadcrumb-bar" style={{ marginTop: 20 }}>
            <button type="button" className="link-btn" onClick={loadOrgs}>← Change organization</button>
            <span>/</span>
            {elections.length > 0 ? (
              <button type="button" className="link-btn" onClick={() => loadElections(org)}>{org.name}</button>
            ) : (
              <span className="current">{org.name}</span>
            )}
          </div>

          <h1 style={{ marginTop: 20 }}>Start a new election</h1>
          <p className="lede">Every election runs its own committee, candidate list, and voter roll.</p>
          <Message type={msg?.type}>{msg?.text}</Message>

          <div className="card">
            <form onSubmit={createElection}>
              <div className="field">
                <label htmlFor="electionName">Election name</label>
                <input id="electionName" name="name" placeholder="e.g. Board Election 2026" required />
              </div>
              <div className="field">
                <label htmlFor="electionType">Type</label>
                <input id="electionType" name="type" placeholder="e.g. Board Election" />
              </div>
              <button type="submit" className="btn-block" disabled={pending === "election"}>
                {pending === "election" && <span className="spinner" />}
                {pending === "election" ? "Creating…" : "Create election"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Stage: workspace (the running protocol for one election) ----------

  const step3Done = committee.length > 0;
  const step4Done = candidates.length > 0;
  const step5Done = votersTotal > 0;
  const step6Done = election?.status === "ACTIVE" || election?.status === "CLOSED";
  const step7Done = votersLinkSent > 0;
  const step8Done = election?.status === "CLOSED";
  const approvedCount = committee.filter((c) => c.approved).length;
  const isDraft = election.status === "DRAFT";

  const steps = [
    { id: "committee", num: 3, title: "Committee (Valgstyre)", sub: step3Done ? `${committee.length} invited · ${approvedCount}/3 approved` : "Not started", done: step3Done },
    { id: "candidates", num: 4, title: "Candidates", sub: step4Done ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}` : "Not started", done: step4Done },
    { id: "voters", num: 5, title: "Voter roll", sub: step5Done ? `${votersTotal} voter${votersTotal === 1 ? "" : "s"}` : "Not started", done: step5Done },
    { id: "approval", num: 6, title: "Committee approval", sub: step6Done ? "Election is active" : "Waiting on committee sign-off", done: step6Done },
  ];
  if (election.status === "ACTIVE") {
    steps.push({ id: "links", num: 7, title: "Open voting", sub: step7Done ? `${votersLinkSent} of ${votersTotal} links sent` : "Not started", done: step7Done });
  }
  if (election.status === "ACTIVE" || election.status === "CLOSED") {
    steps.push({ id: "close", num: 8, title: "Close & tally", sub: step8Done ? "Closed" : "Ready to close", done: step8Done });
  }
  const doneCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  function toggleStep(id) {
    setOpenStep((cur) => (cur === id ? null : id));
  }

  function scrollToStep(id) {
    setOpenStep(id);
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="shell">
      <Head><title>{election.name} — SikkerValg</title></Head>

      <aside className="shell-sidebar">
        <Brand />

        <div className="shell-sidebar-context">
          <div className="shell-sidebar-context-label">Organization</div>
          <div className="shell-sidebar-context-value">{org.name}</div>
          {orgs.length > 1 && <button type="button" className="link-btn" onClick={loadOrgs}>Switch</button>}
        </div>

        <div className="shell-sidebar-context">
          <div className="shell-sidebar-context-label">Election</div>
          <div className="shell-sidebar-context-value">{election.name} <StatusBadge status={election.status} /></div>
          <button type="button" className="link-btn" onClick={() => loadElections(org)}>Switch</button>
        </div>

        <nav className="shell-nav">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`shell-nav-item ${s.done ? "is-done" : ""} ${openStep === s.id ? "is-current" : ""}`}
              onClick={() => scrollToStep(s.id)}
            >
              <span className="dot" />
              {s.title}
            </button>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <button type="button" className="btn-ghost" onClick={logout} style={{ width: "100%", justifyContent: "flex-start" }}>Log out</button>
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-main-inner">
          <div className="shell-header">
            <div>
              <h1>{election.name}</h1>
              <p className="lede" style={{ marginBottom: 0 }}>Run the election protocol step by step — you can safely refresh, everything here is saved.</p>
            </div>
          </div>

          <div className="progress-summary">
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
            <div className="progress-label">{doneCount}/{steps.length} steps complete</div>
          </div>

          <Message type={msg?.type}>{msg?.text}</Message>

          <div className="step-list">
            <StepRow id="committee" num={3} title="Committee (Valgstyre)" done={step3Done}
              sub={step3Done ? `${committee.length} invited · ${approvedCount}/3 approved` : "Invite the three members who approve the voter roll"}
              isOpen={openStep === "committee"} onToggle={toggleStep}>
              <div id="step-committee" />
              <p className="helper-text" style={{ marginTop: 0 }}>Invite the three members who will independently approve the voter roll.</p>
              {isDraft ? (
                <form onSubmit={inviteCommittee}>
                  <div className="field">
                    <label htmlFor="emails">Committee emails</label>
                    <input id="emails" name="emails" placeholder="ane@firma.no, bjorn@firma.no, cathrine@firma.no" required />
                  </div>
                  <button type="submit" disabled={pending === "committee"}>
                    {pending === "committee" && <span className="spinner" />}
                    {pending === "committee" ? "Sending…" : step3Done ? "Send more invites" : "Send invites"}
                  </button>
                </form>
              ) : (
                <p className="helper-text" style={{ marginTop: 0 }}>Locked — the election is no longer a draft.</p>
              )}
              {step3Done && (
                <ul className="committee-list">
                  {committee.map((c) => (
                    <li key={c.email}>
                      <span>{c.email}</span>
                      <span className={c.approved ? "approved" : "pending"}>{c.approved ? "✓ Approved" : "Pending"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </StepRow>

            <StepRow id="candidates" num={4} title="Candidates" done={step4Done}
              sub={step4Done ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} added` : "Add who's on the ballot"}
              isOpen={openStep === "candidates"} onToggle={toggleStep}>
              <div id="step-candidates" />
              {isDraft ? (
                <form onSubmit={addCandidate}>
                  <div className="field">
                    <label htmlFor="candidateName">Candidate name</label>
                    <input id="candidateName" name="name" placeholder="Full name" required />
                  </div>
                  <button type="submit" disabled={pending === "candidate"}>
                    {pending === "candidate" && <span className="spinner" />}
                    {pending === "candidate" ? "Adding…" : "Add candidate"}
                  </button>
                </form>
              ) : (
                <p className="helper-text" style={{ marginTop: 0 }}>Locked — the election is no longer a draft.</p>
              )}
              {candidates.length > 0 && (
                <ul style={{ margin: "14px 0 0", paddingLeft: 20, fontSize: 14, color: "var(--ink-soft)" }}>
                  {candidates.map((c) => <li key={c._id}>{c.name}</li>)}
                </ul>
              )}
            </StepRow>

            <StepRow id="voters" num={5} title="Voter roll" done={step5Done}
              sub={step5Done ? `${votersTotal} voter${votersTotal === 1 ? "" : "s"} on the roll` : "Upload who's eligible to vote"}
              isOpen={openStep === "voters"} onToggle={toggleStep}>
              <div id="step-voters" />
              <p className="helper-text" style={{ marginTop: 0 }}>Paste a CSV with columns: email, name, weight.</p>
              {isDraft ? (
                <form onSubmit={uploadVoters}>
                  <div className="field">
                    <label htmlFor="csv">Voter CSV</label>
                    <textarea id="csv" name="csv" rows={4} placeholder={"email,name,weight\na@x.com,A,1\nb@x.com,B,0.5"} required />
                  </div>
                  <button type="submit" disabled={pending === "voters"}>
                    {pending === "voters" && <span className="spinner" />}
                    {pending === "voters" ? "Uploading…" : "Upload voters"}
                  </button>
                </form>
              ) : (
                <p className="helper-text" style={{ marginTop: 0 }}>Locked — the election is no longer a draft.</p>
              )}
            </StepRow>

            <StepRow id="approval" num={6} title="Committee approval" done={step6Done}
              sub={step6Done ? "Election is active" : `Waiting on committee sign-off (${approvedCount}/3)`}
              isOpen={openStep === "approval"} onToggle={toggleStep}>
              <div id="step-approval" />
              <p>Committee members approve from their own login at <a href="/committee/approve">/committee/approve</a> after joining via their invite link (see the Dev inbox).</p>
              <div className="field">
                <label>Election ID (share with committee if needed)</label>
                <IdChip value={election._id} label="election id" />
              </div>
              <p style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 0 }}>
                Current status: <StatusBadge status={election.status} />
                <button type="button" className="btn-secondary btn-sm" onClick={refreshStatus} disabled={pending === "refresh"}>
                  {pending === "refresh" && <span className="spinner" />}
                  {pending === "refresh" ? "Checking…" : "Refresh status"}
                </button>
              </p>
            </StepRow>

            {election.status === "ACTIVE" && (
              <StepRow id="links" num={7} title="Open voting" done={step7Done}
                sub={step7Done ? `${votersLinkSent} of ${votersTotal} links sent` : "Generate and send voting links"}
                isOpen={openStep === "links"} onToggle={toggleStep}>
                <div id="step-links" />
                <p>Generates a single-use magic link per voter and consumes their entry from the draft roll. Links are emailed via Resend.</p>
                <button type="button" onClick={sendLinks} disabled={pending === "links"}>
                  {pending === "links" && <span className="spinner" />}
                  {pending === "links" ? "Sending…" : step7Done ? "Send links again" : "Send voting links"}
                </button>
              </StepRow>
            )}

            {(election.status === "ACTIVE" || election.status === "CLOSED") && (
              <StepRow id="close" num={8} title="Close & tally" done={step8Done}
                sub={step8Done ? "Closed — protocol available" : "Locks the ledger and computes the final tally"}
                isOpen={openStep === "close"} onToggle={toggleStep}>
                <div id="step-close" />
                {election.status === "ACTIVE" ? (
                  <>
                    <p>Closing is final. This locks the ballot ledger and computes the weighted tally exactly once.</p>
                    <button type="button" className="btn-danger" onClick={closeElection} disabled={pending === "close"}>
                      {pending === "close" && <span className="spinner" />}
                      {pending === "close" ? "Closing…" : "Close election & compute tally"}
                    </button>
                  </>
                ) : (
                  <>
                    <p>Closed{election.closedAt ? ` at ${new Date(election.closedAt).toLocaleString()}` : ""}.</p>
                    <button type="button" onClick={downloadProtocol} disabled={pending === "protocol"}>
                      {pending === "protocol" && <span className="spinner" />}
                      {pending === "protocol" ? "Preparing…" : "Download signed Valgprotokoll (PDF)"}
                    </button>
                    {election.tally && (
                      <>
                        <table>
                          <thead><tr><th>Option</th><th>Weight</th><th>Ballots</th></tr></thead>
                          <tbody>
                            {election.tally.results.map((r) => (
                              <tr key={r.name}><td>{r.name}</td><td>{r.weight}</td><td>{r.count}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        <p style={{ marginBottom: election.tally.deAnonRiskAdjusted?.length > 0 ? 12 : 0 }}>
                          Total ballots: {election.tally.totalBallots}
                        </p>
                        {election.tally.deAnonRiskAdjusted?.length > 0 && (
                          <Message type="warn">
                            Anonymity guard applied to: {election.tally.deAnonRiskAdjusted.join(", ")} (single 0.5-weight ballot rounded to 1.0)
                          </Message>
                        )}
                      </>
                    )}
                  </>
                )}
              </StepRow>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
