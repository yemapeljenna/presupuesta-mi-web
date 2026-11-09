// Catálogo de servicios que se pueden ofrecer.
// Los precios NO se escriben aquí: se leen de tarifas.ts (única fuente de precios).
import { TARIFAS } from "@/lib/tarifas"

// categoria:
//   "tipo"  → tipo de web (solo puede haber uno en una propuesta)
//   "extra" → servicio opcional que se suma al total
//   "regla" → no se elige directamente: se aplica según el número de páginas
export type CategoriaServicio = "tipo" | "extra" | "regla"
export type IdServicio =
  | "landing"
  | "corporativa"
  | "paginaAdicional"
  | "formulario"
  | "segundoIdioma"

export interface ServicioCatalogo {
  id: IdServicio
  categoria: CategoriaServicio
  nombre: string
  incluye: string
  precio: number
  regla?: string
}

export const CATALOGO: readonly ServicioCatalogo[] = Object.freeze([
  {
    id: "landing",
    categoria: "tipo",
    nombre: "Landing",
    incluye:
      "Página única de presentación con diseño adaptado a móvil. Incluye la primera página.",
    precio: TARIFAS.landing,
  },
  {
    id: "corporativa",
    categoria: "tipo",
    nombre: "Web corporativa",
    incluye:
      "Sitio con varias secciones (inicio, servicios, sobre nosotros...) y menú de navegación. Incluye la primera página.",
    precio: TARIFAS.corporativa,
  },
  {
    id: "paginaAdicional",
    categoria: "regla",
    nombre: "Página adicional",
    incluye: "Cada página a partir de la segunda (máximo 20 páginas en total).",
    regla: "(páginas − 1) × precio",
    precio: TARIFAS.paginaAdicional,
  },
  {
    id: "formulario",
    categoria: "extra",
    nombre: "Formulario de contacto",
    incluye:
      "Formulario simple que envía los datos del visitante por correo (contacto, solicitud de cita o reserva sin calendario ni pagos).",
    precio: TARIFAS.formulario,
  },
  {
    id: "segundoIdioma",
    categoria: "extra",
    nombre: "Segundo idioma",
    incluye: "Toda la web traducida y publicada en un idioma adicional.",
    precio: TARIFAS.segundoIdioma,
  },
] satisfies ServicioCatalogo[]).map((s) => Object.freeze(s))

const idsDe = (categoria: CategoriaServicio) =>
  CATALOGO.filter((s) => s.categoria === categoria).map((s) => s.id)

// Ids que el usuario (o la IA) puede elegir como servicio
export const IDS_SELECCIONABLES: readonly string[] = CATALOGO.filter(
  (s) => s.categoria !== "regla"
).map((s) => s.id)
export const IDS_TIPO: readonly string[] = idsDe("tipo")
export const IDS_EXTRA: readonly string[] = idsDe("extra")
export const MONEDA = TARIFAS.moneda

export function buscarServicio(id: string): ServicioCatalogo | undefined {
  return CATALOGO.find((s) => s.id === id)
}
