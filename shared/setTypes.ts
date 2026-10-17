/**
 * Tipos de binder montado a partir de uma coleção do TCGdex.
 * Textos aprovados na Sprint 4; Grand Master Set fica para a Sprint 5.
 */
export const SET_TYPES = ['core', 'master'] as const
export type SetType = (typeof SET_TYPES)[number]

export const SET_TYPE_LABELS: Record<SetType, string> = {
  core: 'Core Set',
  master: 'Master Set',
}

export const SET_TYPE_DESCRIPTIONS: Record<SetType, string> = {
  core:
    'Uma cópia de cada carta numerada da coleção, do #001 até o último número oficial ' +
    '(ex.: 159 em Amigos de Jornada). Não inclui as cartas secretas, numeradas acima do total ' +
    'oficial, nem versões alternativas.',
  master:
    'Todas as cartas da coleção, incluindo as secretas (ex.: 190 em Amigos de Jornada), em cada ' +
    'versão que sai nos boosters: normal, reverse holo e holo. Uma carta com versão normal e ' +
    'reverse ocupa dois bolsos, um ao lado do outro.',
}
