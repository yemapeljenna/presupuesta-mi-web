# Presupuesta mi web

Aplicación **Next.js** que prepara presupuestos de proyectos web. El cliente describe su proyecto, un agente con **OpenAI** propone servicios del catálogo, el usuario los revisa (acepta, quita o añade) y descarga el presupuesto en **PDF**.

La IA solo **propone y redacta**. La validación, los precios y los totales se calculan siempre en el servidor, en los Route Handlers de Next (`web/app/api/`), y nunca se aceptan importes enviados por el navegador.

**Autora:** Jennifer Paucara Mamani · DAW · Módulo 0613 · IFP Hospitalet

---

## Resumen rápido

| Carpeta | Instalar | Ejecutar | Pruebas | Puerto |
|---|---|---|---|---|
| `web/` | `npm install` | `npm run dev` | `npm test` | 3000 (`http://localhost:3000`) |

Todo (interfaz y API) es **un solo proyecto de Next.js** en `web/`. Ya no hay servidor Express.

---

## Requisitos

- [Node.js](https://nodejs.org/) **22 o superior** (lo exige el SDK `openai` v7).
- Una clave de API de OpenAI, solo para generar propuestas con IA. Sin clave funcionan el modo manual, el cálculo y el PDF; el agente responde 502 con el mensaje "El servicio de IA no está configurado".

## Instalación y ejecución en local

```bash
git clone https://github.com/yemapeljenna/presupuesta-mi-web.git
cd presupuesta-mi-web/web
npm install
cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
# edita .env.local y rellena OPENAI_API_KEY y OPENAI_MODEL
npm run dev
```

Abre `http://localhost:3000`. Para producción en local: `npm run build` y `npm start`.

### Variables de entorno

Son **solo de servidor**: no llevan el prefijo `NEXT_PUBLIC_`, así que Next nunca las incluye en el código del navegador. Solo las lee `web/app/api/agente/route.ts`.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | Sí (para el agente) | Clave de la API de OpenAI |
| `OPENAI_MODEL` | Sí (para el agente) | Modelo que se usa (debe admitir salida estructurada con JSON schema) |
| `OPENAI_TIMEOUT_MS` | No | Tiempo máximo de espera a OpenAI. Por defecto, 25000 ms |

`web/.env.example` las lista sin valores. Los archivos `.env*` reales no se suben al repositorio (`.gitignore`). La variable `NEXT_PUBLIC_API_URL` de la versión anterior **ya no existe**: la interfaz llama a rutas relativas (`/api/...`) de la misma aplicación.

---

## Cómo funciona

```
Navegador (web/components)            Servidor (web/app/api, Route Handlers)
─────────────────────────             ───────────────────────────────────────
1. Cliente + descripción ───────────▶ POST /api/agente
                                        ├─ valida (400 si vacío o demasiado largo)
                                        ├─ OpenAI: Responses API + JSON schema estricto, timeout
                                        └─ revalida: ids del catálogo, un solo tipo, páginas 1-20
2. Revisa la propuesta  ◀───────────── { resumen, servicios[], tipo, paginas, dudas[], pendientes[] }
   acepta / quita / añade
   completa tipo y páginas ─────────▶ POST /api/presupuesto  (ticket en vivo)
3. Vista previa del PDF ────────────▶ POST /api/presupuesto/pdf
   y descarga                           └─ validarSolicitud + calcularPresupuesto (ignora importes)
```

No hay estado en memoria entre peticiones: el navegador envía en cada petición todo lo necesario (selección, resumen, dudas y pendientes). Por eso funciona en las funciones sin estado de Vercel.

### El agente (`web/app/api/agente/route.ts`)

Las instrucciones, el JSON schema y la llamada a OpenAI están en ese archivo.

- **Salida estructurada:** `text.format` de tipo `json_schema` con `strict: true`. Campos: `resumen`, `servicios [{ id, justificacion }]` (con `id` limitado a los ids del catálogo), `tipo` y `paginas` (o `null` si no se deducen), `dudas[]` y `pendientes[]`.
- **Instrucciones:** usar solo ids del catálogo; no inventar servicios, precios ni plazos; lo que no esté en el catálogo va a `pendientes`. Un formulario simple de reservas o citas es `formulario`; las reservas con disponibilidad o con pagos van a pendientes. El catálogo se describe al modelo **sin precios**.
- **La descripción son datos:** se envía como un objeto JSON en el mensaje del usuario, separada de las instrucciones, y las instrucciones indican ignorar cualquier orden que contenga.
- **Revalidación** (`web/lib/propuesta.ts`): aunque el schema ya limita los ids, la respuesta se vuelve a comprobar. Se descartan los ids que no estén en el catálogo y los repetidos, se deja un solo tipo de web, se anulan las páginas fuera de 1-20 y se recortan los textos. Los ids descartados se devuelven en `descartados`, y lo que falta por completar, en `faltan`.
- **Timeout y errores:** se espera como máximo `OPENAI_TIMEOUT_MS` (se cancela la petición con `AbortSignal`), sin reintentos automáticos. Si falta la configuración, OpenAI da error, se agota el tiempo, el modelo rechaza la petición o la respuesta no es JSON, la ruta responde **502** con un mensaje claro y `"reintentar": true`. La interfaz muestra entonces el botón **Reintentar**. En el registro del servidor nunca aparece la clave.
- `store: false`: OpenAI no guarda la conversación con los datos del cliente.

### Catálogo y precios (`web/lib/`)

| Archivo | Contenido |
|---|---|
| `tarifas.ts` | **Única** fuente de precios (congelada con `Object.freeze`) |
| `catalogo.ts` | Servicios: `id`, `categoria` (tipo, extra o regla), `nombre`, `incluye` y `precio`, que se **lee** de `tarifas.ts` |
| `validacion.ts` | `validarSolicitud()`, la misma validación que tenía la API Express |
| `calculo.ts` | `calcularPresupuesto()`, separada de las rutas |
| `propuesta.ts` | Validación de la entrada del agente y revalidación de la respuesta del modelo |
| `pdf.ts` | Validación de los datos del PDF y generación con PDFKit |
| `http.ts` | Lectura del JSON: exige `Content-Type`, limita el tamaño a 50 KB y responde 400 si el JSON está mal formado |
| `api.ts` | Funciones del navegador que llaman a `/api/...` |

---

## Rutas (Route Handlers)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/estado` | `{"status":"ok"}` |
| GET | `/api/tarifas` | Tarifas del servidor |
| GET | `/api/catalogo` | Catálogo de servicios con precios (leídos de `tarifas.ts`) |
| POST | `/api/presupuesto` | Valida `{ tipo, paginas, formulario, segundoIdioma }` y devuelve el desglose |
| POST | `/api/agente` | `{ cliente, descripcion }` → propuesta de la IA revalidada |
| POST | `/api/presupuesto/pdf` | Selección final → PDF recalculado en el servidor |

Todas las rutas POST exigen `Content-Type: application/json`. Las propiedades extra (`"total"`, `"precios"`...) se ignoran.

### POST /api/agente

```json
{ "cliente": "Clínica Sonrisa", "descripcion": "Web con inicio, servicios, equipo, blog y contacto, y un formulario para pedir cita." }
```

- `cliente`: obligatorio, máximo 120 caracteres. `descripcion`: obligatoria, máximo 4000 caracteres. Si no se cumple, **400** sin llamar a OpenAI.
- **200:**

```json
{
  "cliente": "Clínica Sonrisa",
  "resumen": "Web corporativa para una clínica dental…",
  "tipo": "corporativa",
  "paginas": 5,
  "servicios": [
    { "id": "corporativa", "nombre": "Web corporativa", "incluye": "…", "justificacion": "Pide cinco secciones." },
    { "id": "formulario", "nombre": "Formulario de contacto", "incluye": "…", "justificacion": "Quiere que pidan cita." }
  ],
  "dudas": [],
  "pendientes": [],
  "descartados": [],
  "faltan": []
}
```

- **502:** `{ "error": "No se ha podido generar la propuesta", "detalles": ["El servicio de IA ha tardado demasiado en responder.", "…"], "reintentar": true }`

### POST /api/presupuesto/pdf

```json
{
  "cliente": "Clínica Sonrisa",
  "resumen": "Web corporativa para una clínica dental.",
  "seleccion": { "tipo": "corporativa", "paginas": 6, "formulario": false, "segundoIdioma": true },
  "dudas": ["¿Tiene ya dominio propio?"],
  "pendientes": ["Sistema de reservas con pago online"]
}
```

- `seleccion` se valida con **`validarSolicitud`** y se calcula con **`calcularPresupuesto`**, las mismas funciones que `POST /api/presupuesto`. Cualquier importe que envíe el cliente se ignora.
- **200:** `application/pdf`, con la cabecera `X-Presupuesto-Total` (el total calculado). **400:** `campos` y `detalles` (por ejemplo, `seleccion.paginas`).
- El PDF incluye cliente, fecha, resumen, servicios confirmados con su descripción e importe, desglose, total, aclaraciones (notas fijas y dudas) y pendientes.
- `resumen`, `dudas` y `pendientes` llegan del navegador porque no hay estado en el servidor. Son solo texto (con límites de longitud) y nunca afectan a los importes.

---

## Librería de PDF: comparativa y elección

Criterios: que siga mantenida, que funcione en un **Route Handler de Next.js** (runtime Node.js) desplegado en **Vercel** como función sin estado y que no pese demasiado. Versiones consultadas en npm en noviembre de 2026.

| Librería | Última versión (npm) | Mantenimiento | Encaje en Route Handler + Vercel |
|---|---|---|---|
| **PDFKit** | 0.20.2 (sept. 2026) | Activo | JavaScript puro con APIs de Node (Buffer, streams). Ligera. Sus fuentes estándar se cargan como módulos JS, así que el trazado de archivos de Vercel las incluye. Con `serverExternalPackages: ["pdfkit"]`, Next la carga con `require` sin empaquetarla. |
| pdf-lib | 1.17.1 (mayo 2022) | **Sin publicar desde hace más de 4 años** | Funcionaría, pero es arriesgado depender de una librería abandonada. Diseño de bajo nivel: el ajuste de líneas y los saltos de página se hacen a mano. |
| @react-pdf/renderer | 4.9.0 (ago. 2026) | Activo | Encaja con React (`renderToBuffer`) y es una alternativa razonable. Es más pesada (motor de maquetación y fuentes propios) y, en el App Router, también suele necesitar configuración como paquete externo. Internamente usa su propia variante de PDFKit. |
| jsPDF | 4.2.1 (mar. 2026) | Activo | Pensada sobre todo para el navegador. Generar el PDF en el cliente iría contra el requisito de recalcular en el servidor. En Node funciona, pero la maquetación de textos largos es más manual. |
| Puppeteer | 25.16.0 (oct. 2026) | Activo | Necesita Chromium. En Vercel obliga a usar `puppeteer-core` + `@sparticuz/chromium`, se acerca al límite de 250 MB por función, tiene arranques en frío lentos y gasta más memoria. Es excesivo para un documento sencillo. |

**Elección: PDFKit.** Se mantiene activamente, es ligera, no necesita navegador y ofrece texto con ajuste de línea, saltos de página y estilos suficientes para el presupuesto.

Lo he comprobado en el Route Handler: `web/app/api/presupuesto/pdf/route.ts` declara `runtime = "nodejs"` (PDFKit no funciona en el runtime Edge) y `next.config.ts` la marca como `serverExternalPackages`. Con `npm run build` + `npm start`, la ruta devuelve el PDF correcto. Un presupuesto ocupa unos 3 KB, muy por debajo del límite de 4,5 MB de respuesta de las funciones de Vercel.

Limitación conocida: las fuentes estándar del PDF (Helvetica) usan la codificación WinAnsi. Tildes, ñ, ¿, ¡ y € se ven bien; los emojis y los alfabetos no latinos se sustituyen por `?`. Para admitirlos habría que incrustar una fuente TTF con `doc.registerFont`.

---

## Interfaz

En la cabecera se elige el modo:

- **Asistente IA** (`components/asistente-ia.tsx`), en tres pasos:
  1. **Proyecto:** nombre del cliente y descripción (con contador de caracteres). Si OpenAI falla, aparece el aviso con **Reintentar**.
  2. **Propuesta:** resumen redactado por la IA, tipo de web y páginas (marcados como obligatorios si la IA no los ha deducido) y servicios extra. Cada servicio propuesto muestra su justificación y se puede **Aceptar** o **Quitar**; los del catálogo que no se han propuesto se pueden **Añadir**. También se muestran las dudas y los pendientes. No se avanza hasta completar el tipo, las páginas (1-20) y revisar todas las propuestas.
  3. **Presupuesto PDF:** vista previa del PDF generado por el servidor, enlace para abrirlo en otra pestaña y botón **Descargar PDF**.
- **Manual** (`components/formulario-presupuesto.tsx`): el asistente por pasos de la versión anterior.

El ticket de la derecha se recalcula en el servidor (`POST /api/presupuesto`) cada vez que cambia la selección. La interfaz **no calcula ningún precio**. Modo claro/oscuro con la tecla `d` o con el botón de la cabecera.

---

## Despliegue en Vercel (un solo proyecto)

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project** e importa el repositorio.
3. **Root Directory: `web`**. Vercel detecta Next.js; no hace falta cambiar los comandos de build.
4. **Settings → Environment Variables**: añade `OPENAI_API_KEY` y `OPENAI_MODEL` (y, si quieres, `OPENAI_TIMEOUT_MS`) para Production y Preview. No se marcan como públicas.
5. **Settings → Build and Deployment → Node.js Version: 22.x o superior** (`package.json` ya declara `"engines": { "node": ">=22" }`).
6. **Deploy.** Comprueba `https://<tu-proyecto>.vercel.app/api/estado`.

Con la CLI:

```bash
cd web
npx vercel link            # Root Directory: web
npx vercel env add OPENAI_API_KEY
npx vercel env add OPENAI_MODEL
npx vercel --prod
```

Si tenías los dos proyectos anteriores (API Express e interfaz), borra el de la API y quita la variable `NEXT_PUBLIC_API_URL` del proyecto de la interfaz.

La ruta del agente declara `maxDuration = 60` segundos, que deja margen sobre el timeout de 25 s de OpenAI.

---

## Tarifas

| Concepto | Precio |
|---|---|
| Landing, incluida la primera página | 300 € |
| Web corporativa, incluida la primera página | 600 € |
| Cada página adicional a la primera | 50 € |
| Formulario de contacto | 80 € |
| Segundo idioma | 150 € |

**Total = base + (páginas − 1) × 50 + extras seleccionados**

---

## Pruebas automáticas

```bash
cd web
npm test
```

`web/pruebas/pruebas.ts` (se ejecuta con `tsx`) llama directamente a las funciones `GET` y `POST` de cada `route.ts` con objetos `Request` estándar, sin arrancar un servidor. **OpenAI está simulado**: se intercepta `fetch` hacia `api.openai.com`, así que se prueba la ruta real con el SDK real y no hace falta clave ni conexión. Muestra `[OK]` o `[FALLO]` en cada caso.

### Cálculo (`POST /api/presupuesto`)

| Caso | Solicitud | Esperado |
|---|---|---|
| 1 | landing, 1 página, sin extras | 200 · 300 € |
| 2 | corporativa, 4 páginas, formulario | 200 · 830 € |
| 3 | landing, 2 páginas, ambos extras | 200 · 580 € |
| 4 | landing, 20 páginas | 200 · 1.250 € |
| 5-7 | `paginas` 0, 21 y 2.5 | 400 · `["paginas"]` |
| 8 | `tipo: "tienda"` | 400 · `["tipo"]` |
| 9 | `formulario: "false"` | 400 · `["formulario"]` |
| 10 | `paginas: "4"` (cadena) | 400 · `["paginas"]` |
| 11 | falta `segundoIdioma` | 400 |
| 12 | `total: 1, base: 0` | 200 · 300 € (se ignoran) |
| 13 | sin `Content-Type: application/json` | 400 |
| 14 | JSON mal formado `{malo` | 400 |

### Agente (`POST /api/agente`, OpenAI simulado)

| Caso | Situación | Esperado |
|---|---|---|
| P1 | Solicitud clara (clínica con 5 secciones y formulario de citas) | 200 · corporativa, 5 páginas, `corporativa,formulario` con justificaciones. La petición a OpenAI usa JSON schema estricto, el modelo de `OPENAI_MODEL` y la descripción como datos, y las instrucciones no contienen precios |
| P2 | Solicitud ambigua ("una web para mi negocio") | 200 · `tipo` y `paginas` a `null`, `faltan: ["tipo","paginas"]`, con dudas |
| P3 | Servicio no ofrecido (reservas con pago online) | 200 · solo `landing`; la reserva va a `pendientes` |
| P4 | Descripción vacía | 400 · `["descripcion"]` y **no** se llama a OpenAI |
| P4b | Cliente vacío y descripción de 4001 caracteres | 400 · `["cliente","descripcion"]` |
| P5 | OpenAI responde con error 500 | 502 · `reintentar: true` |
| P5b | OpenAI no responde | 502 por timeout ("ha tardado demasiado") en menos de 3 s (timeout de prueba: 300 ms) |
| P5c | El modelo devuelve algo que no es JSON | 502 |
| P5d | Falta `OPENAI_API_KEY` | 502 · "no está configurado" |
| P6 | Id inventado (`tiendaOnline`), dos tipos de web, id repetido y 99 páginas | 200 · `corporativa,formulario`; `descartados` incluye `tiendaOnline` y `landing`; `paginas: null` |

### PDF (`POST /api/presupuesto/pdf`)

| Caso | Situación | Esperado |
|---|---|---|
| PDF1 | Selección **modificada** respecto a la propuesta (quita formulario, añade segundo idioma, pasa de 5 a 6 páginas) y con `total: 1` y `precios` falsos | 200 · `application/pdf` que empieza por `%PDF-` · total **1.000 €** (600 + 5 × 50 + 150) |
| PDF2 | Misma selección en `POST /api/presupuesto` | Mismo total, 1.000 € |
| PDF3 | `seleccion.paginas: 0` | 400 · `["seleccion.paginas"]` |
| PDF4 | Cliente vacío | 400 · `["cliente"]` |

### Estados de respuesta

| Código | Significado |
|---|---|
| 200 | Petición atendida correctamente |
| 400 | La solicitud incumple el contrato (no se calcula nada ni se llama a OpenAI) |
| 413 | Cuerpo de más de 50 KB |
| 404 | Ruta inexistente |
| 502 | El servicio de IA no está disponible, ha tardado demasiado o ha devuelto una respuesta no válida |

---

## Estructura del proyecto

```
presupuesta-mi-web/
├── README.md
├── .gitignore
└── web/                          # Único proyecto (Root Directory en Vercel)
    ├── package.json              # Scripts: dev, build, start, lint, typecheck, test
    ├── .env.example              # OPENAI_API_KEY y OPENAI_MODEL (sin valores)
    ├── next.config.ts            # serverExternalPackages: ["pdfkit"]
    ├── app/
    │   ├── page.tsx, layout.tsx, globals.css
    │   └── api/
    │       ├── estado/route.ts
    │       ├── tarifas/route.ts
    │       ├── catalogo/route.ts
    │       ├── presupuesto/route.ts
    │       ├── presupuesto/pdf/route.ts
    │       └── agente/route.ts   # Instrucciones, schema y llamada a OpenAI
    ├── lib/                      # tarifas, catalogo, validacion, calculo, propuesta, pdf, http, api
    ├── components/
    │   ├── panel-presupuesto.tsx # Cabecera, selector de modo y ticket
    │   ├── asistente-ia.tsx      # Proyecto → Propuesta → PDF
    │   ├── formulario-presupuesto.tsx  # Modo manual
    │   ├── resultado-presupuesto.tsx   # Ticket
    │   └── ui/                   # Componentes de shadcn/ui
    └── pruebas/pruebas.ts        # npm test (OpenAI simulado)
```

---

## Problemas frecuentes

| Problema | Causa y solución |
|---|---|
| El agente responde "no está configurado" | Faltan `OPENAI_API_KEY` u `OPENAI_MODEL` en `web/.env.local` (en local) o en las variables del proyecto de Vercel. Tras cambiarlas, reinicia `npm run dev` o vuelve a desplegar. |
| El agente responde "no ha respondido correctamente" | Clave no válida, sin saldo o un modelo que no admite JSON schema. El detalle aparece en el registro del servidor (terminal o *Logs* de Vercel). |
| `npm install` avisa de la versión de Node | El SDK de OpenAI necesita Node 22 o superior. |
| `Error: listen EADDRINUSE ... :3000` | El puerto ya está ocupado. Cierra la otra terminal o usa `npx next dev -p 3001`. |
| Las tildes salen como `?` al probar con `curl` en Windows | La consola envía el cuerpo con otra codificación. Guarda el JSON en un archivo UTF-8 y usa `curl --data-binary @archivo.json`. La interfaz web siempre envía UTF-8. |
| La vista previa del PDF no se ve en el móvil | Algunos navegadores móviles no muestran PDF dentro de la página. Usa "Abrir la vista previa en otra pestaña" o "Descargar PDF". |
