import type { ChatMessageDTO, PlaybackStateDTO, PlayState, RoomDTO, UserRole } from "../types/events.js";
import type { StoredPlayback, StoredRoom } from "../models/room.model.js";
import { Participant } from "./Participant.js";

interface PlaybackState {
  playState: PlayState;
  currentTime: number;
  videoId: string;
  updatedAt: number;
  sequence: number;
}

const MAX_CHAT_HISTORY = 100;

export class Room {
  public readonly id: string;
  public title: string;
  public readonly ownerId: string;
  public readonly hostToken: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public readonly participants = new Map<string, Participant>();
  private playback: PlaybackState;
  private readonly messages: ChatMessageDTO[];

  constructor(input: {
    id: string;
    title: string;
    videoId: string;
    ownerId?: string;
    hostToken: string;
    createdAt?: Date;
    updatedAt?: Date;
    playback?: StoredPlayback;
    participants?: Participant[];
    messages?: ChatMessageDTO[];
  }) {
    this.id = input.id;
    this.title = input.title;
    this.ownerId = input.ownerId ?? "";
    this.hostToken = input.hostToken;
    this.createdAt = input.createdAt ?? new Date();
    this.updatedAt = input.updatedAt ?? new Date();
    this.playback = input.playback ?? {
      playState: "paused",
      currentTime: 0,
      videoId: input.videoId,
      updatedAt: Date.now(),
      sequence: 0
    };
    this.messages = [...(input.messages ?? [])].slice(-MAX_CHAT_HISTORY);
    for (const participant of input.participants ?? []) {
      this.participants.set(participant.id, participant);
    }
  }

  get participantCount(): number {
    return [...this.participants.values()].filter((participant) => participant.isOnline).length;
  }

  addParticipant(participant: Participant): void {
    this.participants.set(participant.id, participant);
    this.touch();
  }

  removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (!participant) return undefined;
    this.participants.delete(userId);
    this.touch();
    return participant;
  }

  findBySocketId(socketId: string): Participant | undefined {
    return [...this.participants.values()].find((participant) => participant.socketId === socketId);
  }

  findBySessionToken(sessionToken: string): Participant | undefined {
    return [...this.participants.values()].find((participant) => participant.sessionToken === sessionToken);
  }

  findByAccountUserId(accountUserId: string): Participant | undefined {
    if (!accountUserId) return undefined;
    return [...this.participants.values()].find((participant) => participant.accountUserId === accountUserId);
  }

  onlineHost(): Participant | undefined {
    return [...this.participants.values()].find((participant) => participant.role === "host" && participant.isOnline);
  }

  setHost(participant: Participant): void {
    for (const candidate of this.participants.values()) {
      if (candidate.role === "host" && candidate.id !== participant.id) {
        candidate.role = candidate.isOnline ? "moderator" : "participant";
      }
    }
    participant.role = "host";
    this.touch();
  }

  updatePlayback(input: { playState?: PlayState; currentTime?: number; videoId?: string }): PlaybackStateDTO {
    const effectiveTime = this.effectiveCurrentTime();
    this.playback = {
      playState: input.playState ?? this.playback.playState,
      currentTime: input.currentTime ?? effectiveTime,
      videoId: input.videoId ?? this.playback.videoId,
      updatedAt: Date.now(),
      sequence: this.playback.sequence + 1
    };
    this.touch();
    return this.getPlaybackDTO();
  }

  addMessage(message: ChatMessageDTO): void {
    this.messages.push(message);
    if (this.messages.length > MAX_CHAT_HISTORY) {
      this.messages.splice(0, this.messages.length - MAX_CHAT_HISTORY);
    }
    this.touch();
  }

  getMessagesDTO(): ChatMessageDTO[] {
    return [...this.messages];
  }

  getPlaybackDTO(): PlaybackStateDTO {
    return {
      playState: this.playback.playState,
      currentTime: this.effectiveCurrentTime(),
      videoId: this.playback.videoId,
      updatedAt: this.playback.updatedAt,
      serverTime: Date.now(),
      sequence: this.playback.sequence
    };
  }

  getParticipantsDTO() {
    return [...this.participants.values()]
      .sort((a, b) => Room.roleRank(a.role) - Room.roleRank(b.role) || a.joinedAt.getTime() - b.joinedAt.getTime())
      .map((participant) => participant.toDTO());
  }

  toDTO(): RoomDTO {
    return {
      id: this.id,
      title: this.title,
      playback: this.getPlaybackDTO(),
      participants: this.getParticipantsDTO(),
      messages: this.getMessagesDTO(),
      createdAt: this.createdAt.toISOString()
    };
  }

  toPersistence(): StoredRoom {
    return {
      _id: this.id,
      title: this.title,
      ownerId: this.ownerId,
      hostToken: this.hostToken,
      playback: { ...this.playback },
      participants: [...this.participants.values()].map((participant) => participant.toPersistence()),
      messages: this.getMessagesDTO(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromPersistence(input: StoredRoom): Room {
    return new Room({
      id: input._id,
      title: input.title,
      videoId: input.playback.videoId,
      ownerId: input.ownerId ?? "",
      hostToken: input.hostToken,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
      playback: {
        ...input.playback,
        playState: "paused",
        currentTime: input.playback.playState === "playing"
          ? input.playback.currentTime + Math.max(0, Date.now() - input.playback.updatedAt) / 1000
          : input.playback.currentTime,
        updatedAt: Date.now()
      },
      participants: input.participants.map((participant) => Participant.fromPersistence(participant)),
      messages: input.messages ?? []
    });
  }

  selectHostSuccessor(excludingUserId?: string): Participant | undefined {
    const candidates = [...this.participants.values()]
      .filter((participant) => participant.id !== excludingUserId && participant.isOnline)
      .sort((a, b) => Room.roleRank(a.role) - Room.roleRank(b.role) || a.joinedAt.getTime() - b.joinedAt.getTime());
    return candidates[0];
  }

  touch(): void {
    this.updatedAt = new Date();
  }

  private effectiveCurrentTime(): number {
    if (this.playback.playState === "paused") return this.playback.currentTime;
    const elapsedSeconds = Math.max(0, Date.now() - this.playback.updatedAt) / 1000;
    return this.playback.currentTime + elapsedSeconds;
  }

  private static roleRank(role: UserRole): number {
    if (role === "host") return 0;
    if (role === "moderator") return 1;
    return 2;
  }
}
