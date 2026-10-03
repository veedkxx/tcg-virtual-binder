import { z } from 'zod'
import type { Language } from '../../shared/languages'
import {
  CardDetailSchema,
  CardSearchResponseSchema,
  CollectionItemSchema,
  CollectionResponseSchema,
  type AddToCollectionInput,
} from '../../shared/schemas'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: { method: string; body?: unknown },
): Promise<z.infer<S>> {
  const res = await fetch(path, {
    method: init?.method,
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  if (res.status === 204) return undefined as z.infer<S>

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Erro inesperado.')
  }
  return schema.parse(json)
}

const qs = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()

export const api = {
  searchCards: (q: string, page: number, lang: Language) =>
    request(`/api/cards?${qs({ q, page, lang })}`, CardSearchResponseSchema),

  getCard: (id: string, lang: Language) =>
    request(`/api/cards/${encodeURIComponent(id)}?${qs({ lang })}`, CardDetailSchema),

  getCollection: (lang: Language) =>
    request(`/api/collection?${qs({ lang })}`, CollectionResponseSchema),

  addToCollection: (input: AddToCollectionInput) =>
    request('/api/collection', CollectionItemSchema, { method: 'POST', body: input }),

  setQuantity: (cardId: string, lang: Language, quantity: number) =>
    request(`/api/collection/${encodeURIComponent(cardId)}?${qs({ lang })}`, CollectionItemSchema, {
      method: 'PATCH',
      body: { quantity },
    }),

  removeFromCollection: (cardId: string, lang: Language) =>
    request(`/api/collection/${encodeURIComponent(cardId)}?${qs({ lang })}`, z.undefined(), {
      method: 'DELETE',
    }),
}
