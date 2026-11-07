# Sprint 5: desempenho e fontes de dados

Branch: `sprint-5`, a partir de `master`.

## Medições (novembro de 2026)

- Função da Vercel em Washington (`iad1`) e Turso em São Paulo (`aws-sa-east-1`): 116 ms por
  consulta; uma ação logada (2 a 5 consultas) custava 250 a 500+ ms só de banco.
- Imagens do TCGdex: ~750 ms cada (servidor único no Canadá, sem CDN); ~40% das cartas em português
  sem imagem.
- TCGdex visto da função: 20 a 77 ms. Primeira chamada com a função parada: ~1,4 s.

## O que mudou

- **Função em São Paulo** (`regions: ["gru1"]` no `vercel.json`), junto do banco.
- **Imagens pela CDN:** `/api/img` repassa imagens de `assets.tcgdex.net` com cache de um ano (404 por
  um dia). Só aceita esse domínio.
- **Reserva em inglês:** carta sem imagem no idioma escolhido usa a mesma carta em inglês (a série de
  cada coleção vem de uma consulta GraphQL, guardada por um dia); se a imagem falhar ao carregar, o app
  tenta a versão em inglês antes de mostrar "Sem imagem".
- **Bundle:** páginas sob demanda e bibliotecas em arquivos próprios; o código do app foi de 539 kB para
  59 kB. As outras páginas são pré-carregadas quando o navegador fica ocioso.
- **Deploy:** o build da Vercel (`npm run vercel-build`) aplica as migrations; `/api/health?deep=1`
  acusa banco atrasado (`migrations`).
- **CI** no GitHub Actions: typecheck (também no modo sem `strict`, como na Vercel), lint, testes e build.
- **`Server-Timing`** em toda resposta da API.
- **Pesquisa de APIs:** `docs/pesquisa-apis.md`. Fica o TCGdex; preço em stand-by.

## Descartado

- Cache persistente do TCGdex no Turso: com a função perto do banco e o TCGdex rápido visto da função,
  o ganho não compensa.

## Limitações

- Cartas que o TCGdex não tem em nenhum idioma (ex.: Coleção Clássica de 30 Anos) seguem sem imagem.
  Resolver isso exige uma API paga (ver `docs/pesquisa-apis.md`).
