import { z } from 'zod'

// Variáveis vazias (ex.: "TURSO_AUTH_TOKEN=" no .env) contam como ausentes.
const optionalString = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined)

/** URL pública do app: base do redirecionamento do Google e decide se os cookies levam Secure. */
function resolveAppUrl(explicit: string | undefined) {
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const url = explicit ?? (vercelProd ? `https://${vercelProd}` : 'http://localhost:5173')
  return url.replace(/\/+$/, '')
}

const EnvSchema = z
  .object({
    TURSO_DATABASE_URL: z.string().min(1).default('file:local.db'),
    TURSO_AUTH_TOKEN: optionalString,
    // Login com Google: opcionais aqui para scripts como db:migrate não exigirem credenciais.
    // Sem elas, o login responde "não configurado" em vez de derrubar o servidor.
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    APP_URL: optionalString,
    PORT: z.coerce.number().default(3001),
  })
  .refine((e) => !(process.env.VERCEL && e.TURSO_DATABASE_URL.startsWith('file:')), {
    message:
      'Na Vercel o sistema de arquivos é efêmero: configure TURSO_DATABASE_URL (libsql://...) e TURSO_AUTH_TOKEN.',
    path: ['TURSO_DATABASE_URL'],
  })
  .transform((e) => ({ ...e, APP_URL: resolveAppUrl(e.APP_URL) }))

export const env = EnvSchema.parse(process.env)
