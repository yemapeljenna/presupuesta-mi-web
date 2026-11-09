"use client"

import * as React from "react"
import { SlidersHorizontalIcon, SparklesIcon } from "lucide-react"

import { AsistenteIA } from "@/components/asistente-ia"
import { EstadoServicio, type Estado } from "@/components/estado-servicio"
import { FormularioPresupuesto } from "@/components/formulario-presupuesto"
import { ResultadoPresupuesto } from "@/components/resultado-presupuesto"
import { BotonTema } from "@/components/boton-tema"
import { cn } from "@/lib/utils"
import {
  comprobarEstado,
  obtenerTarifas,
  solicitarPresupuesto,
  type RespuestaTarifas,
  type ResultadoPresupuesto as Resultado,
  type SolicitudPresupuesto,
} from "@/lib/api"

const INTERVALO_ESTADO_MS = 15000

type Modo = "asistente" | "manual"

const MODOS: { valor: Modo; nombre: string; icono: typeof SparklesIcon }[] = [
  { valor: "asistente", nombre: "Asistente IA", icono: SparklesIcon },
  { valor: "manual", nombre: "Manual", icono: SlidersHorizontalIcon },
]

// Ticket de cada modo: así al cambiar de modo no se mezclan los resultados
interface Ticket {
  resultado: Resultado | null
  solicitud: SolicitudPresupuesto | null
  referencia: number
}
const TICKET_VACIO: Ticket = { resultado: null, solicitud: null, referencia: 0 }

