# AI Agent Platform: Backend

REST API for the AI Agent Platform. AI agents work customer-support tickets through workflows, and a person must approve any risky step (refunds, outbound email) before it runs.

Frontend repo: `ai-agent-frontend`.

## Stack

- Node 22, Express 5, TypeScript
- MongoDB with Mongoose
- Zod for request and model-output validation
- bcryptjs and JWT (httpOnly cookie) for authentication
- helmet, CORS, rate limiting, multer (uploads)
- Vitest, Supertest and an in-memory MongoDB for tests
- Agents call any OpenAI-compatible model API (Groq free tier by default)

## Quick start

Requirements: Node 22, Git, and a MongoDB database (local MongoDB or a free Atlas cluster).

```bash
git clone <this-repo-url>
cd ai-agent-backend
npm install
cp .env.example .env     # on Windows PowerShell: Copy-Item .env.example .env
```

Fill in `.env` (see below), then seed sample data and start the server:

```bash
npm run seed              # users (admin, agent, viewer)
npm run seed:tickets
npm run seed:workflows
npm run seed:extractions
npm run dev               # http://localhost:5000/api
```

Check it works: open `http://localhost:5000/api/health`. You should see `"database":"connected"`.

The seed scripts print the accounts they create. Change those passwords before sharing the app with anyone (see "Changing a password").

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test` or `production`. Default `development` |
| `PORT` | No | Default `5000` |
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name |
| `CLIENT_ORIGIN` | Yes | Exact frontend origin, for example `http://localhost:3000`. No trailing slash |
| `JWT_SECRET` | Yes | Random string of at least 32 characters |
| `LLM_API_KEY` | No | Model provider key. Without it, agent steps are simulated |
| `LLM_BASE_URL` | No | Default `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | No | Model name. Check which models your key can use (for example `openai/gpt-oss-20b`) |

Never commit `.env`. Only `.env.example` (names, no values) belongs in git.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the test suite |
| `npm run test:watch` | Re-run tests on change |
| `npm run seed` | Create the demo users |
| `npm run seed:tickets` | Create sample tickets (`-- --reset` to replace) |
| `npm run seed:workflows` | Create sample workflows |
| `npm run seed:extractions` | Create sample extraction jobs |
| `npm run set-password` | Change a user's password |

### Changing a password

```bash
npx tsx --env-file=.env src/scripts/set-password.ts admin@example.com 'A-Strong-Password-1'
```

For a hosted database, set `MONGODB_URI` in your terminal first and run the script without `--env-file`.

## How it works

1. A **ticket** enters the system.
2. A **workflow** is an ordered list of agents. Each has a role, instructions and tools.
3. Starting a **run** creates a snapshot of the workflow and works through its steps one at a time.
4. A background **executor** (started in `server.ts`) checks for due runs every second. For each step, the agent runner asks the model for a structured answer, validates it with Zod, and stores it.
5. If a step uses a risky tool (`refund_api`, `email_sender`), the run **pauses** with the agent's proposal. A person approves or rejects it.
6. Approve: the tool runs (currently simulated) and the run continues. Reject: the run ends as failed and nothing is sent.

Run state lives in the database, so runs survive a restart. Concurrent updates are protected by optimistic concurrency. Run the backend as a **single instance**, because a second one could call the model twice for the same step.

## Roles

| Role | Can do |
| --- | --- |
| `admin` | Everything, including users and workflows |
| `agent` | Run workflows, approve or reject steps, reassign tickets, upload documents |
| `viewer` | Read-only |

New sign-ups are always viewers. Permissions are enforced on the server for every request.

## API overview

All routes are under `/api`. Reads need a signed-in user, and writes need the role shown.

| Area | Path | Operations | Write access |
| --- | --- | --- | --- |
| Health | `/health` | Status and database state | Public |
| Auth | `/auth` | `register`, `login`, `logout`, `me` | Public for register and login |
| Users | `/users` | List, change role | Admin |
| Tickets | `/tickets` | List (filter by status, priority), get, update | Admin, agent |
| Workflows | `/workflows` | List, get, create, update, delete, `POST /:id/run` | Admin to edit, admin and agent to run |
| Runs | `/runs` | List, get, `POST /:id/decision` | Admin, agent |
| Extractions | `/extractions` | List, get, upload (multipart, PDF/PNG/JPG up to 10 MB) | Admin, agent |

`POST /workflows/:id/run` takes an optional body `{ "ticketId": "TCK-1001" }`. Without it, a dispatch workflow uses the newest open ticket. Human-readable ids: `TCK-1001`, `WF-001`, `RUN-101`, `EXT-001`.

## Project structure

```
src/
  config/        env validation, database, permission matrix
  middleware/    auth, error handling, rate limits
  modules/
    auth/ users/ tickets/ workflows/ extractions/
    runs/        model, service, executor, controller, agent/ (runner and tools)
  scripts/       seed and password scripts
  test/          test setup and helpers
  utils/         tokens, passwords, counters, params, HttpError
  app.ts         builds the Express app
  server.ts      connects the database, starts the API and the executor
```

Each module has a model, Zod schemas, a controller and routes.

## Testing

```bash
npm test
```

Tests use Supertest against the real app and an in-memory MongoDB, so they never touch real data. The first run downloads a MongoDB binary. Tests run agents in simulated mode and do not use any model key.

CI (GitHub Actions) runs typecheck, tests and build on every push and pull request.

## Deployment (Render)

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your frontend URL), and optionally the `LLM_*` variables
- Database: MongoDB Atlas, with the Render service allowed through the network access list

The free tier sleeps when idle, so the first request after a quiet period can take up to a minute.

## Known limitations

- Refunds and email are simulated after approval. No money moves and nothing is sent.
- Data extraction returns sample fields, and uploaded files are not stored.
- Only fictional data should be sent to a free model provider.
- Lists are capped (1,000 tickets, 500 extraction jobs, 200 runs) until pagination is added.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Invalid environment variables` on start | A required variable is missing or too short. Check `.env` |
| `bad auth` from MongoDB | Wrong database username or password. Copy the exact string from Atlas and URL-encode special characters |
| Login returns 401 | The password does not match this database. Reset it with `set-password` |
| `ERR_CONNECTION_REFUSED` from the frontend | The backend is not running. Start it with `npm run dev` |
| Agent step fails | Look for `Agent step failed:` in the server log. A `404` means the model name is not available to your key |

## Contributing

- One branch per feature, then open a pull request.
- Never commit secrets or `.env` files.
- Run `npm run typecheck` and `npm test` before pushing.
- Keep pull requests small and explain why the change is needed.