# Pesquisa: APIs de cartas e de preços (Sprint 5)

Novembro de 2026. Medições feitas a partir do Brasil; páginas de comparação costumam ser de
fornecedores, então os pontos marcados "a confirmar" precisam ser checados na documentação oficial
antes de integrar.

## APIs de cartas

| API | Custo | Idiomas | Imagens | Situação |
| --- | --- | --- | --- | --- |
| **TCGdex** (atual) | grátis, sem chave | 13+ (inclui pt) | sim, servidor próprio sem CDN | ativa; REST + GraphQL |
| pokemontcg.io | grátis | inglês | sim, com CDN | **sai do ar em 1/3/2027**; o próprio projeto pede para migrar |
| Scrydex | a partir de US$ 29/mês (5.000 créditos) | inglês e japonês; pt a confirmar | sim | sucessora da pokemontcg.io; também tem preços e histórico |
| PokéWallet, Pokemon Price Tracker, pokemon-api.com | plano grátis + pagos (a confirmar) | inglês (e japonês) | variam | focadas em preços |

**Medições no TCGdex:**

- ~40% das cartas da busca em português vêm sem imagem; um terço a dois terços delas têm imagem em
  inglês. Em inglês faltam ~15%.
- Imagens: ~750 ms cada (servidor nginx único no Canadá, sem CDN). Dados: 180 ms (carta) a 1 s (busca).

**Recomendação:** continuar no TCGdex. É a única opção grátis com português, e os problemas medidos
são resolvidos do nosso lado: imagens pela CDN da Vercel e reserva em inglês (feito na Sprint 5),
cache persistente das respostas (próximo passo). A pokemontcg.io está descartada (vai sair do ar e é
só inglês). A Scrydex só faz sentido se houver orçamento e se cobrir português.

## APIs de preços

| Fonte | Custo | O que tem | Observação |
| --- | --- | --- | --- |
| **TCGdex** (`pricing` na carta) | grátis | Cardmarket (EUR: média, mínimo, tendência, 1/7/30 dias, holo) e TCGplayer (USD por variante: normal, reverse, holo) | atualizado todo dia; amostra de 12 cartas de várias épocas: 10/10 em pt (as 2 restantes não existem em pt), 12/12 em en |
| TCGplayer (oficial) | — | — | fechada para novos desenvolvedores (a confirmar) |
| PriceCharting | pago | vendas concluídas | sem histórico pela API (a confirmar) |
| JustTCG, PokéWallet, Pokemon Price Tracker | grátis limitado + pagos | preços e histórico | coberturas divergem entre fontes (a confirmar) |
| Liga Pokémon (BRL) | — | — | sem API oficial; só raspadores de terceiros (Apify, pagos por resultado) e o robots.txt do site bloqueia as páginas de histórico de preço |

**Ressalva:** Cardmarket e TCGplayer são mercados da Europa e dos EUA. Carta em português da Copag é
outro produto no Brasil, com outro preço; nenhuma API encontrada tem preço em reais.

**Decisão (novembro de 2026): preço fica em stand-by.** Preço em EUR/USD não interessa por enquanto,
e não há fonte legítima de preço em reais. Caminhos para depois: um botão "Ver na Liga Pokémon" na
página da carta (o usuário vê o preço em reais na fonte, sem raspar nada) e pedir acesso oficial à Liga.

## Fontes

- [PokemonTCG/pokemon-tcg-data: aviso de descontinuação](https://github.com/PokemonTCG/pokemon-tcg-data)
- [Scrydex: planos](https://scrydex.com/pricing)
- [Best Pokemon Card APIs in 2026 (ScrapingBee)](https://www.scrapingbee.com/blog/pokemon-card-api/)
- [TCGplayer API Alternatives for Developers (cardgrader.ai)](https://cardgrader.ai/blog/tcgplayer-api-alternatives)
- [Pokemon Card API Comparison 2026 (PokeTrace)](https://poketrace.com/blog/pokemon-card-api-comparison)
- [PokéWallet: comparação com TCGdex e pokemontcg.io](https://pokewallet.io/blog/pokemon-tcg-api-comparison-pokewallet-tcgdex-pokemontcgio)
- [10 Trading Card Game APIs Compared (tcgapi.dev)](https://tcgapi.dev/blog/trading-card-game-apis-compared/)
- [Liga Pokémon: robots.txt](https://www.ligapokemon.com.br/robots.txt)
- [Raspador de preços da Liga Pokémon na Apify (exemplo)](https://apify.com/dami_studio/ligapokemon-card-prices-scraper/api/python)
