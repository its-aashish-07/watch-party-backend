import { nanoid } from "nanoid";
import type { ParticipantDTO, UserRole } from "../types/events.js";
import type { StoredParticipant } from "../models/room.model.js";

export class Participant {
  public readonly id: string;
  public readonly accountUserId: string;
  public socketId: string;
  public readonly sessionToken: string;
  public name: string;
  public role: UserRole;
  public isOnline: boolean;
  public readonly joinedAt: Date;

  constructor(input: {
    accountUserId?: string;
    socketId: string;
    name: string;
    role: UserRole;
    sessionToken?: string;
    id?: string;
    isOnline?: boolean;
    joinedAt?: Date;
  }) {
    this.id = input.id ?? nanoid(12);
    this.accountUserId = input.accountUserId ?? "";
    this.socketId = input.socketId;
    this.sessionToken = input.sessionToken ?? nanoid(32);
    this.name = input.name;
    this.role = input.role;
    this.isOnline = input.isOnline ?? true;
    this.joinedAt = input.joinedAt ?? new Date();
  }

  reconnect(socketId: string, name: string): void {
    this.socketId = socketId;
    this.name = name;
    this.isOnline = true;
  }

  toDTO(): ParticipantDTO {
    return {
      id: this.id,
      name: this.name,
      initials: Participant.initials(this.name),
      role: this.role,
      isOnline: this.isOnline,
      joinedAt: this.joinedAt.toISOString()
    };
  }

  toPersistence(): StoredParticipant {
    return {
      id: this.id,
      accountUserId: this.accountUserId,
      socketId: this.socketId,
      sessionToken: this.sessionToken,
      name: this.name,
      role: this.role,
      isOnline: this.isOnline,
      joinedAt: this.joinedAt
    };
  }

  static fromPersistence(input: StoredParticipant): Participant {
    return new Participant({
      id: input.id,
      accountUserId: input.accountUserId ?? "",
      socketId: "",
      sessionToken: input.sessionToken,
      name: input.name,
      role: input.role,
      isOnline: false,
      joinedAt: new Date(input.joinedAt)
    });
  }

  private static initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "U";
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
  }
}
