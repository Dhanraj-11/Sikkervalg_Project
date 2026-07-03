import mongoose from "mongoose";

let cached = global._mongoose || { conn: null, promise: null };

export default async function connectDB() {
  if (cached.conn) return cached.conn;
  cached.promise ||= mongoose.connect(process.env.MONGODB_URI);
  cached.conn = await cached.promise;
  global._mongoose = cached;
  return cached.conn;
}
