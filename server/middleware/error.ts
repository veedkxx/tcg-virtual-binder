import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../errors.js'

// Formato único de erro: { error: { code, message, issues? } }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Parâmetros inválidos.', issues: err.issues },
    })
    return
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno.' } })
}
