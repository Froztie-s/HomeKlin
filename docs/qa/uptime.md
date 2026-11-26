# Availability record (T37)

Quality Plan target: backend availability of at least 99% during the pilot and UAT.

## How it is measured
- `.github/workflows/uptime.yml` calls `https://home-klin.vercel.app/api/health` every 10 minutes from
  GitHub's network. The address answers 200 with `{"status":"ok"}` only when the app and its Supabase
  project are both up. A run counts as down only when three tries, 10 seconds apart, all fail.
- Every run is kept in the Actions history of the repository, which is the evidence.
- `npm run uptime` turns that history into a figure: checks, how many were up and down, and the
  percentage. `npm run uptime -- 2026-11-10` counts from a date (UTC), for example the start of UAT.
  No login is needed; set `GITHUB_TOKEN` for a higher request limit.
- The visits also keep the free Supabase project awake, which pauses after about a week without use.

## Limits to know
- GitHub starts scheduled runs when it has capacity, so they can come a few minutes late, and a run is
  sometimes skipped. The percentage is over the checks that did run.
- A 10-minute interval cannot see an outage shorter than that. It is enough for a 99% target over days.
- GitHub disables scheduled workflows in a repository with no activity for 60 days.
- This is a stand-in for an external monitor. The plan in the README is an UptimeRobot monitor on the
  same address, which checks every 5 minutes from outside GitHub and keeps its own report. Use whichever
  figure the client group accepts, or both.

## Results

| Date of report | Counted from | Checks | Up | Down | Availability |
|---|---|---|---|---|---|
| 2026-11-26 | 2026-11-05 (first run) | 73 | 73 | 0 | 100.00% (target: at least 99%) |

Read the number with its limit in mind: a 10-minute schedule would give about 3,000 checks in 21 days, but GitHub
started only 73, because it runs scheduled workflows when it has spare capacity and skips many on a repository with
little activity. All 73 checks that ran were up, so no outage was seen, but the record does not prove continuous
coverage. For the client group's UAT window, add the UptimeRobot monitor described in the README (every 5 minutes,
outside GitHub) and report both figures.
