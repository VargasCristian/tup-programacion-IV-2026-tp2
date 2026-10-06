# Diagrama Entidad-Relación - Ejercicio 3: Calificaciones

El siguiente diagrama representa el modelo relacional implementado en MySQL para la gestión de alumnos, materias y calificaciones con clave foránea y regla de unicidad:

```mermaid
erDiagram
    MATERIAS ||--o{ CALIFICACIONES : "contiene (1 a N)"
    
    MATERIAS {
        int id PK "Identificador único (AUTO_INCREMENT)"
        varchar nombre UK "Nombre único de la materia"
        timestamp creado_en "Fecha de creación"
    }

    CALIFICACIONES {
        int id PK "Identificador único (AUTO_INCREMENT)"
        varchar alumno "Nombre completo del alumno"
        varchar alumno_normalizado "Nombre normalizado para unicidad"
        int materia_id FK "Clave foránea hacia materias.id"
        decimal nota1 "Primera nota (escala 1.00 a 10.00)"
        decimal nota2 "Segunda nota (escala 1.00 a 10.00)"
        decimal nota3 "Tercera nota (escala 1.00 a 10.00)"
        timestamp creado_en "Fecha de registro"
        timestamp actualizado_en "Fecha de última modificación"
    }
```

> **Regla de integridad y unicidad**:
> - Clave foránea: `calificaciones.materia_id` referencia a `materias.id` (`ON DELETE RESTRICT ON UPDATE CASCADE`).
> - Restricción de unicidad: `UNIQUE KEY (alumno_normalizado, materia_id)` para asegurar que ningún alumno posea registros repetidos en la misma materia.
>
> También se encuentra disponible en formato gráfico como `diagrama_er.png`.
