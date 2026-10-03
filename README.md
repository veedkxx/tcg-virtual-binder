# TCG Binder

Catálogo de cartas Pokémon TCG: **Pesquisa → Carta → Adicionar à coleção → Quantidade** (Sprint 1).

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

Outros scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Os testes (`server/app.test.ts`) usam as migrations de `./drizzle`, então rode `db:generate` antes.

## Estrutura

```
api/index.ts          entrada serverless da Vercel (exporta o app Express)
server/               app Express, rotas, serviços (TCGdex, coleção), schema Drizzle
shared/               schemas Zod e idiomas, usados por front e back
src/                  React: pages, components (ui/ = shadcn), hooks (TanStack Query), store (Zustand)
drizzle/              migrations geradas pelo drizzle-kit
```

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/cards?q=&page=&lang=` | busca por nome (proxy do TCGdex, 20 por página) |
| GET | `/api/cards/:id?lang=` | detalhe da carta |
| GET | `/api/collection?lang=` | coleção + totais |
| POST | `/api/collection` | `{ cardId, quantity?, language? }`; se já existe, **soma** a quantidade |
| PATCH | `/api/collection/:cardId?lang=` | `{ quantity }` define a quantidade exata (1 a 9999) |
| DELETE | `/api/collection/:cardId?lang=` | remove da coleção |

Erros seguem `{ "error": { "code", "message" } }`.

## Idiomas

Sprint 1 é só **português** (`pt`). A chave única da coleção é `(card_id, language)`, então a mesma carta
em idiomas diferentes já é tratada como itens separados. Para habilitar outro idioma:

1. adicione o código em `ENABLED_LANGUAGES` e o rótulo em `LANGUAGE_LABELS` (`shared/languages.ts`);
2. crie o seletor de idioma chamando `setLanguage` da store (`src/store/ui.ts`).

Nenhuma migration é necessária. Todos os hooks já incluem o idioma nas query keys.

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
4. Smoke test: `GET /api/health`, buscar uma carta, adicionar, recarregar e conferir que persistiu.

Se `TURSO_DATABASE_URL` for `file:...` dentro da Vercel, o servidor falha de propósito ao iniciar.

## Fora do escopo da Sprint 1

Scanner (barcode/QR e imagem), autenticação, variantes (normal/holo/reverse), condição da carta, binders.
