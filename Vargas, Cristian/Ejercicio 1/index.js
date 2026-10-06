const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Middleware para capturar y formatear los errores de express-validator
const verificarErroresValidacion = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      exito: false,
      mensaje: 'Errores de validacion en la solicitud',
      errores: errores.array().map(err => ({
        campo: err.path,
        mensaje: err.msg,
        valorRecibido: err.value
      }))
    });
  }
  next();
};

// Validaciones para lados del rectangulo
const validacionesLados = [
  body('lado1')
    .exists({ checkFalsy: false }).withMessage('El campo "lado1" es obligatorio')
    .isFloat({ gt: 0 }).withMessage('El campo "lado1" debe ser un numero mayor a 0')
    .toFloat(),

  body('lado2')
    .exists({ checkFalsy: false }).withMessage('El campo "lado2" es obligatorio')
    .isFloat({ gt: 0 }).withMessage('El campo "lado2" debe ser un numero mayor a 0')
    .toFloat(),

  // Rechazar explicitamente si el cliente intenta enviar perimetro o superficie
  body('perimetro')
    .not().exists().withMessage('El campo "perimetro" no debe ser enviado por el cliente; se calcula en el servidor'),

  body('superficie')
    .not().exists().withMessage('El campo "superficie" no debe ser enviado por el cliente; se calcula en el servidor')
];

// Validacion para el parametro id de la ruta
const validacionId = [
  param('id')
    .isInt({ min: 1 }).withMessage('El parametro "id" debe ser un numero entero positivo mayor o igual a 1')
    .toInt()
];

// Ruta raiz
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API para gestion y calculo de rectangulos',
    recurso: '/rectangulos',
    metodos: ['GET /rectangulos', 'GET /rectangulos/:id', 'POST /rectangulos', 'PUT /rectangulos/:id', 'DELETE /rectangulos/:id']
  });
});

// 1. GET /rectangulos - Listar todos los rectangulos
app.get('/rectangulos', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM rectangulos ORDER BY id ASC');
    return res.json({
      exito: true,
      total: filas.length,
      datos: filas
    });
  } catch (error) {
    console.error('Error al listar rectangulos:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar los rectangulos'
    });
  }
});

// 2. GET /rectangulos/:id - Obtener un rectangulo por ID
app.get('/rectangulos/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const [filas] = await pool.query('SELECT * FROM rectangulos WHERE id = ?', [id]);

    if (filas.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ningun rectangulo con el ID ${id}`
      });
    }

    return res.json({
      exito: true,
      datos: filas[0]
    });
  } catch (error) {
    console.error('Error al obtener rectangulo por ID:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar el rectangulo'
    });
  }
});

// 3. POST /rectangulos - Crear un nuevo rectangulo
app.post('/rectangulos', validacionesLados, verificarErroresValidacion, async (req, res) => {
  const { lado1, lado2 } = req.body;

  // Calculo en el servidor de perimetro y superficie
  const perimetro = Number((2 * (lado1 + lado2)).toFixed(2));
  const superficie = Number((lado1 * lado2).toFixed(2));

  try {
    const consulta = `
      INSERT INTO rectangulos (lado1, lado2, perimetro, superficie)
      VALUES (?, ?, ?, ?)
    `;
    const [resultado] = await pool.query(consulta, [lado1, lado2, perimetro, superficie]);

    return res.status(201).json({
      exito: true,
      mensaje: 'Rectangulo registrado y calculado exitosamente',
      datos: {
        id: resultado.insertId,
        lado1,
        lado2,
        perimetro,
        superficie
      }
    });
  } catch (error) {
    console.error('Error al registrar rectangulo:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al registrar el rectangulo'
    });
  }
});

// 4. PUT /rectangulos/:id - Modificar lados de un rectangulo existente
app.put('/rectangulos/:id', validacionId, validacionesLados, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;
  const { lado1, lado2 } = req.body;

  // Recalculo forzoso en el servidor
  const perimetro = Number((2 * (lado1 + lado2)).toFixed(2));
  const superficie = Number((lado1 * lado2).toFixed(2));

  try {
    const consulta = `
      UPDATE rectangulos
      SET lado1 = ?, lado2 = ?, perimetro = ?, superficie = ?
      WHERE id = ?
    `;
    const [resultado] = await pool.query(consulta, [lado1, lado2, perimetro, superficie, id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ningun rectangulo con el ID ${id} para actualizar`
      });
    }

    return res.json({
      exito: true,
      mensaje: 'Rectangulo actualizado y recalculado exitosamente',
      datos: {
        id: Number(id),
        lado1,
        lado2,
        perimetro,
        superficie
      }
    });
  } catch (error) {
    console.error('Error al actualizar rectangulo:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al actualizar el rectangulo'
    });
  }
});

// 5. DELETE /rectangulos/:id - Eliminar un rectangulo por ID
app.delete('/rectangulos/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await pool.query('DELETE FROM rectangulos WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ningun rectangulo con el ID ${id} para eliminar`
      });
    }

    return res.json({
      exito: true,
      mensaje: `Rectangulo con ID ${id} eliminado correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar rectangulo:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al eliminar el rectangulo'
    });
  }
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor del Ejercicio 1 escuchando en el puerto ${PORT}`);
});
