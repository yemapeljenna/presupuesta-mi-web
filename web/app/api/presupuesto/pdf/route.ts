// POST /api/presupuesto/pdf → recalcula en el servidor y devuelve el PDF.
// Sin estado: todo lo necesario viaja en la petición (apto para Vercel).
import { errorValidacion, leerJson } from "@/lib/http"
import { generarPdf, validarDatosPdf } from "@/lib/pdf"

// PDFKit necesita las APIs de Node (Buffer, streams): no vale el runtime Edge
export const runtime = "nodejs"

export async function POST(request: Request) {
  const lectura = await leerJson(request)
  if (!lectura.ok) return lectura.respuesta

  const resultado = validarDatosPdf(lectura.body)
  if (!resultado.ok) return errorValidacion(resultado.campos, resultado.errores)

  const { buffer, presupuesto } = await generarPdf(resultado.datos)
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="presupuesto.pdf"',
      "Cache-Control": "no-store",
      "X-Presupuesto-Total": String(presupuesto.total),
    },
  })
}
