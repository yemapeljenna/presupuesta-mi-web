# Presupuesta mi web

API REST hecha con **Node.js + Express** que calcula el presupuesto desglosado de un proyecto web. El servidor usa sus propias tarifas y nunca acepta precios ni totales enviados por el cliente. Incluye además una interfaz cliente opcional (carpeta `web/`) que consume la API.

**Autora:** Jennifer Paucara Mamani · DAW · Módulo 0613 · IFP Hospitalet

---

## Resumen rápido

| Parte | Carpeta | Instalar | Ejecutar | Puerto |
|---|---|---|---|---|
| API | raíz del proyecto | `npm install` | `npm start` | 3000 (`http://localhost:3000`) |
| Interfaz (ampliación) | `web/` | `npm install` | `npm run dev` | 3001 (`http://localhost:3001`) |

---

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye `npm`).

## Instalación

```bash
git clone https://github.com/yemapeljenna/presupuesta-mi-web.git
cd presupuesta-mi-web
npm install
```

La carpeta `node_modules` no se sube al repositorio. `npm install` la genera leyendo `package.json` (dependencias del proyecto) y `package-lock.json` (versiones exactas).

## Ejecución

```bash
npm start
```

La API arranca en el **puerto 3000**: `http://localhost:3000`

- Para pararla: `Ctrl + C` en la terminal.
- Para usar otro puerto, se define la variable `PORT`:
  - Bash: `PORT=4000 npm start`
  - PowerShell: `$env:PORT=4000; npm start`
  - CMD: `set PORT=4000` y después `npm start`

Las rutas GET se pueden abrir en el navegador (por ejemplo `http://localhost:3000/api/estado`). La ruta **POST no se prueba desde la barra del navegador**, porque el navegador solo hace peticiones GET al escribir una dirección. Para el POST se usa `curl` (ver más abajo) o un cliente HTTP como Postman o Thunder Client.

## Pruebas automáticas

```bash
npm test
```

Arranca la API en el puerto 3999, prueba las rutas GET y los casos de la tabla de pruebas, y muestra `[OK]` o `[FALLO]` en cada uno. No hace falta tener el servidor encendido.

---

## Rutas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/estado` | Comprueba que el servicio funciona. Responde `{"status":"ok"}` |
| GET | `/api/tarifas` | Devuelve las tarifas que usa el servidor |
| POST | `/api/presupuesto` | Valida la solicitud y devuelve el presupuesto desglosado |

### POST /api/presupuesto

Cabecera obligatoria: `Content-Type: application/json`

**Cuerpo de ejemplo** (los cuatro campos son obligatorios):

```json
{
  "tipo": "corporativa",
  "paginas": 4,
  "formulario": true,
  "segundoIdioma": false
}
```

| Campo | Tipo | Valores permitidos |
|---|---|---|
| `tipo` | texto | `"landing"` o `"corporativa"` |
| `paginas` | número entero | de 1 a 20 |
| `formulario` | booleano | `true` o `false` |
| `segundoIdioma` | booleano | `true` o `false` |

Las propiedades extra (por ejemplo `"total": 1`) se ignoran.

**Respuesta correcta (200):**

```json
{
  "base": 600,
  "paginasAdicionales": 150,
  "formulario": 80,
  "segundoIdioma": 0,
  "total": 830,
  "moneda": "EUR"
}
```

**Respuesta con error (400):** `campos` indica qué campos fallan y `detalles` explica el motivo. En este caso no se calcula nada.

```json
{
  "error": "Solicitud no válida",
  "campos": ["paginas"],
  "detalles": ["El campo \"paginas\" debe ser un número entero entre 1 y 20."]
}
```

### Ejemplos con curl

La opción `-i` muestra también la cabecera de la respuesta, donde se ve el código de estado (200 o 400).

**Bash, Git Bash, macOS o Linux:**

```bash
curl -i -X POST http://localhost:3000/api/presupuesto \
  -H "Content-Type: application/json" \
  -d '{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}'
```

**CMD de Windows** (las comillas internas se escapan con `\"`):

