
const db = require("../config/database");

const create = (nombre, correo, password) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO usuarios (nombre, correo, password)
      VALUES (?, ?, ?)
    `;

    db.run(sql, [nombre, correo, password], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
};


const searchEmail = (correo) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM usuarios WHERE correo = ?";

    db.get(sql, [correo], (err, user) => {
      if (err) return reject(err);
      resolve(user || null);
    });
  });
};


const searchId = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, nombre, correo, puntos
      FROM usuarios
      WHERE id = ?
    `;

    db.get(sql, [id], (err, user) => {
      if (err) return reject(err);
      resolve(user || null);
    });
  });
};

module.exports = {
  create,
  searchEmail,
  searchId,
};
