/**
 * O TCGdex devolve tipo e categoria no idioma da carta ("Grass", "Planta", "Pflanze"…). Na coleção
 * eles são guardados em português, para o filtro juntar cartas de idiomas diferentes.
 * Nomes de /v2/{idioma}/types e /v2/{idioma}/categories (pt, en, es, fr, de, it).
 */
const TYPES: Record<string, string[]> = {
  Planta: ['Grass', 'Plante', 'Pflanze', 'Erba'],
  Fogo: ['Fire', 'Fuego', 'Feu', 'Feuer', 'Fuoco'],
  Água: ['Water', 'Agua', 'Eau', 'Wasser', 'Acqua'],
  Elétrico: ['Lightning', 'Rayo', 'Électrique', 'Elektro', 'Lampo'],
  Psíquico: ['Psychic', 'Psy', 'Psycho', 'Psico'],
  Lutador: ['Fighting', 'Lucha', 'Combat', 'Kampf', 'Lotta'],
  Sombrio: ['Darkness', 'Oscura', 'Obscurité', 'Unlicht', 'Oscurità'],
  Metal: ['Metálica', 'Métal', 'Metall', 'Metallo'],
  Fada: ['Fairy', 'Hada', 'Fée', 'Fee', 'Folletto'],
  Dragão: ['Dragon', 'Dragón', 'Drache', 'Drago'],
  Incolor: ['Colorless', 'Incolora', 'Incolore', 'Farblos'],
}

const CATEGORIES: Record<string, string[]> = {
  Pokémon: ['Pokemon'],
  Treinador: ['Trainer', 'Entrenador', 'Dresseur', 'Allenatore'],
  Energia: ['Energy', 'Energía', 'Énergie', 'Energie'],
}

const toPt = (table: Record<string, string[]>) =>
  new Map(Object.entries(table).flatMap(([pt, others]) => [pt, ...others].map((n) => [n, pt])))

const TYPE_PT = toPt(TYPES)
const CATEGORY_PT = toPt(CATEGORIES)

/** Nome desconhecido (tipo novo, idioma novo) passa como veio. */
export const typeInPortuguese = (name: string) => TYPE_PT.get(name) ?? name
export const categoryInPortuguese = (name: string) => CATEGORY_PT.get(name) ?? name
