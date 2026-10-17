import { z } from 'zod'
import type { Language } from '../../shared/languages'
import {
  BinderDetailSchema,
  BinderListResponseSchema,
  BinderSummarySchema,
  CardDetailSchema,
  CardSearchResponseSchema,
  CollectionItemSchema,
  CollectionResponseSchema,
  FillBinderResponseSchema,
  MeResponseSchema,
  SetListResponseSchema,
  type AddToCollectionInput,
  type UpdateCollectionItemInput,
  type CreateBinderInput,
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
  // O login em si é uma navegação (GET /api/auth/google), não uma chamada fetch.
  getMe: () => request('/api/auth/me', MeResponseSchema),

  logout: () => request('/api/auth/logout', z.undefined(), { method: 'POST' }),

  searchCards: (q: string, page: number, lang: Language) =>
    request(`/api/cards?${qs({ q, page, lang })}`, CardSearchResponseSchema),

  getCard: (id: string, lang: Language) =>
    request(`/api/cards/${encodeURIComponent(id)}?${qs({ lang })}`, CardDetailSchema),

  getCollection: (lang: Language) =>
    request(`/api/collection?${qs({ lang })}`, CollectionResponseSchema),

  addToCollection: (input: AddToCollectionInput) =>
    request('/api/collection', CollectionItemSchema, { method: 'POST', body: input }),

  updateCollectionItem: (id: number, patch: UpdateCollectionItemInput) =>
    request(`/api/collection/${id}`, CollectionItemSchema, { method: 'PATCH', body: patch }),

  removeCollectionItem: (id: number) =>
    request(`/api/collection/${id}`, z.undefined(), { method: 'DELETE' }),

  listSets: (lang: Language) => request(`/api/sets?${qs({ lang })}`, SetListResponseSchema),

  listBinders: (lang: Language) =>
    request(`/api/binders?${qs({ lang })}`, BinderListResponseSchema),

  getBinder: (id: string) => request(`/api/binders/${encodeURIComponent(id)}`, BinderDetailSchema),

  createBinder: (input: CreateBinderInput) =>
    request('/api/binders', BinderSummarySchema, { method: 'POST', body: input }),

  renameBinder: (id: string, name: string) =>
    request(`/api/binders/${encodeURIComponent(id)}`, z.undefined(), {
      method: 'PATCH',
      body: { name },
    }),

  deleteBinder: (id: string) =>
    request(`/api/binders/${encodeURIComponent(id)}`, z.undefined(), { method: 'DELETE' }),

  fillBinder: (id: string) =>
    request(`/api/binders/${encodeURIComponent(id)}/fill`, FillBinderResponseSchema, {
      method: 'POST',
    }),

  putSlot: (id: string, position: number, collectionItemId: number) =>
    request(`/api/binders/${encodeURIComponent(id)}/slots/${position}`, z.undefined(), {
      method: 'PUT',
      body: { collectionItemId },
    }),

  clearSlot: (id: string, position: number) =>
    request(`/api/binders/${encodeURIComponent(id)}/slots/${position}`, z.undefined(), {
      method: 'DELETE',
    }),
}
