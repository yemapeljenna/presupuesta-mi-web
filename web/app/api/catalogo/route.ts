// GET /api/catalogo → servicios que se pueden ofrecer (precios leídos de tarifas.ts)
import { CATALOGO, MONEDA } from "@/lib/catalogo"

export function GET() {
  return Response.json({ servicios: CATALOGO, moneda: MONEDA })
}
