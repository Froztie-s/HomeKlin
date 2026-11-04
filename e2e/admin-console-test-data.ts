import { randomUUID } from "node:crypto";
import { attachRecording, recordingsBucket } from "../src/lib/recordings/attach";
import { adminClient, type TestUser } from "../tests/integration/test-project";
import { createJobWorld, type JobWorld } from "./job-test-data";
import { standInClip } from "./recording-test-data";

// Test data for the admin console specs and screenshots (T24-T26), in the shared Supabase test project,
// on top of the job world (e2e/job-test-data.ts): an agency of its own in Jakarta Timur with three
// cleaners; two jobs in progress, each with a live stream (a stream_sessions row written with the secret
// key, as start_stream would write it); one of today's jobs without a cleaner; a job finished two days
// ago with a recording that plays, and one finished nine days ago whose recording was deleted after
// its 7 days; and an urgent open ticket from the world's customer. The recording is attached the way
// check-out does (attachRecording), from the 8-byte stand-in clip in the library, which is upserted
// and never deleted (other tests share it). The world's cleanup removes everything made here: the
// recording files under jobs/, the orders (their streams and recordings go with them), the windows,
// the agency and the users (the ticket goes with its customer).

const minute = 60_000;
const day = 24 * 60;

export type ConsoleWorld = {
  world: JobWorld;
  agencyName: string;
  cleaners: { first: string; second: string; recorded: string };
  /** Order ids of the two jobs being streamed, and of today's job without a cleaner. */
  live: { first: string; second: string };
  waiting: string;
  /** The finished jobs and their recordings. */
  recorded: { available: { orderId: string; recordingId: string }; expired: { orderId: string; recordingId: string } };
  ticket: { id: string; question: string };
  admin: TestUser;
  cleanup: () => Promise<void>;
};

async function must<T>(what: string, request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Could not set up ${what}: ${error.message}`);
  return data as T;
}

export async function createConsoleWorld(label: string): Promise<ConsoleWorld> {
  const admin = adminClient();
  const world = await createJobWorld(label);
  try {
    const suffix = randomUUID().slice(0, 6);
    const agencyName = `Uji Agensi Konsol ${suffix}`;
    const agency = await world.agency(agencyName);
    const cleaners = { first: "Uji Petugas Siaran Satu", second: "Uji Petugas Siaran Dua", recorded: "Uji Petugas Rekaman" };
    const first = await world.cleaner(agency.id, cleaners.first);
    const second = await world.cleaner(agency.id, cleaners.second);
    const recorded = await world.cleaner(agency.id, cleaners.recorded);

    const liveFirst = await world.job({
      agencyId: agency.id,
      cleaner: first,
      startsIn: -30,
      address: "Jl. Uji Siaran No. 1, Cakung, Jakarta Timur",
      checkedInMinutesAgo: 20,
    });
    const liveSecond = await world.job({
      agencyId: agency.id,
      cleaner: second,
      startsIn: -20,
      address: "Jl. Uji Siaran No. 2, Cakung, Jakarta Timur",
      checkedInMinutesAgo: 10,
    });
    const waiting = await world.job({ agencyId: agency.id, cleaner: null, startsIn: 45, address: "Jl. Uji Menunggu No. 3, Cakung, Jakarta Timur" });

    // As start_stream writes it: one session per job, the demo source, a status the cleaner's page reports.
    await must(
      "the live streams",
      admin.from("stream_sessions").insert([
        { order_id: liveFirst.id, cleaner_id: first.id, agency_id: agency.id, source: "demo", status: "active" },
        { order_id: liveSecond.id, cleaner_id: second.id, agency_id: agency.id, source: "demo", status: "weak" },
      ]),
    );
    await must(
      "the stand-in clip",
      admin.storage.from(recordingsBucket).upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true }),
    );

    const availableJob = await world.job({
      agencyId: agency.id,
      cleaner: recorded,
      startsIn: -2 * day,
      address: "Jl. Uji Rekaman No. 4, Cakung, Jakarta Timur",
      completedMinutesAgo: 2 * day - 120,
    });
    const available = await attachRecording(admin, availableJob.id);

    const expiredJob = await world.job({
      agencyId: agency.id,
      cleaner: recorded,
      startsIn: -9 * day,
      address: "Jl. Uji Kedaluwarsa No. 5, Cakung, Jakarta Timur",
      completedMinutesAgo: 9 * day - 120,
    });
    // As the 7-day cleanup (T16) leaves it: the row stays, marked deleted; it never had a file.
    const now = Date.now();
    const expired = await must(
      "the expired recording",
      admin
        .from("recordings")
        .insert({
          order_id: expiredJob.id,
          agency_id: agency.id,
          file_path: `jobs/${expiredJob.id}.mp4`,
          created_at: new Date(now - (9 * day - 120) * minute).toISOString(),
          expires_at: new Date(now - 2 * day * minute).toISOString(),
          deleted_at: new Date(now - 2 * day * minute).toISOString(),
        })
        .select("id")
        .single<{ id: string }>(),
    );

    const question = `Uji tiket konsol ${suffix}: petugas belum datang, apakah jadwalnya tetap?`;
    const ticket = await must(
      "the open ticket",
      admin
        .from("support_tickets")
        .insert({ customer_id: world.customer.id, question, urgency: "urgent", status: "open" })
        .select("id")
        .single<{ id: string }>(),
    );
    await must(
      "the ticket's message",
      admin.from("ticket_messages").insert({ ticket_id: ticket.id, author_id: world.customer.id, from_admin: false, body: question }),
    );

    const staff = await world.admin("Uji Admin Konsol");

    return {
      world,
      agencyName,
      cleaners,
      live: { first: liveFirst.id, second: liveSecond.id },
      waiting: waiting.id,
      recorded: {
        available: { orderId: availableJob.id, recordingId: available.id },
        expired: { orderId: expiredJob.id, recordingId: expired.id },
      },
      ticket: { id: ticket.id, question },
      admin: staff,
      cleanup: () => world.cleanup(),
    };
  } catch (error) {
    await world.cleanup();
    throw error;
  }
}
