import { Router } from "express";
import { createRoom, getRoom } from "../controllers/rooms.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const roomsRouter = Router();
roomsRouter.use(requireAuth);
roomsRouter.post("/", createRoom);
roomsRouter.get("/:roomId", getRoom);
