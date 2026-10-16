# Sprint 3: Binders + confiabilidade da API

Branch: `sprint-3` (criada a partir de `sprint-2`; rebasear sobre `main` depois do merge do PR #1).

## 1. Binders personalizados

O usuário cria binders com nome (ex.: "Trocas", "Pikachus") e coloca cartas **da própria coleção**
em bolsos de páginas 3x3, que dá pra folhear.

### Banco (migration `0002`)

```
binders
  id          text pk
  user_id     text → users.id (cascade)
  name        text not null          -- único por usuário
  created_at / updated_at

binder_slots
  binder_id           text → binders.id (cascade)
  position            integer >= 0   -- página = floor(position / 9), bolso = position % 9
  collection_item_id  integer → collection_items.id (cascade)
  unique (binder_id, position)
```

- Remover a carta da coleção remove os bolsos dela (cascade).
- Bolsos vazios não são gravados, então dá pra deixar buracos de propósito.

### API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/binders` | lista com contagem de cartas |
| POST | `/api/binders` | `{ name }` |
| GET | `/api/binders/:id` | binder + bolsos (com o snapshot da carta) |
| PATCH | `/api/binders/:id` | `{ name }` |
| DELETE | `/api/binders/:id` | apaga o binder (as cartas continuam na coleção) |
| PUT | `/api/binders/:id/slots/:position` | `{ collectionItemId }` coloca/troca a carta do bolso |
| DELETE | `/api/binders/:id/slots/:position` | esvazia o bolso |

Tudo escopado por `userId`, como a coleção.

### Frontend

- `/binders`: grade de binders + criar/renomear/apagar.
- `/binders/:id`: página 3x3 (2 páginas lado a lado no desktop), navegação por setas, teclado e swipe.
- Bolso vazio → abre seletor com busca na coleção. Bolso ocupado → trocar / remover.
- Visualização mais dinâmica: zoom da carta em alta resolução (`imageHighUrl`) com efeito de
  inclinação/brilho no hover; animação de virar página.

## 2. Confiabilidade da API

- **Health check:** `/api/health` continua leve; `/api/health?deep=1` testa o banco (`select 1`) e o
  TCGdex (com timeout curto) e retorna o status de cada um.
- **Cache + fallback do TCGdex:** cache em memória por instância (TTL ~1h) em `tcgdex.ts`; se o
  TCGdex falhar ou estourar o timeout, serve a última resposta guardada (stale). O cache do CDN
  (`s-maxage`) continua valendo.
- **Smoke test pós-deploy:** `npm run smoke -- https://<app>.vercel.app` confere health (deep),
  busca, detalhe da carta e se `/api/collection` sem login responde 401.
- **Validar cardId ao adicionar:** já funciona. O `POST /api/collection` busca a carta no TCGdex e
  responde 404 se ela não existe. Só falta um teste cobrindo esse caso.

## Em aberto

- Uma carta com quantidade 1 pode estar em vários binders ao mesmo tempo? Proposta: sim, por
  enquanto (binder é visualização, não estoque).
- Limite de páginas por binder? Proposta: sem limite.
