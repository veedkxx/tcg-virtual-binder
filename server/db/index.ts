import { env } from '../env.js'
import { createDb } from './client.js'

export const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN)
