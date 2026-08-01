export type UserRole = "host" | "moderator" | "participant";
export type PlayState = "playing" | "paused";

export interface ParticipantDTO {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  isOnline: boolean;
  joinedAt: string;
}

export interface PlaybackStateDTO {
  playState: PlayState;
  currentTime: number;
  videoId: string;
  updatedAt: number;
  serverTime: number;
  sequence: number;
}

export interface ChatMessageDTO {
  id: string;
  senderId: string;
  sender: string;
  initials: string;
  message: string;
  sentAt: string;
}

export interface RoomDTO {
  id: string;
  title: string;
  playback: PlaybackStateDTO;
  participants: ParticipantDTO[];
  messages: ChatMessageDTO[];
  createdAt: string;
}

export type AckSuccess<T> = { ok: true; data: T };
export type AckFailure = { ok: false; error: { code: string; message: string } };
export type Ack<T> = (response: AckSuccess<T> | AckFailure) => void;

export interface ClientToServerEvents {
  join_room: (
    payload: { roomId: string; username: string; hostToken?: string; sessionToken?: string },
    ack?: Ack<{ room: RoomDTO; self: ParticipantDTO; sessionToken: string }>
  ) => void;
  leave_room: (payload: { roomId: string }, ack?: Ack<{ roomId: string }>) => void;
  request_sync: (payload: { roomId: string }, ack?: Ack<{ playback: PlaybackStateDTO }>) => void;
  play: (payload: { roomId: string; currentTime: number }, ack?: Ack<{ playback: PlaybackStateDTO }>) => void;
  pause: (payload: { roomId: string; currentTime: number }, ack?: Ack<{ playback: PlaybackStateDTO }>) => void;
  seek: (payload: { roomId: string; time: number }, ack?: Ack<{ playback: PlaybackStateDTO }>) => void;
  change_video: (payload: { roomId: string; videoId: string }, ack?: Ack<{ playback: PlaybackStateDTO }>) => void;
  assign_role: (payload: { roomId: string; userId: string; role: Exclude<UserRole, "host"> }, ack?: Ack<{ participants: ParticipantDTO[] }>) => void;
  remove_participant: (payload: { roomId: string; userId: string }, ack?: Ack<{ participants: ParticipantDTO[] }>) => void;
  transfer_host: (payload: { roomId: string; userId: string }, ack?: Ack<{ participants: ParticipantDTO[] }>) => void;
  chat_message: (payload: { roomId: string; message: string }, ack?: Ack<{ message: ChatMessageDTO }>) => void;
}

export interface ServerToClientEvents {
  sync_state: (payload: PlaybackStateDTO) => void;
  user_joined: (payload: { participant: ParticipantDTO; participants: ParticipantDTO[] }) => void;
  user_left: (payload: { userId: string; username: string; participants: ParticipantDTO[] }) => void;
  role_assigned: (payload: { userId: string; username: string; role: UserRole; participants: ParticipantDTO[] }) => void;
  participant_removed: (payload: { userId: string; participants: ParticipantDTO[] }) => void;
  host_transferred: (payload: { previousHostId: string; newHostId: string; participants: ParticipantDTO[] }) => void;
  chat_message: (payload: ChatMessageDTO) => void;
  room_closed: (payload: { roomId: string; reason: string }) => void;
  error_message: (payload: { code: string; message: string }) => void;
}

export interface SocketData {
  roomId?: string;
  userId?: string;
  sessionToken?: string;
  accountUserId?: string;
  accountName?: string;
  accountEmail?: string;
}
