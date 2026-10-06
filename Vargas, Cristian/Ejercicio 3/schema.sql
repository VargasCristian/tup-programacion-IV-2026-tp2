-- Creacion de la base de datos para el Ejercicio 3
CREATE DATABASE IF NOT EXISTS db_calificaciones
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_calificaciones;

-- Tabla independiente de materias
CREATE TABLE IF NOT EXISTS materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de calificaciones con relacion foranea hacia materias
CREATE TABLE IF NOT EXISTS calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno VARCHAR(100) NOT NULL,
  alumno_normalizado VARCHAR(100) NOT NULL,
  materia_id INT NOT NULL,
  nota1 DECIMAL(4, 2) NOT NULL,
  nota2 DECIMAL(4, 2) NOT NULL,
  nota3 DECIMAL(4, 2) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calificaciones_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_alumno_materia
    UNIQUE (alumno_normalizado, materia_id)
);

-- Insercion de materias iniciales
INSERT INTO materias (id, nombre) VALUES
  (1, 'Programacion IV'),
  (2, 'Base de Datos'),
  (3, 'Metodologia de Sistemas')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Insercion de calificaciones de prueba iniciales
INSERT INTO calificaciones (alumno, alumno_normalizado, materia_id, nota1, nota2, nota3) VALUES
  ('Cristian Vargas', 'cristian vargas', 1, 8.50, 9.00, 8.00),
  ('Juan Perez', 'juan perez', 1, 6.00, 7.00, 6.50),
  ('Maria Gomez', 'maria gomez', 2, 9.00, 9.50, 10.00);
