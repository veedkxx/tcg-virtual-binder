// Monta o app com as dependências reais (banco, TCGdex, Google). Usado pelo servidor de
// desenvolvimento (dev.ts) e pela função serverless da Vercel (api/index.ts).
import { createApp } from './app.js'
import { db } from './db/index.js'
import { env } from './env.js'
import { createGoogleProvider } from './services/google.js'
import { tcgdex } from './services/tcgdex.js'

export function createRuntimeApp() {
  return createApp({
    db,
    cards: tcgdex,
    google: createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/api/auth/google/callback`,
    }),
    appUrl: env.APP_URL,
  })
}
