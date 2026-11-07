import { describe, expect, it } from 'vitest'
import { categoryInPortuguese, typeInPortuguese } from './cardTypes.js'

describe('tipos e categorias em português', () => {
  it('junta o mesmo tipo de todos os idiomas', () => {
    for (const name of ['Planta', 'Grass', 'Plante', 'Pflanze', 'Erba']) {
      expect(typeInPortuguese(name)).toBe('Planta')
    }
    expect(typeInPortuguese('Incolore')).toBe('Incolor') // fr e it
    expect(categoryInPortuguese('Dresseur')).toBe('Treinador')
    expect(categoryInPortuguese('Pokemon')).toBe('Pokémon')
  })

  it('nome desconhecido passa como veio', () => {
    expect(typeInPortuguese('Tipo Novo')).toBe('Tipo Novo')
  })
})
