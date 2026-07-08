import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkPw, signToken } from "@/lib/auth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8g0z3Z0z3Z0z3Z0z3Z0z3Z0z3Z0z3.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  const { email, password } = result.data;

  const ip = clientIp(req);
  if (await enforceRateLimit(req, res, "login-ip", ip, { max: 20, windowMs: 15 * 60 * 1000 })) return;
  if (await enforceRateLimit(req, res, "login-email", email, { max: 10, windowMs: 15 * 60 * 1000 })) return;

  await connectDB();
  const user = await User.findOne({ email });
  const ok = await checkPw(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken(user) });
}
