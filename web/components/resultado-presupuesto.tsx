import { cn } from "@/lib/utils"
import {
  formatearImporte,
  type Presupuesto,
  type SolicitudPresupuesto,
} from "@/lib/api"

const NOMBRE_TIPO: Record<SolicitudPresupuesto["tipo"], string> = {
  landing: "Landing",
  corporativa: "Web corporativa",
}

// Grosores de las barras del código de barras decorativo (en px)
const BARRAS = [
  2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 3, 2, 1, 1, 2,
  1, 1, 3, 1, 2, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1,
]

export function ResultadoPresupuesto({
  presupuesto,
  solicitud,
  referencia,
  enviando,
}: {
  presupuesto: Presupuesto | null
  solicitud: SolicitudPresupuesto | null
  referencia: number
  enviando: boolean
}) {
  const hayResultado = presupuesto !== null && solicitud !== null
  const moneda = presupuesto?.moneda ?? "EUR"
  const importe = (valor: number | undefined) =>
    valor === undefined ? "—" : formatearImporte(valor, moneda)

  return (
    // key: con cada presupuesto nuevo el ticket se vuelve a montar y "sale impreso"
    <div
      key={referencia}
      className="mx-auto w-full max-w-[380px] animate-in duration-300 fade-in-0 slide-in-from-top-3 lg:mr-0"
    >
      <div aria-live="polite" aria-busy={enviando}>
        <div className="rounded-t-xl border border-b-0 bg-card pb-6 ticket-muesca-abajo">
          <div className="flex flex-col gap-1.5 px-6 pt-7">
            <p className="text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase">
              Presupuesto
            </p>
            {/* Referencia y fecha: decorativas, generadas en el navegador */}
            <p className="font-mono text-xs text-muted-foreground">
              {hayResultado
                ? `REF. ${String(referencia).padStart(4, "0")} · ${new Date().toLocaleDateString("es-ES")}`
                : "REF. ---- · --/--/----"}
            </p>
            <p className="mt-3 font-heading text-xl font-semibold text-emphasis">
              {hayResultado
                ? `${NOMBRE_TIPO[solicitud.tipo]} · ${solicitud.paginas} ${solicitud.paginas === 1 ? "página" : "páginas"}`
                : "Sin calcular"}
            </p>
          </div>

          <div className="mx-6 my-5 border-t-2 border-dashed" />

          <div
            className={cn(
              "px-6 transition-opacity duration-200",
              enviando && "opacity-60"
            )}
          >
            <dl className="flex flex-col gap-2.5 font-mono text-[0.8rem]">
              <Linea
                concepto="Precio base"
                importe={importe(presupuesto?.base)}
              />
              <Linea
                concepto="Páginas adicionales"
                importe={importe(presupuesto?.paginasAdicionales)}
              />
              <Linea
                concepto="Formulario"
                importe={importe(presupuesto?.formulario)}
              />
              <Linea
                concepto="Segundo idioma"
                importe={importe(presupuesto?.segundoIdioma)}
              />
            </dl>
          </div>
        </div>

        {/* Parte inferior: las muescas de las dos partes coinciden en la línea
          discontinua antes del total, como un ticket troquelado */}
        <div className="border border-y-0 bg-card pb-6 ticket-muesca-arriba">
          <div className="mx-6 mb-6 -translate-y-px border-t-2 border-dashed" />

          <div
            className={cn(
              "flex items-end justify-between gap-4 px-6 transition-opacity duration-200",
              enviando && "opacity-60"
            )}
          >
            <span className="pb-2 font-mono text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Total
            </span>
            {hayResultado ? (
              <span className="font-heading text-5xl font-bold tracking-tight text-emphasis tabular-nums underline decoration-total-underline decoration-4 underline-offset-[6px]">
                {formatearImporte(presupuesto.total, moneda)}
              </span>
            ) : (
              <span className="font-heading text-5xl font-bold text-muted-foreground">
                —
              </span>
            )}
          </div>

          {!hayResultado && (
            <p className="mt-6 px-6 text-center text-sm text-muted-foreground">
              Completa los datos para ver el presupuesto
            </p>
          )}

          <p className="mt-8 px-6 text-center text-xs text-muted-foreground">
            Importes calculados por el servidor · Moneda: {moneda}
          </p>

          <div
            aria-hidden
            className="mx-auto mt-5 flex h-10 w-fit items-stretch gap-[2px] opacity-40"
          >
            {BARRAS.map((ancho, indice) => (
              <span
                key={indice}
                className="bg-muted-foreground"
                style={{ width: ancho }}
              />
            ))}
          </div>
        </div>
        <div aria-hidden className="h-[7px] bg-card ticket-zigzag" />
      </div>
    </div>
  )
}

// Línea del desglose con puntos guía entre el concepto y el importe
function Linea({ concepto, importe }: { concepto: string; importe: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-foreground">{concepto}</dt>
      <span
        aria-hidden
        className="min-w-4 flex-1 -translate-y-1 border-b-2 border-dotted"
      />
      <dd className="font-semibold text-emphasis tabular-nums">{importe}</dd>
    </div>
  )
}
