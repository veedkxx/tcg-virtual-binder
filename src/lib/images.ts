const TCGDEX_ASSETS = 'https://assets.tcgdex.net/'

export function proxied(src: string | null | undefined): string | null {
  if (!src) return null
  return src.startsWith(TCGDEX_ASSETS) ? `/api/img?src=${encodeURIComponent(src)}` : src
}

export function englishVersion(src: string | null | undefined): string | null {
  if (!src?.startsWith(TCGDEX_ASSETS)) return null
  const rest = src.slice(TCGDEX_ASSETS.length)
  const [lang, ...path] = rest.split('/')
  return lang && lang !== 'en' && lang !== 'univ' ? `${TCGDEX_ASSETS}en/${path.join('/')}` : null
}
