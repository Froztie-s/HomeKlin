import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/lib/booking/orders";
import type { StreamStatus } from "@/lib/stream/streams";
import { JobsError } from "./jobs";

// Admin's read of one order (B2), through admin_order_detail() in
// supabase/migrations/20261114130000_admin_order_detail.sql (last changed in
// 20261120090000_admin_cleaner_phone.sql: the cleaner's phone), which answers admins only. Pass the
// admin's session client (createSupabaseServerClient), behind <Suspense>.

export type AdminOrderDetail = {
  id: string;
  /** The short order number, "HK-1042". */
  orderCode: string;
  status: OrderStatus;
  serviceId: string;
  areaId: string;
  startsAt: string;
  endsAt: string;
  address: string;
  /** The phone the customer gave for the job (+628...); null on orders made before T9b. */
  contactPhone: string | null;
  customerName: string | null;
  agencyId: string;
  agencyName: string;
  cleanerId: string | null;
  cleanerName: string | null;
  /** The cleaner's mobile number (+628...), set by their agency (B11); null when none is set (2026-11-20). */
  cleanerPhone: string | null;
  priceIdr: number;
  /** The agency's fee and HomeKlin's income; together they are the price. */
  agencyFeeIdr: number;
  homeklinIncomeIdr: number;
  /** True once check-out wrote the real fee; before that it is the expected fee at today's percent. */
  agencyFeeFinal: boolean;
  createdAt: string;
  /** When the paid result arrived; null for an order that is not paid (or paid in older seed data). */
  paidAt: string | null;
  /** When the agency assigned the cleaner (B3); null before, and on orders assigned before B3. */
  assignedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  /** The live stream's state and its last change, or null when the job never streamed. */
  streamStatus: StreamStatus | null;
  streamUpdatedAt: string | null;
  /** The customer's note for the cleaner (B7); empty when there is none. */
  customerNote: string;
  /** How the order was paid, as Midtrans names it (B8); null until paid. */
  paymentMethod: string | null;
};

type Row = {
  order_id: string;
  order_code: string;
  status: OrderStatus;
  service_id: string;
  area_id: string;
  starts_at: string;
  ends_at: string;
  address: string;
  contact_phone: string | null;
  customer_name: string | null;
  agency_id: string;
  agency_name: string;
  cleaner_id: string | null;
  cleaner_name: string | null;
  price_idr: number;
  agency_fee_idr: number;
  homeklin_income_idr: number;
  agency_fee_final: boolean;
  created_at: string;
  paid_at: string | null;
  assigned_at: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  stream_status: StreamStatus | null;
  stream_updated_at: string | null;
  customer_note: string | null;
  payment_type: string | null;
  cleaner_phone: string | null;
};

const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value ? iso(value) : null);

/** One order for admin, or null when there is no such order. Throws JobsError on any other failure. */
export async function getAdminOrderDetail(client: SupabaseClient, orderId: string): Promise<AdminOrderDetail | null> {
  const { data, error } = await client.rpc("admin_order_detail", { p_order: orderId });
  if (error) {
    if (error.message === "order_not_found") return null;
    throw new JobsError(error);
  }
  const row = (data as Row[])[0];
  if (!row) return null;
  return {
    id: row.order_id,
    orderCode: row.order_code,
    status: row.status,
    serviceId: row.service_id,
    areaId: row.area_id,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    address: row.address,
    contactPhone: row.contact_phone,
    customerName: row.customer_name,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    cleanerPhone: row.cleaner_phone ?? null,
    priceIdr: row.price_idr,
    agencyFeeIdr: Number(row.agency_fee_idr),
    homeklinIncomeIdr: Number(row.homeklin_income_idr),
    agencyFeeFinal: row.agency_fee_final === true,
    createdAt: iso(row.created_at),
    paidAt: isoOrNull(row.paid_at),
    assignedAt: isoOrNull(row.assigned_at),
    checkedInAt: isoOrNull(row.checked_in_at),
    completedAt: isoOrNull(row.completed_at),
    streamStatus: row.stream_status,
    streamUpdatedAt: isoOrNull(row.stream_updated_at),
    customerNote: row.customer_note ?? "",
    paymentMethod: row.payment_type ?? null,
  };
}
