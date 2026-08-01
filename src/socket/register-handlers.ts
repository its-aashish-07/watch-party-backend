import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import { env } from "../config/env.js";
import { Participant } from "../domain/Participant.js";
import { roomManager } from "../domain/RoomManager.js";
import type { Room } from "../domain/Room.js";
import type {
  Ack,
  ChatMessageDTO,
  ClientToServerEvents,
  ParticipantDTO,
  ServerToClientEvents,
  SocketData,
  UserRole
} from "../types/events.js";
import { fail, succeed } from "../utils/socket-response.js";
import {
  assignRoleSchema,
  changeVideoSchema,
  chatSchema,
  joinRoomSchema,
  playbackSchema,
  roomActionSchema,
  seekSchema,
  userTargetSchema
} from "./schemas.js";

type WatchPartyServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type WatchPartySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function actorFor(socket: WatchPartySocket, roomId: string) {
  const room = roomManager.getRoom(roomId);
  const actor = room?.findBySocketId(socket.id);
  return { room, actor };
}

function requireRole<T>(socket: WatchPartySocket, roomId: string, roles: UserRole[], ack?: Ack<T>) {
  const { room, actor } = actorFor(socket, roomId);
  if (!room) {
    fail(ack, "ROOM_NOT_FOUND", "Watch room not found.");
    return null;
  }
  if (!actor || !actor.isOnline) {
    fail(ack, "NOT_IN_ROOM", "Join the room before sending this event.");
    return null;
  }
  if (!roles.includes(actor.role)) {
    fail(ack, "FORBIDDEN", `This action requires one of these roles: ${roles.join(", ")}.`);
    return null;
  }
  return { room, actor };
}

function parseOrFail<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  payload: unknown,
  ack?: Ack<any>
): T | null {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    fail(ack, "VALIDATION_ERROR", "Invalid event payload.");
    return null;
  }
  return parsed.data;
}

async function persistOrFail<T>(room: Room, ack?: Ack<T>): Promise<boolean> {
  try {
    await roomManager.persistRoom(room);
    return true;
  } catch (error) {
    console.error(`Failed to persist room ${room.id}`, error);
    fail(ack, "DATABASE_ERROR", "The room could not be saved. Please try again.");
    return false;
  }
}

function broadcastHostTransfer(
  io: WatchPartyServer,
  roomId: string,
  previousHostId: string,
  newHostId: string,
  participants: ParticipantDTO[]
): void {
  io.to(roomId).emit("host_transferred", { previousHostId, newHostId, participants });
}

function transferHostAfterDeparture(room: Room, previousHostId: string): Participant | undefined {
  if (room.onlineHost()) return undefined;
  const successor = room.selectHostSuccessor(previousHostId);
  if (!successor) return undefined;
  room.setHost(successor);
  return successor;
}

