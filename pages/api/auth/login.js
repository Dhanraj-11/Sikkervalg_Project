import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkPw, signToken } from "@/lib/auth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

// A hash of a value nobody will ever type, used only so bcrypt always does
// real work below — without this, an unknown email returns in ~0ms while a
// known email takes ~100ms for the real bcrypt.compare, which is enough of
// a timing signal to enumerate which HR/committee emails exist in the system.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8g0z3Z0z3Z0z3Z0z3Z0z3Z0z3Z0z3.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { email, password } = req.body || {};

  // Two limiters: per-IP catches a single attacker hammering many accounts;
  // per-email catches a distributed attack (many IPs) targeting one account.
  const ip = clientIp(req);
  if (await enforceRateLimit(req, res, "login-ip", ip, { max: 20, windowMs: 15 * 60 * 1000 })) return;
  if (email && (await enforceRateLimit(req, res, "login-email", email.toLowerCase(), { max: 10, windowMs: 15 * 60 * 1000 })))
    return;

  await connectDB();
  const user = await User.findOne({ email });
  const ok = await checkPw(password || "", user ? user.password : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken(user) });
}
