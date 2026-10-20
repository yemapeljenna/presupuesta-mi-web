const express = require('express');
const TARIFAS = require('./tarifas');
const validarSolicitud = require('./validacion');
const calcularPresupuesto = require('./calculo');

const app = express();

// Permite que la interfaz (React u otra web) consuma la API desde otro puerto
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Lee cuerpos JSON
app.use(express.json());

// GET /api/estado → comprueba que el servicio funciona
app.get('/api/estado', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/tarifas → publica las tarifas del servidor
app.get('/api/tarifas', (req, res) => {
  res.json({
    tarifas: [
      { concepto: 'landing', descripcion: 'Landing, incluida la primera página', precio: TARIFAS.landing },
      { concepto: 'corporativa', descripcion: 'Web corporativa, incluida la primera página', precio: TARIFAS.corporativa },
      { concepto: 'paginaAdicional', descripcion: 'Cada página adicional a la primera', precio: TARIFAS.paginaAdicional },
      { concepto: 'formulario', descripcion: 'Formulario de contacto', precio: TARIFAS.formulario },
      { concepto: 'segundoIdioma', descripcion: 'Segundo idioma', precio: TARIFAS.segundoIdioma }
    ],
    moneda: TARIFAS.moneda
  });
});

// POST /api/presupuesto → valida y calcula
app.post('/api/presupuesto', (req, res) => {
  // La petición debe enviarse como JSON
  if (!req.is('application/json')) {
    return res.status(400).json({
      error: 'Solicitud no válida',
      campos: [],
      detalles: ['La petición debe usar la cabecera Content-Type: application/json.']
    });
  }

  const resultado = validarSolicitud(req.body);
  if (!resultado.ok) {
    // Datos incorrectos → 400 y NO se calcula nada
    return res.status(400).json({
      error: 'Solicitud no válida',
      campos: resultado.campos,
      detalles: resultado.errores
    });
  }

  // Solo llegan aquí los datos limpios y validados
  const presupuesto = calcularPresupuesto(resultado.datos);
  res.status(200).json(presupuesto);
});

// JSON mal escrito (por ejemplo, falta una llave) → 400
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Solicitud no válida', campos: [], detalles: ['El JSON enviado no es válido.'] });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Rutas que no existen → 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

module.exports = app;
