import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { sessions, users, type UserRow } from '../db/schema.js'
import type { GoogleProfile } from './google.js'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Quando falta menos que isto, a sessão é renovada por mais um TTL inteiro. */
const RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000

// O token vai no cookie; no banco fica só o hash dele.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function createAuthService(db: Db) {
  return {
    /** Cria o usuário no primeiro login e atualiza nome, e-mail e foto nos seguintes. */
    async upsertGoogleUser(profile: GoogleProfile): Promise<UserRow> {
      const [row] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          googleId: profile.sub,
          email: profile.email,
          name: profile.name ?? null,
          avatarUrl: profile.picture ?? null,
        })
        .onConflictDoUpdate({
          target: users.googleId,
          set: {
            email: profile.email,
            name: profile.name ?? null,
            avatarUrl: profile.picture ?? null,
          },
        })
        .returning()
      return row!
    },

    async createSession(userId: string) {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = Date.now() + SESSION_TTL_MS
      await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt })
      return { token, expiresAt }
    },

    /** Retorna o usuário da sessão, ou null se não existe ou expirou (e então a apaga). */
    async validateSession(token: string) {
      const id = hashToken(token)
      const [row] = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, id))
        .limit(1)
      if (!row) return null

      const now = Date.now()
      if (row.session.expiresAt <= now) {
        await db.delete(sessions).where(eq(sessions.id, id))
        return null
      }

      let expiresAt = row.session.expiresAt
      let renewed = false
      if (expiresAt - now < RENEW_BELOW_MS) {
        expiresAt = now + SESSION_TTL_MS
        renewed = true
        await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id))
      }
      return { user: row.user, expiresAt, renewed }
    },

    async deleteSession(token: string) {
      await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
