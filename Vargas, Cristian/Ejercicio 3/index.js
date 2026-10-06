const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Criterio de normalizacion de texto (alumno) para garantizar comparaciones consistentes
const normalizarTexto = (texto) => {
  if (typeof texto !== 'string') return '';
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
};

// Escala academica universitaria: notas de 1.00 a 10.00
const NOTA_MINIMA = 1.0;
const NOTA_MAXIMA = 10.0;

// Calculo de datos derivados (promedio y condicion academica)
const calcularPromedioYCondicion = (n1, n2, n3) => {
  const promedio = Number(((n1 + n2 + n3) / 3).toFixed(2));
  let condicion = 'reprobado';
  if (promedio >= 8.0) {
    condicion = 'promocionado';
  } else if (promedio >= 6.0) {
    condicion = 'aprobado';
  }
  return { promedio, condicion };
};

// Formatea la salida de un registro de calificacion agregando datos derivados
const formatearRegistroCalificacion = (registro) => {
  const n1 = Number(registro.nota1);
  const n2 = Number(registro.nota2);
  const n3 = Number(registro.nota3);
  const { promedio, condicion } = calcularPromedioYCondicion(n1, n2, n3);

  return {
    id: registro.id,
    alumno: registro.alumno,
    materia: {
      id: registro.materia_id,
      nombre: registro.materia_nombre || registro.materia || undefined
    },
    notas: [n1, n2, n3],
    detalleNotas: {
      nota1: n1,
      nota2: n2,
      nota3: n3
    },
    promedio,
    condicion,
    creado_en: registro.creado_en,
    actualizado_en: registro.actualizado_en
  };
};

// Middleware para verificar errores de express-validator
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

// Validacion de ID en parametros de ruta
const validacionId = [
  param('id')
    .isInt({ min: 1 }).withMessage('El parametro "id" debe ser un entero positivo mayor o igual a 1')
    .toInt()
];

// Validaciones para gestion de materias
const validacionesMateria = [
  body('nombre')
    .exists({ checkFalsy: false }).withMessage('El campo "nombre" de la materia es obligatorio')
    .isString().withMessage('El campo "nombre" debe ser una cadena de texto')
    .trim()
    .notEmpty().withMessage('El campo "nombre" de la materia no puede estar vacio')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre de la materia debe tener entre 3 y 100 caracteres')
];

// Middleware custom para procesar y validar las tres notas (acepta objeto con nota1, nota2, nota3 o arreglo "notas")
const middlewareAdaptarNotas = (req, res, next) => {
  // Si viene un array "notas", mapearlo a nota1, nota2, nota3
  if (Array.isArray(req.body.notas)) {
    if (req.body.notas.length !== 3) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El arreglo "notas" debe contener exactamente tres (3) valores numericos.'
      });
    }
    req.body.nota1 = req.body.notas[0];
    req.body.nota2 = req.body.notas[1];
    req.body.nota3 = req.body.notas[2];
  }
  next();
};

// Validaciones para calificaciones (POST y PUT)
const validacionesCalificacion = [
  body('alumno')
    .exists({ checkFalsy: false }).withMessage('El nombre del alumno es obligatorio')
    .isString().withMessage('El nombre del alumno debe ser una cadena de texto')
    .trim()
    .notEmpty().withMessage('El nombre del alumno no puede estar vacio')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre del alumno debe tener entre 3 y 100 caracteres'),

  body('materia_id')
    .exists({ checkFalsy: false }).withMessage('El campo "materia_id" es obligatorio')
    .isInt({ min: 1 }).withMessage('El campo "materia_id" debe ser un numero entero positivo correspondiente a una materia existente')
    .toInt(),

  body('nota1')
    .exists({ checkFalsy: false }).withMessage('La primera nota ("nota1") es obligatoria')
    .isFloat({ min: NOTA_MINIMA, max: NOTA_MAXIMA }).withMessage(`La "nota1" debe ser un numero entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}`)
    .toFloat(),

  body('nota2')
    .exists({ checkFalsy: false }).withMessage('La segunda nota ("nota2") es obligatoria')
    .isFloat({ min: NOTA_MINIMA, max: NOTA_MAXIMA }).withMessage(`La "nota2" debe ser un numero entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}`)
    .toFloat(),

  body('nota3')
    .exists({ checkFalsy: false }).withMessage('La tercera nota ("nota3") es obligatoria')
    .isFloat({ min: NOTA_MINIMA, max: NOTA_MAXIMA }).withMessage(`La "nota3" debe ser un numero entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}`)
    .toFloat()
];

