import { TARIFAS } from "@/lib/tarifas"
import type { SolicitudPresupuesto } from "@/lib/validacion"

export interface Presupuesto {
  base: number
  paginasAdicionales: number
  formulario: number
  segundoIdioma: number
  total: number
  moneda: string
}

// Función de cálculo INDEPENDIENTE de las rutas. Recibe datos ya validados:
// Total = precio base + páginas adicionales + extras seleccionados
export function calcularPresupuesto({
  tipo,
  paginas,
  formulario,
  segundoIdioma,
}: SolicitudPresupuesto): Presupuesto {
  const base = TARIFAS[tipo] // 300 o 600
  const paginasAdicionales = (paginas - 1) * TARIFAS.paginaAdicional // la 1ª va incluida
  const costeFormulario = formulario ? TARIFAS.formulario : 0
  const costeIdioma = segundoIdioma ? TARIFAS.segundoIdioma : 0

  return {
    base,
    paginasAdicionales,
    formulario: costeFormulario,
    segundoIdioma: costeIdioma,
    total: base + paginasAdicionales + costeFormulario + costeIdioma,
    moneda: TARIFAS.moneda,
  }
}
