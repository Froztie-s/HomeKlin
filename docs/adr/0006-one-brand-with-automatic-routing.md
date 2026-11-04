# ADR 0006: One brand to the customer, automatic routing to partners

- Status: accepted (2026-10-18, the user's correction of the business model; extended 2026-11-03)

## Context
HomeKlin employs no cleaners. Partner cleaning agencies do the work, but the customer should see one
cleaning company with one price list, not a marketplace.

## Decision
- Customers see HomeKlin's services and the combined free arrival windows of every active partner in
  their area. `book_slot()` routes each booking to a partner with a place free in that window (the one
  with the most room, race-safe with `FOR UPDATE SKIP LOCKED`).
- Customer pages never name or hint at a partner agency; the cleaner appears as "Petugas HomeKlin" with
  name and photo. An e2e test fails on any agency wording on customer pages.
- Admin sets services and prices. Agencies manage only their cleaners, their windows and the jobs
  routed to them. The owner adds, suspends and reactivates partners; a suspended partner gets no new
  bookings and its windows are not offered.

## Consequences
- The order row holds the agency, so customers never read the orders table directly.
- An area with no active partner shows an empty state instead of services.
