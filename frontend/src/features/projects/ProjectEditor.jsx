import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { deleteProject, updateProject } from "./projectsSlice";

export default function ProjectEditor({ project }) {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: project.nombre,
    descripcion: project.descripcion ?? "",
  });
  const { updateStatusById, updateErrorById, deletionStatusById, deletionErrorById } = useSelector(
    (state) => state.projects,
  );
  const isSaving = updateStatusById[project.id] === "loading";
  const isDeleting = deletionStatusById[project.id] === "loading";

  async function handleSubmit(event) {
    event.preventDefault();
    const action = await dispatch(updateProject({
      projectId: project.id,
      project: { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null },
    }));
    if (updateProject.fulfilled.match(action)) setIsEditing(false);
  }

  function handleDelete() {
    if (window.confirm(`Se eliminará el proyecto "${project.nombre}" y sus actividades. Esta acción no se puede deshacer.`)) {
      dispatch(deleteProject(project.id));
    }
  }

  return (
    <div className="project-editor">
      <button
        className="project-editor__button"
        onClick={() => {
          setForm({ nombre: project.nombre, descripcion: project.descripcion ?? "" });
          setIsEditing((current) => !current);
        }}
        type="button"
      >
        {isEditing ? "Cancelar edición" : "Editar proyecto"}
      </button>
      <button className="project-editor__delete" disabled={isDeleting} onClick={handleDelete} type="button">
        {isDeleting ? "Eliminando..." : "Eliminar proyecto"}
      </button>
      {deletionErrorById[project.id] && <p role="alert">{deletionErrorById[project.id]}</p>}
      {isEditing && (
        <form className="project-editor__form" onSubmit={handleSubmit}>
          <label>Nombre<input onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
          <label>Descripción<textarea onChange={(event) => setForm({ ...form, descripcion: event.target.value })} value={form.descripcion} /></label>
          {updateErrorById[project.id] && <p role="alert">{updateErrorById[project.id]}</p>}
          <button disabled={isSaving} type="submit">{isSaving ? "Guardando..." : "Guardar cambios"}</button>
        </form>
      )}
    </div>
  );
}