```
curl -i -X POST http://localhost:3000/api/presupuesto -H "Content-Type: application/json" -d "{\"tipo\":\"corporativa\",\"paginas\":4,\"formulario\":true,\"segundoIdioma\":false}"
```

Rutas GET:

```bash
curl -i http://localhost:3000/api/estado
curl -i http://localhost:3000/api/tarifas
```

---

## Interfaz cliente (ampliación)

En la carpeta `web/` hay una interfaz hecha con **Next.js y shadcn/ui** que consume la API. Muestra el estado del servicio, las tarifas de `GET /api/tarifas` integradas en cada opción y un asistente por pasos (tipo de web, páginas, extras y revisión) que envía la solicitud a `POST /api/presupuesto`. El resultado se muestra como un ticket con el desglose y el total.

La interfaz **no calcula ningún precio**: todos los importes vienen de la API. Si la API responde 400, muestra los mensajes de `detalles` y marca el paso que tiene el error.

Hacen falta **dos terminales**:

**Terminal 1** (raíz del proyecto), API en `http://localhost:3000`:

```bash
npm install
npm start
```

**Terminal 2**, interfaz en `http://localhost:3001`:

```bash
cd web
npm install
npm run dev
```

Después se abre `http://localhost:3001` en el navegador.

- **URL de la API:** se lee de la variable `NEXT_PUBLIC_API_URL`. Si no existe, se usa `http://localhost:3000`. Hay un ejemplo en `web/.env.example`; para cambiarla se copia como `web/.env.local` y se edita el valor. Los archivos `.env` reales no se suben al repositorio.
- **Modo claro / oscuro:** se cambia con la tecla `d` o con el botón de la cabecera.

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

## Estructura del proyecto

```
presupuesta-mi-web/
├── package.json              # Dependencias y scripts (start, dev, test)
├── package-lock.json         # Versiones exactas de las dependencias
├── .gitignore                # Excluye node_modules, .next y archivos .env
├── README.md
├── src/                      # Código de la API
│   ├── server.js             # Arranca el servidor (puerto)
│   ├── app.js                # Configuración de Express y rutas
│   ├── tarifas.js            # Tarifas del servidor (congeladas)
│   ├── validacion.js         # Validación de la solicitud
│   └── calculo.js            # Función de cálculo (separada de la ruta)
├── pruebas/
│   └── pruebas.js            # Pruebas automáticas (npm test)
└── web/                      # Interfaz cliente (ampliación, Next.js)
    ├── package.json
    ├── package-lock.json
    ├── .env.example          # Ejemplo de NEXT_PUBLIC_API_URL
    ├── app/                  # Página, layout y estilos (globals.css)
    ├── lib/api.ts            # Peticiones a la API
    └── components/           # Componentes de la interfaz
        ├── panel-presupuesto.tsx
        ├── formulario-presupuesto.tsx
        ├── lista-pasos.tsx
        ├── resultado-presupuesto.tsx
        ├── estado-servicio.tsx
        ├── boton-tema.tsx
        └── ui/               # Componentes de shadcn/ui
```

---

## Tabla de pruebas

Resultados obtenidos al ejecutar `npm test`. En los casos inválidos el resto de campos es correcto, para comprobar cada error por separado.

### Rutas GET

| Ruta | Resultado esperado | Resultado obtenido |
|---|---|---|
| GET `/api/estado` | 200 · `{"status":"ok"}` | 200 · `{"status":"ok"}` |
| GET `/api/tarifas` | 200 · lista de tarifas | 200 · 5 conceptos (300, 600, 50, 80, 150) y moneda EUR |

### POST /api/presupuesto

