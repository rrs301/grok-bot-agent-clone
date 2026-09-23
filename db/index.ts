import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder-url';

// `prepare: false` keeps the postgres client compatible with pooled/serverless
// Postgres providers that do not support named prepared statements reliably.
const client = postgres(databaseUrl, { prepare: false });

// Export one typed Drizzle instance so API routes and background jobs share the
// same schema mapping, relation names, and inferred TypeScript types.
export const db = drizzle({ client, schema });
export * from '@/db/schema';
