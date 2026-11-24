import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearProjectCreationError, createProject } from "./projectsSlice";

const initialForm = { nombre: "", descripcion: "" };

export default function ProjectForm() {
  const dispatch = useDispatch();
  const { creationStatus, creationError } = useSelector((state) => state.projects);
  const [form, setForm] = useState(initialForm);

  function handleChange(event) {
    const { name, value } = event.target;

    if (creationError) {
      dispatch(clearProjectCreationError());
    }

    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const action = await dispatch(createProject({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
    }));

    if (createProject.fulfilled.match(action)) {
      setForm(initialForm);
    }
  }

  return (
    <section aria-labelledby="create-project-title">
      <h2 id="create-project-title">Nuevo proyecto</h2>

      {creationError && (
        <p className="project-form__error" id="project-name-error" role="alert">
          {creationError}
        </p>
      )}

      <form className="project-form" onSubmit={handleSubmit}>
        <p className="project-form__field">
          <label htmlFor="project-name">Nombre</label>
          <input
            aria-describedby={creationError ? "project-name-error" : undefined}
            aria-invalid={Boolean(creationError)}
            id="project-name"
            name="nombre"
            onChange={handleChange}
            required
            value={form.nombre}
          />
        </p>

        <p className="project-form__field">
          <label htmlFor="project-description">Descripción</label>
          <textarea
            id="project-description"
            name="descripcion"
            onChange={handleChange}
            value={form.descripcion}
          />
        </p>

        <button type="submit" disabled={creationStatus === "loading"}>
          {creationStatus === "loading" ? "Guardando..." : "Crear proyecto"}
        </button>
      </form>
    </section>
  );
}
