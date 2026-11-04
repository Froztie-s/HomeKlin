import type { SupabaseClient } from "@supabase/supabase-js";
import { streamSourceFor, type StreamView } from "./source";

// Watching a job's stream (T23, T25, T29). The viewer's own session asks the database whether this
// person may watch (stream_for_viewer(), supabase/migrations/20261104140000_streams.sql); only then
// does the server ask the stream source for something to play. Admin and agencies list the streams
// that are live with live_streams(). Pass the viewer's session client and the server's client.

export type StreamStatus = "active" | "weak" | "disconnected" | "ended";

export type ViewerStream = {
  sessionId: string;
  orderId: string;
  status: StreamStatus;
  source: string;
  startedAt: string;
  cleanerName: string | null;
  view: StreamView;
};

export type StreamRefusal = "stream_not_found";

export class StreamError extends Error {
  /** Why there is nothing to watch, or null when the database or the source failed. */
  readonly reason: StreamRefusal | null;

  constructor(reason: StreamRefusal | null, message: string) {
    super(`Could not open the stream: ${message}`);
    this.name = "StreamError";
    this.reason = reason;
  }
}

type ViewerRow = { session_id: string; order_id: string; status: StreamStatus; source: string; started_at: string; cleaner_name: string | null };

/** The stream of one job, for a viewer allowed to see it; StreamError("stream_not_found") otherwise. */
export async function watchStream(viewer: SupabaseClient, server: SupabaseClient, orderId: string): Promise<ViewerStream> {
  const { data, error } = await viewer.rpc("stream_for_viewer", { p_order: orderId });
  if (error) throw new StreamError(error.message === "stream_not_found" ? "stream_not_found" : null, error.message);
  const row = (data as ViewerRow[] | null)?.[0];
  if (!row) throw new StreamError(null, "the database returned no stream");
  const view = await streamSourceFor(row.source, server).view(row.order_id);
  return {
    sessionId: row.session_id,
    orderId: row.order_id,
    status: row.status,
    source: row.source,
    startedAt: new Date(row.started_at).toISOString(),
    cleanerName: row.cleaner_name,
    view,
  };
}

/** The status of a job's stream for a viewer allowed to see it, without a new link (for polling). */
export async function streamStatus(viewer: SupabaseClient, orderId: string): Promise<StreamStatus | null> {
  const { data, error } = await viewer.rpc("stream_for_viewer", { p_order: orderId });
  if (error) {
    if (error.message === "stream_not_found") return null;
    throw new StreamError(null, error.message);
  }
  return (data as ViewerRow[] | null)?.[0]?.status ?? null;
}

export type LiveStream = {
  sessionId: string;
  orderId: string;
  status: StreamStatus;
  source: string;
  startedAt: string;
  updatedAt: string;
  serviceId: string;
  areaId: string;
  cleanerName: string | null;
  agencyName: string;
};

/** The streams that are live: all of them for admin, the agency's own for an agency. */
export async function listLiveStreams(client: SupabaseClient): Promise<LiveStream[]> {
  const { data, error } = await client.rpc("live_streams");
  if (error) throw new StreamError(null, error.message);
  type Row = ViewerRow & { updated_at: string; service_id: string; area_id: string; agency_name: string };
  return (data as Row[]).map((row) => ({
    sessionId: row.session_id,
    orderId: row.order_id,
    status: row.status,
    source: row.source,
    startedAt: new Date(row.started_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    serviceId: row.service_id,
    areaId: row.area_id,
    cleanerName: row.cleaner_name,
    agencyName: row.agency_name,
  }));
}
