async function up(db) {
  await db.runAsync(
    "ALTER TABLE actividades ADD COLUMN asignado_usuario_id INTEGER REFERENCES usuarios(id)",
  );
  await db.runAsync("ALTER TABLE actividad_cumplimientos RENAME TO actividad_cumplimientos_legacy");
  await db.runAsync(`CREATE TABLE actividad_cumplimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    actor_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TEXT NOT NULL CHECK(fecha GLOB '????-??-??'),
    puntos INTEGER NOT NULL DEFAULT 10 CHECK(puntos >= 0),
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (actividad_id, fecha)
  )`);
  await db.runAsync(`INSERT INTO actividad_cumplimientos
    (id, actividad_id, actor_usuario_id, fecha, puntos)
    SELECT c.id, c.actividad_id, a.usuario_id, c.fecha, c.puntos
    FROM actividad_cumplimientos_legacy c
    JOIN actividades a ON a.id = c.actividad_id`);
  await db.runAsync("DROP TABLE actividad_cumplimientos_legacy");
  await db.runAsync("CREATE INDEX idx_cumplimientos_actor_fecha ON actividad_cumplimientos(actor_usuario_id, fecha)");
  await db.runAsync("CREATE INDEX idx_actividades_asignado ON actividades(asignado_usuario_id)");
}

module.exports = { up };
