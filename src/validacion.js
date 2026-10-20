// Valida el cuerpo de la petición POST /api/presupuesto.
// Devuelve { ok: true, datos } con SOLO los 4 campos válidos,
// o { ok: false, campos: [...], errores: [...] } si algo falla.

const TIPOS_VALIDOS = ['landing', 'corporativa'];
const CAMPOS_OBLIGATORIOS = ['tipo', 'paginas', 'formulario', 'segundoIdioma'];

function validarSolicitud(body) {
  // 1. El cuerpo tiene que ser un objeto (no null, no array, no texto)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, campos: [], errores: ['El cuerpo de la petición debe ser un objeto JSON.'] };
  }

  const errores = [];
  const campos = []; // nombres de los campos que fallan

  // 2. Los cuatro campos obligatorios deben existir
  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (!(campo in body)) {
      campos.push(campo);
      errores.push(`Falta el campo obligatorio "${campo}".`);
    }
  }
  if (errores.length > 0) return { ok: false, campos, errores };

  const { tipo, paginas, formulario, segundoIdioma } = body;

  // 3. tipo: solo "landing" o "corporativa"
  if (!TIPOS_VALIDOS.includes(tipo)) {
    campos.push('tipo');
    errores.push('El campo "tipo" debe ser "landing" o "corporativa".');
  }

  // 4. paginas: número entero entre 1 y 20 (la cadena "4" NO vale)
  if (typeof paginas !== 'number' || !Number.isInteger(paginas) || paginas < 1 || paginas > 20) {
    campos.push('paginas');
    errores.push('El campo "paginas" debe ser un número entero entre 1 y 20.');
  }

  // 5. formulario y segundoIdioma: booleanos de verdad (la cadena "false" NO vale)
  if (typeof formulario !== 'boolean') {
    campos.push('formulario');
    errores.push('El campo "formulario" debe ser un booleano (true o false).');
  }
  if (typeof segundoIdioma !== 'boolean') {
    campos.push('segundoIdioma');
    errores.push('El campo "segundoIdioma" debe ser un booleano (true o false).');
  }

  if (errores.length > 0) return { ok: false, campos, errores };

  // Devolvemos solo los campos permitidos: cualquier propiedad extra
  // (por ejemplo "total" o "precio") se ignora.
  return { ok: true, datos: { tipo, paginas, formulario, segundoIdioma } };
}

module.exports = validarSolicitud;
