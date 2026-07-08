import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true },
    password: String,
    role: { type: String, enum: ["hr", "committee"], default: "hr" },
    // Bumped to invalidate every outstanding JWT for this user at once
    // (password change, "log out everywhere"). See lib/auth.js requireAuth.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
