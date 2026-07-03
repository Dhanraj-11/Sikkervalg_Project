import connectDB from "@/lib/db";
import User from "@/models/User";
import { hashPw, signToken, validatePassword } from "@/lib/auth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 5 signups per hour per IP — generous for real use, tight enough to stop
  // automated account-farming.
  if (await enforceRateLimit(req, res, "signup", clientIp(req), { max: 5, windowMs: 60 * 60 * 1000 })) return;

  await connectDB();
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Invalid request" });

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const user = await User.create({ name, email, password: await hashPw(password) });
    res.status(201).json({ token: signToken(user) });
  } catch (err) {
    // BE-19: duplicate email (Mongo code 11000) is the one expected failure
    // here — give it a clean message instead of letting a raw driver error
    // reach the client as a 500.
    if (err.code === 11000) return res.status(409).json({ error: "An account with that email already exists" });
    res.status(500).json({ error: "Unable to create account" });
  }
}
