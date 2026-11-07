import { sql } from 'drizzle-orm'
import journal from '../../drizzle/meta/_journal.json' with { type: 'json' }
import type { Db } from './client.js'

export async function migrationStatus(db: Db) {
  const expected = journal.entries.length
  let applied = 0
  try {
    const rows = await db.all<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`)
    applied = Number(rows[0]?.n ?? 0)
  } catch {
  }
  return { expected, applied, upToDate: applied >= expected }
}
