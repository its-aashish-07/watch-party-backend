import { describe, expect, it, vi } from "vitest";
import { Room } from "../src/domain/Room.js";

vi.mock("../src/config/env.js", () => ({ env: { ROOM_TTL_MINUTES: 360, MAX_PARTICIPANTS_PER_ROOM: 50 } }));

describe("Room playback", () => {
  it("advances current time while playing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T00:00:00Z"));
    const room = new Room({ id: "WP-TEST", title: "Test", videoId: "LXb3EKWsInQ", hostToken: "token" });
    room.updatePlayback({ playState: "playing", currentTime: 10 });
    vi.advanceTimersByTime(5_000);
    expect(room.getPlaybackDTO().currentTime).toBeCloseTo(15, 1);
    vi.useRealTimers();
  });
});
