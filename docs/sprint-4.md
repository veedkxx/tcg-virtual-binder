# Sprint 4: coleção completa

Branch: `sprint-4`, a partir de `master`.

## Cópias

Cada item da coleção é uma cópia: carta + idioma + **variante** + **condição**.

- Variantes (`shared/copies.ts`): normal, reverse holo, holo, 1ª edição, promo W. Só são aceitas as que o
  TCGdex diz existir pra carta (`VARIANT_NOT_AVAILABLE`). Sem variante no pedido, vale a primeira impressa.
- Condições: NM, LP, MP, HP, DMG (padrão NM).
- Mudar a variante ou a condição de uma cópia pra uma que já existe junta as duas: as quantidades somam e
  os bolsos dos binders passam pra cópia que fica.
- `uniqueCards` conta cartas diferentes; `totalCards` soma todas as cópias.

## Idiomas

Português e inglês, com seletor no cabeçalho, salvo no navegador. Busca, coleção e binders seguem o
idioma escolhido.

## Binders

- Binder de coleção pode ser **Core Set** (uma de cada carta numerada até o total oficial, sem as
  secretas) ou **Master Set** (todas as cartas, um bolso por versão de booster: normal, reverse, holo).
  Impressões com carimbo ou acabamento especial ficam de fora (Grand Master Set: Sprint 5).
- No Master Set cada bolso só aceita a sua versão (`WRONG_VARIANT_FOR_POCKET`). Montar um Master Set
  busca o detalhe de cada carta no TCGdex (~5 s na primeira vez; depois fica em cache).
- No zoom do bolso dá pra mudar a quantidade da cópia e, na carta que falta, escolher quantas adicionar.

- Ao preencher um binder de coleção, entra a cópia mais comum na melhor condição (normal NM primeiro).
- O bolso mostra a variante quando não é normal (ex.: `×1 · RH`).
- Num binder de coleção dá pra trocar a cópia do bolso por outra cópia da mesma carta.
- Carta que falta num binder de coleção: o `+` no bolso adiciona à coleção e já coloca no bolso
  (`POST /api/binders/:id/slots/:position/add`); no zoom dá pra escolher variante e condição antes.

## Deploy

Migrations `0003` (colunas `variant` e `condition` + chave única nova) e `0004` (coluna `set_type`).
Aplicar no Turso antes do deploy. Itens antigos viram `normal` / `NM`; binders antigos ficam sem tipo.
