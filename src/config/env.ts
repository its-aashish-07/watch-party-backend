import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().trim().min(1).default("mongodb://127.0.0.1:27017"),
  MONGODB_DB_NAME: z.string().trim().min(1).default("syncroom_watch_party"),
  JWT_SECRET: z.string().min(32).default("development-only-change-this-jwt-secret-2026"),
  JWT_EXPIRES_IN: z.string().trim().min(2).default("7d"),
  ROOM_TTL_MINUTES: z.coerce.number().int().positive().default(360),
  MAX_PARTICIPANTS_PER_ROOM: z.coerce.number().int().positive().max(500).default(50)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export const allowedOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
