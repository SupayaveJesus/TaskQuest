async function up(db) {
  await db.runAsync(`
    INSERT OR IGNORE INTO proyecto_usuarios (proyecto_id, usuario_id)
    SELECT id, creador_id
    FROM proyectos
  `);
}

module.exports = { up };
