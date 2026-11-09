// Cliente de las rutas /api de esta misma aplicación (Route Handlers de Next).
// El navegador no calcula precios: solo envía datos y muestra lo que responde el servidor.
import type { ServicioCatalogo } from "@/lib/catalogo"
import type { Presupuesto } from "@/lib/calculo"
import type { Propuesta } from "@/lib/propuesta"
import type { SolicitudPresupuesto, TipoWeb } from "@/lib/validacion"

export type { Presupuesto, Propuesta, ServicioCatalogo, SolicitudPresupuesto, TipoWeb }

export interface Tarifa {
  concepto: string
  descripcion: string
  precio: number
}

export interface RespuestaTarifas {
  tarifas: Tarifa[]
  moneda: string
}

export interface RespuestaCatalogo {
  servicios: ServicioCatalogo[]
  moneda: string
}

export interface ErrorValidacion {
  error: string
  campos: string[]
  detalles: string[]
}

export type PropuestaRecibida = Propuesta & { cliente: string }

export type ResultadoPresupuesto =
  | { tipo: "ok"; presupuesto: Presupuesto }
  | { tipo: "invalido"; error: ErrorValidacion }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; mensaje: string }

export type ResultadoPropuesta =
  | { tipo: "ok"; propuesta: PropuestaRecibida }
  | { tipo: "invalido"; error: ErrorValidacion }
  | { tipo: "fallo-ia"; detalles: string[] }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; mensaje: string }

export interface DatosPdf {
  cliente: string
  resumen: string
  seleccion: SolicitudPresupuesto
  dudas: string[]
  pendientes: string[]
}

export type ResultadoPdf =
  | { tipo: "ok"; pdf: Blob; total: number | null }
  | { tipo: "invalido"; error: ErrorValidacion }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; mensaje: string }

// --- Utilidades -------------------------------------------------------------

async function enviarJson(ruta: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    return null // sin conexión
  }
}

async function errorDe(res: Response): Promise<ErrorValidacion> {
  const datos = await res.json().catch(() => ({}))
  return {
    error: datos.error ?? "Solicitud no válida",
    campos: Array.isArray(datos.campos) ? datos.campos : [],
    detalles: Array.isArray(datos.detalles) ? datos.detalles : [],
  }
}

const errorCodigo = (res: Response) => ({
  tipo: "error" as const,
  mensaje: `El servidor respondió con el código ${res.status}.`,
})

// --- Rutas ------------------------------------------------------------------

export async function comprobarEstado(): Promise<boolean> {
  try {
    const res = await fetch("/api/estado", { cache: "no-store" })
    if (!res.ok) return false
    const datos = await res.json()
    return datos?.status === "ok"
  } catch {
    return false
  }
}

export async function obtenerTarifas(): Promise<RespuestaTarifas> {
  const res = await fetch("/api/tarifas", { cache: "no-store" })
  if (!res.ok) throw new Error(`El servidor respondió con el código ${res.status}.`)
  return res.json()
}

export async function obtenerCatalogo(): Promise<RespuestaCatalogo> {
  const res = await fetch("/api/catalogo", { cache: "no-store" })
  if (!res.ok) throw new Error(`El servidor respondió con el código ${res.status}.`)
  return res.json()
}

export async function solicitarPresupuesto(
  solicitud: SolicitudPresupuesto
): Promise<ResultadoPresupuesto> {
  const res = await enviarJson("/api/presupuesto", solicitud)
  if (!res) return { tipo: "sin-conexion" }
  if (res.status === 200) return { tipo: "ok", presupuesto: await res.json() }
  if (res.status === 400) return { tipo: "invalido", error: await errorDe(res) }
  return errorCodigo(res)
}

export async function solicitarPropuesta(datos: {
  cliente: string
  descripcion: string
}): Promise<ResultadoPropuesta> {
  const res = await enviarJson("/api/agente", datos)
  if (!res) return { tipo: "sin-conexion" }
  if (res.status === 200) return { tipo: "ok", propuesta: await res.json() }
  if (res.status === 400) return { tipo: "invalido", error: await errorDe(res) }
  if (res.status === 502) return { tipo: "fallo-ia", detalles: (await errorDe(res)).detalles }
  return errorCodigo(res)
}

export async function generarPdf(datos: DatosPdf): Promise<ResultadoPdf> {
  const res = await enviarJson("/api/presupuesto/pdf", datos)
  if (!res) return { tipo: "sin-conexion" }
  if (res.status === 200) {
    const total = Number(res.headers.get("X-Presupuesto-Total"))
    return { tipo: "ok", pdf: await res.blob(), total: Number.isFinite(total) ? total : null }
  }
  if (res.status === 400) return { tipo: "invalido", error: await errorDe(res) }
  return errorCodigo(res)
}

// Precio de un concepto tal como lo publica el servidor (undefined si no existe).
export function precioDe(datos: RespuestaTarifas | null, concepto: string) {
  return datos?.tarifas.find((tarifa) => tarifa.concepto === concepto)?.precio
}

// Solo da formato a un importe recibido del servidor; no hace ningún cálculo.
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
