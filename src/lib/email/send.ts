import type { Locale } from "next-intl";
import { formatRupiah } from "@/lib/format";

// Email from the app (T9b): the order confirmation, sent through Brevo's transactional email API with
// a plain HTTPS call (no SDK). The emailed sign-in codes are sent by Supabase Auth itself, through
// Brevo's SMTP (scripts/supabase.mjs smtp). Without BREVO_API_KEY (tests, CI, a local copy without the
// key) nothing is sent and the caller is told so: an order never fails because an email could not go.
// Source: https://developers.brevo.com/reference/sendtransacemail

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "refused" | "network" };

type SendOptions = {
  apiKey: string | undefined;
  /** "Name <address>" or a bare address: a sender verified in Brevo. */
  from: string;
  fetchFn?: typeof fetch;
};

const brevoUrl = "https://api.brevo.com/v3/smtp/email";

function sender(from: string): { name: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1] || "HomeKlin", email: match[2] } : { name: "HomeKlin", email: from.trim() };
}

export async function sendEmail(message: EmailMessage, { apiKey, from, fetchFn = fetch }: SendOptions): Promise<SendResult> {
  if (!apiKey) return { sent: false, reason: "not_configured" };
  try {
    const response = await fetchFn(brevoUrl, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: sender(from),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? { sent: true } : { sent: false, reason: "refused" };
  } catch {
    return { sent: false, reason: "network" };
  }
}

/** Sends with the settings from the environment (server only). */
export function sendAppEmail(message: EmailMessage): Promise<SendResult> {
  return sendEmail(message, { apiKey: process.env.BREVO_API_KEY, from: process.env.EMAIL_FROM ?? "HomeKlin <no-reply@homeklin.invalid>" });
}

export type ConfirmationOrder = {
  serviceName: string;
  startsAt: string;
  endsAt: string;
  address: string;
  priceIdr: number;
  orderUrl: string;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Senin, 26 Oktober 2026" / "Monday, 26 October 2026", in Jakarta time. */
function jakartaDay(iso: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}

/** "08.00", in Jakarta time, the Indonesian way in both languages (as on the site). */
function jakartaTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("hour")}.${part("minute")}`;
}

const copy = {
  id: {
    subject: "Pesanan HomeKlin Anda sudah dibuat",
    intro: "Terima kasih. Pesanan Anda sudah dibuat dan menunggu pembayaran.",
    service: "Layanan",
    arrival: "Petugas datang",
    address: "Alamat",
    total: "Total",
    open: "Lihat pesanan",
    note: "Masuk dengan email ini untuk membayar, menonton pekerjaan secara langsung, dan memutar ulang rekamannya.",
  },
  en: {
    subject: "Your HomeKlin order has been placed",
    intro: "Thank you. Your order has been placed and is awaiting payment.",
    service: "Service",
    arrival: "Cleaner arrives",
    address: "Address",
    total: "Total",
    open: "View your order",
    note: "Sign in with this email to pay, watch the job live and replay its recording.",
  },
} satisfies Record<Locale, Record<string, string>>;

/** The order confirmation in the customer's language. Names HomeKlin only, never an agency. */
export function orderConfirmationEmail(order: ConfirmationOrder, locale: Locale): Omit<EmailMessage, "to"> {
  const t = copy[locale];
  const arrival = `${jakartaDay(order.startsAt, locale)}, ${jakartaTime(order.startsAt)} - ${jakartaTime(order.endsAt)} WIB`;
  const rows: [string, string][] = [
    [t.service, order.serviceName],
    [t.arrival, arrival],
    [t.address, order.address],
    [t.total, formatRupiah(order.priceIdr, locale)],
  ];
  const text = [t.intro, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", `${t.open}: ${order.orderUrl}`, "", t.note].join("\n");
  const html = [
    `<p>${escapeHtml(t.intro)}</p>`,
    "<table>",
    ...rows.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`),
    "</table>",
    `<p><a href="${escapeHtml(order.orderUrl)}">${escapeHtml(t.open)}</a></p>`,
    `<p>${escapeHtml(t.note)}</p>`,
  ].join("\n");
  return { subject: t.subject, html, text };
}
