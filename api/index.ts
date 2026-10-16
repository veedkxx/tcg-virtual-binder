// Entrada serverless da Vercel: todo /api/* é reescrito para cá (ver vercel.json).
import { createRuntimeApp } from '../server/runtime.js'

export default createRuntimeApp()
