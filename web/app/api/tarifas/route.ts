// GET /api/tarifas → publica las tarifas del servidor
import { TARIFAS } from "@/lib/tarifas"

export function GET() {
  return Response.json({
    tarifas: [
      { concepto: "landing", descripcion: "Landing, incluida la primera página", precio: TARIFAS.landing },
      { concepto: "corporativa", descripcion: "Web corporativa, incluida la primera página", precio: TARIFAS.corporativa },
      { concepto: "paginaAdicional", descripcion: "Cada página adicional a la primera", precio: TARIFAS.paginaAdicional },
      { concepto: "formulario", descripcion: "Formulario de contacto", precio: TARIFAS.formulario },
      { concepto: "segundoIdioma", descripcion: "Segundo idioma", precio: TARIFAS.segundoIdioma },
    ],
    moneda: TARIFAS.moneda,
  })
}
