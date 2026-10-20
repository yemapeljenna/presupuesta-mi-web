// Ejecuta las pruebas obligatorias contra el servidor real.
// Uso: npm test   (arranca el servidor solo en un puerto de prueba)
const app = require('../src/app');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;

const casos = [
  { n: 1, desc: 'Landing, 1 página, sin extras', body: { tipo: 'landing', paginas: 1, formulario: false, segundoIdioma: false }, estado: 200, total: 300 },
  { n: 2, desc: 'Corporativa, 4 páginas, formulario, sin 2º idioma', body: { tipo: 'corporativa', paginas: 4, formulario: true, segundoIdioma: false }, estado: 200, total: 830 },
  { n: 3, desc: 'Landing, 2 páginas, ambos extras', body: { tipo: 'landing', paginas: 2, formulario: true, segundoIdioma: true }, estado: 200, total: 580 },
  { n: 4, desc: 'Landing, 20 páginas, sin extras', body: { tipo: 'landing', paginas: 20, formulario: false, segundoIdioma: false }, estado: 200, total: 1250 },
  { n: 5, desc: 'paginas: 0', body: { tipo: 'landing', paginas: 0, formulario: false, segundoIdioma: false }, estado: 400 },
  { n: 6, desc: 'paginas: 21', body: { tipo: 'landing', paginas: 21, formulario: false, segundoIdioma: false }, estado: 400 },
  { n: 7, desc: 'paginas: 2.5', body: { tipo: 'landing', paginas: 2.5, formulario: false, segundoIdioma: false }, estado: 400 },
  { n: 8, desc: 'tipo: "tienda"', body: { tipo: 'tienda', paginas: 2, formulario: false, segundoIdioma: false }, estado: 400 },
  { n: 9, desc: 'formulario: "false"', body: { tipo: 'landing', paginas: 2, formulario: 'false', segundoIdioma: false }, estado: 400 },
  // Extras (no obligatorios, demuestran robustez)
  { n: 10, desc: 'paginas: "4" (cadena)', body: { tipo: 'landing', paginas: '4', formulario: false, segundoIdioma: false }, estado: 400 },
  { n: 11, desc: 'Falta segundoIdioma', body: { tipo: 'landing', paginas: 2, formulario: false }, estado: 400 },
  { n: 12, desc: 'Intenta imponer total: 1 (se ignora)', body: { tipo: 'landing', paginas: 1, formulario: false, segundoIdioma: false, total: 1, base: 0 }, estado: 200, total: 300 }
];

async function main() {
  const server = app.listen(PORT);
  let fallos = 0;

  try {
    const estado = await fetch(`${URL}/api/estado`);
    console.log(`GET /api/estado   → ${estado.status}`, JSON.stringify(await estado.json()));
    const tarifas = await fetch(`${URL}/api/tarifas`);
    console.log(`GET /api/tarifas  → ${tarifas.status}`, JSON.stringify(await tarifas.json()));
    console.log('');

    for (const c of casos) {
      const res = await fetch(`${URL}/api/presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.body)
      });
      const datos = await res.json();
      const ok = res.status === c.estado && (c.total === undefined || datos.total === c.total);
      if (!ok) fallos++;
      console.log(`${ok ? '[OK]   ' : '[FALLO]'} Caso ${c.n}: ${c.desc}`);
      console.log(`   Esperado: ${c.estado}${c.total !== undefined ? ' · total ' + c.total : ''} | Obtenido: ${res.status}`, JSON.stringify(datos));
    }
  } finally {
    // Cerramos las conexiones abiertas y esperamos a que el servidor se apague
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${fallos === 0 ? 'Resultado: todas las pruebas pasan' : fallos + ' prueba(s) fallan'}`);
  // Sin process.exit(): dejamos que Node termine solo (evita un fallo de Node en Windows)
  process.exitCode = fallos === 0 ? 0 : 1;
}

main();
