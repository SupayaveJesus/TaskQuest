const db = require("../config/database");

// Crear actividad
const create = (actividad) => {
  const {
    titulo,
    descripcion,
    recurrente,
    frecuencia,
    fecha,
    usuario_id,
    proyecto_id,
    asignado_usuario_id,
    zona_horaria,
  } = actividad;

  const sql = `
    INSERT INTO actividades
    (titulo, descripcion, recurrente, frecuencia, fecha, usuario_id, proyecto_id, asignado_usuario_id, zona_horaria)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.run(
      sql,
      [
        titulo,
        descripcion ?? null,
        recurrente ?? 0,
        frecuencia ?? null,
        fecha ?? null,
        usuario_id,
        proyecto_id ?? null,
        asignado_usuario_id ?? null,
        zona_horaria ?? null,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      },
    );
  });
};

// Obtener actividades creadas por el usuario o asignadas a él
const findByUser = (userId) => {
  const sql = `
    SELECT *
    FROM actividades
      WHERE (proyecto_id IS NULL AND (usuario_id = ? OR asignado_usuario_id = ?))
         OR (proyecto_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM proyecto_usuarios pu
           WHERE pu.proyecto_id = actividades.proyecto_id AND pu.usuario_id = ?
         ))
    ORDER BY id DESC
  `;

  return new Promise((resolve, reject) => {
    db.all(sql, [userId, userId, userId], (err, actividades) => {
      if (err) return reject(err);
      resolve(actividades);
    });
  });
};

// Buscar actividad por ID y creador
const findById = (id, userId) => {
  const sql = `
    SELECT *
    FROM actividades
    WHERE id = ? AND usuario_id = ?
  `;

  return new Promise((resolve, reject) => {
    db.get(sql, [id, userId], (err, actividad) => {
      if (err) return reject(err);
      resolve(actividad || null);
    });
  });
};

// Buscar actividad por ID si el usuario es creador o asignado
const findAccessibleById = (id, userId) => {
  const sql = `
    SELECT *
    FROM actividades
    WHERE id = ?
      AND (
        (proyecto_id IS NULL AND (usuario_id = ? OR asignado_usuario_id = ?))
        OR (proyecto_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM proyecto_usuarios pu
          WHERE pu.proyecto_id = actividades.proyecto_id AND pu.usuario_id = ?
        ))
      )
  `;

  return new Promise((resolve, reject) => {
    db.get(sql, [id, userId, userId, userId], (err, actividad) => {
      if (err) return reject(err);
      resolve(actividad || null);
    });
  });
};

const findByIdForAssignment = (id) => {
  const sql = `
    SELECT *
    FROM actividades
    WHERE id = ?
  `;

  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err, actividad) => {
      if (err) return reject(err);
      resolve(actividad || null);
    });
  });
};

const updateAssignment = (id, projectId, actorUserId, asignadoUsuarioId) => {
  /* La asignación solo se escribe si la autorización sigue vigente. */
  return db.runAsync(
    `
      UPDATE actividades
      SET asignado_usuario_id = ?
      WHERE id = ?
        AND proyecto_id = ?
        AND EXISTS (
          SELECT 1
          FROM proyectos
          WHERE id = actividades.proyecto_id
            AND creador_id = ?
        )
        AND (
          ? IS NULL
          OR EXISTS (
            SELECT 1
            FROM proyecto_usuarios
            WHERE proyecto_id = actividades.proyecto_id
              AND usuario_id = ?
          )
        )
    `,
    [
      asignadoUsuarioId,
      id,
      projectId,
      actorUserId,
      asignadoUsuarioId,
      asignadoUsuarioId,
    ],
  );
};

const update = (id, userId, actividad) => {
  const { titulo, descripcion, recurrente, frecuencia, fecha, zona_horaria } = actividad;

  const sql = `
    UPDATE actividades
    SET titulo = ?,
        descripcion = ?,
        recurrente = ?,
        frecuencia = ?,
        fecha = ?,
        zona_horaria = ?
    WHERE id = ? AND usuario_id = ?
      AND (proyecto_id IS NULL OR EXISTS (
        SELECT 1 FROM proyecto_usuarios pu
        WHERE pu.proyecto_id = actividades.proyecto_id AND pu.usuario_id = ?
      ))
  `;

  return new Promise((resolve, reject) => {
    db.run(
      sql,
      [titulo, descripcion, recurrente, frecuencia, fecha, zona_horaria ?? null, id, userId, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      },
    );
  });
};

const remove = (id, userId) => {
  const sql = `
    DELETE FROM actividades
    WHERE id = ? AND usuario_id = ?
      AND (proyecto_id IS NULL OR EXISTS (
        SELECT 1 FROM proyecto_usuarios pu
        WHERE pu.proyecto_id = actividades.proyecto_id AND pu.usuario_id = ?
      ))
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, [id, userId, userId], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

module.exports = {
  create,
  findByUser,
  findById,
  findAccessibleById,
  findByIdForAssignment,
  updateAssignment,
  update,
  remove,
};
