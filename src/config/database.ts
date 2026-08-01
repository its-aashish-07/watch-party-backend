import mongoose from "mongoose";
import { env } from "./env.js";

export let lastDbError: string | null = null;

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000
    });
    lastDbError = null;
    console.log(`MongoDB connected (${env.MONGODB_DB_NAME})`);
  } catch (error) {
    lastDbError = error instanceof Error ? error.message : String(error);
    throw error;
  }
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
