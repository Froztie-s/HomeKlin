import { expect, type Page } from "@playwright/test";

// The history page (/orders) shows one month at a time (2026-11-20), chosen with the month select and
// kept in the address as ?bulan=2026-11. These open the month that holds an order, whatever the date
// the test runs on, by walking the months the select offers.

/**
 * The page's content sits behind <Suspense> (the role check), so it can be revealed a moment after
 * `goto` resolves; its h1 is the first thing the content holds. Waiting for it keeps the counts below
 * from reading the loading state.
 */
async function waitForContent(page: Page): Promise<void> {
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
}

const monthKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

/** The Jakarta month of a moment as the select's values have it, "2026-11" (a window near a month's edge can fall in either). */
export const jakartaMonth = (iso: string): string => monthKeyFormat.format(new Date(iso)).slice(0, 7);

/**
 * What the history page lists for orders with these windows, worked out from the windows alone: one
 * group per Jakarta month, the latest month first, and in each month the latest job first. Specs that
 * book windows near a month's edge (a 13-day edge can fall on the 1st) read the expected months and rows
 * from this, never from a single assumed month.
 */
export function expectedHistory(orders: readonly { id: string; startsAt: string }[]): { month: string; ids: string[] }[] {
  const groups: { month: string; ids: string[] }[] = [];
  for (const order of orders.toSorted((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))) {
    const month = jakartaMonth(order.startsAt);
    const last = groups.at(-1);
    if (last?.month === month) last.ids.push(order.id);
    else groups.push({ month, ids: [order.id] });
  }
  return groups;
}

/** The months the history page offers, the latest first. */
export async function historyMonths(page: Page): Promise<string[]> {
  const select = page.locator("main select");
  if ((await select.count()) === 0) return [];
  return select.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
}

/** Opens `${prefix}/orders` (keeping `query`) on the month whose list has the order's row. */
export async function openHistoryMonthOf(page: Page, orderId: string, prefix = "", query = ""): Promise<void> {
  const row = page.locator(`main a[href="${prefix}/orders?order=${orderId}"]`);
  await page.goto(`${prefix}/orders${query ? `?${query}` : ""}`);
  await waitForContent(page);
  if ((await row.count()) > 0) return;
  for (const month of await historyMonths(page)) {
    const params = new URLSearchParams(query);
    params.set("bulan", month);
    await page.goto(`${prefix}/orders?${params.toString()}`);
    await waitForContent(page);
    if ((await row.count()) > 0) return;
  }
  await expect(row, `no month of ${prefix}/orders lists ${orderId}`).toHaveCount(1);
}
