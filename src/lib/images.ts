/**
 * Imagens do TCGdex passam pelo nosso /api/img, que a CDN da Vercel guarda perto do usuário
 * (o servidor de imagens do TCGdex não tem CDN). Outras URLs ficam como estão.
 */
const TCGDEX_ASSETS = 'https://assets.tcgdex.net/'

export function proxied(src: string | null | undefined): string | null {
  if (!src) return null
  return src.startsWith(TCGDEX_ASSETS) ? `/api/img?src=${encodeURIComponent(src)}` : src
}

/** A mesma imagem em inglês (…/pt/sv/sv09/001/low.webp → …/en/sv/sv09/001/low.webp). */
export function englishVersion(src: string | null | undefined): string | null {
  if (!src?.startsWith(TCGDEX_ASSETS)) return null
  const rest = src.slice(TCGDEX_ASSETS.length)
  const [lang, ...path] = rest.split('/')
  return lang && lang !== 'en' && lang !== 'univ' ? `${TCGDEX_ASSETS}en/${path.join('/')}` : null
}
