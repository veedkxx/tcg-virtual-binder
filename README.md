# TCG Binder

Catálogo de cartas Pokémon TCG: **Pesquisa → Carta → Adicionar à coleção → Quantidade** (Sprint 1),
login com Google (Sprint 2) e **binders** em páginas 3x3, livres ou montados a partir de uma coleção (Sprint 3),
cópias com variante, condição e idioma (Sprint 4).

Stack: React + TypeScript + Vite, Tailwind v4, shadcn/ui, TanStack Query + Zustand, Express 5,
SQLite via Turso (libSQL) + Drizzle ORM, dados de cartas do [TCGdex](https://tcgdex.dev). Deploy na Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env        # dev usa um arquivo SQLite local (file:local.db)
npm run db:generate         # gera a migration inicial em ./drizzle (commite a pasta)
npm run db:migrate          # aplica no banco apontado por TURSO_DATABASE_URL
npm run dev                 # Express em :3001 + Vite em :5173 (proxy de /api)
```

Outros scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run smoke -- <url>` (confere um deploy: health, busca, carta, coleções e rotas protegidas).
Os testes (`server/app.test.ts`) usam as migrations de `./drizzle`, então rode `db:generate` antes.

## Estrutura

```
api/index.ts          entrada serverless da Vercel (exporta o app Express)
server/               app Express, rotas, serviços (TCGdex, coleção, binders), schema Drizzle
scripts/smoke.ts      smoke test pós-deploy
shared/               schemas Zod e idiomas, usados por front e back
src/                  React: pages, components (ui/ = shadcn), hooks (TanStack Query), store (Zustand)
drizzle/              migrations geradas pelo drizzle-kit
```

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/cards?q=&page=&lang=` | busca por nome (proxy do TCGdex, 20 por página) |
| GET | `/api/cards/:id?lang=` | detalhe da carta |
| GET | `/api/collection?lang=` | cópias da coleção + totais |
| POST | `/api/collection` | `{ cardId, language?, variant?, condition?, quantity? }`; se a cópia já existe, **soma** a quantidade |
| PATCH | `/api/collection/:id` | `{ quantity?, variant?, condition? }`; se virar uma cópia que já existe, as duas se juntam |
| DELETE | `/api/collection/:id` | remove a cópia |
| GET | `/api/sets?lang=` | coleções do TCGdex (mais novas primeiro) |
| GET | `/api/sets/:id?lang=` | coleção com as cartas |
| GET | `/api/binders?lang=` | binders do usuário |
| POST | `/api/binders` | `{ name, setId?, setType?, fill? }`; com `setId`, monta Core Set (padrão) ou Master Set |
| GET / PATCH / DELETE | `/api/binders/:id` | detalhe / renomear `{ name }` / apagar (a coleção não muda) |
| POST | `/api/binders/:id/fill` | coloca as cartas que o usuário tem nos bolsos vazios do molde |
| PUT / DELETE | `/api/binders/:id/slots/:position` | `{ collectionItemId }` coloca/troca / esvazia o bolso |
| GET | `/api/health?deep=1` | testa banco e TCGdex (503 se algum falhar); sem `deep`, só responde ok |

Coleção, binders e login exigem sessão. Detalhes dos binders em [docs/sprint-3.md](docs/sprint-3.md).

Erros seguem `{ "error": { "code", "message" } }`.

## Idiomas

**Português** e **inglês**, escolhidos no cabeçalho; o idioma vale para busca, coleção e binders e
fica salvo no navegador. Cada cópia da coleção é `(carta, idioma, variante, condição)`.

Para habilitar outro idioma do TCGdex (es, fr, de, it, ja…), adicione o código em `ENABLED_LANGUAGES` e
o rótulo em `LANGUAGE_LABELS` (`shared/languages.ts`). Nenhuma migration é necessária.

## Deploy (Vercel + Turso)

O sistema de arquivos da Vercel é efêmero, por isso o banco de produção é o Turso.

```bash
turso db create tcg-binder
turso db show tcg-binder --url          # -> TURSO_DATABASE_URL
turso db tokens create tcg-binder       # -> TURSO_AUTH_TOKEN
```

1. Defina `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` nas variáveis de ambiente do projeto na Vercel.
2. Aplique as migrations no Turso a partir da sua máquina, com as mesmas variáveis exportadas: `npm run db:migrate`.
3. Faça o deploy. `vercel.json` já reescreve `/api/*` para `api/index.ts` e o resto para o SPA.
4. Smoke test: `npm run smoke -- https://<seu-app>.vercel.app`; depois, logado, adicione uma carta e
   coloque num binder para conferir a escrita.

Se `TURSO_DATABASE_URL` for `file:...` dentro da Vercel, o servidor falha de propósito ao iniciar.

## Ainda fora do escopo

Scanner (barcode/QR e imagem), arrastar cartas entre bolsos. Roadmap em `docs/`.
