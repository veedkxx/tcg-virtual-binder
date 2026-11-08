import { describe, expect, it } from 'vitest'
import {
  compareVariants,
  isSpecialVariant,
  parseVariant,
  variantCode,
  variantLabel,
  variantShort,
} from './copies.js'

describe('códigos de variante', () => {
  it('ida e volta entre código e partes; carimbos em ordem', () => {
    const parts = { base: 'holo' as const, subtype: 'shadowless', stamps: ['staff', '1st-edition'] }
    const code = variantCode(parts)
    expect(code).toBe('holo~shadowless@1st-edition,staff')
    expect(parseVariant(code)).toEqual({
      base: 'holo',
      subtype: 'shadowless',
      foil: undefined,
      stamps: ['1st-edition', 'staff'],
    })
  })

  it('nomes em português e selo curto', () => {
    expect(variantLabel('normal')).toBe('Normal')
    expect(variantLabel('reverse:pokeball')).toBe('Reverse holo · Poké Ball')
    expect(variantLabel('holo:cosmos@player-rewards-program')).toBe(
      'Holo · Cosmos · carimbo Player Rewards',
    )
    expect(variantLabel('normal@novo-carimbo')).toBe('Normal · carimbo Novo Carimbo')
    expect(variantShort('reverse')).toBe('RH')
    expect(variantShort('reverse:masterball')).toBe('RH·MB')
    expect(variantShort('holo:cosmos@player-rewards-program')).toBe('H·C★')
  })

  it('especial = acabamento ou carimbo; subtipo sozinho não', () => {
    expect(isSpecialVariant('reverse:pokeball')).toBe(true)
    expect(isSpecialVariant('normal@set-logo')).toBe(true)
    expect(isSpecialVariant('holo~unlimited')).toBe(false)
  })

  it('ordem: base, depois comuns antes das especiais', () => {
    const sorted = ['holo', 'reverse:pokeball', 'reverse', 'normal@set-logo', 'normal'].sort(
      compareVariants,
    )
    expect(sorted).toEqual(['normal', 'normal@set-logo', 'reverse', 'reverse:pokeball', 'holo'])
  })
})
