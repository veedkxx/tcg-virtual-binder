import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const url = process.env.TURSO_DATABASE_URL || 'file:local.db'
const authToken = process.env.TURSO_AUTH_TOKEN || undefined

// Usado por `db:generate` e `db:studio`. As migrations são aplicadas por `npm run db:migrate`
// (server/db/migrate.ts). O dialeto "turso" exige authToken, então arquivo local usa "sqlite".
export default url.startsWith('file:')
  ? defineConfig({
      dialect: 'sqlite',
      schema: './server/db/schema.ts',
      out: './drizzle',
      dbCredentials: { url },
    })
  : defineConfig({
      dialect: 'turso',
      schema: './server/db/schema.ts',
      out: './drizzle',
      dbCredentials: { url, authToken },
    })