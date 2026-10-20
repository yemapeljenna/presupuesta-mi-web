"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  FileStackIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  PuzzleIcon,
  ReceiptIcon,
  UnplugIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  ListaPasos,
  type EstadoPaso,
  type PasoAsistente,
} from "@/components/lista-pasos"
import { cn } from "@/lib/utils"
import {
  formatearImporte,
  precioDe,
  type RespuestaTarifas,
  type ResultadoPresupuesto,
  type SolicitudPresupuesto,
  type TipoWeb,
} from "@/lib/api"

const TIPOS: { value: TipoWeb; nombre: string; descripcion: string }[] = [
  {
    value: "landing",
    nombre: "Landing",
    descripcion: "Una página para presentar un producto o servicio.",
  },
  {
    value: "corporativa",
    nombre: "Web corporativa",
    descripcion: "Sitio de empresa con varias secciones.",
  },
]

const EXTRAS = [
  {
    campo: "formulario",
    nombre: "Formulario de contacto",
    descripcion: "Para que los visitantes puedan escribir.",
  },
  {
    campo: "segundoIdioma",
    nombre: "Segundo idioma",
    descripcion: "Toda la web en un idioma adicional.",
  },
] as const

const PASOS = [
  {
    titulo: "Tipo de web",
    subtitulo: "Landing o corporativa",
    icono: LayoutTemplateIcon,
    ayuda: "Elige el formato que mejor encaja con el proyecto.",
  },
  {
    titulo: "Páginas",
    subtitulo: "Número de páginas",
    icono: FileStackIcon,
    ayuda: "Indica cuántas páginas tendrá la web.",
  },
  {
    titulo: "Extras",
    subtitulo: "Formulario e idioma",
    icono: PuzzleIcon,
    ayuda: "Funciones opcionales que se suman al presupuesto.",
  },
  {
    titulo: "Revisar",
    subtitulo: "Confirmar y calcular",
    icono: ReceiptIcon,
    ayuda: "Comprueba los datos antes de calcular el presupuesto.",
  },
]

type Campo = keyof SolicitudPresupuesto

// Paso (índice) al que pertenece cada campo de la API
const PASO_DE_CAMPO: Record<Campo, number> = {
  tipo: 0,
  paginas: 1,
  formulario: 2,
  segundoIdioma: 2,
}

const ULTIMO_PASO = PASOS.length - 1
const ESPERA_CALCULO_MS = 400
const MIN_PAGINAS = 1
const MAX_PAGINAS = 20

