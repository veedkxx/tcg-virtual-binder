import { createApp } from './app.js'
import { db } from './db/index.js'
import { env } from './env.js'
import { tcgdex } from './services/tcgdex.js'

createApp({ db, cards: tcgdex }).listen(env.PORT, () => {
  console.log(`API em http://localhost:${env.PORT}  (db: ${env.TURSO_DATABASE_URL})`)
})
