# ADR 0005: Authorization lives in the database

- Status: accepted (2026-10-22, refined through T5-T31)

## Context
Video, recordings, orders and support chats must reach only the right people, and the client group will
try to get around the rules. Checks only in pages or in the browser can be skipped.

## Decision
- Every table has row-level security. Tables that hold something a role must not see (orders hold the
  partner agency; recordings; streams) are closed to users entirely and read through
  `security definer` functions with an empty `search_path`. Each function reads the caller's role from
  `profiles`, never from metadata a user can change, and returns only what that role may see.
- Refusals carry a fixed name (`recording_not_found`, `too_early`, ...) that the app turns into a
  message. A user without the right gets the same "not found" as for something that does not exist, so
  nothing can be probed.
- The Supabase secret key is used on the server only, in the few places with no signed-in person
  (Midtrans' notification, the daily cleanup, attaching a recording) or that must create an account
  (an agency's cleaner, the owner's admins), each after its own role check.
- Pages check the role too (`RoleGate` in every protected page; a layout's check would not protect it),
  but only for a friendly redirect; the database is the boundary.

## Consequences
- Each access rule has an integration test against a separate test project, per role (tests/integration).
- A new feature means a migration and its tests first; screens come after.
