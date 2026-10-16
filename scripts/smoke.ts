// Smoke test pós-deploy: confere as rotas principais contra uma URL real.
// Uso: npm run smoke -- https://seu-app.vercel.app   (sem argumento: http://localhost:5173)

export {}

const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '')

type Check = { name: string; run: () => Promise<string | void> }

async function get(path: string) {
  const started = Date.now()
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15_000) })
  return { res, ms: Date.now() - started }
}

function expectStatus(res: Response, expected: number) {
  if (res.status !== expected) throw new Error(`esperava ${expected}, veio ${res.status}`)
}

let cardId = ''

const checks: Check[] = [
  {
    name: 'SPA carrega (GET /)',
    async run() {
      const { res, ms } = await get('/')
      expectStatus(res, 200)
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) {
        throw new Error('não veio HTML')
      }
      return `${ms}ms`
    },
  },
  {
    name: 'health (banco + TCGdex)',
    async run() {
      const { res, ms } = await get('/api/health?deep=1')
      const body = (await res.json()) as {
        checks?: Record<string, { ok: boolean; ms: number; error?: string }>
      }
      const detail = Object.entries(body.checks ?? {})
        .map(([k, v]) => `${k} ${v.ok ? 'ok' : `FALHOU (${v.error})`} ${v.ms}ms`)
        .join(', ')
      if (res.status !== 200) throw new Error(detail || `status ${res.status}`)
      return `${detail} · total ${ms}ms`
    },
  },
  {
    name: 'busca de cartas',
    async run() {
      const { res, ms } = await get('/api/cards?q=pikachu')
      expectStatus(res, 200)
      const body = (await res.json()) as { items: { id: string }[] }
      if (body.items.length === 0) throw new Error('nenhuma carta para "pikachu"')
      cardId = body.items[0]!.id
      return `${body.items.length} cartas · ${ms}ms`
    },
  },
  {
    name: 'detalhe da carta',
    async run() {
      if (!cardId) throw new Error('pulado: a busca falhou')
      const { res, ms } = await get(`/api/cards/${encodeURIComponent(cardId)}`)
      expectStatus(res, 200)
      return `${cardId} · ${ms}ms`
    },
  },
  {
    name: 'coleções do TCGdex (sets)',
    async run() {
      const { res, ms } = await get('/api/sets')
      expectStatus(res, 200)
      const body = (await res.json()) as { items: unknown[] }
      if (body.items.length === 0) throw new Error('lista vazia')
      return `${body.items.length} coleções · ${ms}ms`
    },
  },
  {
    name: 'coleção do usuário exige login',
    async run() {
      expectStatus((await get('/api/collection')).res, 401)
    },
  },
  {
    name: 'binders exigem login',
    async run() {
      expectStatus((await get('/api/binders')).res, 401)
    },
  },
  {
    name: 'rota inexistente da API dá 404 em JSON',
    async run() {
      const { res } = await get('/api/nao-existe')
      expectStatus(res, 404)
      await res.json()
    },
  },
]

console.log(`Smoke test em ${base}\n`)
let failed = 0
for (const check of checks) {
  try {
    const info = await check.run()
    console.log(`  ✓ ${check.name}${info ? `  (${info})` : ''}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${check.name}: ${(err as Error).message}`)
  }
}
console.log(
  failed ? `\n${failed} de ${checks.length} falharam.` : `\nTudo certo (${checks.length}).`,
)
process.exit(failed ? 1 : 0)
