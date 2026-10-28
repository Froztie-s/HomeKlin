import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { cancelOrder, dayText, windowText, type Window } from "./booking-test-data";
import { deleteAccountsByEmail } from "./setup/email-code";

// Test data for the order specs and screenshots (T9b), in the shared Supabase test project. Guests
// order with a unique address on example.com (each makes an account by ordering); the clean-up gives
// every place they booked back (cancelOrder in ./booking-test-data.ts) and then deletes the accounts.
// Windows come from lateWindow() there, so other specs keep the earliest ones.

/** A fresh guest address, remembered in `list` for the clean-up. */
export function guestEmail(list: string[]): string {
  const email = `t9b-${randomUUID().slice(0, 8)}@example.com`;
  list.push(email);
  return email;
}

/** The order page's address for a service, area and window (prefix "/en" for English). */
export function orderPath(serviceId: string, areaId?: string, startsAt?: string, prefix = ""): string {
  const params = new URLSearchParams({ layanan: serviceId });
  if (areaId) params.set("area", areaId);
  if (startsAt) params.set("starts", startsAt);
  return `${prefix}/pesan?${params.toString()}`;
}

/** Gives back every place the accounts booked, then deletes the accounts (their orders go with them). */
export async function removeGuests(emails: string[]): Promise<void> {
  const wanted = new Set(emails.splice(0).map((email) => email.toLowerCase()));
  if (wanted.size === 0) return;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not list the test users: ${error.message}`);
  const ids = data.users.filter((user) => user.email && wanted.has(user.email.toLowerCase())).map((user) => user.id);
  if (ids.length > 0) {
    const orders = await admin.from("orders").select("id").in("customer_id", ids);
    for (const row of (orders.data ?? []) as { id: string }[]) await cancelOrder(row.id);
  }
  await deleteAccountsByEmail([...wanted]);
}

/** Picks a window in the order form's list (opening the list first when it is closed). */
export async function chooseWindow(page: Page, window: Window, language: "id" | "en" = "id") {
  const toggle = page.getByRole("button", { name: language === "id" ? "Ganti jadwal" : "Change time" });
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await page
    .getByRole("group", { name: dayText(window.startsAt, language) })
    .getByRole("radio", { name: windowText(window) })
    .check();
  await expect(page.getByRole("group", { name: language === "id" ? "Jadwal kedatangan" : "Arrival time" })).toContainText(
    windowText(window),
  );
}

/**
 * Books a window as the signed-in customer, the way a customer does on the order form (the window
 * given in the address), and returns the new order's id.
 */
export async function bookSignedIn(page: Page, serviceId: string, areaId: string, window: Window): Promise<string> {
  await page.goto(orderPath(serviceId, areaId, window.startsAt));
  await page.getByLabel("Alamat lengkap").fill("Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat");
  await page.getByLabel("Nomor HP").fill("0812 3456 7890");
  await page.getByRole("switch", { name: /Saya setuju/ }).check();
  await page.getByRole("button", { name: "Pesan sekarang" }).click();
  // Booking and the redirect run on the server; under a full parallel run that can take over 5 s.
  await expect(page).toHaveURL(/\/orders\?booked=[0-9a-f-]{36}$/, { timeout: 15_000 });
  return new URL(page.url()).searchParams.get("booked") ?? "";
}
