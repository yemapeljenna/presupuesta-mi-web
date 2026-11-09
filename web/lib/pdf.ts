// Presupuesto en PDF con PDFKit (solo servidor).
// Recibe la selección final, la valida con validarSolicitud y recalcula con
// calcularPresupuesto: cualquier importe enviado por el cliente se ignora.
import PDFDocument from "pdfkit"

import { calcularPresupuesto, type Presupuesto } from "@/lib/calculo"
import { buscarServicio } from "@/lib/catalogo"
import { LIMITES } from "@/lib/propuesta"
import { TARIFAS } from "@/lib/tarifas"
import {
  esObjeto,
  validarSolicitud,
  type ResultadoValidacion,
  type SolicitudPresupuesto,
} from "@/lib/validacion"

export interface DatosPdf {
  cliente: string
  resumen: string
  seleccion: SolicitudPresupuesto
  dudas: string[]
  pendientes: string[]
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

export function validarDatosPdf(body: unknown): ResultadoValidacion<DatosPdf> {
  if (!esObjeto(body)) {
    return {
      ok: false,
      campos: [],
      errores: ["El cuerpo de la petición debe ser un objeto JSON."],
    }
  }
  const campos: string[] = []
  const errores: string[] = []

  const cliente = typeof body.cliente === "string" ? body.cliente.trim() : ""
  if (!cliente || cliente.length > LIMITES.cliente) {
    campos.push("cliente")
    errores.push(
      `El nombre del cliente es obligatorio y no puede superar ${LIMITES.cliente} caracteres ("cliente").`
    )
  }

  const resumen = body.resumen === undefined ? "" : body.resumen
  if (typeof resumen !== "string" || resumen.length > LIMITES.resumen) {
    campos.push("resumen")
    errores.push(
      `El resumen debe ser un texto de ${LIMITES.resumen} caracteres como máximo ("resumen").`
    )
  }

  const listas = { dudas: [] as string[], pendientes: [] as string[] }
  for (const campo of ["dudas", "pendientes"] as const) {
    const valor = body[campo] === undefined ? [] : body[campo]
    const valida =
      Array.isArray(valor) &&
      valor.length <= LIMITES.items &&
      valor.every((v) => typeof v === "string" && v.length <= LIMITES.item)
    if (!valida) {
      campos.push(campo)
      errores.push(
        `"${campo}" debe ser una lista de hasta ${LIMITES.items} textos de ${LIMITES.item} caracteres como máximo.`
      )
    } else {
      listas[campo] = (valor as string[]).map((v) => v.trim()).filter(Boolean)
    }
  }

  // La selección se valida con la MISMA función que POST /api/presupuesto
  const seleccion = validarSolicitud(body.seleccion)
  if (!seleccion.ok) {
    campos.push(
      ...(seleccion.campos.length > 0
        ? seleccion.campos.map((c) => `seleccion.${c}`)
        : ["seleccion"])
    )
    errores.push(...seleccion.errores)
  }

  if (!seleccion.ok || errores.length > 0) return { ok: false, campos, errores }

  return {
    ok: true,
    datos: {
      cliente,
      resumen: (resumen as string).trim(),
      seleccion: seleccion.datos, // solo tipo, paginas, formulario, segundoIdioma
      dudas: listas.dudas,
      pendientes: listas.pendientes,
    },
  }
}

// ---------------------------------------------------------------------------
// Generación del documento
// ---------------------------------------------------------------------------

const COLOR = {
  titulo: "#330921",
  texto: "#330921",
  suave: "#864b6c",
  acento: "#612547",
  linea: "#ead6e1",
  fondo: "#fdf4f9",
}

// Las fuentes estándar del PDF usan WinAnsi: se sustituyen los caracteres que
// no se pueden representar (emojis, otros alfabetos) para que no salgan rotos.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"
export function aWinAnsi(texto: string) {
  return texto
    .replace(/[  ]/g, " ")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/gu, (c) =>
      WINANSI_EXTRA.includes(c) ? c : "?"
    )
}

export function euros(importe: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: TARIFAS.moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: "always",
  }).format(importe)
}

function fechaLarga(fecha: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "Europe/Madrid",
  }).format(fecha)
}

interface Concepto {
  nombre: string
  descripcion: string
  importe: number
}

// Servicio confirmado + descripción del catálogo + importe calculado
function conceptos(seleccion: SolicitudPresupuesto, presupuesto: Presupuesto) {
  const tipo = buscarServicio(seleccion.tipo)!
  const lineas: Concepto[] = [
    { nombre: tipo.nombre, descripcion: tipo.incluye, importe: presupuesto.base },
  ]
  if (seleccion.paginas > 1) {
    const extra = seleccion.paginas - 1
    const pagina = buscarServicio("paginaAdicional")!
    lineas.push({
      nombre: `${extra === 1 ? pagina.nombre : "Páginas adicionales"} (${extra} × ${euros(TARIFAS.paginaAdicional)})`,
      descripcion: `${seleccion.paginas} páginas en total; la primera está incluida en el tipo de web.`,
      importe: presupuesto.paginasAdicionales,
    })
  }
  for (const id of ["formulario", "segundoIdioma"] as const) {
    if (seleccion[id]) {
      const servicio = buscarServicio(id)!
      lineas.push({
        nombre: servicio.nombre,
        descripcion: servicio.incluye,
        importe: presupuesto[id],
      })
    }
  }
  return lineas
}

