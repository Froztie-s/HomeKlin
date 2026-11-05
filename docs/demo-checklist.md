# Demo checklist and script (T39)

For the presenters from the software house. Do the checklist on the day, at least 30 minutes before the
demo; the script follows the Quality Plan scenarios.

## Checklist
| Done | Step | How |
|---|---|---|
| [ ] | The live Supabase project is awake | Open https://home-klin.vercel.app/api/health: it answers 200 with `supabase: ok`. A free project pauses after about a week without use; wake it in the Supabase dashboard (Restore). |
| [ ] | The live database has every migration | `npm run supabase -- migrate live` says "up to date". |
| [ ] | Demo clips are in place | `.mp4` or `.webm` files under 50 MB in the local `clips/` folder. |
| [ ] | Seed data is fresh | `npm run db:seed -- live`, at most 15 minutes before the demo: the upcoming job starts 10 minutes after the seed, and check-in opens 15 minutes before it. The finished jobs get fresh 7-day recordings. |
| [ ] | Vercel settings | `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, the SMTP values and `SITE_URL` are set; the latest deployment of `main` is live. |
| [ ] | The demo passwords | `SEED_DEMO_PASSWORD` from `.env`, shared privately with the presenters. |
| [ ] | Phones | One phone for the customer, one for the cleaner (location allowed for the browser), a laptop for agency, admin and owner. Open the site on each phone once. |
| [ ] | Email | The presenter's own email for ordering (the 6-digit code arrives through Gmail SMTP; check spam). |
| [ ] | Midtrans Sandbox | The Notification URL in the Sandbox dashboard is `https://home-klin.vercel.app/api/payments/midtrans`; the simulator is at https://simulator.sandbox.midtrans.com. |

## Script (about 15 minutes)
1. **Landing and booking (customer phone).** `/`: one brand, services and prices. Order a service in Jakarta Selatan with the presenter's email, type the code: the account is made by ordering.
2. **Payment.** "Bayar sekarang", BCA Virtual Account, pay in the Sandbox simulator; the order turns "Sudah dibayar". For "failed": the test card `4911 1111 1111 1113`. For "cancelled": an unpaid order expires (60 minutes), or show the recorded run.
3. **Cleaner (cleaner phone, `petugas.yuliana@example.com`).** The seeded job starting now: Check-in (location), Mulai siaran, simulate a weak signal and a drop, Sambung lagi.
4. **Live view (customer phone, `pelanggan@example.com`).** The job in progress: "Tonton langsung", the status follows the cleaner's simulation. Explain: the clip stands in for the camera (ADR 0002); only this customer, HomeKlin's team and the job's partner can watch.
5. **Help (customer).** `/support`: search "bayar"; no answer, so "Hubungi admin" opens a ticket.
6. **Admin (laptop, `admin@example.com`).** Dashboard, the ticket arrives in the inbox at once, reply: it shows on the customer's phone without a reload. The live grid shows the cleaner's feed.
7. **Check-out (cleaner).** Check-out: the job is complete and the recording is attached.
8. **Replay (customer).** The finished job: the recording with "tersedia sampai ..." and the countdown; rate the service and the Petugas HomeKlin. A seeded older job shows the same.
9. **Agency (laptop, `agensi.kilau@example.com`).** Its own jobs only; assign a cleaner; add a window in "Jadwal" and see it free on `/services`.
10. **Owner (laptop, `pemilik@example.com`).** Business numbers, suspend a partner (its windows vanish), reactivate; the admin accounts.
11. **Security in one sentence.** Every rule is enforced by the database and tested per role; a customer never sees a partner agency (`docs/adr/0005`, `docs/qa/security-audit-2026-11-05.md`).

## If something breaks
- **Rollback:** in Vercel, Deployments, promote the previous deployment of `main` (one click, no rebuild). Database migrations only add things, so an older deployment still works with the newer database.
- **Supabase paused or down:** show the recorded run and the test reports in `docs/qa/`.
- **Email code slow:** Supabase allows 30 code emails an hour; wait a minute, or sign in a demo customer with the password.
- **Midtrans Sandbox slow:** the order stays "Menunggu pembayaran" until the notification arrives; refresh after a minute.
