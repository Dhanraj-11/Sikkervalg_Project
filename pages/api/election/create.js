import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const CreateElectionSchema = z.object({
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid organization ID"),
  name: z.string().min(3, "Name must be at least 3 characters").max(200),
  type: z.string().optional(),
  startTime: z.string().datetime().optional().or(z.string().max(0)),
  endTime: z.string().datetime().optional().or(z.string().max(0)),
});

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const result = CreateElectionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  const { organizationId, name, type, startTime, endTime } = result.data;

  await connectDB();
  const org = await Organization.findOne({ _id: organizationId, ownerId: req.user.id });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const cleanStartTime = startTime ? new Date(startTime) : undefined;
  const cleanEndTime = endTime ? new Date(endTime) : undefined;

  const election = await Election.create({
    organizationId,
    name,
    type,
    startTime: cleanStartTime,
    endTime: cleanEndTime,
  });
  res.status(201).json(election);
});
