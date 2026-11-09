const db = require("../config/database");

const XP_PER_COMPLETION = 10;

const createRepositoryError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const registrarCumplimiento = (actividadId, usuarioId, fecha) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (beginError) => {
        if (beginError) {
          return reject(beginError);
        }

        const rollback = (error) => {
          db.run("ROLLBACK", () => reject(error));
        };

        const existingCompletionSql = `
          SELECT id
          FROM actividad_cumplimientos
          WHERE actividad_id = ?
          LIMIT 1
        `;

        db.get(
          existingCompletionSql,
          [actividadId],
          (existingError, existingCompletion) => {
            if (existingError) {
              return rollback(existingError);
            }

            if (existingCompletion) {
              return rollback(
                createRepositoryError(
                  "ACTIVITY_ALREADY_COMPLETED",
                  "La actividad ya fue completada",
                ),
              );
            }

            const updateActivitySql = `
              UPDATE actividades
              SET estado = 'completada'
              WHERE id = ?
                AND usuario_id = ?
                AND estado = 'pendiente'
                AND recurrente = 0
            `;

            db.run(
              updateActivitySql,
              [actividadId, usuarioId],
              function (activityError) {
                if (activityError) {
                  return rollback(activityError);
                }

                if (this.changes === 0) {
                  return rollback(
                    createRepositoryError(
                      "ACTIVITY_NOT_ELIGIBLE",
                      "La actividad no puede completarse",
                    ),
                  );
                }

                const insertCompletionSql = `
                  INSERT INTO actividad_cumplimientos
                  (actividad_id, actor_usuario_id, fecha, puntos)
                  VALUES (?, ?, ?, ?)
                `;

                db.run(
                  insertCompletionSql,
                  [actividadId, usuarioId, fecha, XP_PER_COMPLETION],
                  function (completionError) {
                    if (completionError) {
                      return rollback(completionError);
                    }

                    db.run(
                      "UPDATE usuarios SET puntos = puntos + ? WHERE id = ?",
                      [XP_PER_COMPLETION, usuarioId],
                      function (pointsError) {
                        if (pointsError) {
                          return rollback(pointsError);
                        }

                        if (this.changes === 0) {
                          return rollback(
                            createRepositoryError(
                              "USER_NOT_FOUND",
                              "El usuario no existe",
                            ),
                          );
                        }

                        db.get(
                          "SELECT puntos FROM usuarios WHERE id = ?",
                          [usuarioId],
                          (userError, user) => {
                            if (userError) {
                              return rollback(userError);
                            }

                            db.run("COMMIT", (commitError) => {
                              if (commitError) {
                                return rollback(commitError);
                              }

                              return resolve({
                                actividadId,
                                fecha,
                                puntosGanados: XP_PER_COMPLETION,
                                puntosTotales: user.puntos,
                              });
                            });
                          },
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      });
    });
  });
};

module.exports = {
  registrarCumplimiento,
};