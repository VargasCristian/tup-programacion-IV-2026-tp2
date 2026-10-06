-- Creacion de la base de datos para el Ejercicio 2
CREATE DATABASE IF NOT EXISTS db_tareas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_tareas;

-- Tabla de tareas
CREATE TABLE IF NOT EXISTS tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nombre_normalizado VARCHAR(255) NOT NULL UNIQUE,
  completada BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Datos iniciales de prueba
INSERT INTO tareas (nombre, nombre_normalizado, completada) VALUES
  ('Preparar presentacion de Programacion IV', 'preparar presentacion de programacion iv', FALSE),
  ('Comprar insumos de libreria', 'comprar insumos de libreria', TRUE),
  ('Repasar conceptos de Express y MySQL', 'repasar conceptos de express y mysql', FALSE);