export function PanelPresupuesto() {
  const [estado, setEstado] = React.useState<Estado>("comprobando")
  const [tarifas, setTarifas] = React.useState<RespuestaTarifas | null>(null)
  const [cargandoTarifas, setCargandoTarifas] = React.useState(true)
  const [errorTarifas, setErrorTarifas] = React.useState<string | null>(null)
  const [modo, setModo] = React.useState<Modo>("asistente")
  const [enviando, setEnviando] = React.useState<Record<Modo, boolean>>({
    asistente: false,
    manual: false,
  })
  const [tickets, setTickets] = React.useState<Record<Modo, Ticket>>({
    asistente: TICKET_VACIO,
    manual: TICKET_VACIO,
  })

  const actualizarEstado = React.useCallback(async () => {
    const disponible = await comprobarEstado()
    setEstado(disponible ? "conectado" : "sin-conexion")
    return disponible
  }, [])

  // Pide estado y tarifas al servidor; solo actualiza el estado al recibir respuesta
  const cargarDatos = React.useCallback(async () => {
    const disponible = await actualizarEstado()
    try {
      if (!disponible) throw new TypeError()
      setTarifas(await obtenerTarifas())
      setErrorTarifas(null)
    } catch (error) {
      setTarifas(null)
      setErrorTarifas(
        error instanceof TypeError
          ? "No se puede conectar con el servidor."
          : error instanceof Error
            ? error.message
            : "Error desconocido."
      )
    } finally {
      setCargandoTarifas(false)
    }
  }, [actualizarEstado])

  function volverAComprobar() {
    setEstado("comprobando")
    setCargandoTarifas(true)
    cargarDatos()
  }

  // Carga inicial y comprobación periódica del estado del servicio
  React.useEffect(() => {
    // Los cambios de estado ocurren tras las peticiones (después de await), no de forma síncrona
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos()
    const intervalo = setInterval(actualizarEstado, INTERVALO_ESTADO_MS)
    return () => clearInterval(intervalo)
  }, [cargarDatos, actualizarEstado])

  // Número de la última petición de cada modo, para descartar respuestas antiguas
  const ultimaPeticion = React.useRef<Record<Modo, number>>({ asistente: 0, manual: 0 })

  // Devuelve la respuesta para que el formulario pueda reaccionar (por ejemplo,
  // saltar al paso con error), o null si ya hay una petición más reciente.
  async function enviar(
    origen: Modo,
    datos: SolicitudPresupuesto
  ): Promise<Resultado | null> {
    const peticion = ++ultimaPeticion.current[origen]
    setEnviando((actual) => ({ ...actual, [origen]: true }))
    const respuesta = await solicitarPresupuesto(datos)
    if (peticion !== ultimaPeticion.current[origen]) return null
    setTickets((actuales) => ({
      ...actuales,
      [origen]: {
        resultado: respuesta,
        solicitud: respuesta.tipo === "ok" ? datos : null,
        referencia: actuales[origen].referencia + (respuesta.tipo === "ok" ? 1 : 0),
      },
    }))
    setEstado(respuesta.tipo === "sin-conexion" ? "sin-conexion" : "conectado")
    if (respuesta.tipo !== "sin-conexion" && !tarifas) cargarDatos()
    setEnviando((actual) => ({ ...actual, [origen]: false }))
    return respuesta
  }

  function limpiarTicket(origen: Modo) {
    ultimaPeticion.current[origen]++
    setTickets((actuales) =>
      actuales[origen].resultado === null
        ? actuales
        : { ...actuales, [origen]: { ...actuales[origen], resultado: null, solicitud: null } }
    )
  }

  const ticket = tickets[modo]

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 lg:px-8">
      <header className="flex flex-col gap-6 border-b pt-10 pb-8 sm:flex-row sm:items-end sm:justify-between sm:pt-14 sm:pb-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-emphasis sm:text-5xl">
            Presupuesta mi web
          </h1>
          <p className="text-base text-muted-foreground">
            Describe tu proyecto y obtén un presupuesto con las tarifas vigentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoServicio estado={estado} onComprobar={volverAComprobar} />
          <BotonTema />
        </div>
      </header>

      {/* Selector de modo */}
      <div
        role="radiogroup"
        aria-label="Modo de presupuesto"
        className="mt-8 inline-flex w-fit gap-1 rounded-xl border bg-card p-1 sm:mt-10"
      >
        {MODOS.map(({ valor, nombre, icono: Icono }) => (
          <label
            key={valor}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150",
              "hover:bg-muted has-checked:bg-primary has-checked:text-primary-foreground",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            )}
          >
            <input
              type="radio"
              name="modo"
              value={valor}
              checked={modo === valor}
              onChange={() => setModo(valor)}
              className="sr-only"
            />
            <Icono className="size-4" aria-hidden />
            {nombre}
          </label>
        ))}
      </div>

      <main className="grid flex-1 items-start gap-8 pt-6 pb-8 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:content-start lg:items-stretch">
        {/* Los dos modos siguen montados: al cambiar no se pierde la propuesta */}
        <div hidden={modo !== "asistente"} className="flex min-w-0 flex-col [&>form]:flex-1">
          <AsistenteIA
            enviando={enviando.asistente}
            onCalcular={(datos) => enviar("asistente", datos)}
            onLimpiar={() => limpiarTicket("asistente")}
          />
        </div>
        <div hidden={modo !== "manual"} className="flex min-w-0 flex-col [&>form]:flex-1">
          <FormularioPresupuesto
            enviando={enviando.manual}
            resultado={tickets.manual.resultado}
            tarifas={tarifas}
            cargandoTarifas={cargandoTarifas}
            errorTarifas={errorTarifas}
            onReintentarTarifas={volverAComprobar}
            onEnviar={(datos) => enviar("manual", datos)}
          />
        </div>
        <aside>
          <ResultadoPresupuesto
            presupuesto={ticket.resultado?.tipo === "ok" ? ticket.resultado.presupuesto : null}
            solicitud={ticket.solicitud}
            referencia={ticket.referencia}
            enviando={enviando[modo]}
          />
        </aside>
      </main>

      <footer className="border-t py-6 text-xs text-muted-foreground">
        Jennifer Paucara · DAW · 0613 Desarrollo web en entorno servidor
      </footer>
    </div>
  )
}
