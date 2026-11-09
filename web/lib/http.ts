// Utilidades comunes de los Route Handlers (solo servidor).

const MAX_CUERPO_BYTES = 50 * 1024

export function errorValidacion(
  campos: string[],
  detalles: string[],
  estado = 400
) {
  return Response.json(
    {
      error: estado === 413 ? "Solicitud demasiado grande" : "Solicitud no válida",
      campos,
      detalles,
    },
    { status: estado }
  )
}

// Lee el cuerpo JSON con las mismas reglas que tenía la API Express:
// cabecera Content-Type obligatoria, límite de tamaño y 400 si el JSON está mal.
export async function leerJson(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false; respuesta: Response }> {
  const tipo = request.headers.get("content-type") ?? ""
  if (!/^application\/json\b/i.test(tipo)) {
    return {
      ok: false,
      respuesta: errorValidacion(
        [],
        ["La petición debe usar la cabecera Content-Type: application/json."]
      ),
    }
  }

  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_CUERPO_BYTES) {
    return {
      ok: false,
      respuesta: errorValidacion(
        [],
        ["El cuerpo de la petición es demasiado grande."],
        413
      ),
    }
  }

  try {
    return { ok: true, body: JSON.parse(texto) }
  } catch {
    return {
      ok: false,
      respuesta: errorValidacion([], ["El JSON enviado no es válido."]),
    }
  }
}
