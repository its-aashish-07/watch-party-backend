import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { RoomModel, type StoredRoom } from "../models/room.model.js";
import { Room } from "./Room.js";

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly persistenceQueues = new Map<string, Promise<void>>();

  async initialize(): Promise<number> {
    const cutoff = new Date(Date.now() - env.ROOM_TTL_MINUTES * 60_000);
    const documents = await RoomModel.find({ updatedAt: { $gte: cutoff } }).lean().exec();

    this.rooms.clear();
    for (const document of documents) {
      const room = Room.fromPersistence(document as StoredRoom);
      this.rooms.set(room.id, room);
    }

    await RoomModel.deleteMany({ updatedAt: { $lt: cutoff } }).exec();
    return this.rooms.size;
  }

  async createRoom(input: { title: string; videoId: string; ownerId: string }): Promise<Room> {
    const id = await this.createUniqueRoomId();
    const room = new Room({
      id,
      title: input.title,
      videoId: input.videoId,
      ownerId: input.ownerId,
      hostToken: nanoid(40)
    });
    this.rooms.set(id, room);
    try {
      await this.persistRoom(room);
      return room;
    } catch (error) {
      this.rooms.delete(id);
      throw error;
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(RoomManager.normalizeId(roomId));
  }

  async persistRoom(room: Room): Promise<void> {
    const snapshot = room.toPersistence();
    const previous = this.persistenceQueues.get(room.id) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        await RoomModel.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true }).exec();
      });

    this.persistenceQueues.set(room.id, operation);
    try {
      await operation;
    } finally {
      if (this.persistenceQueues.get(room.id) === operation) {
        this.persistenceQueues.delete(room.id);
      }
    }
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const normalizedId = RoomManager.normalizeId(roomId);
    const existed = this.rooms.delete(normalizedId);
    await RoomModel.deleteOne({ _id: normalizedId }).exec();
    return existed;
  }

  async cleanupExpiredRooms(): Promise<string[]> {
    const expired: string[] = [];
    const ttlMs = env.ROOM_TTL_MINUTES * 60_000;
    const now = Date.now();

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participantCount === 0 && now - room.updatedAt.getTime() > ttlMs) {
        this.rooms.delete(roomId);
        expired.push(roomId);
      }
    }

    if (expired.length > 0) {
      await RoomModel.deleteMany({ _id: { $in: expired } }).exec();
    }
    return expired;
  }

  private async createUniqueRoomId(): Promise<string> {
    let id = "";
    let exists = true;
    while (exists) {
      id = `WP-${nanoid(6).toUpperCase()}`;
      exists = this.rooms.has(id) || Boolean(await RoomModel.exists({ _id: id }));
    }
    return id;
  }

  static normalizeId(roomId: string): string {
    return roomId.trim().toUpperCase();
  }
}

export const roomManager = new RoomManager();
