import connectDB from "@/lib/db";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";

// Powers the dashboard's resume flow: on load (including after a refresh)
// the frontend asks "does this HR user already have organizations?" before
// deciding whether to show a picker or a blank creation form.
export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const orgs = await Organization.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ orgs });
});
