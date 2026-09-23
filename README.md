# Grok Bot Agent Clone

A Next.js agent workspace for creating AI agents, connecting external tools through Composio, running OpenAI-powered chat flows, scheduling routines with Inngest, and launching E2B desktop sandboxes for browser or desktop-style agent work.

## Tech Stack

- Next.js 16 with App Router
- React 19 and TypeScript
- Tailwind CSS 4 with shadcn-style UI components
- NextAuth for Google and GitHub OAuth
- Drizzle ORM with PostgreSQL
- OpenAI Agents SDK
- Composio for connected app tools
- E2B Desktop for VM/browser automation
- Inngest for background jobs and scheduled routine execution

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL database, local or hosted
- OpenAI API account
- Optional accounts for Google OAuth, GitHub OAuth, Composio, E2B, and Inngest

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create the environment file:

```bash
cp .env.example .env
```

3. Fill in the values in `.env` using the key generation steps below.

4. Push the Drizzle schema to your database:

```bash
npm run db:push
```

5. Start the Next.js development server:

```bash
npm run dev
```

6. Open the app:

```text
http://localhost:3000
```

7. In a second terminal, start the local Inngest dev server when testing routines:

```bash
npm run inngest:dev
```

## Environment Variables

Use `.env.example` as the template. Keep real secrets in `.env` only.

### App URL

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, set this to your deployed app URL, for example `https://your-domain.com`.

### OpenAI

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_COMPUTER_MODEL=gpt-5.6-luna
```

How to generate:

1. Go to the OpenAI dashboard.
2. Open API keys.
3. Create a new secret key.
4. Paste it as `OPENAI_API_KEY`.
5. Set `OPENAI_MODEL` to the chat/planning model your account can access.
6. Set `OPENAI_COMPUTER_MODEL` to a computer-use capable model your account can access for E2B desktop control.

### PostgreSQL Database

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/your_database
```

Local option:

1. Create a PostgreSQL database locally.
2. Replace `your_password` and `your_database` with your real values.
3. Run `npm run db:push`.

Hosted option:

1. Create a PostgreSQL database with your preferred provider.
2. Copy the provider's pooled or direct connection string.
3. Paste it as `DATABASE_URL`.
4. Run `npm run db:push`.

### NextAuth

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-at-least-32-chars-long
```

Generate the secret:

```bash
openssl rand -base64 32
```

Use `http://localhost:3000` for local development. In production, set `NEXTAUTH_URL` to your deployed URL.

### GitHub OAuth

```env
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
```

How to generate:

1. Go to GitHub Developer settings.
2. Create a new OAuth App.
3. Set the homepage URL to `http://localhost:3000`.
4. Set the authorization callback URL to `http://localhost:3000/api/auth/callback/github`.
5. Copy the client ID and generate a client secret.
6. Paste them into `.env`.

For production, create or update the OAuth app with:

```text
https://your-domain.com/api/auth/callback/github
```

### Google OAuth

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

How to generate:

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create OAuth client credentials for a web application.
5. Add `http://localhost:3000` as an authorized JavaScript origin.
6. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
7. Copy the client ID and secret into `.env`.

For production, add:

```text
https://your-domain.com/api/auth/callback/google
```

### Inngest

```env
INNGEST_EVENT_KEY=your_inngest_event_key_here
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
```

Local development does not require hosted keys when using:

```bash
npm run inngest:dev
```

For production:

1. Create an Inngest account and app.
2. Open the app's keys or environment settings.
3. Copy the event key into `INNGEST_EVENT_KEY`.
4. Copy the signing key into `INNGEST_SIGNING_KEY`.
5. Configure the Inngest serve URL as `https://your-domain.com/api/inngest`.

### Composio

```env
COMPOSIO_API_KEY=your_composio_api_key_here
```

How to generate:

1. Create a Composio account.
2. Open project or API key settings.
3. Generate an API key.
4. Paste it into `.env`.

This is required for connected external app actions used by agent workflows.

### E2B

```env
E2B_API_KEY=your_e2b_api_key_here
```

How to generate:

1. Create an E2B account.
2. Open dashboard API keys.
3. Create or copy an API key.
4. Paste it into `.env`.

Without this key, VM desktop routes will return a configuration error and desktop automation will be unavailable.

## Database Commands

Generate migration files after schema changes:

```bash
npm run db:generate
```

Push schema changes directly to the configured database:

```bash
npm run db:push
```

Open Drizzle Studio:

```bash
npm run db:studio
```

## Development Commands

```bash
npm run dev
npm run build
npm run start
npm run inngest:dev
```

## Project Structure

```text
app/                  Next.js routes, layouts, auth pages, and API routes
components/           Shared UI and custom workspace components
context/              React context for agent configuration
db/                   Drizzle database client and schema
drizzle/              Generated migrations and metadata
lib/                  OpenAI, E2B, Composio, Inngest, routine, and helper logic
type/                 Shared TypeScript types
docs/                 Implementation notes and project documentation
public/               Static assets
```

## Production Checklist

- Set every required environment variable in the hosting provider.
- Update `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` to the production URL.
- Add production OAuth callback URLs for GitHub and Google.
- Run `npm run db:push` or apply generated migrations to the production database.
- Configure Inngest with `https://your-domain.com/api/inngest`.
- Confirm the OpenAI models are available to your API project.
- Confirm `COMPOSIO_API_KEY` and `E2B_API_KEY` are present if using connected tools and VM desktop features.

## Troubleshooting

- Auth redirects fail: check `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and OAuth callback URLs.
- Database requests fail: verify `DATABASE_URL` and run `npm run db:push`.
- Agent replies fail: verify `OPENAI_API_KEY` and model names.
- Connected tools fail: verify `COMPOSIO_API_KEY`.
- VM desktop fails: verify `E2B_API_KEY` and that the selected computer model is available.
- Routines do not run locally: run `npm run inngest:dev` in a second terminal.
