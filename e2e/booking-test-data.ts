import { adminClient, visitorClient } from "../tests/integration/test-project";

// Test data for the booking specs and screenshots (T9), in the shared Supabase test project.
// The rules: book only windows late in the seeded range (other specs read the earliest ones), and give
// every place back afterwards: delete the order and lower the window's `booked` again, so the seeded
// windows stay free run after run. Services, areas and agencies are never touched.

export type Window = { startsAt: string; endsAt: string };

const dayMs = 86_400_000;
const timeZone = "Asia/Jakarta";
const timeFormat = new Intl.DateTimeFormat("id-ID", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** "15.00": a moment's time in Jakarta, as the pages write it. */
export const jakartaTime = (iso: string) => timeFormat.format(new Date(iso));

/** "15.00-17.00": a window as the pages write it. */
export const windowText = (window: Window) => `${jakartaTime(window.startsAt)}-${jakartaTime(window.endsAt)}`;

/** "Jumat, 6 November" / "Friday, 6 November": a window's day as the pages write it (not today or tomorrow). */
export function dayText(iso: string, language: "id" | "en" = "id"): string {
  const locale = language === "id" ? "id-ID" : "en-ID";
  const moment = new Date(iso);
  const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(moment);
  const date = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "long" }).format(moment);
  return `${weekday}, ${date}`;
}

/** The area's free windows for the next 14 days, as the booking page lists them. */
export async function freeWindows(areaId: string): Promise<Window[]> {
  const now = Date.now();
  const { data, error } = await visitorClient().rpc("free_slots", {
    p_area: areaId,
    p_from: new Date(now).toISOString(),
    p_to: new Date(now + 14 * dayMs).toISOString(),
  });
  if (error) throw new Error(`Could not read the free windows: ${error.message}`);
  return (data as { starts_at: string; ends_at: string }[]).map((row) => ({
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  }));
}

/**
 * A free window late in the range at that Jakarta time ("15.00"), `daysBack` open days before the last
 * one. Days that start within a day of the 14-day edge are skipped, so the page (a moment later) still
 * lists the window.
 */
export async function lateWindow(areaId: string, time: string, daysBack = 0): Promise<Window> {
  const edge = Date.now() + 13 * dayMs;
  const candidates = (await freeWindows(areaId)).filter(
    (window) => jakartaTime(window.startsAt) === time && Date.parse(window.startsAt) < edge,
  );
  const window = candidates[candidates.length - 1 - daysBack];
  if (!window) throw new Error(`No free ${time} window left in ${areaId} for the booking tests`);
  return window;
}

/** A start no window has: the next Sunday at 15.00 in Jakarta (the seed has no Sunday windows). */
export function sundayAfternoon(): string {
  for (let day = 1; day <= 7; day += 1) {
    const moment = new Date(Date.now() + day * dayMs);
    const [year, month, date] = dateKeyFormat.format(moment).split("-").map(Number);
    const at15 = new Date(Date.UTC(year, month - 1, date, 8)); // 15.00 WIB
    if (new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(at15) === "Sunday") {
      return at15.toISOString();
    }
  }
  throw new Error("No Sunday in the next seven days");
}

/** The booking page's address for a window. */
export function bookPath(serviceId: string, areaId: string, startsAt: string, prefix = ""): string {
  const params = new URLSearchParams({ service: serviceId, area: areaId, starts: startsAt });
  return `${prefix}/book?${params.toString()}`;
}

/**
 * Deletes an order and gives its place in the window back, unless a failed or cancelled payment has
 * given it back already (T11).
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const admin = adminClient();
  const { data: order, error } = await admin.from("orders").select("slot_id, status").eq("id", orderId).maybeSingle();
  if (error) throw new Error(`Could not read the test order: ${error.message}`);
  if (!order) return;
  const removed = await admin.from("orders").delete().eq("id", orderId);
  if (removed.error) throw new Error(`Could not delete the test order: ${removed.error.message}`);
  if (order.status === "failed" || order.status === "cancelled") return;
  const { data: slot } = await admin.from("availability_slots").select("booked").eq("id", order.slot_id).single();
  if (slot && slot.booked > 0) {
    await admin.from("availability_slots").update({ booked: slot.booked - 1 }).eq("id", order.slot_id);
  }
}

/** Every order a customer has in an area at those window starts (to clean up after a failed test). */
export async function ordersAt(customerId: string, areaId: string, starts: readonly string[]): Promise<string[]> {
  if (starts.length === 0) return [];
  const { data, error } = await adminClient()
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("area_id", areaId)
    .in("starts_at", [...starts]);
  if (error) throw new Error(`Could not read the test orders: ${error.message}`);
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Fills a window: every agency's place in it is taken, as if other customers had just booked them.
 * Returns how to put the window back exactly as it was.
 */
export async function fillWindow(areaId: string, startsAt: string): Promise<() => Promise<void>> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("availability_slots")
    .select("id, booked, capacity")
    .eq("area_id", areaId)
    .eq("starts_at", startsAt);
  if (error || !data || data.length === 0) throw new Error(`Could not read the window to fill: ${error?.message}`);
  const rows = data as { id: string; booked: number; capacity: number }[];
  for (const row of rows) await admin.from("availability_slots").update({ booked: row.capacity }).eq("id", row.id);
  return async () => {
    for (const row of rows) await admin.from("availability_slots").update({ booked: row.booked }).eq("id", row.id);
  };
}

/** The seeded agencies' names and ids: none of them may reach a customer's page. */
export async function agencyMarks(): Promise<string[]> {
  const { data, error } = await adminClient().from("agencies").select("id, name");
  if (error) throw new Error(`Could not read the agencies: ${error.message}`);
  return (data as { id: string; name: string }[]).flatMap((agency) => [agency.id, agency.name]);
}
