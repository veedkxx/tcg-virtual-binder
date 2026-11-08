# Sprint 6: filtros e idiomas

Branch: `sprint-6`, a partir de `master`.

## Idiomas

- Português, inglês, espanhol, francês, alemão e italiano. Os idiomas europeus usam os mesmos ids de
  carta, então a mesma carta em idiomas diferentes cabe no mesmo bolso.
- Japonês ficou de fora: ids de coleção próprios, busca só pelo nome em japonês e ~80% das cartas sem
  imagem no TCGdex. Para habilitar, é uma linha em `shared/languages.ts`.
- O seletor do cabeçalho vale para a busca e para o idioma de binders novos. Coleção e binders mostram
  todos os idiomas.

## Idiomas misturados

- `GET /api/collection` e `GET /api/binders` sem `lang` trazem todos os idiomas.
- Binder aceita cópias de qualquer idioma. Ao preencher, entra primeiro a cópia no idioma do binder.
- No bolso, carta de outro idioma ganha um selo ("EN"). Na página da carta e no zoom do bolso dá para
  escolher o idioma da cópia nova.

## Filtros

- **Coleção:** texto, idioma, coleção, raridade, tipo, variante, condição e ordenação (recentes, nome,
  coleção e número, coleção). Os filtros ficam na URL; no celular, recolhidos atrás de "Filtros".
- **Binder:** "todas / tenho / faltam" (binder de coleção) e idioma. Bolsos que não batem ficam
  apagados; a ordem das páginas não muda.

## Tipo das cartas

- Migration `0005`: colunas `category` e `types` na coleção, guardadas em português
  (`shared/cardTypes.ts` traduz os nomes dos seis idiomas), para o filtro juntar idiomas.
- Cópias antigas são completadas sozinhas: quando a coleção abre com cópias sem tipo, o app chama
  `POST /api/collection/complete` (40 por vez).
