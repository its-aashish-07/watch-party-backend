import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase, databaseHealth } from "./config/database.js";
import { allowedOrigins, env } from "./config/env.js";
import { roomManager } from "./domain/RoomManager.js";
import { registerSocketHandlers } from "./socket/register-handlers.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./types/events.js";
import { verifyAccessToken } from "./utils/auth.js";

const app = createApp();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 100_000
});

io.use((socket, next) => {
  const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
  if (!token) {
    next(new Error("AUTH_REQUIRED"));
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    socket.data.accountUserId = claims.userId;
    socket.data.accountName = claims.name;
    socket.data.accountEmail = claims.email;
    next();
  } catch {
    next(new Error("INVALID_TOKEN"));
  }
});

io.on("connection", (socket) => registerSocketHandlers(io, socket));

let cleanupTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  try {
    await connectDatabase();
    const restoredRooms = await roomManager.initialize();
    console.log(`Restored ${restoredRooms} active room(s) from MongoDB`);
  } catch (error) {
    console.warn("WARNING: Failed to connect to MongoDB. Starting server anyway, but database features will not work until MONGODB_URI is configured properly.");
  }

  cleanupTimer = setInterval(() => {
    if (databaseHealth().state === "disconnected") {
      connectDatabase()
        .then(() => roomManager.initialize().then(r => console.log(`Restored ${r} active room(s) after reconnection`)))
        .catch(() => {});
    }

    void roomManager.cleanupExpiredRooms()
      .then((expiredRoomIds) => {
        for (const roomId of expiredRoomIds) {
          io.to(roomId).emit("room_closed", { roomId, reason: "Room expired because it was inactive." });
        }
      })
      .catch((error) => console.error("Room cleanup failed", error));
  }, 60_000);
  cleanupTimer.unref();

  httpServer.listen(env.PORT, () => {
    console.log(`Watch Party API listening on http://localhost:${env.PORT}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing server...`);
  if (cleanupTimer) clearInterval(cleanupTimer);
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((error) => {
  console.error("Failed to start Watch Party API", error);
  process.exit(1);
});
