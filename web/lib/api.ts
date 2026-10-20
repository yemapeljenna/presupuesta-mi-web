// Cliente de la API "Presupuesta mi web".
// El frontend no calcula precios: solo envía los datos y devuelve la respuesta del servidor.

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/+$/, "")

export type TipoWeb = "landing" | "corporativa"

export interface Tarifa {
  concepto: string
  descripcion: string
  precio: number
}

export interface RespuestaTarifas {
  tarifas: Tarifa[]
  moneda: string
}

export interface SolicitudPresupuesto {
  tipo: TipoWeb
  paginas: number
  formulario: boolean
  segundoIdioma: boolean
}

export interface Presupuesto {
  base: number
  paginasAdicionales: number
  formulario: number
  segundoIdioma: number
  total: number
  moneda: string
}

export interface ErrorValidacion {
  error: string
  campos: string[]
  detalles: string[]
}

export type ResultadoPresupuesto =
  | { tipo: "ok"; presupuesto: Presupuesto }
  | { tipo: "invalido"; error: ErrorValidacion }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; mensaje: string }

export async function comprobarEstado(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/estado`, { cache: "no-store" })
    if (!res.ok) return false
    const datos = await res.json()
    return datos?.status === "ok"
  } catch {
    return false
  }
}

export async function obtenerTarifas(): Promise<RespuestaTarifas> {
  const res = await fetch(`${API_URL}/api/tarifas`, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`La API respondió con el código ${res.status}.`)
  }
  return res.json()
}

export async function solicitarPresupuesto(
  solicitud: SolicitudPresupuesto
): Promise<ResultadoPresupuesto> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/presupuesto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solicitud),
    })
  } catch {
    return { tipo: "sin-conexion" }
  }

  if (res.status === 200) {
    return { tipo: "ok", presupuesto: await res.json() }
  }

  if (res.status === 400) {
    const datos = await res.json()
    return {
      tipo: "invalido",
      error: {
        error: datos.error ?? "Solicitud no válida",
        campos: Array.isArray(datos.campos) ? datos.campos : [],
        detalles: Array.isArray(datos.detalles) ? datos.detalles : [],
      },
    }
  }

  return {
    tipo: "error",
    mensaje: `La API respondió con el código ${res.status}.`,
  }
}

// Precio de un concepto tal como lo publica la API (undefined si no existe).
export function precioDe(datos: RespuestaTarifas | null, concepto: string) {
  return datos?.tarifas.find((tarifa) => tarifa.concepto === concepto)?.precio
}

// Solo da formato a un importe recibido de la API; no hace ningún cálculo.
// useGrouping "always" para que 1250 se muestre como "1.250 €" en es-ES.
export function formatearImporte(importe: number, moneda = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: "always",
  }).format(importe)
}
