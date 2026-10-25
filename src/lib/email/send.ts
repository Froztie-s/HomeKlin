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

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

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
  const from = process.env.EMAIL_FROM ?? `HomeKlin <${smtp?.user ?? "no-reply@homeklin.invalid"}>`;
  return sendEmail(message, { smtp, from });
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
