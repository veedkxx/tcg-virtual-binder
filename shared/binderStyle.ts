/** Cores de binder (a aparência de cada uma fica no frontend). */
export const BINDER_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const
export type BinderColor = (typeof BINDER_COLORS)[number]

export const BINDER_COLOR_LABELS: Record<BinderColor, string> = {
  slate: 'Grafite',
  red: 'Vermelho',
  orange: 'Laranja',
  amber: 'Amarelo',
  green: 'Verde',
  teal: 'Turquesa',
  blue: 'Azul',
  violet: 'Roxo',
  pink: 'Rosa',
}

/** Critérios de "organizar automaticamente" (binder livre). */
export const ORGANIZE_BY = ['number', 'name', 'type', 'artist', 'recent'] as const
export type OrganizeBy = (typeof ORGANIZE_BY)[number]

export const ORGANIZE_LABELS: Record<OrganizeBy, string> = {
  number: 'Coleção e número',
  name: 'Nome',
  type: 'Tipo',
  artist: 'Artista',
  recent: 'Adicionadas por último primeiro',
}
