# Roadmap

## Feito

| Sprint | Entregas |
| --- | --- |
| 1. Catálogo | Busca de cartas (TCGdex), página da carta, coleção com quantidade |
| 2. Login | Login com Google, coleção por usuário, proteção de origem |
| 3. Binders | Binders em branco ou de uma coleção, páginas 3x3, zoom; health check, cache do TCGdex, smoke test |
| 4. Coleção completa | Variantes e condição, português e inglês, Core Set e Master Set, adicionar direto no bolso |

## Próximas sprints

### Sprint 5: desempenho e fontes de dados

- Lentidão e otimização: cache persistente do TCGdex (Turso), pré-carregamento, code-splitting,
  medição de tempo por rota.
- Imagens: usar a de outro idioma quando faltar; tentar de novo quando falhar.
- Pesquisa de outras APIs de cartas (responsividade, imagens, idiomas, limites, termos de uso).
- Pesquisa de API de preços (fonte, moeda, atualização, custo, cobertura em português).
- Migrations aplicadas no deploy; CI com testes a cada PR.

### Sprint 6: filtros e idiomas

- Filtros na coleção e nos binders: coleção, raridade, tipo, variante, condição, idioma, tenho/faltam.
- Binders com cartas de idiomas diferentes, com filtro por idioma.
- Mais idiomas (es, fr, de, it, ja…).

### Sprint 7: binders, organização e lista de desejos

- Grand Master Set (reverse Poké Ball/Master Ball, cosmos, carimbos).
- Arrastar e soltar entre bolsos e páginas, inserir/remover página, organizar automaticamente,
  capa e cor.
- Lista de desejos.

### Sprint 8: preços e estatísticas

- Preços com a API escolhida na Sprint 5: carta, coleção e binder.
- Estatísticas da coleção.
- Importar e exportar CSV.

### Sprint 9: scanner

- Câmera lendo o número da carta e o símbolo da coleção.

## Major update (v2): rede social

- Perfil de usuário, binders públicos dentro do app, seguir colecionadores, feed, curtidas e comentários.
- Referências: Backloggd, Letterboxd, Serialized, AniList.
- Começa por um documento de design comparando essas referências.
