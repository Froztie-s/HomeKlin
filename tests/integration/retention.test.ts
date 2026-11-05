import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachRecording, clipFolder, recordingsBucket } from "@/lib/recordings/attach";
import { recordingLink } from "@/lib/recordings/link";
import { deleteExpiredRecordings } from "@/lib/recordings/retention";
import { adminClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// The 7-day retention (T16, src/lib/recordings/retention.ts) against the real test project, with a
// 2-second retention: once it has passed, the cleanup deletes the file and marks the entry, and the
// server refuses the entry. Recordings still inside their retention are left alone. The cleanup runs on
// the real clock: other test files keep recordings that expire within minutes, and a "now" in the
// future would delete their files too.

let world: World;
const clipName = "test-clip.mp4"; // shared by every test file, never deleted
const clipBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
const files: string[] = [];

beforeAll(async () => {
  world = await createWorld("t16");
  await adminClient().storage.from(recordingsBucket).upload(`${clipFolder}/${clipName}`, clipBytes, { contentType: "video/mp4", upsert: true });
}, 180_000);

afterAll(async () => {
  await adminClient().storage.from(recordingsBucket).remove(files);
  await world.cleanup();
}, 120_000);

const fileExists = async (path: string) => {
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data } = await adminClient().storage.from(recordingsBucket).list(folder, { search: path.slice(folder.length + 1) });
  return (data ?? []).length > 0;
};

describe("deleteExpiredRecordings", { timeout: 60_000 }, () => {
  it("deletes a recording whose retention has passed, and the server then refuses it", async () => {
    const short = await attachRecording(adminClient(), await world.job({ startsAt: new Date(Date.now() - hours(3)), completed: true }), {
      retentionDays: 2 / (24 * 60 * 60),
    });
    const kept = await attachRecording(adminClient(), await world.job({ startsAt: new Date(Date.now() - hours(3)), completed: true }));
    files.push(short.filePath, kept.filePath);
    expect(await fileExists(short.filePath)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 3000));
    const result = await deleteExpiredRecordings(adminClient());
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    expect(await fileExists(short.filePath)).toBe(false);
    expect(await fileExists(kept.filePath)).toBe(true);
    const { data } = await adminClient().from("recordings").select("id, deleted_at").in("id", [short.id, kept.id]);
    expect(data?.find((row) => row.id === short.id)?.deleted_at).not.toBeNull();
    expect(data?.find((row) => row.id === kept.id)?.deleted_at).toBeNull();

    await expect(recordingLink(world.users.customer.client, adminClient(), short.id)).rejects.toMatchObject({ reason: "recording_expired" });
    await expect(recordingLink(world.users.customer.client, adminClient(), kept.id)).resolves.toMatchObject({ url: expect.any(String) });
  });

  it("refuses a deleted entry even before its date, and running again deletes nothing twice", async () => {
    const recording = await attachRecording(adminClient(), await world.job({ startsAt: new Date(Date.now() - hours(3)), completed: true }));
    files.push(recording.filePath);
    await adminClient().from("recordings").update({ deleted_at: new Date().toISOString() }).eq("id", recording.id);
    await expect(recordingLink(world.users.admin.client, adminClient(), recording.id)).rejects.toMatchObject({ reason: "recording_expired" });

    const again = await deleteExpiredRecordings(adminClient());
    const { data } = await adminClient().from("recordings").select("id").eq("id", recording.id).is("deleted_at", null);
    expect(data).toEqual([]);
    expect(again.deleted).toBeGreaterThanOrEqual(0);
  });
});
