# Sprint 7: binders personalizados

Branch: `sprint-7`, a partir de `master`. Ideia do projeto: o máximo de liberdade para o usuário.

## Binder por Pokémon ou artista

- Nova opção no "Novo binder". Por Pokémon, a busca traz todas as variações do nome (Pikachu,
  Pikachu V, duplas como Pikachu e Zekrom GX…); por artista, o nome exato (com sugestões da lista
  de ilustradores do TCGdex).
- Todas as cartas vêm marcadas; o usuário desmarca as que não quer ("Só 'Pikachu'" marca só o nome
  exato). A ordem é escolhida na criação: mais antigas, mais novas ou por nome.
- O binder guarda a busca (`search`) e as cartas que ficaram de fora (`excluded`). "Buscar cartas
  novas" mostra as lançadas depois, marcadas, e as removidas à parte, para trazer de volta. Entram
  no fim.
- API: `GET /api/search/candidates`, `GET /api/search/illustrators`, `GET /api/binders/:id/new-cards`,
  `POST /api/binders/:id/cards`.

## Remover cartas de binders

- Em qualquer binder de coleção ou de busca, o zoom do bolso tem "Remover esta carta do binder": o
  bolso some e os seguintes andam uma posição, com as cartas já colocadas. A coleção não muda.
- API: `DELETE /api/binders/:id/template/:position`.

## Artista

- A coleção guarda o ilustrador (migration `0006`); cópias antigas são completadas sozinhas.
- Filtro "Artista" e ordenação por artista na coleção.

## Grand Master Set

- Terceiro tipo de binder de coleção: o Master Set mais todas as impressões especiais registradas no
  TCGdex (ex.: Evoluções Prismáticas tem 472 bolsos no Grand Master contra 280 no Master).
- A variante virou um código (`shared/copies.ts`): `base[~subtipo][:acabamento][@carimbos]`, por
  exemplo `reverse:pokeball`, `holo:cosmos@player-rewards-program`, `holo~shadowless@1st-edition`.
  Os códigos vêm sempre da carta em inglês (em outros idiomas o TCGdex traduz os nomes pela
  metade), então a mesma impressão tem o mesmo código em qualquer idioma. Nomes em português em
  `variantLabel`; códigos antigos (`normal`, `reverse`, `holo`…) continuam valendo.
- Sem migration para variantes (a coluna já era texto).

## Deploy

Migration `0006` (busca e cartas removidas nos binders, artista na coleção). O build da Vercel
aplica sozinho; no PC, rodar `npm run db:migrate`.
