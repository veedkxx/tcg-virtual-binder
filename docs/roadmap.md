# Roadmap

## Feito

| Sprint | Entregas |
| --- | --- |
| 1. Catálogo | Busca de cartas (TCGdex), página da carta, coleção com quantidade |
| 2. Login | Login com Google, coleção por usuário, proteção de origem |
| 3. Binders | Binders em branco ou de uma coleção, páginas 3x3, zoom; health check, cache do TCGdex, smoke test |
| 4. Coleção completa | Variantes e condição, português e inglês, Core Set e Master Set, adicionar direto no bolso |
| 5. Desempenho | Função em São Paulo junto do banco, imagens pela CDN com reserva em inglês, bundle menor, migrations no deploy, CI |
| 6. Filtros e idiomas | Filtros na coleção e nos binders, binders com idiomas misturados, es/fr/de/it |

## Próximas sprints

### Sprint 7: binders personalizados

A ideia do projeto é dar o máximo de liberdade para o usuário montar o que quiser.

- Binder a partir de uma busca: por Pokémon (ex.: todas as cartas de Pikachu) ou por artista. O usuário
  desmarca as cartas que não quer antes de criar.
- Remover cartas (bolsos) de qualquer binder de coleção já criado.
- Artista (ilustrador) nos filtros e na ordenação da coleção e dos binders.
- Grand Master Set (reverse Poké Ball/Master Ball, cosmos, carimbos).

### Sprint 8: organização e lista de desejos

- Arrastar e soltar entre bolsos e páginas, inserir/remover página, organizar automaticamente,
  capa e cor.
- Lista de desejos.

### Sprint 9: estatísticas e dados

- Estatísticas da coleção.
- Importar e exportar CSV.
- Preços: **em stand-by** (sem fonte legítima em reais; EUR/USD não interessa por enquanto). Opção
  simples: botão "Ver na Liga Pokémon" na página da carta. Ver `docs/pesquisa-apis.md`.

### Sprint 10: scanner

- Câmera lendo o número da carta e o símbolo da coleção.

## Major update (v2): rede social

- Perfil de usuário, binders públicos dentro do app, seguir colecionadores, feed, curtidas e comentários.
- Referências: Backloggd, Letterboxd, Serialized, AniList.
- Começa por um documento de design comparando essas referências.
