import { env } from './env.js'
import { createRuntimeApp } from './runtime.js'

createRuntimeApp().listen(env.PORT, () => {
  console.log(`API em http://localhost:${env.PORT}  (db: ${env.TURSO_DATABASE_URL})`)
  console.log(`App em ${env.APP_URL}  (login: ${env.GOOGLE_CLIENT_ID ? 'configurado' : 'sem credenciais do Google'})`)
})
