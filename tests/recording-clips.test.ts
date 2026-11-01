import { describe, expect, it } from "vitest";
import { pickClip, recordingPath } from "@/lib/recordings/attach";
import { clipFileName, clipFiles } from "../scripts/seed.mjs";

// The pure parts of attaching a recording (T13). The real storage is covered by
// tests/integration/recordings.test.ts.

const orderId = "0000000b-1111-4222-8333-444444444444";

describe("pickClip", () => {
  it("picks the same clip for the same order, whatever order the library lists them in", () => {
    expect(pickClip(["a.mp4", "b.mp4", "c.mp4"], orderId)).toBe(pickClip(["c.mp4", "a.mp4", "b.mp4"], orderId));
  });

  it("spreads orders over the library", () => {
    const clips = ["a.mp4", "b.mp4", "c.mp4"];
    const picks = ["00000000", "00000001", "00000002"].map((start) => pickClip(clips, `${start}-1111-4222-8333-444444444444`));
    expect(new Set(picks).size).toBe(3);
  });

  it("has nothing to pick from an empty library", () => {
    expect(pickClip([], orderId)).toBeNull();
  });
});

describe("recordingPath", () => {
  it("files a job's copy under its order, keeping the clip's type", () => {
    expect(recordingPath(orderId, "kitchen.webm")).toBe(`jobs/${orderId}.webm`);
    expect(recordingPath(orderId, "living.room.mp4")).toBe(`jobs/${orderId}.mp4`);
  });
});

describe("clip files for the seed", () => {
  it("makes a file name storage accepts", () => {
    expect(clipFileName("Video Cleaning (1).MP4")).toBe("video-cleaning-1.mp4");
  });

  it("takes only videos, each with its type", () => {
    expect(clipFiles(["a.mp4", "b.WEBM", "notes.txt", ".gitkeep"])).toEqual([
      { source: "a.mp4", name: "a.mp4", contentType: "video/mp4" },
      { source: "b.WEBM", name: "b.webm", contentType: "video/webm" },
    ]);
  });
});
