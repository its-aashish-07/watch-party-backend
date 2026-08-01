import type { RequestHandler } from "express";
import { z } from "zod";
import { roomManager } from "../domain/RoomManager.js";
import { extractYouTubeVideoId } from "../utils/youtube.js";

const createRoomSchema = z.object({
  title: z.string().trim().min(2).max(80),
  videoUrl: z.string().trim().min(1).max(500)
});

export const createRoom: RequestHandler = async (request, response, next) => {
  try {
    const input = createRoomSchema.parse(request.body);
    const videoId = extractYouTubeVideoId(input.videoUrl);
    if (!videoId) {
      response.status(400).json({ ok: false, error: { code: "INVALID_VIDEO", message: "Provide a valid YouTube URL or video ID." } });
      return;
    }

    if (!request.auth) {
      response.status(401).json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Log in to create a room." } });
      return;
    }

    const room = await roomManager.createRoom({ title: input.title, videoId, ownerId: request.auth.userId });
    response.status(201).json({
      ok: true,
      data: {
        room: room.toDTO(),
        hostToken: room.hostToken,
        invitePath: `/room/${room.id}`
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getRoom: RequestHandler = (request, response) => {
  const room = roomManager.getRoom(String(request.params.roomId));
  if (!room) {
    response.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "Watch room not found." } });
    return;
  }

  response.json({
    ok: true,
    data: {
      id: room.id,
      title: room.title,
      videoId: room.getPlaybackDTO().videoId,
      participantCount: room.participantCount,
      createdAt: room.createdAt.toISOString()
    }
  });
};
