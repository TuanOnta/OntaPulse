/** Landing copy, ported verbatim from apps/web/references/landing-prototype.html. */

export const HERO = {
  chip: "HTTP monitoring for teams",
  title: "Know the moment your site breaks.",
  sub: "OntaPulse checks your websites and APIs on a schedule, flags errors and slow responses, and keeps your whole team looking at the same results.",
  primaryCta: "Start monitoring",
  secondaryCta: "See how it works",
  meta: "HTTP/HTTPS targets · checks every 1 min to 24 h · public URLs only",
} as const;

export type StepKey = "queued" | "running" | "done";
type HowStep = { key: StepKey; num: string; title: string; body: string };

export const HOW = {
  eyebrow: "How it works",
  title: "From request to result, without blocking.",
  lead: "Triggering a scan never makes you wait on the target. The API queues the work and a separate worker does the check.",
  steps: [
    {
      key: "queued",
      num: "01",
      title: "Queue",
      body: "Trigger a scan or let the interval do it. The API records it as queued and answers right away.",
    },
    {
      key: "running",
      num: "02",
      title: "Check",
      body: "A worker picks up the job, confirms the target is public, and sends an HTTP GET with strict timeouts.",
    },
    {
      key: "done",
      num: "03",
      title: "Review",
      body: "Status and findings land in your workspace for everyone on the team to see.",
    },
  ],
} as const satisfies { steps: readonly HowStep[] } & Record<string, unknown>;

export const RESULT = {
  eyebrow: "Scan results",
  title: "Every scan tells you what happened.",
  leads: [
    "A target that answers with an error is still a result worth reading. OntaPulse keeps the scan, records the response time, and turns problems into findings with a severity.",
    "Timeouts and DNS failures are recorded as failed scans, so you can tell an unhealthy page from an unreachable one.",
  ],
  /** Static marketing sample: not API data. */
  sample: {
    url: "https://api.example.com/health",
    status: "SUCCEEDED",
    stats: [
      { label: "HTTP status", value: "503" },
      { label: "Response time", value: "2,430 ms" },
    ],
    findingsLabel: "Findings",
    findings: [
      {
        type: "HTTP_SERVER_ERROR",
        text: "The target answered with a 5xx status.",
        severity: "HIGH",
      },
      {
        type: "SLOW_RESPONSE",
        text: "The response took 2,000 ms or more.",
        severity: "MEDIUM",
      },
    ],
  },
} as const;

export const FEATURES = {
  eyebrow: "Features",
  title: "Built for teams that share one source of truth.",
  items: [
    {
      title: "Workspaces and roles",
      body: "Owner, Admin, and Member roles per workspace. Everyone sees the results; only the right people change things.",
    },
    {
      title: "Projects and monitors",
      body: "Group HTTP and HTTPS targets into projects and set an interval from one minute up to a full day.",
    },
    {
      title: "Findings that matter",
      body: "Client errors, server errors, and slow responses become structured findings, each with a severity.",
    },
    {
      title: "Safe by design",
      body: "Targets must resolve to public addresses and redirects are not followed, so a check can't be steered into a private network.",
    },
    {
      title: "Resilient checks",
      body: "When infrastructure hiccups, a job retries after 5, 30, and 120 seconds before it is set aside for review instead of vanishing.",
    },
    {
      title: "Made for teams",
      body: "Add registered teammates, adjust their roles, and review every scan together in one place.",
    },
  ],
  comingSoonLabel: "Coming soon",
  comingSoon: ["Notifications", "Uptime trends", "Incident history"],
} as const;

export const CTA = {
  title: "Watch your first target in minutes.",
  lead: "Create a workspace, add a project, and point a monitor at a public URL.",
  primary: "Create your workspace",
  secondary: "Sign in",
} as const;