export function registerSocketHandlers(io: WatchPartyServer, socket: WatchPartySocket): void {
  socket.on("join_room", async (rawPayload, ack) => {
    const payload = parseOrFail(joinRoomSchema, rawPayload, ack);
    if (!payload) return;

    const room = roomManager.getRoom(payload.roomId);
    if (!room) {
      fail(ack, "ROOM_NOT_FOUND", "Watch room not found.");
      return;
    }

    const accountUserId = socket.data.accountUserId;
    const displayName = socket.data.accountName;
    if (!accountUserId || !displayName) {
      fail(ack, "AUTH_REQUIRED", "Log in before joining a room.");
      return;
    }

    let participant = payload.sessionToken ? room.findBySessionToken(payload.sessionToken) : undefined;
    if (participant && participant.accountUserId !== accountUserId) {
      participant = undefined;
    }
    participant ??= room.findByAccountUserId(accountUserId);
    let isNewParticipant = false;

    if (participant) {
      const timer = disconnectTimers.get(participant.id);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(participant.id);
      }
      participant.reconnect(socket.id, displayName);
      room.touch();
    } else {
      if (room.participantCount >= env.MAX_PARTICIPANTS_PER_ROOM) {
        fail(ack, "ROOM_FULL", "This room has reached its participant limit.");
        return;
      }
      participant = new Participant({
        accountUserId,
        socketId: socket.id,
        name: displayName,
        role: "participant"
      });
      room.addParticipant(participant);
      isNewParticipant = true;
    }

    const isRoomOwner = Boolean(room.ownerId) && room.ownerId === accountUserId;
    if (!room.onlineHost() && (participant.role === "host" || isRoomOwner || payload.hostToken === room.hostToken)) {
      room.setHost(participant);
    }

    if (!await persistOrFail(room, ack)) return;

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.userId = participant.id;
    socket.data.sessionToken = participant.sessionToken;

    const participants = room.getParticipantsDTO();
    succeed(ack, { room: room.toDTO(), self: participant.toDTO(), sessionToken: participant.sessionToken });
    socket.emit("sync_state", room.getPlaybackDTO());

    if (isNewParticipant) {
      socket.to(room.id).emit("user_joined", { participant: participant.toDTO(), participants });
    } else {
      io.to(room.id).emit("user_joined", { participant: participant.toDTO(), participants });
    }
  });

  socket.on("request_sync", (rawPayload, ack) => {
    const payload = parseOrFail(roomActionSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator", "participant"], ack);
    if (!access) return;
    const playback = access.room.getPlaybackDTO();
    socket.emit("sync_state", playback);
    succeed(ack, { playback });
  });

  socket.on("play", async (rawPayload, ack) => {
    const payload = parseOrFail(playbackSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator"], ack);
    if (!access) return;
    const playback = access.room.updatePlayback({ playState: "playing", currentTime: payload.currentTime });
    if (!await persistOrFail(access.room, ack)) return;
    io.to(access.room.id).emit("sync_state", playback);
    succeed(ack, { playback });
  });

  socket.on("pause", async (rawPayload, ack) => {
    const payload = parseOrFail(playbackSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator"], ack);
    if (!access) return;
    const playback = access.room.updatePlayback({ playState: "paused", currentTime: payload.currentTime });
    if (!await persistOrFail(access.room, ack)) return;
    io.to(access.room.id).emit("sync_state", playback);
    succeed(ack, { playback });
  });

  socket.on("seek", async (rawPayload, ack) => {
    const payload = parseOrFail(seekSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator"], ack);
    if (!access) return;
    const playback = access.room.updatePlayback({ currentTime: payload.time });
    if (!await persistOrFail(access.room, ack)) return;
    io.to(access.room.id).emit("sync_state", playback);
    succeed(ack, { playback });
  });

  socket.on("change_video", async (rawPayload, ack) => {
    const payload = parseOrFail(changeVideoSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator"], ack);
    if (!access) return;
    const playback = access.room.updatePlayback({ videoId: payload.videoId, currentTime: 0, playState: "paused" });
    if (!await persistOrFail(access.room, ack)) return;
    io.to(access.room.id).emit("sync_state", playback);
    succeed(ack, { playback });
  });

  socket.on("assign_role", async (rawPayload, ack) => {
    const payload = parseOrFail(assignRoleSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host"], ack);
    if (!access) return;
    const target = access.room.participants.get(payload.userId);
    if (!target) {
      fail(ack, "USER_NOT_FOUND", "Participant not found.");
      return;
    }
    if (target.role === "host") {
      fail(ack, "INVALID_ROLE_CHANGE", "Use transfer_host to change the host.");
      return;
    }
    target.role = payload.role;
    access.room.touch();
    if (!await persistOrFail(access.room, ack)) return;
    const participants = access.room.getParticipantsDTO();
    io.to(access.room.id).emit("role_assigned", { userId: target.id, username: target.name, role: target.role, participants });
    succeed(ack, { participants });
  });

  socket.on("remove_participant", async (rawPayload, ack) => {
    const payload = parseOrFail(userTargetSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host"], ack);
    if (!access) return;
    if (payload.userId === access.actor.id) {
      fail(ack, "INVALID_ACTION", "The host cannot remove themselves. Transfer host first.");
      return;
    }
    const target = access.room.participants.get(payload.userId);
    if (!target) {
      fail(ack, "USER_NOT_FOUND", "Participant not found.");
      return;
    }
    access.room.removeParticipant(target.id);
    if (!await persistOrFail(access.room, ack)) return;
    const participants = access.room.getParticipantsDTO();
    io.to(access.room.id).emit("participant_removed", { userId: target.id, participants });
    io.sockets.sockets.get(target.socketId)?.leave(access.room.id);
    io.sockets.sockets.get(target.socketId)?.disconnect(true);
    succeed(ack, { participants });
  });

  socket.on("transfer_host", async (rawPayload, ack) => {
    const payload = parseOrFail(userTargetSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host"], ack);
    if (!access) return;
    const target = access.room.participants.get(payload.userId);
    if (!target || !target.isOnline) {
      fail(ack, "USER_NOT_FOUND", "Choose an online participant.");
      return;
    }
    if (target.id === access.actor.id) {
      fail(ack, "INVALID_ACTION", "You are already the host.");
      return;
    }
    const previousHostId = access.actor.id;
    access.actor.role = "moderator";
    access.room.setHost(target);
    if (!await persistOrFail(access.room, ack)) return;
    const participants = access.room.getParticipantsDTO();
    broadcastHostTransfer(io, access.room.id, previousHostId, target.id, participants);
    succeed(ack, { participants });
  });

  socket.on("chat_message", async (rawPayload, ack) => {
    const payload = parseOrFail(chatSchema, rawPayload, ack);
    if (!payload) return;
    const access = requireRole(socket, payload.roomId, ["host", "moderator", "participant"], ack);
    if (!access) return;
    const message: ChatMessageDTO = {
      id: nanoid(12),
      senderId: access.actor.id,
      sender: access.actor.name,
      initials: access.actor.toDTO().initials,
      message: payload.message,
      sentAt: new Date().toISOString()
    };
    access.room.addMessage(message);
    if (!await persistOrFail(access.room, ack)) return;
    io.to(access.room.id).emit("chat_message", message);
    succeed(ack, { message });
  });

  socket.on("leave_room", async (rawPayload, ack) => {
    const payload = parseOrFail(roomActionSchema, rawPayload, ack);
    if (!payload) return;
    const { room, actor } = actorFor(socket, payload.roomId);
    if (!room || !actor) {
      fail(ack, "NOT_IN_ROOM", "You are not in this room.");
      return;
    }
    const wasHost = actor.role === "host";
    room.removeParticipant(actor.id);
    const successor = wasHost ? transferHostAfterDeparture(room, actor.id) : undefined;
    if (!await persistOrFail(room, ack)) return;

    socket.leave(room.id);
    const participants = room.getParticipantsDTO();
    socket.to(room.id).emit("user_left", { userId: actor.id, username: actor.name, participants });
    if (successor) broadcastHostTransfer(io, room.id, actor.id, successor.id, participants);
    succeed(ack, { roomId: room.id });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    if (!roomId || !userId) return;
    const room = roomManager.getRoom(roomId);
    const actor = room?.participants.get(userId);
    if (!room || !actor || actor.socketId !== socket.id) return;

    const wasHost = actor.role === "host";
    actor.isOnline = false;
    if (wasHost) actor.role = "participant";
    room.touch();
    const successor = wasHost ? transferHostAfterDeparture(room, actor.id) : undefined;

    void roomManager.persistRoom(room).then(() => {
      const participants = room.getParticipantsDTO();
      socket.to(room.id).emit("user_left", { userId: actor.id, username: actor.name, participants });
      if (successor) broadcastHostTransfer(io, room.id, actor.id, successor.id, participants);
    }).catch((error) => console.error(`Failed to persist disconnect for room ${room.id}`, error));

    const timer = setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomId);
      const currentActor = currentRoom?.participants.get(userId);
      if (currentRoom && currentActor && !currentActor.isOnline && currentActor.socketId === socket.id) {
        currentRoom.removeParticipant(userId);
        void roomManager.persistRoom(currentRoom).then(() => {
          io.to(roomId).emit("user_left", {
            userId,
            username: currentActor.name,
            participants: currentRoom.getParticipantsDTO()
          });
        }).catch((error) => console.error(`Failed to persist participant removal for room ${roomId}`, error));
      }
      disconnectTimers.delete(userId);
    }, 20_000);
    timer.unref();
    disconnectTimers.set(userId, timer);
  });
}
