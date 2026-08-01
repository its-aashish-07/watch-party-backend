import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { databaseHealth } from "./config/database.js";
import { allowedOrigins } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.routes.js";
import { roomsRouter } from "./routes/rooms.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

  app.get("/health", (_request, response) => {
    const database = databaseHealth();
    response.status(database.connected ? 200 : 503).json({
      ok: database.connected,
      service: "syncroom-watch-party-api",
      database,
      authentication: "jwt",
      timestamp: new Date().toISOString()
    });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, error: { code: "TOO_MANY_AUTH_ATTEMPTS", message: "Too many login or signup attempts. Try again later." } }
  });

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/rooms", roomsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
