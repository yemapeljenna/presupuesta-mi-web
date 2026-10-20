// Tarifas oficiales del servidor.
// Object.freeze impide que se modifiquen en tiempo de ejecución.
const TARIFAS = Object.freeze({
  landing: 300,          // Landing, incluida la primera página
  corporativa: 600,      // Web corporativa, incluida la primera página
  paginaAdicional: 50,   // Cada página adicional a la primera
  formulario: 80,        // Formulario de contacto
  segundoIdioma: 150,    // Segundo idioma
  moneda: 'EUR'
});

module.exports = TARIFAS;
