import { expect, type Page } from "@playwright/test";

// The history page (/orders) shows one month at a time (2026-11-20), chosen with the month select and
// kept in the address as ?bulan=2026-11. These open the month that holds an order, whatever the date
// the test runs on, by walking the months the select offers.

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
  if ((await row.count()) > 0) return;
  for (const month of await historyMonths(page)) {
    const params = new URLSearchParams(query);
    params.set("bulan", month);
    await page.goto(`${prefix}/orders?${params.toString()}`);
    if ((await row.count()) > 0) return;
  }
  await expect(row, `no month of ${prefix}/orders lists ${orderId}`).toHaveCount(1);
}
