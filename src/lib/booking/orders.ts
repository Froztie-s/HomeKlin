import type { SupabaseClient } from "@supabase/supabase-js";

// The signed-in customer's own orders (T9, read by the booking confirmation and the order list),
// through my_orders() (supabase/migrations/20261104090000_jobs.sql), which returns them without the
// agency: the cleaner appears only by name and photo, as "Petugas HomeKlin". Pass the customer's session client (createSupabaseServerClient), behind <Suspense>.

export type OrderStatus = "pending_payment" | "paid" | "failed" | "cancelled";

export type CustomerOrder = {
  id: string;
  serviceId: string;
  areaId: string;
  /** The arrival window, as ISO 8601 times (UTC). */
  startsAt: string;
  endsAt: string;
  address: string;
  /** The customer's phone for the cleaner (+628...); null on orders made before T9b. */
  contactPhone: string | null;
  /** The price when the customer booked, in whole rupiah. */
  priceIdr: number;
  status: OrderStatus;
  createdAt: string;
  /** The cleaner the job was given to (T28), or null until then. */
  cleanerName: string | null;
  cleanerPhotoUrl: string | null;
  checkedInAt: string | null;
  /** When the cleaner finished the job (T18). */
  completedAt: string | null;
  /** The job's recording (T13), or null when it has none. */
  recordingId: string | null;
  recordingExpiresAt: string | null;
  /** The 7-day cleanup (T16) has deleted the file: it can no longer be played. */
  recordingDeleted: boolean;
};

type OrderRow = {
  order_id: string;
  service_id: string;
  area_id: string;
  starts_at: string;
  ends_at: string;
  address: string;
  contact_phone: string | null;
  price_idr: number;
  status: OrderStatus;
  created_at: string;
  cleaner_name: string | null;
  cleaner_photo_url: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  recording_id: string | null;
  recording_expires_at: string | null;
  recording_deleted: boolean | null;
};

const isoOrNull = (value: string | null) => (value ? new Date(value).toISOString() : null);

export class OrdersError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read the orders: ${cause.message}`);
    this.name = "OrdersError";
  }
}

/** The customer's orders, newest first. */
export async function listMyOrders(client: SupabaseClient): Promise<CustomerOrder[]> {
  const { data, error } = await client.rpc("my_orders");
  if (error) throw new OrdersError(error);
  return (data as OrderRow[]).map((row) => ({
    id: row.order_id,
    serviceId: row.service_id,
    areaId: row.area_id,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    address: row.address,
    contactPhone: row.contact_phone,
    priceIdr: row.price_idr,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    cleanerName: row.cleaner_name,
    cleanerPhotoUrl: row.cleaner_photo_url,
    checkedInAt: isoOrNull(row.checked_in_at),
    completedAt: isoOrNull(row.completed_at),
    recordingId: row.recording_id,
    recordingExpiresAt: isoOrNull(row.recording_expires_at),
    recordingDeleted: row.recording_deleted === true,
  }));
}
