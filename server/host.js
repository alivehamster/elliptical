import http from "node:http"
import express from "express"
import { Server } from "socket.io"
import { build, createServer as createViteServer } from "vite"
import path from "node:path"
import url from "node:url"
import { ensuredb } from "./db.js"
import { password } from "./functions.js"

await ensuredb()
await password()

const app = express()
export const server = http.createServer(app)
export const io = new Server(server)

// Initalize server stuff
const __dirname = url.fileURLToPath(new URL("./", import.meta.url))

// frontend
if (process.argv.includes("--dev")) {
  // if dev mode start vite server
  const vite = await createViteServer({
    server: { middlewareMode: "html" },
  })
  app.use(vite.middlewares)
  console.log("✅ Vite development server served with middleware")
} else {
  // prod, serve from dist
  console.log("🔁 Building for production...")
  await build()
  app.use(express.static("dist"))
  app.use((req, res) =>
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"))
  )
  console.log("✅ Production build served from dist")
}
