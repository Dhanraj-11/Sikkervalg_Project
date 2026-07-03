# Election Committee (Valgstyre) — Composition

Confirmed: the committee consists of **3 people total**, one of whom is **HR**, plus **2 additional members**.

This matches how the app already works — no code changes were needed:

- `pages/api/committee/invite.js` — you invite committee members by email (include HR's email along with the other two).
- `pages/api/committee/approve.js` — the election only flips from `DRAFT` to `ACTIVE` once **3** committee members have approved (`approvedCount >= 3`), which is hard-coded to match this 3-person requirement.
- `pages/dashboard.js` — the Committee step in the dashboard already labels this as "Invite the three members who will independently approve the voter roll," and shows progress as `X/3 approved`.

So in practice: when you send committee invites, just make sure HR's email is one of the three you enter (e.g. `hr@firma.no, ane@firma.no, bjorn@firma.no`). The system already requires all three — including HR — to approve before the election goes live.
