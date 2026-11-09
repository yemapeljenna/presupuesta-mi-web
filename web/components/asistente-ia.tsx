"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  ListChecksIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  MinusIcon,
  PlusIcon,
  RotateCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UnplugIcon,
  XIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  ListaPasos,
  type EstadoPaso,
  type PasoAsistente,
} from "@/components/lista-pasos"
import { cn } from "@/lib/utils"
import {
  formatearImporte,
  generarPdf,
  obtenerCatalogo,
  solicitarPropuesta,
  type ErrorValidacion,
  type PropuestaRecibida,
  type RespuestaCatalogo,
  type ResultadoPresupuesto,
  type SolicitudPresupuesto,
  type TipoWeb,
} from "@/lib/api"

// Límites mostrados en el formulario (el servidor los vuelve a comprobar)
const MAX_CLIENTE = 120
const MAX_DESCRIPCION = 4000
const MIN_PAGINAS = 1
const MAX_PAGINAS = 20
const ESPERA_CALCULO_MS = 400

const PASOS = [
  {
    titulo: "Proyecto",
    subtitulo: "Describe la web",
    icono: MessageSquareTextIcon,
    ayuda: "Cuenta qué negocio es, qué secciones necesitas y qué debe hacer la web.",
  },
  {
    titulo: "Propuesta",
    subtitulo: "Revisa los servicios",
    icono: ListChecksIcon,
    ayuda: "La IA propone servicios del catálogo. Acepta, quita o añade lo que necesites.",
  },
  {
    titulo: "Presupuesto PDF",
    subtitulo: "Vista previa y descarga",
    icono: FileTextIcon,
    ayuda: "El servidor recalcula los importes y genera el documento.",
  },
]

type IdExtra = "formulario" | "segundoIdioma"
const IDS_EXTRA: IdExtra[] = ["formulario", "segundoIdioma"]
// propuesto: la IA lo sugiere y falta revisarlo · aceptado: entra en el presupuesto · no: fuera
type EstadoExtra = "propuesto" | "aceptado" | "no"

type ErrorPropuesta =
  | { tipo: "invalido"; error: ErrorValidacion }
  | { tipo: "fallo-ia"; detalles: string[] }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; mensaje: string }

