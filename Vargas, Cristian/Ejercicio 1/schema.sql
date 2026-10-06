-- Creacion de la base de datos para el Ejercicio 1
CREATE DATABASE IF NOT EXISTS db_rectangulos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_rectangulos;

-- Tabla de rectangulos
CREATE TABLE IF NOT EXISTS rectangulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lado1 DECIMAL(10, 2) NOT NULL,
  lado2 DECIMAL(10, 2) NOT NULL,
  perimetro DECIMAL(10, 2) NOT NULL,
  superficie DECIMAL(10, 2) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Datos iniciales de prueba
INSERT INTO rectangulos (lado1, lado2, perimetro, superficie) VALUES
  (5.00, 10.00, 30.00, 50.00),
  (3.50, 7.20, 21.40, 25.20),
  (4.00, 4.00, 16.00, 16.00);
