import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // La raíz del repositorio tiene su propio package-lock.json (la API);
  // se indica que el proyecto de Next.js es esta carpeta.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
}

export default nextConfig
