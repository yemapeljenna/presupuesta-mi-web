// Validación de la entrada del agente y REVALIDACIÓN de lo que devuelve el modelo.
// La IA solo propone y redacta: nunca se confía en su respuesta.
import { IDS_SELECCIONABLES, IDS_TIPO, buscarServicio } from "@/lib/catalogo"
import {
  esObjeto,
  MAX_PAGINAS,
  MIN_PAGINAS,
  type ResultadoValidacion,
  type TipoWeb,
} from "@/lib/validacion"

export const LIMITES = Object.freeze({
  cliente: 120,
  descripcion: 4000,
  resumen: 1000,
  justificacion: 400,
  item: 300, // cada duda o pendiente
  items: 10, // número máximo de dudas o pendientes
})

export interface ServicioPropuesto {
  id: string
  nombre: string
  incluye: string
  justificacion: string
}

export interface Propuesta {
  resumen: string
  tipo: TipoWeb | null
  paginas: number | null
  servicios: ServicioPropuesto[]
  dudas: string[]
  pendientes: string[]
  descartados: string[] // ids devueltos por el modelo que no se aceptan
  faltan: ("tipo" | "paginas")[]
}

// Error controlado del servicio de IA: la ruta lo convierte en 502
export class ErrorIA extends Error {
  constructor(mensaje: string, readonly causa?: unknown) {
    super(mensaje)
    this.name = "ErrorIA"
  }
}

// ---------------------------------------------------------------------------
// Entrada del cliente
// ---------------------------------------------------------------------------

export function validarEntrada(
  body: unknown
): ResultadoValidacion<{ cliente: string; descripcion: string }> {
  if (!esObjeto(body)) {
    return {
      ok: false,
      campos: [],
      errores: ["El cuerpo de la petición debe ser un objeto JSON."],
    }
  }
  const campos: string[] = []
  const errores: string[] = []
  const reglas = [
    ["cliente", "El nombre del cliente", LIMITES.cliente],
    ["descripcion", "La descripción del proyecto", LIMITES.descripcion],
  ] as const
  const datos = { cliente: "", descripcion: "" }
  for (const [campo, etiqueta, max] of reglas) {
    const valor = typeof body[campo] === "string" ? (body[campo] as string).trim() : ""
    if (valor === "") {
      campos.push(campo)
      errores.push(`${etiqueta} es obligatorio ("${campo}").`)
    } else if (valor.length > max) {
      campos.push(campo)
      errores.push(`${etiqueta} no puede superar ${max} caracteres ("${campo}").`)
    }
    datos[campo] = valor
  }
  if (errores.length > 0) return { ok: false, campos, errores }
  return { ok: true, datos }
}

// ---------------------------------------------------------------------------
// Revalidación de la respuesta del modelo
// ---------------------------------------------------------------------------

export function textoLimpio(valor: unknown, max: number) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : ""
}

function listaDeTextos(valor: unknown) {
  if (!Array.isArray(valor)) return []
  return valor
    .map((v) => textoLimpio(v, LIMITES.item))
    .filter(Boolean)
    .slice(0, LIMITES.items)
}

const JUSTIFICACION_POR_DEFECTO = "Deducido de la descripción del proyecto."

export function revalidarPropuesta(bruta: unknown): Propuesta {
  if (!esObjeto(bruta)) {
    throw new ErrorIA("El servicio de IA devolvió un formato no válido.")
  }

  const dudas = listaDeTextos(bruta.dudas)
  const pendientes = listaDeTextos(bruta.pendientes)
  const descartados: string[] = []

  // Servicios: solo ids del catálogo, sin repetir
  const propuestos: { id: string; justificacion: string }[] = []
  for (const item of Array.isArray(bruta.servicios) ? bruta.servicios : []) {
    const id = esObjeto(item) && typeof item.id === "string" ? item.id : ""
    if (!IDS_SELECCIONABLES.includes(id)) {
      if (id) descartados.push(id)
      continue
    }
    if (propuestos.some((p) => p.id === id)) continue
    propuestos.push({
      id,
      justificacion: textoLimpio((item as { justificacion?: unknown }).justificacion, LIMITES.justificacion),
    })
  }

  // Un solo tipo de web. Manda el campo "tipo"; si falta, se usa el único tipo
  // que aparezca en servicios. Si aparecen dos y no hay "tipo", queda sin decidir.
  const tiposEnServicios = propuestos
    .filter((p) => IDS_TIPO.includes(p.id))
    .map((p) => p.id)
  let tipo: string | null =
    typeof bruta.tipo === "string" && IDS_TIPO.includes(bruta.tipo)
      ? bruta.tipo
      : null
  if (!tipo && tiposEnServicios.length === 1) tipo = tiposEnServicios[0]
  if (!tipo && tiposEnServicios.length > 1) {
    dudas.unshift(
      "¿El proyecto es una landing (una sola página) o una web corporativa (varias secciones)?"
    )
  }
  for (const id of tiposEnServicios) if (id !== tipo) descartados.push(id)

  const servicios = propuestos
    .filter((p) => !IDS_TIPO.includes(p.id) || p.id === tipo)
    .map((p) => ({
      ...p,
      justificacion: p.justificacion || JUSTIFICACION_POR_DEFECTO,
    }))
  if (tipo && !servicios.some((s) => s.id === tipo)) {
    servicios.unshift({ id: tipo, justificacion: JUSTIFICACION_POR_DEFECTO })
  }
  // El tipo de web siempre primero
  servicios.sort(
    (a, b) => Number(IDS_TIPO.includes(b.id)) - Number(IDS_TIPO.includes(a.id))
  )

  const paginas =
    typeof bruta.paginas === "number" &&
    Number.isInteger(bruta.paginas) &&
    bruta.paginas >= MIN_PAGINAS &&
    bruta.paginas <= MAX_PAGINAS
      ? bruta.paginas
      : null

  const faltan: Propuesta["faltan"] = []
  if (!tipo) faltan.push("tipo")
  if (!paginas) faltan.push("paginas")

  return {
    resumen: textoLimpio(bruta.resumen, LIMITES.resumen),
    tipo: tipo as TipoWeb | null,
    paginas,
    servicios: servicios.map((s) => {
      const { nombre, incluye } = buscarServicio(s.id)!
      return { id: s.id, nombre, incluye, justificacion: s.justificacion }
    }),
    dudas: dudas.slice(0, LIMITES.items),
    pendientes,
    descartados,
    faltan,
  }
}
