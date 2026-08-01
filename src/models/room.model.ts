import { model, models, Schema, type Model } from "mongoose";
import type { ChatMessageDTO, PlayState, UserRole } from "../types/events.js";

export interface StoredParticipant {
  id: string;
  accountUserId?: string;
  socketId: string;
  sessionToken: string;
  name: string;
  role: UserRole;
  isOnline: boolean;
  joinedAt: Date;
}

export interface StoredPlayback {
  playState: PlayState;
  currentTime: number;
  videoId: string;
  updatedAt: number;
  sequence: number;
}

export interface StoredRoom {
  _id: string;
  title: string;
  ownerId?: string;
  hostToken: string;
  playback: StoredPlayback;
  participants: StoredParticipant[];
  messages: ChatMessageDTO[];
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<StoredParticipant>({
  id: { type: String, required: true },
  accountUserId: { type: String, default: "" },
  socketId: { type: String, default: "" },
  sessionToken: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ["host", "moderator", "participant"], required: true },
  isOnline: { type: Boolean, default: false },
  joinedAt: { type: Date, required: true }
}, { _id: false });

const playbackSchema = new Schema<StoredPlayback>({
  playState: { type: String, enum: ["playing", "paused"], required: true },
  currentTime: { type: Number, required: true, min: 0 },
  videoId: { type: String, required: true },
  updatedAt: { type: Number, required: true },
  sequence: { type: Number, required: true, min: 0 }
}, { _id: false });

const messageSchema = new Schema<ChatMessageDTO>({
  id: { type: String, required: true },
  senderId: { type: String, required: true },
  sender: { type: String, required: true },
  initials: { type: String, required: true },
  message: { type: String, required: true },
  sentAt: { type: String, required: true }
}, { _id: false });

const roomSchema = new Schema<StoredRoom>({
  _id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  ownerId: { type: String, default: "", index: true },
  hostToken: { type: String, required: true },
  playback: { type: playbackSchema, required: true },
  participants: { type: [participantSchema], default: [] },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true }
}, {
  versionKey: false,
  collection: "rooms"
});

roomSchema.index({ updatedAt: 1 });

export const RoomModel = (models.Room as Model<StoredRoom> | undefined) ?? model<StoredRoom>("Room", roomSchema);
