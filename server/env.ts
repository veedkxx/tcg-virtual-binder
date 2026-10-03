import { z } from 'zod'

const EnvSchema = z
  .object({
    TURSO_DATABASE_URL: z.string().min(1).default('file:local.db'),
    TURSO_AUTH_TOKEN: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    PORT: z.coerce.number().default(3001),
  })
  .refine((e) => !(process.env.VERCEL && e.TURSO_DATABASE_URL.startsWith('file:')), {
    message:
      'Na Vercel o sistema de arquivos é efêmero: configure TURSO_DATABASE_URL (libsql://...) e TURSO_AUTH_TOKEN.',
    path: ['TURSO_DATABASE_URL'],
  })

export const env = EnvSchema.parse(process.env)