| Caso | Solicitud enviada | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 1 | `{"tipo":"landing","paginas":1,"formulario":false,"segundoIdioma":false}` | 200 · 300 € | 200 · base 300, páginas 0, formulario 0, idioma 0, **total 300** |
| 2 | `{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}` | 200 · 830 € | 200 · base 600, páginas 150, formulario 80, idioma 0, **total 830** |
| 3 | `{"tipo":"landing","paginas":2,"formulario":true,"segundoIdioma":true}` | 200 · 580 € | 200 · base 300, páginas 50, formulario 80, idioma 150, **total 580** |
| 4 | `{"tipo":"landing","paginas":20,"formulario":false,"segundoIdioma":false}` | 200 · 1.250 € | 200 · base 300, páginas 950, formulario 0, idioma 0, **total 1250** |
| 5 | `{"tipo":"landing","paginas":0,"formulario":false,"segundoIdioma":false}` | 400 | 400 · campos `["paginas"]` · debe ser un número entero entre 1 y 20 |
| 6 | `{"tipo":"landing","paginas":21,"formulario":false,"segundoIdioma":false}` | 400 | 400 · campos `["paginas"]` · debe ser un número entero entre 1 y 20 |
| 7 | `{"tipo":"landing","paginas":2.5,"formulario":false,"segundoIdioma":false}` | 400 | 400 · campos `["paginas"]` · debe ser un número entero entre 1 y 20 |
| 8 | `{"tipo":"tienda","paginas":2,"formulario":false,"segundoIdioma":false}` | 400 | 400 · campos `["tipo"]` · debe ser "landing" o "corporativa" |
| 9 | `{"tipo":"landing","paginas":2,"formulario":"false","segundoIdioma":false}` | 400 | 400 · campos `["formulario"]` · debe ser un booleano (true o false) |

### Estados de respuesta

| Código | Significado |
|---|---|
| 200 | Cálculo atendido correctamente |
| 400 | Solicitud que incumple el contrato (no se calcula nada) |
| 404 | Ruta inexistente (`{"error":"Ruta no encontrada"}`) |
| 500 | Fallo interno inesperado del servicio |

### Pruebas extra

Los casos 10 a 12 se ejecutan con `npm test`; los casos 13 y 14 se han comprobado con `curl`.

| Caso | Solicitud enviada | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 10 | `{"tipo":"landing","paginas":"4","formulario":false,"segundoIdioma":false}` (páginas como texto) | 400 | 400 · campos `["paginas"]` · debe ser un número entero entre 1 y 20 |
| 11 | `{"tipo":"landing","paginas":2,"formulario":false}` (falta `segundoIdioma`) | 400 | 400 · campos `["segundoIdioma"]` · Falta el campo obligatorio "segundoIdioma" |
| 12 | `{"tipo":"landing","paginas":1,"formulario":false,"segundoIdioma":false,"total":1,"base":0}` (intenta imponer el total) | 200 · 300 € (se ignoran `total` y `base`) | 200 · **total 300** |
| 13 | Cuerpo del caso 1 sin la cabecera `Content-Type: application/json` | 400 | 400 · La petición debe usar la cabecera Content-Type: application/json |
| 14 | JSON mal formado: `{malo` | 400 | 400 · El JSON enviado no es válido |

---

## Cómo funciona

### Una validación: `paginas`

```js
if (typeof paginas !== 'number' || !Number.isInteger(paginas) || paginas < 1 || paginas > 20)
```

1. `typeof paginas !== 'number'` rechaza el texto `"4"`, aunque parezca un número.
2. `!Number.isInteger(paginas)` rechaza decimales como `2.5`.
3. `paginas < 1 || paginas > 20` rechaza `0` y `21`.

Si alguna condición falla, la ruta responde **400** y **no llama** a la función de cálculo.

### Cálculo del caso 2 (corporativa, 4 páginas, con formulario)

La función `calcularPresupuesto()` de `src/calculo.js` recibe los datos ya validados:

| Concepto | Operación | Importe |
|---|---|---|
| Base | tarifa de web corporativa | 600 € |
| Páginas adicionales | (4 − 1) × 50 = 3 × 50 | 150 € |
| Formulario | `true`, se suma 80 | 80 € |
| Segundo idioma | `false`, se suma 0 | 0 € |
| **Total** | 600 + 3 × 50 + 80 + 0 | **830 €** |

### Por qué el cliente no puede cambiar las tarifas

- Las tarifas están en `src/tarifas.js` protegidas con `Object.freeze`, así que no se pueden modificar mientras el servidor está en marcha.
- La validación devuelve solo los cuatro campos permitidos (`tipo`, `paginas`, `formulario` y `segundoIdioma`). Cualquier otra propiedad que envíe el cliente, como `total` o `precio`, se descarta antes de calcular (caso 12).
