# Sprint 8: organização e lista de desejos

Branch: `sprint-8`, a partir de `master`.

## Decisões

- Arrastar e soltar, inserir/remover páginas e organizar automaticamente: só no binder livre. Binders
  de coleção e de busca seguem a ordem do molde.
- Lista de desejos: a carta, com idioma e versão opcionais ("qualquer" por padrão).
- Ao adicionar uma cópia que atende um desejo, ele sai sozinho da lista (aviso "Riscada da lista de
  desejos").

## Binder livre

- **Mover:** arrastar e soltar no desktop; no celular, "Mover" no zoom da carta e um toque no bolso
  de destino (pode trocar de página; Esc ou "Cancelar" desiste). Bolso ocupado troca as duas cartas.
- **Páginas:** abaixo de cada página, inserir uma página em branco antes dela ou remover a página
  (com confirmação se tiver cartas; as seguintes voltam 9 bolsos).
- **Organizar:** por coleção e número, nome, tipo, artista ou adicionadas por último; as cartas
  ficam desde o primeiro bolso, sem buracos.
- API: `POST /api/binders/:id/move`, `/pages`, `/organize`.

## Capa e cor (todos os binders)

- "Personalizar" (no lugar de "Renomear"): nome, cor das páginas e carta de capa (uma do binder).
- A lista de binders mostra a capa e uma lombada na cor escolhida.
- API: `PATCH /api/binders/:id` aceita `name`, `color` e `coverImageUrl` (`null` volta ao padrão).

## Lista de desejos

- Aba "Lista de desejos" junto de "Minha coleção". "Quero esta carta" na página da carta; "Lista de
  desejos" no zoom de uma carta que falta num binder (com a versão do bolso, no Master/Grand Master).
- Coração nas cartas desejadas na busca.
- API: `GET/POST /api/wishlist`, `DELETE /api/wishlist/:id`; `POST /api/collection` e o atalho do
  bolso devolvem `wishlistRemoved`.

## Deploy

Migration `0007` (lista de desejos; cor e capa dos binders). O build da Vercel aplica sozinho; no PC,
rodar `npm run db:migrate`.
