import { sql } from 'drizzle-orm'
import journal from '../../drizzle/meta/_journal.json' with { type: 'json' }
import type { Db } from './client.js'

/** Quantas migrations o código espera e quantas o banco já tem (tabela do drizzle). */
export async function migrationStatus(db: Db) {
  const expected = journal.entries.length
  let applied = 0
  try {
    const rows = await db.all<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`)
    applied = Number(rows[0]?.n ?? 0)
  } catch {
    // Tabela ainda não existe: nenhuma migration aplicada.
  }
  return { expected, applied, upToDate: applied >= expected }
}
