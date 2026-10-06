const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Criterio de normalizacion de nombres consistente:
// 1. Elimina espacios sobrantes en extremos (trim)
// 2. Convierte todo a minusculas (toLowerCase)
// 3. Colapsa multiples espacios intermedios en un solo espacio
const normalizarNombre = (texto) => {
  if (typeof texto !== 'string') return '';
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
};

// Middleware para procesar y responder con errores de express-validator
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

// Reglas de validacion para el parametro de filtrado por consulta
const validacionesConsultaFiltro = [
  query('estado')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(['completadas', 'pendientes', 'todas'])
    .withMessage('El parametro "estado" debe ser uno de los admitidos: "completadas", "pendientes" o "todas"'),

  query('completada')
    .optional()
    .isBoolean()
    .withMessage('El parametro "completada" debe ser un valor booleano valido ("true" o "false")')
];

// Regla de validacion para ID en parametros de ruta
const validacionId = [
  param('id')
    .isInt({ min: 1 }).withMessage('El parametro "id" debe ser un numero entero positivo mayor o igual a 1')
    .toInt()
];

// Reglas de validacion para creacion de tareas (POST)
const validacionesCrearTarea = [
  body('nombre')
    .exists({ checkFalsy: false }).withMessage('El campo "nombre" es obligatorio')
    .isString().withMessage('El campo "nombre" debe ser una cadena de texto')
    .trim()
    .notEmpty().withMessage('El campo "nombre" no puede estar vacio ni contener solo espacios')
    .isLength({ min: 3, max: 255 }).withMessage('El campo "nombre" debe tener entre 3 y 255 caracteres'),

  body('completada')
    .optional()
    .isBoolean().withMessage('El campo "completada" debe ser un valor booleano (true o false)')
];

// Reglas de validacion para modificacion de tareas (PUT)
const validacionesModificarTarea = [
  ...validacionId,
  body('nombre')
    .exists({ checkFalsy: false }).withMessage('El campo "nombre" es obligatorio')
    .isString().withMessage('El campo "nombre" debe ser una cadena de texto')
    .trim()
    .notEmpty().withMessage('El campo "nombre" no puede estar vacio')
    .isLength({ min: 3, max: 255 }).withMessage('El campo "nombre" debe tener entre 3 y 255 caracteres'),

  body('completada')
    .exists().withMessage('El campo "completada" es obligatorio')
    .isBoolean().withMessage('El campo "completada" debe ser un valor booleano (true o false)')
];

// Reglas para actualizacion parcial de estado (PATCH)
const validacionesPatchEstado = [
  ...validacionId,
  body('completada')
    .exists().withMessage('El campo "completada" es obligatorio para cambiar el estado')
    .isBoolean().withMessage('El campo "completada" debe ser booleano (true o false)')
];

// Ruta inicial
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API de gestion de tareas con Express y MySQL',
    recurso: '/tareas',
    filtrosDisponibles: ['?estado=completadas', '?estado=pendientes', '?estado=todas', '?completada=true', '?completada=false'],
    metodos: ['GET /tareas', 'GET /tareas/:id', 'POST /tareas', 'PUT /tareas/:id', 'PATCH /tareas/:id', 'DELETE /tareas/:id']
  });
});

// 1. GET /tareas - Listar tareas con soporte de filtrado por estado
app.get('/tareas', validacionesConsultaFiltro, verificarErroresValidacion, async (req, res) => {
  const { estado, completada } = req.query;

  try {
    let sql = 'SELECT * FROM tareas';
    const params = [];

    // Filtro por parametro "estado"
    if (estado) {
      const estadoLimpio = estado.trim().toLowerCase();
      if (estadoLimpio === 'completadas') {
        sql += ' WHERE completada = TRUE';
      } else if (estadoLimpio === 'pendientes') {
        sql += ' WHERE completada = FALSE';
      }
    }
    // Filtro por parametro "completada" (si no se uso "estado")
    else if (completada !== undefined) {
      const valorBool = (completada === 'true' || completada === true);
      sql += ' WHERE completada = ?';
      params.push(valorBool);
    }

    sql += ' ORDER BY id ASC';

    const [filas] = await pool.query(sql, params);

    return res.json({
      exito: true,
      filtroAplicado: estado || completada || 'todas',
      total: filas.length,
      datos: filas
    });
  } catch (error) {
    console.error('Error al consultar tareas:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar las tareas'
    });
  }
});

