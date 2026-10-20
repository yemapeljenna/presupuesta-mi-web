"use client"

import { cn } from "@/lib/utils"

export type Estado = "comprobando" | "conectado" | "sin-conexion"

const TEXTOS: Record<Estado, string> = {
  comprobando: "Comprobando",
  conectado: "Conectado",
  "sin-conexion": "Sin conexión",
}

export function EstadoServicio({
  estado,
  onComprobar,
}: {
  estado: Estado
  onComprobar: () => void
}) {
  return (
    <button
      type="button"
      onClick={onComprobar}
      disabled={estado === "comprobando"}
      title="Volver a comprobar la conexión"
      aria-live="polite"
      aria-label={`Estado del servicio: ${TEXTOS[estado]}. Volver a comprobar`}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
        estado === "sin-conexion" && "text-destructive"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          estado === "conectado" && "bg-primary",
          estado === "sin-conexion" && "bg-destructive",
          estado === "comprobando" && "animate-pulse bg-muted-foreground"
        )}
      />
      {TEXTOS[estado]}
    </button>
  )
}
