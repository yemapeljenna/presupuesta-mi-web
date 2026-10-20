"use client"

import { CheckIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type EstadoPaso = "activo" | "completado" | "pendiente" | "error"

export interface PasoAsistente {
  titulo: string
  subtitulo: string
  icono: LucideIcon
  estado: EstadoPaso
  // Se puede volver a él desde la lista (pasos ya completados)
  accesible: boolean
}

const TEXTO_ESTADO: Partial<Record<EstadoPaso, string>> = {
  completado: "(completado)",
  error: "(con errores)",
}

// Lista de pasos del asistente: vertical en escritorio y fila de círculos en móvil.
// Sin líneas entre pasos; el estado se ve en el círculo.
export function ListaPasos({
  pasos,
  activo,
  onIr,
}: {
  pasos: PasoAsistente[]
  activo: number
  onIr: (indice: number) => void
}) {
  return (
    <nav aria-label="Pasos del presupuesto">
      <ol className="flex items-center justify-between gap-2 md:flex-col md:items-stretch md:justify-start md:gap-1">
        {pasos.map((paso, indice) => {
          const Icono = paso.estado === "completado" ? CheckIcon : paso.icono
          const esActivo = indice === activo
          return (
            <li key={paso.titulo}>
              <button
                type="button"
                onClick={() => onIr(indice)}
                disabled={!paso.accesible || esActivo}
                aria-current={esActivo ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-1 text-left transition-colors duration-150 outline-none md:px-2.5 md:py-2",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted disabled:cursor-default",
                  esActivo && "md:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 [&>svg]:size-4",
                    (paso.estado === "activo" ||
                      paso.estado === "completado") &&
                      "border-primary bg-primary text-primary-foreground",
                    paso.estado === "pendiente" &&
                      "border-transparent bg-muted text-muted-foreground",
                    paso.estado === "error" &&
                      "border-destructive bg-card text-destructive"
                  )}
                >
                  <Icono aria-hidden />
                </span>
                {/* En móvil solo se ven los círculos; el texto queda para lectores de pantalla */}
                <span className="sr-only flex-col md:not-sr-only md:flex">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      esActivo && "font-semibold text-emphasis",
                      paso.estado === "error" && "text-destructive"
                    )}
                  >
                    {paso.titulo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {paso.subtitulo}
                  </span>
                  {TEXTO_ESTADO[paso.estado] && (
                    <span className="sr-only">{TEXTO_ESTADO[paso.estado]}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
