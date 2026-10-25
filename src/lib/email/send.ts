import nodemailer from "nodemailer";
import type { Locale } from "next-intl";
import { formatRupiah } from "@/lib/format";

// Email from the app (T9b): the order confirmation, sent over SMTP with nodemailer, through the same
// Gmail account that Supabase Auth uses for the sign-in codes (scripts/supabase.mjs smtp). Gmail needs
// an app password (Google account > Security > 2-Step Verification > App passwords), not the account
// password itself. Without SMTP settings (tests, CI) nothing is sent and the caller is told so: an
// order never fails because an email could not go.
// Sources: https://nodemailer.com/smtp/ and https://support.google.com/a/answer/176600

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "undeliverable" | "failed" };

/** example.com/.net/.org and the .test, .invalid, .example and .localhost top-level domains. */
const reservedDomain = /@(?:[^@]*\.)?(?:example\.(?:com|net|org)|[^@]*\.(?:test|invalid|example|localhost))$/i;

export type SmtpSettings = { host: string; port: number; user: string; pass: string };

type Mail = { from: string; to: string; subject: string; html: string; text: string };
type Transport = { sendMail: (mail: Mail) => Promise<unknown> };
type CreateTransport = (options: Record<string, unknown>) => Transport;

type SendOptions = {
  smtp: SmtpSettings | undefined;
  /** "Name <address>": for Gmail, the Gmail address itself. */
  from: string;
  createTransport?: CreateTransport;
};

const defaultTransport: CreateTransport = (options) => nodemailer.createTransport(options);

export async function sendEmail(
  message: EmailMessage,
  { smtp, from, createTransport = defaultTransport }: SendOptions,
): Promise<SendResult> {
  if (!smtp) return { sent: false, reason: "not_configured" };
  // Test and demo accounts use reserved domains (RFC 2606), which can never receive mail: sending
  // there would only bounce back into the sender's inbox.
  if (reservedDomain.test(message.to)) return { sent: false, reason: "undeliverable" };
  try {
    // Port 587 with STARTTLS: the connection is upgraded to TLS before the login is sent.
    const transport = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port !== 465,
      auth: { user: smtp.user, pass: smtp.pass },
      connectionTimeout: 10_000,
    });
    await transport.sendMail({ from, to: message.to, subject: message.subject, html: message.html, text: message.text });
    return { sent: true };
  } catch {
    return { sent: false, reason: "failed" };
  }
}

/** The SMTP settings from the environment (server only), or undefined when they are not set. */
function smtpFromEnv(): SmtpSettings | undefined {
  const { SMTP_USER: user, SMTP_PASS: pass } = process.env;
  if (!user || !pass) return undefined;
  return { host: process.env.SMTP_HOST ?? "smtp.gmail.com", port: Number(process.env.SMTP_PORT ?? 587), user, pass };
}

/** Sends with the settings from the environment (server only). */
export function sendAppEmail(message: EmailMessage): Promise<SendResult> {
  const smtp = smtpFromEnv();
  return sendEmail(message, { smtp, from: senderOf(process.env.EMAIL_FROM, smtp?.user) });
}

/**
 * The From header. Gmail sends only from the account's own address, so the address is always the SMTP
 * user; EMAIL_FROM gives the display name ("HomeKlin", or "HomeKlin <address>" whose address is ignored).
 */
export function senderOf(emailFrom: string | undefined, smtpUser: string | undefined): string {
  const value = (emailFrom ?? "").trim();
  const named = /^(.*?)\s*<[^>]*>$/.exec(value);
  const name = (named ? named[1] : value.includes("@") ? "" : value) || "HomeKlin";
  return `${name} <${smtpUser ?? "no-reply@homeklin.invalid"}>`;
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
  // Email HTML: tables and inline styles only (mail apps ignore <style> blocks), no images, the site's
  // evergreen brand colour; the same look as the sign-in code email (scripts/supabase.mjs).
  const detailRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e3e9e6;font-size:13px;color:#5b6862;width:38%;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #e3e9e6;font-size:15px;color:#17231e;font-weight:bold;vertical-align:top;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f2f6f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#17231e;">
<tr><td style="background:#1d6f55;border-radius:16px 16px 0 0;padding:20px 28px;"><span style="font-size:20px;font-weight:bold;color:#ffffff;">HomeKlin</span></td></tr>
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 8px;font-size:18px;font-weight:bold;">${escapeHtml(t.subject)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#3d4a44;">${escapeHtml(t.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
</td></tr>
<tr><td style="padding:16px 28px 8px;">
<a href="${escapeHtml(order.orderUrl)}" style="display:inline-block;background:#1d6f55;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 24px;border-radius:999px;">${escapeHtml(t.open)}</a>
</td></tr>
<tr><td style="padding:12px 28px 28px;"><p style="margin:0;font-size:13px;line-height:20px;color:#5b6862;">${escapeHtml(t.note)}</p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject: t.subject, html, text };
}
