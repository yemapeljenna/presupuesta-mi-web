// Valida una solicitud de presupuesto (POST /api/presupuesto y la selección del PDF).
// Devuelve { ok: true, datos } con SOLO los 4 campos válidos,
// o { ok: false, campos, errores } si algo falla.

export type TipoWeb = "landing" | "corporativa"

export interface SolicitudPresupuesto {
  tipo: TipoWeb
  paginas: number
  formulario: boolean
  segundoIdioma: boolean
}

export type ResultadoValidacion<T> =
  | { ok: true; datos: T }
  | { ok: false; campos: string[]; errores: string[] }

export const TIPOS_VALIDOS: readonly TipoWeb[] = ["landing", "corporativa"]
export const MIN_PAGINAS = 1
export const MAX_PAGINAS = 20
const CAMPOS_OBLIGATORIOS = [
  "tipo",
  "paginas",
  "formulario",
  "segundoIdioma",
] as const

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

export function validarSolicitud(
  body: unknown
): ResultadoValidacion<SolicitudPresupuesto> {
  // 1. El cuerpo tiene que ser un objeto (no null, no array, no texto)
  if (!esObjeto(body)) {
    return {
      ok: false,
      campos: [],
      errores: ["El cuerpo de la petición debe ser un objeto JSON."],
    }
  }

  const errores: string[] = []
  const campos: string[] = [] // nombres de los campos que fallan

  // 2. Los cuatro campos obligatorios deben existir
  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (!(campo in body)) {
      campos.push(campo)
      errores.push(`Falta el campo obligatorio "${campo}".`)
    }
  }
  if (errores.length > 0) return { ok: false, campos, errores }

  const { tipo, paginas, formulario, segundoIdioma } = body

  // 3. tipo: solo "landing" o "corporativa"
  if (!TIPOS_VALIDOS.includes(tipo as TipoWeb)) {
    campos.push("tipo")
    errores.push('El campo "tipo" debe ser "landing" o "corporativa".')
  }

  // 4. paginas: número entero entre 1 y 20 (la cadena "4" NO vale)
  if (
    typeof paginas !== "number" ||
    !Number.isInteger(paginas) ||
    paginas < MIN_PAGINAS ||
    paginas > MAX_PAGINAS
  ) {
    campos.push("paginas")
    errores.push('El campo "paginas" debe ser un número entero entre 1 y 20.')
  }

  // 5. formulario y segundoIdioma: booleanos de verdad (la cadena "false" NO vale)
  if (typeof formulario !== "boolean") {
    campos.push("formulario")
    errores.push('El campo "formulario" debe ser un booleano (true o false).')
  }
  if (typeof segundoIdioma !== "boolean") {
    campos.push("segundoIdioma")
    errores.push(
      'El campo "segundoIdioma" debe ser un booleano (true o false).'
    )
  }

  if (errores.length > 0) return { ok: false, campos, errores }

  // Solo los campos permitidos: cualquier propiedad extra ("total", "precio"...) se ignora
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoWeb,
      paginas: paginas as number,
      formulario: formulario as boolean,
      segundoIdioma: segundoIdioma as boolean,
    },
  }
}
