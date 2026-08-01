import { describe, expect, it } from "vitest";
import { extractYouTubeVideoId } from "../src/utils/youtube.js";

describe("extractYouTubeVideoId", () => {
  it("accepts a video id", () => expect(extractYouTubeVideoId("LXb3EKWsInQ")).toBe("LXb3EKWsInQ"));
  it("parses watch URLs", () => expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=LXb3EKWsInQ")).toBe("LXb3EKWsInQ"));
  it("parses short URLs", () => expect(extractYouTubeVideoId("https://youtu.be/LXb3EKWsInQ")).toBe("LXb3EKWsInQ"));
  it("rejects invalid values", () => expect(extractYouTubeVideoId("not-a-video")).toBeNull());
});
