const db = require("../config/database");

const withTransaction = async (work) => {
  await db.runAsync("BEGIN IMMEDIATE");

  try {
    const result = await work();
    await db.runAsync("COMMIT");
    return result;
  } catch (error) {
    await db.runAsync("ROLLBACK").catch(() => {});
    throw error;
  }
};

const create = async ({ nombre, descripcion, creadorId }) => {
  return withTransaction(async () => {
    /* La creación y la membresía del creador deben confirmarse juntas. */
    const project = await db.runAsync(
      "INSERT INTO proyectos (nombre, descripcion, creador_id) VALUES (?, ?, ?)",
      [nombre, descripcion, creadorId],
    );

    await db.runAsync(
      "INSERT INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (?, ?)",
      [project.lastID, creadorId],
    );

    return project.lastID;
  });
};

const findAccessibleByUser = (usuarioId) => {
  return db.allAsync(
    `
      SELECT p.id, p.nombre, p.descripcion, p.creador_id
      FROM proyectos p
      JOIN proyecto_usuarios pu ON pu.proyecto_id = p.id
      WHERE pu.usuario_id = ?
      ORDER BY p.id DESC
    `,
    [usuarioId],
  );
};

const findAccessibleById = (id, usuarioId) => {
  return db.getAsync(
    `
      SELECT p.id, p.nombre, p.descripcion, p.creador_id
      FROM proyectos p
      JOIN proyecto_usuarios pu ON pu.proyecto_id = p.id
      WHERE p.id = ? AND pu.usuario_id = ?
    `,
    [id, usuarioId],
  );
};

const findById = (id) => {
  return db.getAsync(
    "SELECT id, nombre, descripcion, creador_id FROM proyectos WHERE id = ?",
    [id],
  );
};

const findMembersByProjectId = (projectId) => {
  return db.allAsync(
    `
      SELECT u.id, u.nombre, u.correo, u.puntos
      FROM usuarios u
      JOIN proyecto_usuarios pu ON pu.usuario_id = u.id
      WHERE pu.proyecto_id = ?
      ORDER BY u.id ASC
    `,
    [projectId],
  );
};

const addMember = async (projectId, actorId, usuarioId) => withTransaction(async () => {
  const project = await findById(projectId);
  if (!project) return { outcome: "NOT_FOUND" };
  if (project.creador_id !== actorId) return { outcome: "FORBIDDEN" };
  const user = await db.getAsync("SELECT id FROM usuarios WHERE id = ?", [usuarioId]);
  if (!user) return { outcome: "USER_NOT_FOUND" };
  const result = await db.runAsync("INSERT OR IGNORE INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (?, ?)", [projectId, usuarioId]);
  return { outcome: result.changes ? "CREATED" : "CONFLICT" };
});

const removeMember = async (projectId, actorId, usuarioId) => {
  return withTransaction(async () => {
    const project = await findById(projectId);
    if (!project) return { outcome: "NOT_FOUND" };
    if (project.creador_id !== actorId) return { outcome: "FORBIDDEN" };
    if (project.creador_id === usuarioId) return { outcome: "CREATOR_REQUIRED" };
    const membership = await db.getAsync(
      "SELECT 1 FROM proyecto_usuarios WHERE proyecto_id = ? AND usuario_id = ?",
      [projectId, usuarioId],
    );

    if (!membership) return { outcome: "MEMBER_NOT_FOUND" };

    /* Un miembro eliminado no puede conservar actividades asignadas del proyecto. */
    await db.runAsync(
      "UPDATE actividades SET asignado_usuario_id = NULL WHERE proyecto_id = ? AND asignado_usuario_id = ?",
      [projectId, usuarioId],
    );

    await db.runAsync(
      "DELETE FROM proyecto_usuarios WHERE proyecto_id = ? AND usuario_id = ?",
      [projectId, usuarioId],
    );
    return { outcome: "REMOVED" };
  });
};

const update = async (id, creadorId, { nombre, descripcion }) => withTransaction(async () => {
  const project = await findById(id);
  if (!project) return { outcome: "NOT_FOUND" };
  if (project.creador_id !== creadorId) return { outcome: "FORBIDDEN" };
  await db.runAsync(
    `
      UPDATE proyectos
      SET nombre = ?, descripcion = ?
      WHERE id = ? AND creador_id = ?
    `,
    [nombre, descripcion, id, creadorId],
  );
  return { outcome: "UPDATED" };
});

const remove = async (id, creadorId) => {
  return withTransaction(async () => {
    const project = await findById(id);
    if (!project) return { outcome: "NOT_FOUND" };
    if (project.creador_id !== creadorId) return { outcome: "FORBIDDEN" };

    /* Se elimina la membresía antes del proyecto para respetar las claves foráneas. */
    await db.runAsync("DELETE FROM actividades WHERE proyecto_id = ?", [id]);
    await db.runAsync("DELETE FROM proyecto_usuarios WHERE proyecto_id = ?", [id]);
    await db.runAsync("DELETE FROM proyectos WHERE id = ? AND creador_id = ?", [id, creadorId]);
    return { outcome: "DELETED" };
  });
};

module.exports = {
  create,
  findAccessibleByUser,
  findAccessibleById,
  findById,
  findMembersByProjectId,
  addMember,
  removeMember,
  update,
  remove,
};
