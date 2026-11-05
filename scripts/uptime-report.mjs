// Availability from the history of the Uptime workflow (.github/workflows/uptime.yml): `npm run uptime`,
// or `npm run uptime -- 2026-11-05` to count from a date (UTC). Each completed run is one check; a
// success is up, a failure is down; cancelled and skipped runs are left out. No login is needed (the
// repository is public); GITHUB_TOKEN is used when set, for a higher request limit.
// API: https://docs.github.com/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow

const repository = "Froztie-s/HomeKlin";
const workflow = "uptime.yml";

/**
 * @param {{ conclusion: string | null, created_at: string }[]} runs
 * @param {Date} [since]
 * @returns {{ checks: number, up: number, down: number, availability: number | null, firstCheck: string | null, lastCheck: string | null }}
 */
export function availability(runs, since) {
  const counted = runs.filter(
    (run) =>
      (run.conclusion === "success" || run.conclusion === "failure") && (!since || Date.parse(run.created_at) >= since.getTime()),
  );
  const up = counted.filter((run) => run.conclusion === "success").length;
  const times = counted.map((run) => run.created_at).sort();
  return {
    checks: counted.length,
    up,
    down: counted.length - up,
    availability: counted.length === 0 ? null : (up / counted.length) * 100,
    firstCheck: times[0] ?? null,
    lastCheck: times.at(-1) ?? null,
  };
}

async function fetchRuns() {
  const headers = { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const runs = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/runs?status=completed&per_page=100&page=${page}`,
      { headers },
    );
    if (response.status === 404) throw new Error("The Uptime workflow is not on GitHub yet: push .github/workflows/uptime.yml to the main branch first.");
    if (!response.ok) throw new Error(`GitHub answered ${response.status}: ${(await response.text()).slice(0, 120)}`);
    const body = await response.json();
    runs.push(...body.workflow_runs);
    if (body.workflow_runs.length < 100) break;
  }
  return runs;
}

async function main() {
  const since = process.argv[2] ? new Date(process.argv[2]) : undefined;
  if (since && Number.isNaN(since.getTime())) throw new Error("Give the start date as YYYY-MM-DD.");
  const result = availability(await fetchRuns(), since);
  if (result.availability === null) {
    console.log("No completed checks yet: the workflow needs to have run at least once on the main branch.");
    return;
  }
  console.log(`Checks: ${result.checks} (every 10 minutes), up ${result.up}, down ${result.down}`);
  console.log(`From ${result.firstCheck} to ${result.lastCheck}`);
  console.log(`Availability: ${result.availability.toFixed(2)}% (target: at least 99%)`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
