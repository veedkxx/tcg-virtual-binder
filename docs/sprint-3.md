# Sprint 3: Binders + confiabilidade da API

Branch: `sprint-3`, a partir de `main` (já com a Sprint 2).

## Decisões

- A mesma carta pode estar em vários bolsos e vários binders. O binder serve pra visualizar a
  coleção e não controla estoque. A interface mostra sempre a quantidade (×N) e em quantos
  binders a carta aparece.
- Sem limite de páginas. Binder livre sempre mostra uma página em branco depois da última usada.
  O único teto é técnico: posição até 89.999, o que dá 10 mil páginas.
- Dois tipos de binder, os dois opcionais:
  - **Em branco:** totalmente livre, você escolhe cada carta e cada bolso.
  - **De uma coleção** (ex.: Amigos de Jornada, `sv09`): um bolso reservado pra cada carta, na
    ordem da coleção. As que você tem podem entrar sozinhas ao criar ("Já colocar as cartas que
    eu tenho"), com o botão "Colocar as que eu tenho" depois, ou uma a uma com um toque.

## 1. Binders

### Banco (migration `0002`)

```
binders
  id            text pk (uuid)
  user_id       text → users.id (cascade)
  name          text
  language      text
  set_id, set_name, set_logo_url   -- coleção de origem (null = binder em branco)
  template      json               -- cartas da coleção na ordem; gravado na criação
  created_at / updated_at

binder_slots
  binder_id           text → binders.id (cascade)
  position            integer >= 0   -- página = floor(position / 9), bolso = position % 9
  collection_item_id  integer → collection_items.id (cascade)
  primary key (binder_id, position)
```

- O molde (`template`) é salvo na criação, então o binder abre mesmo com o TCGdex fora do ar.
- Num binder de coleção, o bolso `i` só aceita a carta `template[i]` (`WRONG_CARD_FOR_POCKET`).
- Tirar a carta da coleção esvazia os bolsos dela (cascade).
- Apagar o binder não mexe na coleção.

### API

| Método | Rota                               | Descrição                                                     |
| ------ | ---------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/sets?lang=`                  | coleções do TCGdex (mais novas primeiro)                      |
| GET    | `/api/sets/:id?lang=`              | coleção com as cartas                                         |
| GET    | `/api/binders?lang=`               | binders do usuário (`filled`, `templateSize`)                 |
| POST   | `/api/binders`                     | `{ name, setId?, fill? }`                                     |
| GET    | `/api/binders/:id`                 | binder + bolsos ocupados + molde                              |
| PATCH  | `/api/binders/:id`                 | `{ name }`                                                    |
| DELETE | `/api/binders/:id`                 | apaga o binder                                                |
| POST   | `/api/binders/:id/fill`            | coloca as cartas que o usuário tem nos bolsos vazios do molde |
| PUT    | `/api/binders/:id/slots/:position` | `{ collectionItemId }` coloca/troca a carta                   |
| DELETE | `/api/binders/:id/slots/:position` | esvazia o bolso                                               |

`GET /api/collection` ganhou `binderCount` em cada item.

### Frontend

- `/binders`: capas dos binders com progresso (ex.: 87/190) e diálogo "Novo binder".
- `/binders/:id`: páginas 3x3 (2 lado a lado no desktop), com setas, teclado (← →), swipe e
  slider pra pular páginas. A página fica na URL (`?p=3`).
- Bolso vazio de binder livre → seletor com filtro na coleção. Bolso de coleção → a carta aparece
  apagada; com borda e "+×N" se você já tem (um toque coloca).
- Zoom da carta em alta resolução com inclinação e brilho holográfico (respeita
  `prefers-reduced-motion`); animação de virar página.

## 2. Confiabilidade da API

- **Health check:** `/api/health` continua leve; `/api/health?deep=1` testa o banco e o TCGdex e
  responde 503 se algum falhar.
- **Cache + fallback do TCGdex:** cache em memória por instância (TTL 1h, até 500 respostas). Se
  o TCGdex falhar ou estourar o timeout, serve a última resposta boa. 404 nunca é cacheado.
- **Smoke test pós-deploy:** `npm run smoke -- https://<app>.vercel.app`.
- **Validar cardId ao adicionar:** já funcionava desde a Sprint 1 (`POST /api/collection` busca a
  carta no TCGdex e responde 404), e já tinha teste.

## Deploy

Aplicar a migration `0002` no Turso antes do deploy: `npm run db:migrate` com as variáveis do Turso.
