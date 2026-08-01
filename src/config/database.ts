import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000
  });
  console.log(`MongoDB connected (${env.MONGODB_DB_NAME})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseHealth(): { connected: boolean; state: string } {
  const states: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  return {
    connected: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] ?? "unknown"
  };
}
