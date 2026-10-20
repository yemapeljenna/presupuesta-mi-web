const TARIFAS = require('./tarifas');

// Función de cálculo INDEPENDIENTE del manejador de la ruta.
// Recibe datos ya validados y aplica:
// Total = precio base + páginas adicionales + extras seleccionados
function calcularPresupuesto({ tipo, paginas, formulario, segundoIdioma }) {
  const base = TARIFAS[tipo];                                   // 300 o 600
  const paginasAdicionales = (paginas - 1) * TARIFAS.paginaAdicional; // la 1ª va incluida
  const costeFormulario = formulario ? TARIFAS.formulario : 0;
  const costeIdioma = segundoIdioma ? TARIFAS.segundoIdioma : 0;

  const total = base + paginasAdicionales + costeFormulario + costeIdioma;

  return {
    base,
    paginasAdicionales,
    formulario: costeFormulario,
    segundoIdioma: costeIdioma,
    total,
    moneda: TARIFAS.moneda
  };
}

module.exports = calcularPresupuesto;
