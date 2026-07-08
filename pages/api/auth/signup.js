import connectDB from "@/lib/db";
import User from "@/models/User";
import { hashPw, signToken, validatePassword } from "@/lib/auth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { z } from "zod";

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  password: z.string().min(10, "Password must be at least 10 characters").max(100),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (await enforceRateLimit(req, res, "signup", clientIp(req), { max: 5, windowMs: 60 * 60 * 1000 })) return;

  const result = SignupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  await connectDB();
  const { name, email, password } = result.data;

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const user = await User.create({ name, email, password: await hashPw(password) });
    res.status(201).json({ token: signToken(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An account with that email already exists" });
    res.status(500).json({ error: "Unable to create account" });
  }
}
