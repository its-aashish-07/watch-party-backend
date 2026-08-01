import { z } from "zod";

export const roomIdSchema = z.string().trim().min(5).max(30).transform((value) => value.toUpperCase());
export const usernameSchema = z.string().trim().min(2).max(40);
export const currentTimeSchema = z.number().finite().min(0).max(86_400);
export const videoIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/);

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  username: usernameSchema,
  hostToken: z.string().max(100).optional(),
  sessionToken: z.string().max(100).optional()
});
export const roomActionSchema = z.object({ roomId: roomIdSchema });
export const playbackSchema = z.object({ roomId: roomIdSchema, currentTime: currentTimeSchema });
export const seekSchema = z.object({ roomId: roomIdSchema, time: currentTimeSchema });
export const changeVideoSchema = z.object({ roomId: roomIdSchema, videoId: videoIdSchema });
export const assignRoleSchema = z.object({ roomId: roomIdSchema, userId: z.string().min(1), role: z.enum(["moderator", "participant"]) });
export const userTargetSchema = z.object({ roomId: roomIdSchema, userId: z.string().min(1) });
export const chatSchema = z.object({ roomId: roomIdSchema, message: z.string().trim().min(1).max(500) });