// Ruta inicial
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API de gestion de calificaciones y materias universitarias',
    recursos: {
      materias: '/materias',
      calificaciones: '/calificaciones'
    },
    escalaNotas: 'De 1.00 a 10.00 (exactamente 3 notas)',
    criterioCondicion: {
      promocionado: 'Promedio >= 8.00',
      aprobado: '6.00 <= Promedio < 8.00',
      reprobado: 'Promedio < 6.00'
    }
  });
});

// ==========================================
// ENDPOINTS DE MATERIAS
// ==========================================

// GET /materias - Listar todas las materias disponibles
app.get('/materias', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM materias ORDER BY id ASC');
    return res.json({
      exito: true,
      total: filas.length,
      datos: filas
    });
  } catch (error) {
    console.error('Error al consultar materias:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar materias'
    });
  }
});

// POST /materias - Crear una nueva materia
app.post('/materias', validacionesMateria, verificarErroresValidacion, async (req, res) => {
  const { nombre } = req.body;
  const nombreLimpio = nombre.trim();

  try {
    const [existente] = await pool.query('SELECT id FROM materias WHERE LOWER(nombre) = LOWER(?)', [nombreLimpio]);
    if (existente.length > 0) {
      return res.status(409).json({
        exito: false,
        mensaje: `Ya existe una materia registrada con el nombre "${nombreLimpio}"`
      });
    }

    const [resultado] = await pool.query('INSERT INTO materias (nombre) VALUES (?)', [nombreLimpio]);
    return res.status(201).json({
      exito: true,
      mensaje: 'Materia registrada exitosamente',
      datos: {
        id: resultado.insertId,
        nombre: nombreLimpio
      }
    });
  } catch (error) {
    console.error('Error al registrar materia:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al registrar la materia'
    });
  }
});

// ==========================================
// ENDPOINTS DE CALIFICACIONES
// ==========================================

// 1. GET /calificaciones - Listar calificaciones con informacion de la materia asociada (JOIN)
app.get(
  '/calificaciones',
  [
    query('materia_id').optional().isInt({ min: 1 }).withMessage('El filtro "materia_id" debe ser un entero positivo').toInt(),
    query('alumno').optional().isString().trim()
  ],
  verificarErroresValidacion,
  async (req, res) => {
    const { materia_id, alumno } = req.query;

    try {
      let sql = `
        SELECT c.*, m.nombre AS materia_nombre
        FROM calificaciones c
        INNER JOIN materias m ON c.materia_id = m.id
      `;
      const params = [];
      const condiciones = [];

      if (materia_id) {
        condiciones.push('c.materia_id = ?');
        params.push(materia_id);
      }

      if (alumno) {
        condiciones.push('c.alumno_normalizado LIKE ?');
        params.push(`%${normalizarTexto(alumno)}%`);
      }

      if (condiciones.length > 0) {
        sql += ' WHERE ' + condiciones.join(' AND ');
      }

      sql += ' ORDER BY c.id ASC';

      const [filas] = await pool.query(sql, params);
      const resultado = filas.map(formatearRegistroCalificacion);

      return res.json({
        exito: true,
        total: resultado.length,
        datos: resultado
      });
    } catch (error) {
      console.error('Error al listar calificaciones:', error.message);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor al consultar calificaciones'
      });
    }
  }
);

// 2. GET /calificaciones/:id - Obtener calificacion por ID
app.get('/calificaciones/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      SELECT c.*, m.nombre AS materia_nombre
      FROM calificaciones c
      INNER JOIN materias m ON c.materia_id = m.id
      WHERE c.id = ?
    `;
    const [filas] = await pool.query(sql, [id]);

    if (filas.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna calificacion con el ID ${id}`
      });
    }

    return res.json({
      exito: true,
      datos: formatearRegistroCalificacion(filas[0])
    });
  } catch (error) {
    console.error('Error al obtener calificacion por ID:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al consultar la calificacion'
    });
  }
});

