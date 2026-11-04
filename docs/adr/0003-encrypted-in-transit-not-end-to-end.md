# ADR 0003: Video is encrypted in transit, not end-to-end

- Status: accepted (2026-10-17)

## Context
The Development and Quality Plan asks for "end-to-end encryption" of the video.

## Decision
State the real guarantee instead of claiming end-to-end encryption:
- Every connection uses HTTPS (the site, Supabase, signed storage links) or, for LiveKit, WebRTC's
  DTLS-SRTP. Video is encrypted on every hop.
- The media server (LiveKit Cloud) and the storage service (Supabase) can technically read the media.
  That is not end-to-end encryption, and we do not call it that.
- What protects the customer is access control: only the booking's customer (during the job), the
  job's agency and admin can watch; only they can replay, for 7 days; links are signed and last at most
  10 minutes; nobody can list or guess streams.

## Consequences
- The hand-over notes and the demo say "encrypted in transit". True end-to-end encryption (LiveKit's
  E2EE with keys held only by the participants) would also block admin's monitoring grid and the stored
  recording, which the Quality Plan requires, so it was not chosen.