export function AsistenteIA({
  enviando,
  onCalcular,
  onLimpiar,
}: {
  enviando: boolean
  onCalcular: (solicitud: SolicitudPresupuesto) => Promise<ResultadoPresupuesto | null>
  // Vacía el ticket cuando la selección deja de estar completa
  onLimpiar: () => void
}) {
  // --- Catálogo (precios y descripciones vienen del servidor) -------------
  const [catalogo, setCatalogo] = React.useState<RespuestaCatalogo | null>(null)
  const cargarCatalogo = React.useCallback(async () => {
    try {
      setCatalogo(await obtenerCatalogo())
    } catch {
      setCatalogo(null)
    }
  }, [])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCatalogo()
  }, [cargarCatalogo])
  const servicio = (id: string) => catalogo?.servicios.find((s) => s.id === id)
  const precio = (id: string) => {
    const valor = servicio(id)?.precio
    if (valor === undefined) return <Skeleton className="inline-block h-4 w-12" />
    return formatearImporte(valor, catalogo?.moneda)
  }

  // --- Paso 1: descripción -------------------------------------------------
  const [cliente, setCliente] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [generando, setGenerando] = React.useState(false)
  const [errorPropuesta, setErrorPropuesta] = React.useState<ErrorPropuesta | null>(null)

  // --- Paso 2: propuesta revisada por el usuario ---------------------------
  const [propuesta, setPropuesta] = React.useState<PropuestaRecibida | null>(null)
  const [tipo, setTipo] = React.useState<TipoWeb | null>(null)
  const [paginas, setPaginas] = React.useState("")
  const [extras, setExtras] = React.useState<Record<IdExtra, EstadoExtra>>({
    formulario: "no",
    segundoIdioma: "no",
  })
  const [intentoConfirmar, setIntentoConfirmar] = React.useState(false)

  // --- Paso 3: PDF ---------------------------------------------------------
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
  const [generandoPdf, setGenerandoPdf] = React.useState(false)
  const [errorPdf, setErrorPdf] = React.useState<string[] | null>(null)
  const firmaPdf = React.useRef("")

  // --- Navegación ----------------------------------------------------------
  const [paso, setPaso] = React.useState(0)
  const [alcanzado, setAlcanzado] = React.useState(0)
  const tituloPaso = React.useRef<HTMLHeadingElement>(null)
  const moverFoco = React.useRef(false)
  React.useEffect(() => {
    if (moverFoco.current) tituloPaso.current?.focus()
    moverFoco.current = false
  }, [paso])
  function irA(indice: number) {
    moverFoco.current = true
    setPaso(indice)
    setAlcanzado((actual) => Math.max(actual, indice))
  }

  // --- Validación de la selección (solo para guiar; el servidor valida) ----
  const paginasNumero = Number.parseInt(paginas, 10)
  const paginasValidas =
    /^\d+$/.test(paginas) && paginasNumero >= MIN_PAGINAS && paginasNumero <= MAX_PAGINAS
  const sinRevisar = IDS_EXTRA.filter((id) => extras[id] === "propuesto")
  const seleccionCompleta = tipo !== null && paginasValidas
  const puedeConfirmar = seleccionCompleta && sinRevisar.length === 0

  const seleccion: SolicitudPresupuesto | null =
    tipo && paginasValidas
      ? {
          tipo,
          paginas: paginasNumero,
          formulario: extras.formulario === "aceptado",
          segundoIdioma: extras.segundoIdioma === "aceptado",
        }
      : null

  // El ticket se recalcula en el servidor cada vez que cambia la selección
  const calcularAutomatico = React.useEffectEvent(() => {
    if (seleccion) onCalcular(seleccion)
    else onLimpiar()
  })
  React.useEffect(() => {
    const espera = setTimeout(calcularAutomatico, ESPERA_CALCULO_MS)
    return () => clearTimeout(espera)
  }, [tipo, paginas, extras])

  // --- Acciones ------------------------------------------------------------

  async function generarPropuesta() {
    setGenerando(true)
    setErrorPropuesta(null)
    const respuesta = await solicitarPropuesta({ cliente, descripcion })
    setGenerando(false)
    if (respuesta.tipo !== "ok") {
      setErrorPropuesta(respuesta)
      return
    }
    const nueva = respuesta.propuesta
    setPropuesta(nueva)
    setTipo(nueva.tipo)
    setPaginas(nueva.paginas ? String(nueva.paginas) : "")
    setExtras({
      formulario: nueva.servicios.some((s) => s.id === "formulario") ? "propuesto" : "no",
      segundoIdioma: nueva.servicios.some((s) => s.id === "segundoIdioma") ? "propuesto" : "no",
    })
    setIntentoConfirmar(false)
    setAlcanzado(1)
    irA(1)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (paso === 0 && !generando) generarPropuesta()
  }

  function cambiarPaginas(incremento: number) {
    const base = Number.isNaN(paginasNumero) ? MIN_PAGINAS - incremento : paginasNumero
    setPaginas(String(Math.min(MAX_PAGINAS, Math.max(MIN_PAGINAS, base + incremento))))
  }

  function confirmar() {
    setIntentoConfirmar(true)
    if (puedeConfirmar) irA(2)
  }

  async function crearPdf() {
    if (!seleccion || !propuesta) return
    setGenerandoPdf(true)
    setErrorPdf(null)
    const respuesta = await generarPdf({
      cliente: propuesta.cliente,
      resumen: propuesta.resumen,
      seleccion,
      dudas: propuesta.dudas,
      pendientes: propuesta.pendientes,
    })
    setGenerandoPdf(false)
    if (respuesta.tipo === "ok") {
      setPdfUrl(URL.createObjectURL(respuesta.pdf))
    } else {
      firmaPdf.current = ""
      setErrorPdf(
        respuesta.tipo === "invalido"
          ? respuesta.error.detalles
          : respuesta.tipo === "sin-conexion"
            ? ["No se puede conectar con el servidor."]
            : [respuesta.mensaje]
      )
    }
  }

  // Al entrar en el paso 3 (o si cambia la selección) se genera la vista previa
  const firmaActual = JSON.stringify({ seleccion, propuesta })
  const generarVistaPrevia = React.useEffectEvent(() => {
    if (firmaPdf.current === firmaActual) return
    firmaPdf.current = firmaActual
    crearPdf()
  })
  React.useEffect(() => {
    if (paso === 2) generarVistaPrevia()
  }, [paso, firmaActual])

  // Libera de memoria el PDF anterior al generar otro (y al desmontar)
  React.useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
  }, [pdfUrl])

  // --- Estado de cada paso en la lista -------------------------------------
  const pasos: PasoAsistente[] = PASOS.map((datos, indice) => {
    let estado: EstadoPaso = "pendiente"
    if (indice === paso) estado = "activo"
    else if (indice === 1 && intentoConfirmar && !puedeConfirmar) estado = "error"
    else if (indice < alcanzado) estado = "completado"
    return {
      titulo: datos.titulo,
      subtitulo: datos.subtitulo,
      icono: datos.icono,
      estado,
      accesible:
        indice === 0 ||
        (indice === 1 && propuesta !== null) ||
        (indice === 2 && propuesta !== null && puedeConfirmar && alcanzado >= 2),
    }
  })

  const nombreArchivo = `presupuesto-${(propuesta?.cliente ?? "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "cliente"}.pdf`

  const justificacionDe = (id: string) =>
    propuesta?.servicios.find((s) => s.id === id)?.justificacion

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col overflow-hidden rounded-2xl border bg-card lg:min-h-[560px] lg:flex-row"
    >
      <div className="border-b p-3 lg:w-[260px] lg:shrink-0 lg:border-r lg:border-b-0 lg:p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ListaPasos pasos={pasos} activo={paso} onIr={irA} />
          </div>
          <span className="text-xs whitespace-nowrap text-muted-foreground lg:hidden">
            Paso {paso + 1} de {PASOS.length}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6 p-5 sm:p-8 lg:p-10">
        <div key={paso} className="animate-in duration-200 fade-in-0 slide-in-from-right-2">
          <section aria-labelledby="titulo-paso-ia" className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="font-heading text-4xl leading-none font-semibold text-muted-foreground/50 tabular-nums"
              >
                {String(paso + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <h2
                  id="titulo-paso-ia"
                  ref={tituloPaso}
                  tabIndex={-1}
                  className="font-heading text-2xl font-semibold text-emphasis outline-none"
                >
                  {PASOS[paso].titulo}
                </h2>
                <p className="text-sm text-muted-foreground">{PASOS[paso].ayuda}</p>
              </div>
            </div>

            {/* ---------------- Paso 1: descripción ---------------- */}
            {paso === 0 && (
              <>
                <ErrorDePropuesta
                  error={errorPropuesta}
                  generando={generando}
                  onReintentar={generarPropuesta}
                />
                <div className="flex flex-col gap-5 rounded-xl border bg-background p-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="cliente" className="text-sm font-semibold">
                      Cliente
                    </label>
                    <Input
                      id="cliente"
                      value={cliente}
                      maxLength={MAX_CLIENTE}
                      autoComplete="organization"
                      placeholder="Nombre de la empresa o persona"
                      onChange={(event) => setCliente(event.target.value)}
                      aria-invalid={campoConError(errorPropuesta, "cliente") || undefined}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <label htmlFor="descripcion" className="text-sm font-semibold">
                        Descripción del proyecto
                      </label>
                      <span
                        className="text-xs text-muted-foreground tabular-nums"
                        aria-live="polite"
                      >
                        {descripcion.length} / {MAX_DESCRIPCION}
                      </span>
                    </div>
                    <Textarea
                      id="descripcion"
                      value={descripcion}
                      maxLength={MAX_DESCRIPCION}
                      rows={7}
                      placeholder="Ej.: Tengo una clínica dental y quiero una web con inicio, servicios, equipo y contacto, con un formulario para pedir cita."
                      onChange={(event) => setDescripcion(event.target.value)}
                      aria-invalid={campoConError(errorPropuesta, "descripcion") || undefined}
                      aria-describedby="descripcion-ayuda"
                      className="min-h-40"
                    />
                    <p id="descripcion-ayuda" className="text-xs text-muted-foreground">
                      La IA solo propone servicios del catálogo. Los precios los calcula siempre el servidor.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ---------------- Paso 2: propuesta ---------------- */}
            {paso === 1 && propuesta && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 rounded-xl border bg-background p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Propuesta para <span className="font-semibold text-emphasis">{propuesta.cliente}</span>
                    </p>
                    <Badge variant="secondary">
                      <SparklesIcon data-icon="inline-start" />
                      Redactado por la IA
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {propuesta.resumen || "La IA no ha redactado un resumen."}
                  </p>
                </div>

                {intentoConfirmar && !puedeConfirmar && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>Falta completar la propuesta</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {!tipo && <li>Elige el tipo de web.</li>}
                        {!paginasValidas && <li>Indica el número de páginas (de 1 a 20).</li>}
                        {sinRevisar.length > 0 && (
                          <li>Acepta o quita los servicios propuestos por la IA.</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Tipo de web */}
                <Bloque
                  titulo="Tipo de web"
                  obligatorio={propuesta.faltan.includes("tipo")}
                  conError={intentoConfirmar && !tipo}
                  mensajeError="Elige el tipo de web: la IA no ha podido deducirlo."
                >
                  <div role="radiogroup" aria-label="Tipo de web" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(["landing", "corporativa"] as const).map((id) => {
                      const sugerido = propuesta.tipo === id
                      return (
                        <label
                          key={id}
                          className={cn(
                            "group flex cursor-pointer flex-col justify-between gap-4 rounded-xl border bg-background p-5 transition-colors duration-200",
                            "hover:border-ring has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
                            "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="tipo-ia"
                            value={id}
                            checked={tipo === id}
                            onChange={() => setTipo(id)}
                            className="sr-only"
                          />
                          <span className="flex flex-col gap-1.5">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-emphasis transition-colors duration-200 group-has-checked:text-primary-foreground">
                                {servicio(id)?.nombre ?? id}
                              </span>
                              {sugerido && (
                                <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase group-has-checked:text-primary-foreground/80">
                                  Sugerido
                                </span>
                              )}
                            </span>
                            <span className="text-sm text-muted-foreground transition-colors duration-200 group-has-checked:text-primary-foreground/80">
                              {sugerido ? justificacionDe(id) : servicio(id)?.incluye}
                            </span>
                          </span>
                          <span className="font-heading text-2xl font-bold text-emphasis tabular-nums transition-colors duration-200 group-has-checked:text-primary-foreground">
                            {precio(id)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </Bloque>

                {/* Páginas */}
                <Bloque
                  titulo="Páginas"
                  obligatorio={propuesta.faltan.includes("paginas")}
                  conError={intentoConfirmar && !paginasValidas}
                  mensajeError="Indica cuántas páginas tendrá la web (de 1 a 20)."
                  detalle={<>Página adicional <span className="font-semibold text-emphasis tabular-nums">{precio("paginaAdicional")}</span></>}
                >
                  <div className="flex flex-col items-center gap-3 rounded-xl border bg-background px-6 py-6">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        className="size-11 rounded-full"
                        onClick={() => cambiarPaginas(-1)}
                        disabled={!Number.isNaN(paginasNumero) && paginasNumero <= MIN_PAGINAS}
                        aria-label="Quitar una página"
                      >
                        <MinusIcon />
                      </Button>
                      <Input
                        id="paginas-ia"
                        type="number"
                        inputMode="numeric"
                        min={MIN_PAGINAS}
                        max={MAX_PAGINAS}
                        step={1}
                        value={paginas}
                        placeholder="–"
                        onChange={(event) => setPaginas(event.target.value)}
                        aria-label="Número de páginas"
                        aria-invalid={(paginas !== "" || intentoConfirmar) && !paginasValidas ? true : undefined}
                        aria-describedby="paginas-ia-ayuda"
                        className="h-16 w-24 [appearance:textfield] border-transparent bg-transparent text-center font-heading text-5xl font-semibold text-emphasis tabular-nums md:text-5xl dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        className="size-11 rounded-full"
                        onClick={() => cambiarPaginas(1)}
                        disabled={!Number.isNaN(paginasNumero) && paginasNumero >= MAX_PAGINAS}
                        aria-label="Añadir una página"
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                    <p id="paginas-ia-ayuda" className="text-sm text-muted-foreground">
                      Entre 1 y 20 · la primera está incluida
                    </p>
                  </div>
                </Bloque>

                {/* Servicios extra: aceptar, quitar o añadir del catálogo */}
                <Bloque titulo="Servicios extra">
                  <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-background">
                    {IDS_EXTRA.map((id) => {
                      const estado = extras[id]
                      const justificacion = justificacionDe(id)
                      const cambiar = (nuevo: EstadoExtra) =>
                        setExtras((actuales) => ({ ...actuales, [id]: nuevo }))
                      return (
                        <li
                          key={id}
                          className={cn(
                            "flex flex-col gap-3 px-5 py-4 transition-colors duration-200 sm:flex-row sm:items-center",
                            estado === "aceptado" && "bg-muted",
                            estado === "propuesto" && intentoConfirmar && "bg-destructive/5"
                          )}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{servicio(id)?.nombre ?? id}</span>
                              {estado === "propuesto" && (
                                <Badge variant="outline">
                                  <SparklesIcon data-icon="inline-start" />
                                  Propuesto
                                </Badge>
                              )}
                              {estado === "aceptado" && (
                                <Badge>
                                  <CheckIcon data-icon="inline-start" />
                                  Incluido
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {justificacion && estado !== "no" ? justificacion : servicio(id)?.incluye}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className="font-semibold whitespace-nowrap text-emphasis tabular-nums">
                              {precio(id)}
                            </span>
                            <div className="flex gap-1.5">
                              {estado === "propuesto" && (
                                <Button type="button" size="sm" onClick={() => cambiar("aceptado")}>
                                  <CheckIcon data-icon="inline-start" />
                                  Aceptar
                                </Button>
                              )}
                              {estado === "no" ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => cambiar("aceptado")}>
                                  <PlusIcon data-icon="inline-start" />
                                  Añadir
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cambiar("no")}
                                  aria-label={`Quitar ${servicio(id)?.nombre ?? id}`}
                                >
                                  <XIcon data-icon="inline-start" />
                                  Quitar
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </Bloque>

                {propuesta.dudas.length > 0 && (
                  <Alert>
                    <HelpCircleIcon />
                    <AlertTitle>Dudas para aclarar con el cliente</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {propuesta.dudas.map((duda) => (
                          <li key={duda}>{duda}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {propuesta.pendientes.length > 0 && (
                  <Alert>
                    <TriangleAlertIcon />
                    <AlertTitle>Pendientes: fuera del catálogo</AlertTitle>
                    <AlertDescription>
                      <p>No se incluyen en el total; se presupuestarán aparte.</p>
                      <ul className="list-disc space-y-1 pl-4">
                        {propuesta.pendientes.map((pendiente) => (
                          <li key={pendiente}>{pendiente}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {propuesta.descartados.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se han descartado {propuesta.descartados.length}{" "}
                    {propuesta.descartados.length === 1 ? "sugerencia" : "sugerencias"} de la IA que no
                    encajaban en el catálogo.
                  </p>
                )}
              </div>
            )}

            {/* ---------------- Paso 3: PDF ---------------- */}
            {paso === 2 && (
              <div className="flex flex-col gap-4">
                {errorPdf && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>No se ha podido generar el PDF</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {errorPdf.map((detalle) => (
                          <li key={detalle}>{detalle}</li>
                        ))}
                      </ul>
                      <Button type="button" variant="outline" size="sm" onClick={crearPdf}>
                        <RotateCwIcon data-icon="inline-start" />
                        Reintentar
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                <div
                  aria-busy={generandoPdf}
                  className="relative overflow-hidden rounded-xl border bg-background"
                >
                  {pdfUrl && (
                    <iframe
                      src={pdfUrl}
                      title="Vista previa del presupuesto en PDF"
                      className={cn(
                        "h-[480px] w-full transition-opacity duration-200 sm:h-[600px]",
                        generandoPdf && "opacity-40"
                      )}
                    />
                  )}
                  {(generandoPdf || !pdfUrl) && (
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 p-10 text-sm text-muted-foreground",
                        pdfUrl ? "absolute inset-0" : "h-[480px] sm:h-[600px]"
                      )}
                    >
                      {generandoPdf ? (
                        <>
                          <Loader2Icon className="size-6 animate-spin" aria-hidden />
                          Generando vista previa
                        </>
                      ) : (
                        !errorPdf && "Sin vista previa"
                      )}
                    </div>
                  )}
                </div>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 self-start text-sm text-primary underline-offset-4 hover:underline"
                  >
                    <ExternalLinkIcon className="size-3.5" aria-hidden />
                    Abrir la vista previa en otra pestaña
                  </a>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ---------------- Botonera ---------------- */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-6">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-11 rounded-xl px-4"
            onClick={() => irA(paso - 1)}
            disabled={paso === 0}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Anterior
          </Button>

          {paso === 0 && (
            <div className="flex items-center gap-2">
              {propuesta && (
                <Button
                  key="ver-propuesta"
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="hidden h-11 rounded-xl px-4 sm:inline-flex"
                  onClick={() => irA(1)}
                  disabled={generando}
                >
                  Ver propuesta actual
                </Button>
              )}
              <Button
                key="generar"
                type="submit"
                size="lg"
                className="h-11 rounded-xl px-5 font-semibold"
                disabled={generando || !cliente.trim() || !descripcion.trim()}
                aria-busy={generando}
              >
                {generando ? <Loader2Icon className="animate-spin" /> : <SparklesIcon data-icon="inline-start" />}
                {generando ? "Analizando" : propuesta ? "Generar de nuevo" : "Generar propuesta"}
              </Button>
            </div>
          )}

          {paso === 1 && (
            <Button
              key="confirmar"
              type="button"
              size="lg"
              className="h-11 rounded-xl px-5 font-semibold"
              onClick={confirmar}
              aria-busy={enviando}
            >
              Confirmar y ver PDF
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}

          {paso === 2 &&
            (pdfUrl && !generandoPdf ? (
              <a
                key="descargar"
                href={pdfUrl}
                download={nombreArchivo}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <DownloadIcon className="size-4" aria-hidden />
                Descargar PDF
              </a>
            ) : (
              <Button key="descargar-desactivado" type="button" size="lg" className="h-11 rounded-xl px-5 font-semibold" disabled>
                <DownloadIcon data-icon="inline-start" />
                Descargar PDF
              </Button>
            ))}
        </div>
      </div>
    </form>
  )
}

function campoConError(error: ErrorPropuesta | null, campo: string) {
  return error?.tipo === "invalido" && error.error.campos.includes(campo)
}

// Avisos del paso 1: datos no válidos (400), fallo de la IA (502) o sin conexión
function ErrorDePropuesta({
  error,
  generando,
  onReintentar,
}: {
  error: ErrorPropuesta | null
  generando: boolean
  onReintentar: () => void
}) {
  if (!error) return null
  if (error.tipo === "invalido") {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Revisa los datos</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            {error.error.detalles.map((detalle) => (
              <li key={detalle}>{detalle}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }
  const titulo =
    error.tipo === "sin-conexion"
      ? "No se puede conectar con el servidor"
      : "No se ha podido generar la propuesta"
  const detalles =
    error.tipo === "fallo-ia"
      ? error.detalles
      : error.tipo === "error"
        ? [error.mensaje]
        : ["Comprueba la conexión e inténtalo de nuevo."]
  return (
    <Alert variant="destructive">
      {error.tipo === "sin-conexion" ? <UnplugIcon /> : <AlertCircleIcon />}
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription>
        {detalles.map((detalle) => (
          <p key={detalle}>{detalle}</p>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onReintentar} disabled={generando}>
          {generando ? <Loader2Icon className="animate-spin" /> : <RotateCwIcon data-icon="inline-start" />}
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  )
}

// Bloque con título dentro de la propuesta; se marca en rojo si falta completarlo
function Bloque({
  titulo,
  obligatorio = false,
  conError = false,
  mensajeError,
  detalle,
  children,
}: {
  titulo: string
  obligatorio?: boolean
  conError?: boolean
  mensajeError?: string
  detalle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "-m-3 flex flex-col gap-3 rounded-2xl border border-transparent p-3 transition-colors duration-200",
        conError && "border-destructive bg-destructive/5"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={cn("flex items-center gap-2 font-semibold text-emphasis", conError && "text-destructive")}>
          {titulo}
          {obligatorio && (
            <span className="text-xs font-normal text-muted-foreground">
              La IA no lo ha deducido · obligatorio
            </span>
          )}
        </h3>
        {detalle && <span className="text-sm text-muted-foreground">{detalle}</span>}
      </div>
      {children}
      {conError && mensajeError && <p className="text-sm text-destructive">{mensajeError}</p>}
    </div>
  )
}