// 3. POST /calificaciones - Registrar calificacion para un alumno en una materia
app.post(
  '/calificaciones',
  middlewareAdaptarNotas,
  validacionesCalificacion,
  verificarErroresValidacion,
  async (req, res) => {
    const { alumno, materia_id, nota1, nota2, nota3 } = req.body;
    const alumnoLimpio = alumno.trim();
    const alumnoNorm = normalizarTexto(alumnoLimpio);

    try {
      // 1. Verificar existencia de la materia
      const [materiaExiste] = await pool.query('SELECT id, nombre FROM materias WHERE id = ?', [materia_id]);
      if (materiaExiste.length === 0) {
        return res.status(404).json({
          exito: false,
          mensaje: `La materia con ID ${materia_id} no existe en el sistema`
        });
      }

      // 2. Verificar regla de unicidad alumno-materia
      const [registroDuplicado] = await pool.query(
        'SELECT id FROM calificaciones WHERE alumno_normalizado = ? AND materia_id = ?',
        [alumnoNorm, materia_id]
      );

      if (registroDuplicado.length > 0) {
        return res.status(409).json({
          exito: false,
          mensaje: `Ya existe un registro para el alumno "${alumnoLimpio}" en la materia "${materiaExiste[0].nombre}". Cada alumno solo puede tener un registro por materia.`
        });
      }

      // 3. Insertar calificacion
      const sqlInsert = `
        INSERT INTO calificaciones (alumno, alumno_normalizado, materia_id, nota1, nota2, nota3)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [resultado] = await pool.query(sqlInsert, [
        alumnoLimpio,
        alumnoNorm,
        materia_id,
        nota1,
        nota2,
        nota3
      ]);

      const { promedio, condicion } = calcularPromedioYCondicion(nota1, nota2, nota3);

      return res.status(201).json({
        exito: true,
        mensaje: 'Calificaciones registradas exitosamente',
        datos: {
          id: resultado.insertId,
          alumno: alumnoLimpio,
          materia: {
            id: materia_id,
            nombre: materiaExiste[0].nombre
          },
          notas: [nota1, nota2, nota3],
          promedio,
          condicion
        }
      });
    } catch (error) {
      console.error('Error al registrar calificaciones:', error.message);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor al registrar las calificaciones'
      });
    }
  }
);

// 4. PUT /calificaciones/:id - Modificar notas o datos de una calificacion
app.put(
  '/calificaciones/:id',
  validacionId,
  middlewareAdaptarNotas,
  validacionesCalificacion,
  verificarErroresValidacion,
  async (req, res) => {
    const { id } = req.params;
    const { alumno, materia_id, nota1, nota2, nota3 } = req.body;
    const alumnoLimpio = alumno.trim();
    const alumnoNorm = normalizarTexto(alumnoLimpio);

    try {
      // 1. Verificar si existe la calificacion
      const [califExistente] = await pool.query('SELECT * FROM calificaciones WHERE id = ?', [id]);
      if (califExistente.length === 0) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontro ninguna calificacion con el ID ${id} para modificar`
        });
      }

      // 2. Verificar existencia de la materia
      const [materiaExiste] = await pool.query('SELECT id, nombre FROM materias WHERE id = ?', [materia_id]);
      if (materiaExiste.length === 0) {
        return res.status(404).json({
          exito: false,
          mensaje: `La materia con ID ${materia_id} no existe en el sistema`
        });
      }

      // 3. Verificar que no choque la combinacion alumno-materia con OTRO registro distinto
      const [duplicados] = await pool.query(
        'SELECT id FROM calificaciones WHERE alumno_normalizado = ? AND materia_id = ? AND id != ?',
        [alumnoNorm, materia_id, id]
      );

      if (duplicados.length > 0) {
        return res.status(409).json({
          exito: false,
          mensaje: `No se puede modificar: ya existe otro registro para el alumno "${alumnoLimpio}" en la materia "${materiaExiste[0].nombre}".`
        });
      }

      // 4. Actualizar registro
      const sqlUpdate = `
        UPDATE calificaciones
        SET alumno = ?, alumno_normalizado = ?, materia_id = ?, nota1 = ?, nota2 = ?, nota3 = ?
        WHERE id = ?
      `;
      await pool.query(sqlUpdate, [alumnoLimpio, alumnoNorm, materia_id, nota1, nota2, nota3, id]);

      const { promedio, condicion } = calcularPromedioYCondicion(nota1, nota2, nota3);

      return res.json({
        exito: true,
        mensaje: 'Calificacion actualizada exitosamente',
        datos: {
          id: Number(id),
          alumno: alumnoLimpio,
          materia: {
            id: materia_id,
            nombre: materiaExiste[0].nombre
          },
          notas: [nota1, nota2, nota3],
          promedio,
          condicion
        }
      });
    } catch (error) {
      console.error('Error al actualizar calificacion:', error.message);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor al actualizar la calificacion'
      });
    }
  }
);

// 5. DELETE /calificaciones/:id - Eliminar calificacion
app.delete('/calificaciones/:id', validacionId, verificarErroresValidacion, async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await pool.query('DELETE FROM calificaciones WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: `No se encontro ninguna calificacion con el ID ${id} para eliminar`
      });
    }

    return res.json({
      exito: true,
      mensaje: `Registro de calificacion con ID ${id} eliminado correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar calificacion:', error.message);
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor al eliminar la calificacion'
    });
  }
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor del Ejercicio 3 escuchando en el puerto ${PORT}`);
});
