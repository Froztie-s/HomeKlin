import type { SupabaseClient } from "@supabase/supabase-js";

// The signed-in customer's own orders (T9, read by the booking confirmation; the order list is T12),
// through my_orders() (supabase/migrations/20261025090000_orders.sql), which returns them without the
// agency. Pass the customer's session client (createSupabaseServerClient), behind <Suspense>.

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
};

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
  }));
}
