import type { RepoBundle } from '../lib/github'

export interface SampleRepo {
  id: string
  label: string
  tagline: string
  bundle: RepoBundle
}

const launchPadReadme = `# LaunchPad

LaunchPad is an opinionated Next.js 15 starter for hackathon teams that want to ship a polished demo before the deadline. It ships with authentication, a Postgres schema, Tailwind UI primitives, and a deploy button that works on the free Vercel tier.

Built by a team that lost three hackathons to broken setup docs.

## Why LaunchPad?

Hackathon teams lose hours wiring auth, database migrations, and deploy config. LaunchPad gives you a working baseline in under five minutes so the team can spend the weekend on the actual idea instead of boilerplate.

**Who it is for:** hackathon teams, indie hackers, and anyone who needs a credible landing page plus dashboard by Sunday.

## Features

- Email + GitHub authentication out of the box
- Typed Postgres access with Drizzle migrations
- Prebuilt dashboard shell with dark mode
- One-click Vercel deploy

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Auth.js |
| Hosting | Vercel |

**Prerequisites:** Node.js 20+, pnpm 9+, and a free Neon or Supabase Postgres database.

## Quickstart

\`\`\`bash
git clone https://github.com/hackathon-launchpad/launchpad.git
cd launchpad
pnpm install
cp .env.example .env
pnpm dev
\`\`\`

Open <http://localhost:3000>. The seeded demo account is \`demo@launchpad.dev\` / \`launchpad\`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| \`DATABASE_URL\` | Yes | Postgres connection string from Neon or Supabase |
| \`AUTH_SECRET\` | Yes | 32-byte secret used to sign sessions (\`openssl rand -base64 32\`) |
| \`GITHUB_CLIENT_ID\` | No | Enables GitHub sign-in |
| \`GITHUB_CLIENT_SECRET\` | No | GitHub OAuth secret |

## Live Demo

**Try it now:** <https://launchpad-demo.vercel.app>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hackathon-launchpad/launchpad)

## Usage

\`\`\`ts
import { createProject } from '@/lib/projects'

const project = await createProject({
  name: 'My hackathon idea',
  ownerId: session.user.id,
})
\`\`\`

## Contributing

1. Fork the repo and create a branch: \`git checkout -b feat/my-change\`
2. Run \`pnpm install\` and \`pnpm dev\`
3. Open a PR using the template in \`.github/PULL_REQUEST_TEMPLATE.md\`

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.
`

const pulseApiReadme = `# PulseAPI

PulseAPI is a small, self-hostable HTTP API that turns raw webhook payloads into normalized events. Point your Stripe, GitHub, or custom webhooks at it and query a single clean event stream instead of writing five different parsers.

It is designed for platform teams that need an audit trail without adopting a full event pipeline.

## Overview

Most teams end up with a folder of one-off webhook handlers. PulseAPI gives you one endpoint, one schema, and one query API. It validates signatures, retries failed deliveries, and stores everything in Postgres.

## Features

- Signature verification for Stripe, GitHub, and Shopify
- Idempotent ingestion with retry-safe writes
- Query API with cursor pagination
- Docker image published to GHCR

## Tech Stack

- Node.js 22 + TypeScript
- Fastify 5
- PostgreSQL 16
- Docker + docker compose

**Prerequisites:** Node.js 22+ and Docker Desktop 4.x.

## Quickstart

\`\`\`bash
git clone https://github.com/pulse-labs/pulse-api.git
cd pulse-api
npm install
docker compose up -d db
npm run dev
\`\`\`

The API listens on <http://localhost:8787>. Health check: \`curl localhost:8787/healthz\`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| \`DATABASE_URL\` | Yes | Postgres connection string |
| \`WEBHOOK_SIGNING_SECRET\` | Yes | Shared secret used to verify inbound payloads |
| \`LOG_LEVEL\` | No | Pino log level, defaults to \`info\` |

## Usage

\`\`\`bash
curl -X POST localhost:8787/v1/events \\
  -H 'content-type: application/json' \\
  -d '{"source":"github","type":"push","payload":{}}'
\`\`\`

## License

Apache-2.0. See [LICENSE](./LICENSE).
`

const csvSquashReadme = `# csv-squash

Squash duplicate rows out of large CSV files.

## Install

\`\`\`bash
npm install -g csv-squash
\`\`\`

## License

MIT
`

export const SAMPLE_REPOS: SampleRepo[] = [
  {
    id: 'hackathon-starter',
    label: 'Hackathon Starter',
    tagline: 'LaunchPad — polished Next.js starter (strong README)',
    bundle: {
      meta: {
        owner: 'hackathon-launchpad',
        name: 'launchpad',
        fullName: 'hackathon-launchpad/launchpad',
        description:
          'Opinionated Next.js 15 starter for hackathon teams: auth, Postgres, Tailwind, and a one-click Vercel deploy.',
        stars: 1284,
        language: 'TypeScript',
        license: null,
        homepage: 'https://launchpad-demo.vercel.app',
        topics: ['nextjs', 'hackathon', 'starter', 'tailwindcss'],
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/hackathon-launchpad/launchpad',
        source: 'sample',
      },
      readme: launchPadReadme,
    },
  },
  {
    id: 'api-tool',
    label: 'API Tool',
    tagline: 'PulseAPI — webhook normalizer (partial README)',
    bundle: {
      meta: {
        owner: 'pulse-labs',
        name: 'pulse-api',
        fullName: 'pulse-labs/pulse-api',
        description:
          'Self-hostable HTTP API that normalizes Stripe, GitHub, and Shopify webhooks into one queryable event stream.',
        stars: 342,
        language: 'TypeScript',
        license: 'Apache-2.0',
        homepage: null,
        topics: ['webhooks', 'fastify', 'postgres', 'api'],
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/pulse-labs/pulse-api',
        source: 'sample',
      },
      readme: pulseApiReadme,
    },
  },
  {
    id: 'minimal-repo',
    label: 'Minimal Repo',
    tagline: 'csv-squash — tiny CLI, barely any docs',
    bundle: {
      meta: {
        owner: 'solo-dev',
        name: 'csv-squash',
        fullName: 'solo-dev/csv-squash',
        description: 'Squash duplicate rows out of large CSV files.',
        stars: 17,
        language: 'JavaScript',
        license: 'MIT',
        homepage: null,
        topics: ['csv', 'cli'],
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/solo-dev/csv-squash',
        source: 'sample',
      },
      readme: csvSquashReadme,
    },
  },
]
