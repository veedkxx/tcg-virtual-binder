// Aplica as migrations de ./drizzle no banco de TURSO_DATABASE_URL (arquivo local ou Turso).
// Usa o mesmo cliente do servidor, então não depende das credenciais do drizzle-kit.
import { migrate } from 'drizzle-orm/libsql/migrator'
import { env } from '../env.js'
import { createDb } from './client.js'

const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN)

try {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log(`Migrations aplicadas em ${env.TURSO_DATABASE_URL}`)
} finally {
  db.$client.close()
}