export function generarPdf(
  datos: DatosPdf,
  fecha = new Date()
): Promise<{ buffer: Buffer; presupuesto: Presupuesto }> {
  const presupuesto = calcularPresupuesto(datos.seleccion)
  const lineas = conceptos(datos.seleccion, presupuesto)
  const t = aWinAnsi

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: t(`Presupuesto - ${datos.cliente}`),
      Author: "Presupuesta mi web",
      Subject: "Presupuesto de proyecto web",
    },
  })
  const fragmentos: Buffer[] = []
  doc.on("data", (f: Buffer) => fragmentos.push(f))
  const terminado = new Promise<Buffer>((resolver, rechazar) => {
    doc.on("end", () => resolver(Buffer.concat(fragmentos)))
    doc.on("error", rechazar)
  })

  const izq = doc.page.margins.left
  const ancho = doc.page.width - izq - doc.page.margins.right
  const limiteInferior = () => doc.page.height - doc.page.margins.bottom

  function titulo(texto: string) {
    if (doc.y > limiteInferior() - 90) doc.addPage()
    doc.moveDown(1.2)
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLOR.suave)
      .text(t(texto.toUpperCase()), izq, doc.y, { characterSpacing: 1.5 })
    const y = doc.y + 4
    doc.moveTo(izq, y).lineTo(izq + ancho, y).lineWidth(0.8).strokeColor(COLOR.linea).stroke()
    doc.y = y + 8
  }

  function lista(items: string[], vacio: string) {
    doc.font("Helvetica").fontSize(10).fillColor(items.length ? COLOR.texto : COLOR.suave)
    if (items.length === 0) {
      doc.text(t(vacio), izq, doc.y, { width: ancho })
      return
    }
    for (const item of items) {
      doc.text(t(`•  ${item}`), izq + 4, doc.y, { width: ancho - 4, paragraphGap: 3 })
    }
  }

  // Cabecera
  doc.rect(0, 0, doc.page.width, 6).fill(COLOR.acento)
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.suave)
    .text("PRESUPUESTA MI WEB", izq, 40, { characterSpacing: 2 })
  doc.font("Helvetica-Bold").fontSize(26).fillColor(COLOR.titulo).text("Presupuesto", izq, 56)
  doc.font("Helvetica").fontSize(10).fillColor(COLOR.suave)
    .text(t(fechaLarga(fecha)), izq, 66, { width: ancho, align: "right" })
  doc.y = 100

  // Cliente
  titulo("Cliente")
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.texto)
    .text(t(datos.cliente), izq, doc.y, { width: ancho })

  // Resumen
  titulo("Resumen del proyecto")
  doc.font("Helvetica").fontSize(10).fillColor(datos.resumen ? COLOR.texto : COLOR.suave)
    .text(t(datos.resumen || "Sin resumen."), izq, doc.y, { width: ancho, lineGap: 2 })

  // Servicios confirmados con su descripción e importe (desglose)
  titulo("Servicios confirmados y desglose")
  const anchoImporte = 90
  const anchoTexto = ancho - anchoImporte - 10
  for (const linea of lineas) {
    if (doc.y > limiteInferior() - 60) doc.addPage()
    const y = doc.y
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLOR.texto)
      .text(t(linea.nombre), izq, y, { width: anchoTexto })
    const yDescripcion = doc.y
    doc.text(t(euros(linea.importe)), izq + ancho - anchoImporte, y, { width: anchoImporte, align: "right" })
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.suave)
      .text(t(linea.descripcion), izq, yDescripcion + 2, { width: anchoTexto, lineGap: 1 })
    const fin = doc.y + 6
    doc.moveTo(izq, fin).lineTo(izq + ancho, fin).dash(2, { space: 2 })
      .lineWidth(0.6).strokeColor(COLOR.linea).stroke().undash()
    doc.y = fin + 8
  }

  // Total
  if (doc.y > limiteInferior() - 60) doc.addPage()
  const yTotal = doc.y + 4
  doc.roundedRect(izq, yTotal, ancho, 44, 6).fill(COLOR.fondo)
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.suave)
    .text("TOTAL", izq + 14, yTotal + 17, { characterSpacing: 2 })
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLOR.titulo)
    .text(t(euros(presupuesto.total)), izq, yTotal + 11, { width: ancho - 14, align: "right" })
  doc.y = yTotal + 52

  // Aclaraciones: notas fijas + dudas detectadas
  titulo("Aclaraciones")
  lista(
    [
      `Importes calculados por el servidor con las tarifas vigentes, en ${presupuesto.moneda}.`,
      "La primera página está incluida en el precio del tipo de web.",
      "Los servicios pendientes no están incluidos en el total.",
      ...datos.dudas.map((duda) => `Por confirmar: ${duda}`),
    ],
    ""
  )

  // Pendientes
  titulo("Pendientes (fuera del catálogo, no presupuestados)")
  lista(datos.pendientes, "Ninguno.")

  doc.end()
  return terminado.then((buffer) => ({ buffer, presupuesto }))
}
