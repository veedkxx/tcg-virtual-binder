// Entrada serverless da Vercel: todo /api/* é reescrito para cá (ver vercel.json).
import { createApp } from '../server/app.js'
import { db } from '../server/db/index.js'
import { tcgdex } from '../server/services/tcgdex.js'

export default createApp({ db, cards: tcgdex })
