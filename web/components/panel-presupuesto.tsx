"use client"

import * as React from "react"

import { EstadoServicio, type Estado } from "@/components/estado-servicio"
import { FormularioPresupuesto } from "@/components/formulario-presupuesto"
import { ResultadoPresupuesto } from "@/components/resultado-presupuesto"
import { BotonTema } from "@/components/boton-tema"
import {
  comprobarEstado,
  obtenerTarifas,
  solicitarPresupuesto,
  type RespuestaTarifas,
  type ResultadoPresupuesto as Resultado,
  type SolicitudPresupuesto,
} from "@/lib/api"

const INTERVALO_ESTADO_MS = 15000

export function PanelPresupuesto() {
  const [estado, setEstado] = React.useState<Estado>("comprobando")
  const [tarifas, setTarifas] = React.useState<RespuestaTarifas | null>(null)
  const [cargandoTarifas, setCargandoTarifas] = React.useState(true)
  const [errorTarifas, setErrorTarifas] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<Resultado | null>(null)
  // Número de referencia decorativo del ticket (sube con cada presupuesto)
  const [referencia, setReferencia] = React.useState(0)
  const [solicitud, setSolicitud] = React.useState<SolicitudPresupuesto | null>(
    null
  )

  const actualizarEstado = React.useCallback(async () => {
    const disponible = await comprobarEstado()
    setEstado(disponible ? "conectado" : "sin-conexion")
    return disponible
  }, [])

  // Pide estado y tarifas a la API; solo actualiza el estado al recibir respuesta
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

  // Número de la última petición enviada, para descartar respuestas antiguas
  const ultimaPeticion = React.useRef(0)

  // Devuelve la respuesta para que el formulario pueda reaccionar (por ejemplo,
  // saltar al paso con error), o null si ya hay una petición más reciente.
  async function enviar(
    datos: SolicitudPresupuesto
  ): Promise<Resultado | null> {
    const peticion = ++ultimaPeticion.current
    setEnviando(true)
    const respuesta = await solicitarPresupuesto(datos)
    if (peticion !== ultimaPeticion.current) return null
    setResultado(respuesta)
    setSolicitud(respuesta.tipo === "ok" ? datos : null)
    if (respuesta.tipo === "ok") setReferencia((actual) => actual + 1)
    setEstado(respuesta.tipo === "sin-conexion" ? "sin-conexion" : "conectado")
    if (respuesta.tipo !== "sin-conexion" && !tarifas) cargarDatos()
    setEnviando(false)
    return respuesta
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 lg:px-8">
      <header className="flex flex-col gap-6 border-b pt-10 pb-8 sm:flex-row sm:items-end sm:justify-between sm:pt-14 sm:pb-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-emphasis sm:text-5xl">
            Presupuesta mi web
          </h1>
          <p className="text-base text-muted-foreground">
            Presupuesto de proyectos web con las tarifas vigentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoServicio estado={estado} onComprobar={volverAComprobar} />
          <BotonTema />
        </div>
      </header>

      <main className="grid flex-1 items-start gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <FormularioPresupuesto
          enviando={enviando}
          resultado={resultado}
          tarifas={tarifas}
          cargandoTarifas={cargandoTarifas}
          errorTarifas={errorTarifas}
          onReintentarTarifas={volverAComprobar}
          onEnviar={enviar}
        />
        <aside className="lg:sticky lg:top-8">
          <ResultadoPresupuesto
            presupuesto={
              resultado?.tipo === "ok" ? resultado.presupuesto : null
            }
            solicitud={solicitud}
            referencia={referencia}
            enviando={enviando}
          />
        </aside>
      </main>

      <footer className="border-t py-6 text-xs text-muted-foreground">
        Jennifer Paucara · DAW · 0613 Desarrollo web en entorno servidor
      </footer>
    </div>
  )
}
