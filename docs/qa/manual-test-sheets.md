# Manual test sheets (T33, T35, Checkpoint 2)

What automated tests cannot show: real devices, real people and a real payment. Fill these in during
UAT preparation and keep them in `docs/qa/`. Run the checklist in `docs/demo-checklist.md` first so the live
project is awake and seeded.

## 1. Compatibility (T35)
Main flows: order a service with an emailed code; pay in the Midtrans Sandbox; cleaner check-in and
check-out; watch the live view; replay the recording; the support chat. Mark Pass, Fail or N/A, and note
the defect.

| Device and browser | Version | Order | Pay | Check-in/out | Live view | Replay | Chat | Notes |
|---|---|---|---|---|---|---|---|---|
| Android phone, Chrome | | | | | | | | |
| iPhone, Safari (iOS 16 or later) | | | | | | | | |
| Desktop Chrome | | | | | | | | |
| Desktop Edge | | | | | | | | |
| Desktop Firefox | | | | | | | | |

Desktop checks also cover the agency, admin and owner pages. Check each at 360 px width (phone) and at
1280 px (desktop). Check both languages once.

## 2. Usability trial (T35; target: at least 90% book without help)
Three people who have not seen the product. Give them only: "Order a cleaning service for your home and
pay for it." Do not help; note where they hesitate. Use a test email address they own.

| Person | Booked without help (yes/no) | Time to a placed order | Where they hesitated | Their words |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Result: ___ of 3 booked unaided (___%).

## 3. Streaming latency and recovery (T33; not needed now)
The real stream was dropped (decision of 2026-11-05), so there is nothing to measure. This sheet stays in case
a real source is built later.

Needs the real LiveKit source (T32), a cleaner's phone and a viewer's phone or laptop side by side.
1. On the cleaner's phone, open a large running clock (for example a stopwatch app showing milliseconds)
   and point the camera at it.
2. On the viewer's device, show the live view next to a second view of the same stopwatch, and film both
   screens with a third phone at 60 frames per second.
3. Step through the video: the difference between the two clocks in one frame is the latency. Repeat 5
   times and write the median.
4. Recovery: switch the cleaner's phone to flight mode for 10 seconds, switch it off again, and time how
   long until the viewer sees live video again. Repeat 3 times.
5. Throttle the cleaner's network (a phone hotspot with a weak signal, or the browser's network
   throttling) and note whether the picture lowers its quality instead of stopping.

| Measurement | 1 | 2 | 3 | 4 | 5 | Median |
|---|---|---|---|---|---|---|
| Latency (seconds) | | | | | | |
| Recovery after a drop (seconds) | | | | | | |

Result against the 3-second target: ____. If the target is missed, write the gap down plainly; the plan
allows documenting an honest gap.

## 4. Payment outcomes on the live site (Checkpoint 2)
All three outcomes are confirmed on the live site. Successful: 1 November 2026 (the user). Failed and cancelled: 5 November 2026, run by
the software house's lead with the user's permission, as the demo customer, through Midtrans's real Sandbox: the
failed order with the deny card below (Midtrans answered "Payment declined by bank"), the cancelled one by choosing
a BCA virtual account in Snap and then cancelling that pending payment with Midtrans's Sandbox cancel call (instead of
waiting an hour). Each time Midtrans sent its real notification to the live site. Both test orders stay on the live
project. The steps, to repeat by hand:
1. **Failed:** order, "Bayar sekarang", choose credit card, test card `4911 1111 1111 1113`, any future
   expiry, CVV `123`, OTP `112233`. The bank declines it; the order must show as failed on `/orders`, and its
   window must be free again.
2. **Cancelled:** order, "Bayar sekarang", choose BCA Virtual Account and leave it unpaid. After 60 minutes
   Midtrans expires it; the order must show as cancelled and its window must be free again. An order left
   unpaid without starting a payment is cancelled after 2 hours.

| Outcome | Order id | Status shown | Window free again | Date | Result |
|---|---|---|---|---|---|
| Successful | | | | 2026-11-01 | Pass (user) |
| Failed | 70c4e526 | failed (read as the customer) | yes: booked 0 of 2, nothing holding the window | 2026-11-05 | Pass (lead) |
| Cancelled | 224e158c | cancelled (read as the customer) | yes: booked 0 of 2, nothing holding the window | 2026-11-05 | Pass (lead) |
