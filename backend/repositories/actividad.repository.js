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
  } = actividad;

  const sql = `
    INSERT INTO actividades
    (titulo, descripcion, recurrente, frecuencia, fecha, usuario_id, proyecto_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      },
    );
  });
};

// Obtener actividades de un usuario
const findByUser = (userId) => {
  const sql = `
    SELECT *
    FROM actividades
    WHERE usuario_id = ?
    ORDER BY id DESC
  `;

  return new Promise((resolve, reject) => {
    db.all(sql, [userId], (err, actividades) => {
      if (err) return reject(err);
      resolve(actividades);
    });
  });
};

// Buscar actividad por ID y usuario
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

const update = (id, userId, actividad) => {
  const { titulo, descripcion, recurrente, frecuencia, fecha } = actividad;

  const sql = `
    UPDATE actividades
    SET titulo = ?,
        descripcion = ?,
        recurrente = ?,
        frecuencia = ?,
        fecha = ?
    WHERE id = ? AND usuario_id = ?
  `;

  return new Promise((resolve, reject) => {
    db.run(
      sql,
      [titulo, descripcion, recurrente, frecuencia, fecha, id, userId],
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
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, [id, userId], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

module.exports = {
  create,
  findByUser,
  findById,
  update,
  remove,
};
