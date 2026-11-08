
const db = require("../config/database");

const registrarCumplimiento = (actividadId, usuarioId, fecha) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (err) => {
        if (err) return reject(err);

        const sql = `
          INSERT INTO actividad_cumplimientos
          (actividad_id, fecha, puntos)
          VALUES (?, ?, 10)
        `;

        db.run(sql, [actividadId, fecha], function (err) {
          if (err) return rollback(err);

          db.run(
            "UPDATE usuarios SET puntos = puntos + 10 WHERE id = ?",
            [usuarioId],
            function (err) {
              if (err || this.changes === 0) {
                return rollback(err || new Error("Usuario no encontrado"));
              }

              db.run("COMMIT", (err) => {
                if (err) return rollback(err);

                resolve({
                  actividad_id: actividadId,
                  fecha,
                  puntosGanados: 10
                });
              });
            }
          );
        });

        function rollback(error) {
          db.run("ROLLBACK", () => reject(error));
        }
      });
    });
  });
};

module.exports = { registrarCumplimiento };
