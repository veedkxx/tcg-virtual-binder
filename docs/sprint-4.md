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

- Ao preencher um binder de coleção, entra a cópia mais comum na melhor condição (normal NM primeiro).
- O bolso mostra a variante quando não é normal (ex.: `×1 · RH`).
- Num binder de coleção dá pra trocar a cópia do bolso por outra cópia da mesma carta.
- Carta que falta num binder de coleção: o `+` no bolso adiciona à coleção e já coloca no bolso
  (`POST /api/binders/:id/slots/:position/add`); no zoom dá pra escolher variante e condição antes.

## Deploy

Migration `0003` (colunas `variant` e `condition` + chave única nova). Aplicar no Turso antes do deploy.
Itens antigos viram `normal` / `NM`.
