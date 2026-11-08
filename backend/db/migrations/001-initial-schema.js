async function up(db) {
  await db.runAsync(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    puntos INTEGER NOT NULL DEFAULT 0 CHECK(puntos >= 0)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    creador_id INTEGER NOT NULL REFERENCES usuarios(id)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS proyecto_usuarios (
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    PRIMARY KEY (proyecto_id, usuario_id)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS actividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT DEFAULT 'pendiente',
    recurrente INTEGER DEFAULT 0,
    frecuencia TEXT,
    fecha TEXT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    proyecto_id INTEGER REFERENCES proyectos(id)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS actividad_cumplimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    puntos INTEGER NOT NULL DEFAULT 10 CHECK(puntos >= 0),
    UNIQUE (actividad_id, fecha)
  )`);
}

module.exports = { up };