// 2. GET /tareas/:id - Obtener una tarea especifica por ID
app.get('/tareas/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const [filas] = await pool.query('SELECT * FROM tareas WHERE id = ?', [id]);

    if (filas.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna tarea con el ID ${id}`
      });
    }

    return res.json({
      exito: true,
      datos: filas[0]
    });
  } catch (error) {
    console.error('Error al obtener tarea por ID:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar la tarea'
    });
  }
});

// 3. POST /tareas - Crear una nueva tarea con validacion de unicidad de nombre
app.post('/tareas', validacionesCrearTarea, verificarErroresValidacion, async (req, res) => {
  const { nombre, completada = false } = req.body;
  const nombreLimpio = nombre.trim();
  const nombreNorm = normalizarNombre(nombreLimpio);

  try {
    // Verificar si ya existe una tarea con el mismo nombre normalizado
    const [existentes] = await pool.query(
      'SELECT id, nombre FROM tareas WHERE nombre_normalizado = ?',
      [nombreNorm]
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        exito: false,
        mensaje: `Ya existe una tarea con el nombre "${existentes[0].nombre}". El nombre debe ser unico independientemente de mayusculas, minusculas o espacios.`
      });
    }

    const consulta = `
      INSERT INTO tareas (nombre, nombre_normalizado, completada)
      VALUES (?, ?, ?)
    `;
    const [resultado] = await pool.query(consulta, [nombreLimpio, nombreNorm, Boolean(completada)]);

    return res.status(201).json({
      exito: true,
      mensaje: 'Tarea creada exitosamente',
      datos: {
        id: resultado.insertId,
        nombre: nombreLimpio,
        nombre_normalizado: nombreNorm,
        completada: Boolean(completada)
      }
    });
  } catch (error) {
    console.error('Error al crear tarea:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al crear la tarea'
    });
  }
});

// 4. PUT /tareas/:id - Modificar nombre y estado de una tarea existente
app.put('/tareas/:id', validacionesModificarTarea, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;
  const { nombre, completada } = req.body;
  const nombreLimpio = nombre.trim();
  const nombreNorm = normalizarNombre(nombreLimpio);

  try {
    // 1. Verificar existencia de la tarea a modificar
    const [tareaActual] = await pool.query('SELECT * FROM tareas WHERE id = ?', [id]);
    if (tareaActual.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna tarea con el ID ${id} para modificar`
      });
    }

    // 2. Verificar que el nuevo nombre no pertenezca a OTRA tarea
    const [duplicados] = await pool.query(
      'SELECT id, nombre FROM tareas WHERE nombre_normalizado = ? AND id != ?',
      [nombreNorm, id]
    );

    if (duplicados.length > 0) {
      return res.status(409).json({
        exito: false,
        mensaje: `No es posible actualizar la tarea: ya existe otra tarea registrada con el nombre "${duplicados[0].nombre}".`
      });
    }

    // 3. Ejecutar actualizacion
    const consulta = `
      UPDATE tareas
      SET nombre = ?, nombre_normalizado = ?, completada = ?
      WHERE id = ?
    `;
    await pool.query(consulta, [nombreLimpio, nombreNorm, Boolean(completada), id]);

    return res.json({
      exito: true,
      mensaje: 'Tarea actualizada exitosamente',
      datos: {
        id: Number(id),
        nombre: nombreLimpio,
        nombre_normalizado: nombreNorm,
        completada: Boolean(completada)
      }
    });
  } catch (error) {
    console.error('Error al actualizar tarea:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al actualizar la tarea'
    });
  }
});

// 5. PATCH /tareas/:id - Modificar unicamente el estado de la tarea (completada / pendiente)
app.patch('/tareas/:id', validacionesPatchEstado, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;
  const { completada } = req.body;

  try {
    const [resultado] = await pool.query(
      'UPDATE tareas SET completada = ? WHERE id = ?',
      [Boolean(completada), id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna tarea con el ID ${id} para actualizar su estado`
      });
    }

    return res.json({
      exito: true,
      mensaje: `Estado de la tarea actualizado a: ${completada ? 'completada' : 'pendiente'}`,
      datos: {
        id: Number(id),
        completada: Boolean(completada)
      }
    });
  } catch (error) {
    console.error('Error al actualizar estado de tarea:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al cambiar el estado de la tarea'
    });
  }
});

// 6. DELETE /tareas/:id - Eliminar una tarea por ID
app.delete('/tareas/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await pool.query('DELETE FROM tareas WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna tarea con el ID ${id} para eliminar`
      });
    }

    return res.json({
      exito: true,
      mensaje: `Tarea con ID ${id} eliminada correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar tarea:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al eliminar la tarea'
    });
  }
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor del Ejercicio 2 escuchando en el puerto ${PORT}`);
});
