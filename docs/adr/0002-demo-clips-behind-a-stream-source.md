# ADR 0002: Demo clips behind a stream source, real LiveKit later

- Status: accepted (2026-10-17)

## Context
The Quality Plan tests live viewing and recording replay. Real streaming needs a media server; LiveKit
Cloud's free plan has about 5,000 participant minutes a month and only about 60 minutes of
recording-type egress, so recording every job is impossible for free. A demo must not depend on a
phone's network on the day.

## Decision
- The live viewer asks a **stream source** what to play (`src/lib/stream/source.ts`). The demo source
  plays a short pre-recorded clip from a private library as the "live" feed. A LiveKit source can replace
  it without changing pages or access rules: each job already has a stream session with its source.
- Recordings are **real storage with real 7-day deletion**; the footage attached at check-out is a copy
  of a demo clip (`attachRecording`, `src/lib/recordings/attach.ts`, the one place a real capture would
  plug in).
- Every access rule (who may watch, who may replay) is enforced by the database whatever the source.

## Consequences
- The demo always works, and the access rules, the 7-day expiry and the deletion can be shown for real.
- The 3-second latency target can only be measured once the LiveKit source runs (T32, T33).
- The presenters say plainly that the clips stand in for the live camera.
