# Automated accessibility scan, 26 November 2026 (part of T35)

Tool: axe-core (already in `node_modules`, no dependency added), WCAG 2.0, 2.1 and 2.2 levels A and AA, run in
Chromium through Playwright against a production build that talks to the test project. A throw-away spec drove it
(not committed): every page below, signed in as the role that uses it, in the Indonesian and the English versions
where marked, at the mobile and the desktop project's size.

## Coverage: 76 page runs, all loaded without redirect
- Visitor: `/`, `/en`, `/services`, `/login`, `/signup`, `/support`, `/en/login`
- Customer: `/home`, `/orders`, `/support`, `/services`, `/en/home`, `/en/orders`, `/pesan`
- Cleaner: `/cleaner`, `/cleaner/jobs`, `/cleaner/account`, `/en/cleaner`
- Agency: `/agency`, `/agency/orders`, `/agency/past`, `/agency/cleaners`, `/agency/recordings`,
  `/agency/schedule`, `/agency/services`, `/en/agency`
- Admin: `/admin/monitor`, `/admin/services`, `/admin/faq`, `/admin/recordings`, `/admin/tickets`, `/en/admin/monitor`
- Owner: `/owner`, `/owner/agencies`, `/owner/agencies/new`, `/owner/admins`, `/owner/admins/new`, `/en/owner`

## Result
One rule reported, nothing else: **0 critical, 0 violations other than colour contrast.**

| Rule | Where | Verdict |
|---|---|---|
| `color-contrast` (serious), 24 nodes | the large "01" to "05" numerals on the landing page's "how it works" cards (`src/components/marketing/how-it-works.tsx`), in both languages and both sizes | **Accepted, by design.** They are `aria-hidden` ghost numerals, tone on tone, in the same family as the footer's `wordmark-ghost` (`markdown/design.md`). The steps are an `<ol>`, so the order is announced without them, and WCAG 1.4.3 exempts text that is pure decoration. axe cannot tell that they are decoration. |

## What this scan does not prove
- It checks what a script can see on these pages in their loaded state. Dialogs, error states, the order pages that
  need an order id (`/orders?order=...`, `/cleaner/jobs/HK-...`, `/admin/orders/HK-...`), the booking steps with a
  chosen window, and the payment step were not opened; screen readers, keyboard-only use and zoom still need a person.
- A finding earlier the same day, from the code review, is fixed: the live monitor's "Buka" link had an accessible name
  without its visible word (WCAG 2.5.3).
- T35's device matrix (Chrome Android, Safari iOS 16+, desktop Chrome, Edge and Firefox) and the three-person
  usability trial are still the user's; the sheets are in `docs/qa/manual-test-sheets.md`.
