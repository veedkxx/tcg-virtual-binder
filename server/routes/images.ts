import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../errors.js'

/**
 * Repassa imagens do TCGdex pelo nosso domínio para a CDN da Vercel guardá-las perto do usuário.
 * O servidor de imagens do TCGdex é um nginx único no Canadá, sem CDN: cada imagem levava
 * ~750 ms a partir do Brasil. Imagens de carta nunca mudam, então o cache é de um ano.
 *
 * Só aceita imagens de assets.tcgdex.net (não é um proxy aberto).
 */
const ALLOWED = /^https:\/\/assets\.tcgdex\.net\/(?:[\w.-]+\/)+[\w.-]+\.(?:webp|png|jpg)$/
const TIMEOUT_MS = 10_000

const QuerySchema = z.object({ src: z.string().max(300) })

const LONG_CACHE = 'public, max-age=604800, s-maxage=31536000, immutable'
// 404 também é cacheado (a imagem não existe), mas por menos tempo: o TCGdex pode ganhá-la.
const MISSING_CACHE = 'public, max-age=3600, s-maxage=86400'

export function createImagesRouter(fetchImpl: typeof fetch = fetch) {
  const router = Router()

  router.get('/', async (req, res) => {
    const { src } = QuerySchema.parse(req.query)
    if (!ALLOWED.test(src)) throw new AppError(400, 'IMAGE_NOT_ALLOWED', 'Imagem não permitida.')

    let upstream: Response
    try {
      upstream = await fetchImpl(src, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      throw new AppError(504, 'UPSTREAM_TIMEOUT', 'A imagem demorou demais para carregar.')
    }

    if (upstream.status === 404) {
      res.set('Cache-Control', MISSING_CACHE).status(404).end()
      return
    }
    if (!upstream.ok) {
      res.set('Cache-Control', 'no-store')
      throw new AppError(502, 'UPSTREAM_ERROR', 'Erro ao carregar a imagem.')
    }

    res.set({
      'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
      'Cache-Control': LONG_CACHE,
    })
    res.send(Buffer.from(await upstream.arrayBuffer()))
  })

  return router
}
