import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { simulationChoices, streamAfter } from "@/components/cleaner/stream-control-state";
import { liveInProgress, readStatusAnswer, readVideoLink } from "@/components/customer/live-status";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The live view (T22, T23): what the cleaner's stream controls show after each answer from the server,
// which simulation buttons they offer, and how the customer's viewer reads the polled status and the
// fresh link from GET /api/streams/<order id>. Pure rules; the components render what these return.

describe("streamAfter (the cleaner's controls)", () => {
  it("starts as active once the server has started the stream", () => {
    expect(streamAfter("off", "start", { ok: true })).toEqual({ stream: "active", note: null, error: null });
  });

  it("shows each simulated state the server accepted", () => {
    expect(streamAfter("active", "weak", { ok: true }).stream).toBe("weak");
    expect(streamAfter("weak", "disconnected", { ok: true }).stream).toBe("disconnected");
    expect(streamAfter("disconnected", "active", { ok: true }).stream).toBe("active");
  });

  it("goes back to off with a note when the stream is stopped", () => {
    expect(streamAfter("weak", "ended", { ok: true })).toEqual({ stream: "off", note: "stopped", error: null });
  });

  it("keeps the state and names the refusal when the server refuses", () => {
    expect(streamAfter("off", "start", { formError: "notCheckedIn" })).toEqual({ stream: "off", note: null, error: "notCheckedIn" });
    expect(streamAfter("active", "weak", { formError: "unavailable" })).toEqual({ stream: "active", note: null, error: "unavailable" });
  });

  it("treats a stream the server no longer has as off", () => {
    expect(streamAfter("active", "weak", { formError: "notFound" })).toEqual({ stream: "off", note: null, error: "streamGone" });
    // Starting a job that is not found is a different problem: the job itself.
    expect(streamAfter("off", "start", { formError: "notFound" }).error).toBe("notFound");
  });

  it("keeps the state when there is no answer yet", () => {
    expect(streamAfter("weak", "disconnected", null)).toEqual({ stream: "weak", note: null, error: null });
  });
});

describe("simulationChoices", () => {
  it("offers weak signal and disconnected while active, with no reconnect", () => {
    expect(simulationChoices("active")).toEqual([
      { status: "weak", current: false },
      { status: "disconnected", current: false },
    ]);
  });

  it("marks the current state and offers reconnect when the signal is not normal", () => {
    expect(simulationChoices("weak")).toEqual([
      { status: "weak", current: true },
      { status: "disconnected", current: false },
      { status: "active", current: false },
    ]);
    expect(simulationChoices("disconnected").map((choice) => choice.current)).toEqual([false, true, false]);
  });

  it("offers nothing while the stream is off", () => {
    expect(simulationChoices("off")).toEqual([]);
  });
});

describe("readStatusAnswer (the customer's polling)", () => {
  it("reads a live status", () => {
    expect(readStatusAnswer(200, { status: "weak" })).toEqual({ kind: "live", status: "weak" });
    expect(readStatusAnswer(200, { status: "active" })).toEqual({ kind: "live", status: "active" });
  });

  it("reads an ended stream, or one the viewer may no longer watch, as gone", () => {
    expect(readStatusAnswer(404, { error: "stream_not_found" })).toEqual({ kind: "gone" });
    expect(readStatusAnswer(200, { status: "ended" })).toEqual({ kind: "gone" });
  });

  it("reads a lost session as signed out", () => {
    expect(readStatusAnswer(401, { error: "sign_in_required" })).toEqual({ kind: "signedOut" });
  });

  it("does not guess on a server problem or an answer it cannot read", () => {
    expect(readStatusAnswer(503, { error: "unavailable" })).toEqual({ kind: "unknown" });
    expect(readStatusAnswer(200, { status: "recording" })).toEqual({ kind: "unknown" });
    expect(readStatusAnswer(200, null)).toEqual({ kind: "unknown" });
    expect(readStatusAnswer(200, "active")).toEqual({ kind: "unknown" });
  });
});

describe("readVideoLink", () => {
  const url = "https://example.supabase.co/storage/v1/object/sign/recordings/library/a.mp4?token=x";

  it("returns the video link of the demo source", () => {
    expect(readVideoLink({ status: "active", view: { kind: "video", url, expiresInSeconds: 600 } })).toBe(url);
  });

  it("returns nothing for another kind of view, a missing link or a link that is not http(s)", () => {
    expect(readVideoLink({ view: { kind: "livekit", serverUrl: "wss://x", token: "t" } })).toBeNull();
    expect(readVideoLink({ view: { kind: "video" } })).toBeNull();
    expect(readVideoLink({ view: { kind: "video", url: "javascript:alert(1)" } })).toBeNull();
    expect(readVideoLink(null)).toBeNull();
  });
});

describe("liveInProgress", () => {
  const base = { status: "paid" as const, checkedInAt: "2026-11-04T03:00:00.000Z", completedAt: null };

  it("is true for a paid job that is checked in and not finished", () => {
    expect(liveInProgress(base)).toBe(true);
  });

  it("is false before check-in, after check-out and for an unpaid order", () => {
    expect(liveInProgress({ ...base, checkedInAt: null })).toBe(false);
    expect(liveInProgress({ ...base, completedAt: "2026-11-04T05:00:00.000Z" })).toBe(false);
    expect(liveInProgress({ ...base, status: "pending_payment" })).toBe(false);
  });
});

describe("the stream messages", () => {
  it("name every state in words, in both languages", () => {
    for (const messages of [id, en]) {
      const viewer = createTranslator({ locale: "id", messages, namespace: "LiveStream" });
      const cleaner = createTranslator({ locale: "id", messages, namespace: "CleanerStream" });
      for (const status of ["active", "weak", "disconnected"] as const) {
        expect(viewer(`status.${status}`)).not.toBe("");
        expect(cleaner(`status.${status}`)).not.toBe("");
      }
    }
  });

  it("never name a partner agency on the customer's viewer", () => {
    expect(JSON.stringify(id.LiveStream)).not.toMatch(/agensi|agency|mitra|partner/i);
    expect(JSON.stringify(en.LiveStream)).not.toMatch(/agensi|agency|mitra|partner/i);
  });
});