export function FormularioPresupuesto({
  enviando,
  resultado,
  tarifas,
  cargandoTarifas,
  errorTarifas,
  onReintentarTarifas,
  onEnviar,
}: {
  enviando: boolean
  resultado: ResultadoPresupuesto | null
  tarifas: RespuestaTarifas | null
  cargandoTarifas: boolean
  errorTarifas: string | null
  onReintentarTarifas: () => void
  onEnviar: (
    solicitud: SolicitudPresupuesto
  ) => Promise<ResultadoPresupuesto | null>
}) {
  const [tipo, setTipo] = React.useState<TipoWeb>("landing")
  const [paginas, setPaginas] = React.useState("1")
  const [extras, setExtras] = React.useState({
    formulario: false,
    segundoIdioma: false,
  })
  const [camposCorregidos, setCamposCorregidos] = React.useState<Campo[]>([])

  // Paso activo y paso más avanzado al que se ha llegado
  const [paso, setPaso] = React.useState(0)
  const [alcanzado, setAlcanzado] = React.useState(0)

  // Campos que la API ha marcado como incorrectos en la última respuesta 400
  const error = resultado?.tipo === "invalido" ? resultado.error : null
  const camposConError = error
    ? (error.campos as Campo[]).filter(
        (campo) => !camposCorregidos.includes(campo)
      )
    : []
  const tieneError = (campo: Campo) => camposConError.includes(campo)
  const pasoConError = (indice: number) =>
    camposConError.some((campo) => PASO_DE_CAMPO[campo] === indice)

  // Los mensajes de la API nombran el campo entre comillas: 'El campo "paginas" ...'
  const mensajeDe = (campo: Campo) =>
    error?.detalles.find((detalle) => detalle.includes(`"${campo}"`)) ??
    "Valor no válido."

  function marcarCorregido(campo: Campo) {
    setCamposCorregidos((actuales) =>
      actuales.includes(campo) ? actuales : [...actuales, campo]
    )
  }

  // Validación solo para la navegación (activar "Siguiente"); quien valida
  // de verdad es la API.
  const paginasActual = Number.parseInt(paginas, 10)
  const paginasValidas =
    /^\d+$/.test(paginas) &&
    paginasActual >= MIN_PAGINAS &&
    paginasActual <= MAX_PAGINAS
  const pasoValido = (indice: number) => indice !== 1 || paginasValidas

  // --- Navegación ---------------------------------------------------------

  // Al cambiar de paso con los botones o la lista, el foco pasa al título
  // del paso nuevo (no al cargar la página).
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

  function siguiente() {
    if (paso < ULTIMO_PASO && pasoValido(paso)) irA(paso + 1)
  }

  // --- Envío a la API -----------------------------------------------------

  const esperaPendiente = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  async function enviar() {
    clearTimeout(esperaPendiente.current)
    setCamposCorregidos([])
    const respuesta = await onEnviar({
      tipo,
      paginas: Number(paginas),
      formulario: extras.formulario,
      segundoIdioma: extras.segundoIdioma,
    })
    // Error 400: salta al primer paso que tenga un campo con error
    if (respuesta?.tipo === "invalido" && respuesta.error.campos.length > 0) {
      const primero = Math.min(
        ...respuesta.error.campos.map(
          (campo) => PASO_DE_CAMPO[campo as Campo] ?? ULTIMO_PASO
        )
      )
      irA(primero)
    }
  }

  // Cálculo automático: el ticket se actualiza al cambiar los datos, solo si
  // las páginas son válidas para no mostrar errores mientras se escribe.
  const enviarAutomatico = React.useEffectEvent(() => {
    if (paginasValidas) enviar()
  })
  React.useEffect(() => {
    esperaPendiente.current = setTimeout(enviarAutomatico, ESPERA_CALCULO_MS)
    return () => clearTimeout(esperaPendiente.current)
  }, [tipo, paginas, extras])

  // Intro en un campo avanza de paso; en el último paso calcula
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (paso < ULTIMO_PASO) siguiente()
    else enviar()
  }

  // Botones - y +: solo cambian el número del campo, el importe lo calcula la API
  function cambiarPaginas(incremento: number) {
    const nuevo = Number.isNaN(paginasActual)
      ? MIN_PAGINAS
      : Math.min(MAX_PAGINAS, Math.max(MIN_PAGINAS, paginasActual + incremento))
    setPaginas(String(nuevo))
    marcarCorregido("paginas")
  }

  const precio = (concepto: string) => {
    const valor = precioDe(tarifas, concepto)
    if (valor !== undefined) return formatearImporte(valor, tarifas?.moneda)
    if (cargandoTarifas) return <Skeleton className="inline-block h-4 w-12" />
    return "-"
  }

  // --- Estado de cada paso en la lista ------------------------------------

  const pasos: PasoAsistente[] = PASOS.map((datos, indice) => {
    const anterioresValidos = PASOS.slice(0, indice).every((_, i) =>
      pasoValido(i)
    )
    const completado =
      indice === ULTIMO_PASO
        ? resultado?.tipo === "ok"
        : indice < alcanzado && pasoValido(indice)
    let estado: EstadoPaso = "pendiente"
    if (pasoConError(indice)) estado = "error"
    else if (indice === paso) estado = "activo"
    else if (completado) estado = "completado"
    return {
      titulo: datos.titulo,
      subtitulo: datos.subtitulo,
      icono: datos.icono,
      estado,
      accesible: indice <= alcanzado && anterioresValidos,
    }
  })

  const nombreTipo = TIPOS.find((opcion) => opcion.value === tipo)?.nombre
  const extrasElegidos = EXTRAS.filter((extra) => extras[extra.campo])

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="overflow-hidden rounded-2xl border bg-card md:grid md:grid-cols-[220px_minmax(0,1fr)]"
    >
      <div className="border-b p-3 md:border-r md:border-b-0 md:p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ListaPasos pasos={pasos} activo={paso} onIr={irA} />
          </div>
          <span className="text-xs whitespace-nowrap text-muted-foreground md:hidden">
            Paso {paso + 1} de {PASOS.length}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-8">
        {(errorTarifas || resultado?.tipo === "sin-conexion") && (
          <Alert variant="destructive">
            <UnplugIcon />
            <AlertTitle>No se puede conectar con el servidor</AlertTitle>
            <AlertDescription>
              <p>
                Las tarifas y el presupuesto no están disponibles en este
                momento.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onReintentarTarifas()
                  if (paginasValidas) enviar()
                }}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Revisa los datos</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {error.detalles.map((detalle) => (
                  <li key={detalle}>{detalle}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {resultado?.tipo === "error" && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se ha podido calcular el presupuesto</AlertTitle>
            <AlertDescription>
              Inténtalo de nuevo en unos segundos.
            </AlertDescription>
          </Alert>
        )}

        {/* key: al cambiar de paso el contenido se vuelve a montar y se anima */}
        <div
          key={paso}
          className="animate-in duration-200 fade-in-0 slide-in-from-right-2"
        >
          <Paso
            numero={String(paso + 1).padStart(2, "0")}
            titulo={PASOS[paso].titulo}
            ayuda={PASOS[paso].ayuda}
            refTitulo={tituloPaso}
            conError={pasoConError(paso)}
            mensajeError={camposConError
              .filter((campo) => PASO_DE_CAMPO[campo] === paso)
              .map(mensajeDe)
              .join(" ")}
            detalle={
              paso === 1 && (
                <>
                  Página adicional{" "}
                  <span className="font-semibold text-emphasis tabular-nums">
                    {precio("paginaAdicional")}
                  </span>
                </>
              )
            }
          >
            {paso === 0 && (
              <div
                role="radiogroup"
                aria-label="Tipo de web"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {TIPOS.map((opcion) => (
                  <label
                    key={opcion.value}
                    className={cn(
                      "group flex cursor-pointer flex-col justify-between gap-6 rounded-xl border bg-background p-5 transition-colors duration-200",
                      "hover:border-ring has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
                      "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={opcion.value}
                      checked={tipo === opcion.value}
                      onChange={() => {
                        setTipo(opcion.value)
                        marcarCorregido("tipo")
                      }}
                      className="sr-only"
                    />
                    <span className="flex flex-col gap-1.5">
                      <span className="font-semibold text-emphasis transition-colors duration-200 group-has-checked:text-primary-foreground">
                        {opcion.nombre}
                      </span>
                      <span className="text-sm text-muted-foreground transition-colors duration-200 group-has-checked:text-primary-foreground/80">
                        {opcion.descripcion}
                      </span>
                    </span>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted-foreground transition-colors duration-200 group-has-checked:text-primary-foreground/80">
                        Precio base
                      </span>
                      <span className="font-heading text-2xl font-bold text-emphasis tabular-nums transition-colors duration-200 group-has-checked:text-primary-foreground">
                        {precio(opcion.value)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {paso === 1 && (
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-11 rounded-full"
                    onClick={() => cambiarPaginas(-1)}
                    disabled={
                      !Number.isNaN(paginasActual) &&
                      paginasActual <= MIN_PAGINAS
                    }
                    aria-label="Quitar una página"
                  >
                    <MinusIcon />
                  </Button>
                  <Input
                    id="paginas"
                    type="number"
                    inputMode="numeric"
                    min={MIN_PAGINAS}
                    max={MAX_PAGINAS}
                    step={1}
                    value={paginas}
                    onChange={(event) => {
                      setPaginas(event.target.value)
                      marcarCorregido("paginas")
                    }}
                    aria-label="Número de páginas"
                    aria-invalid={
                      tieneError("paginas") || !paginasValidas || undefined
                    }
                    aria-describedby="paginas-ayuda"
                    className="h-16 w-24 [appearance:textfield] border-transparent bg-transparent text-center font-heading text-5xl font-semibold text-emphasis tabular-nums md:text-5xl dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-11 rounded-full"
                    onClick={() => cambiarPaginas(1)}
                    disabled={
                      !Number.isNaN(paginasActual) &&
                      paginasActual >= MAX_PAGINAS
                    }
                    aria-label="Añadir una página"
                  >
                    <PlusIcon />
                  </Button>
                </div>
                <p id="paginas-ayuda" className="text-sm text-muted-foreground">
                  Entre 1 y 20 · la primera está incluida
                </p>
              </div>
            )}

            {paso === 2 && (
              <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-background">
                {EXTRAS.map((extra) => (
                  <div
                    key={extra.campo}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 transition-colors duration-200",
                      extras[extra.campo] && "bg-muted"
                    )}
                  >
                    <Switch
                      id={extra.campo}
                      checked={extras[extra.campo]}
                      onCheckedChange={(valor) => {
                        setExtras((actuales) => ({
                          ...actuales,
                          [extra.campo]: valor,
                        }))
                        marcarCorregido(extra.campo)
                      }}
                      aria-invalid={tieneError(extra.campo) || undefined}
                    />
                    <label
                      htmlFor={extra.campo}
                      className="flex flex-1 cursor-pointer items-center justify-between gap-4"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">
                          {extra.nombre}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {extra.descripcion}
                        </span>
                      </span>
                      <span className="font-semibold whitespace-nowrap text-emphasis tabular-nums">
                        {precio(extra.campo)}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {paso === 3 && (
              <dl className="flex flex-col divide-y rounded-xl border bg-background">
                <LineaResumen
                  concepto="Tipo de web"
                  valor={nombreTipo ?? "-"}
                  onEditar={() => irA(0)}
                />
                <LineaResumen
                  concepto="Páginas"
                  valor={`${paginas} ${paginasActual === 1 ? "página" : "páginas"}`}
                  onEditar={() => irA(1)}
                />
                <LineaResumen
                  concepto="Extras"
                  valor={
                    extrasElegidos.length > 0
                      ? extrasElegidos.map((extra) => extra.nombre).join(", ")
                      : "Ninguno"
                  }
                  onEditar={() => irA(2)}
                />
              </dl>
            )}
          </Paso>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-6">
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
          {paso < ULTIMO_PASO ? (
            // key distinta en cada botón: si React reutilizara el mismo elemento,
            // al pulsar "Siguiente" en el paso 3 el botón pasaría a ser de tipo
            // submit durante el clic y el formulario se enviaría solo.
            <Button
              key="siguiente"
              type="button"
              size="lg"
              className="h-11 rounded-xl px-5"
              onClick={siguiente}
              disabled={!pasoValido(paso)}
            >
              Siguiente
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button
              key="calcular"
              type="submit"
              size="lg"
              className="h-11 rounded-xl px-5 font-semibold"
              disabled={enviando}
              aria-busy={enviando}
            >
              {enviando && <Loader2Icon className="animate-spin" />}
              {enviando ? "Calculando" : "Calcular presupuesto"}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

// Contenido de un paso: número grande, título y línea de ayuda. Si la API
// marca un campo de este paso, el bloque se rodea en rojo con el mensaje.
function Paso({
  numero,
  titulo,
  ayuda,
  refTitulo,
  detalle,
  conError,
  mensajeError,
  children,
}: {
  numero: string
  titulo: string
  ayuda: string
  refTitulo: React.Ref<HTMLHeadingElement>
  detalle?: React.ReactNode
  conError: boolean
  mensajeError: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby="titulo-paso"
      className={cn(
        "-m-4 flex flex-col gap-6 rounded-2xl border border-transparent p-4 transition-colors duration-200",
        conError && "border-destructive bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={cn(
            "font-heading text-4xl leading-none font-semibold text-muted-foreground/50 tabular-nums",
            conError && "text-destructive"
          )}
        >
          {numero}
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              id="titulo-paso"
              ref={refTitulo}
              tabIndex={-1}
              className={cn(
                "font-heading text-2xl font-semibold text-emphasis outline-none",
                conError && "text-destructive"
              )}
            >
              {titulo}
            </h2>
            {detalle && (
              <span className="text-sm text-muted-foreground">{detalle}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{ayuda}</p>
        </div>
      </div>
      {children}
      {conError && <p className="text-sm text-destructive">{mensajeError}</p>}
    </section>
  )
}

// Línea del resumen (paso Revisar) con enlace para volver a editarla
function LineaResumen({
  concepto,
  valor,
  onEditar,
}: {
  concepto: string
  valor: string
  onEditar: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">{concepto}</dt>
        <dd className="font-semibold text-emphasis">{valor}</dd>
      </div>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="px-0"
        onClick={onEditar}
        aria-label={`Editar ${concepto.toLowerCase()}`}
      >
        Editar
      </Button>
    </div>
  )
}
