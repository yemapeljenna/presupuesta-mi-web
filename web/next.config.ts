import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // El proyecto de Next.js es esta carpeta (web/), aunque el repositorio
  // tenga más archivos en la raíz.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // PDFKit se carga con require() de Node en tiempo de ejecución en lugar de
  // empaquetarse: así sus fuentes estándar (#standard-fonts/*) se resuelven
  // igual que en Node y Vercel las incluye al trazar la función.
  serverExternalPackages: ["pdfkit"],
}

export default nextConfig
