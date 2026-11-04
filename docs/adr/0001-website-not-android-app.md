# ADR 0001: A hosted website instead of an Android app

- Status: accepted (2026-10-17, confirmed by the client group)
- Deciders: the software house, with the client group

## Context
The Contract names an "Android mobile app". The project runs from 8 September to 9 November 2026 with a
small team, on free tiers only. The client group must be able to test every Quality Plan scenario
themselves, on their own devices, and submitting to the Play Store is out of scope.

## Decision
Build a hosted, bilingual website (Next.js on Vercel). Customer and cleaner pages are mobile-first and
work in the phone's browser; agency, admin and owner pages are desktop-first.

## Consequences
- Anyone opens https://home-klin.vercel.app on any phone or laptop; no install, no store review.
- The phone's browser gives camera, microphone and location, which is all the cleaner's work screens
  need (check-in location, live stream).
- No push notifications or offline mode. Not required by the Quality Plan.
- The change from the Contract's wording must be recorded as an addendum (Contract Pasal 8). The client
  agreed verbally; the written addendum is still open.
