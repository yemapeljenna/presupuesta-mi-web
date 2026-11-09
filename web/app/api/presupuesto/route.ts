// POST /api/presupuesto → valida y calcula
import { calcularPresupuesto } from "@/lib/calculo"
import { errorValidacion, leerJson } from "@/lib/http"
import { validarSolicitud } from "@/lib/validacion"

export async function POST(request: Request) {
  const lectura = await leerJson(request)
  if (!lectura.ok) return lectura.respuesta

  const resultado = validarSolicitud(lectura.body)
  // Datos incorrectos → 400 y NO se calcula nada
  if (!resultado.ok) return errorValidacion(resultado.campos, resultado.errores)

  // Solo llegan aquí los datos limpios y validados
  return Response.json(calcularPresupuesto(resultado.datos))
}
