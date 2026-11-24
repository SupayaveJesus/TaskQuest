import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ProjectForm from "../../features/projects/ProjectForm";
import ProjectMembers from "../../features/projects/ProjectMembers";
import ProjectEditor from "../../features/projects/ProjectEditor";
import { fetchProjects } from "../../features/projects/projectsSlice";
import "./ProjectsPage.css";

export default function ProjectsPage() {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector((state) => state.projects);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  return (
    <section
      aria-busy={status === "loading"}
      aria-labelledby="projects-title"
      className="projects-page"
    >
      <header className="projects-page__header">
        <p className="projects-page__eyebrow">TaskQuest</p>
        <h1 id="projects-title">Proyectos</h1>
        <p className="projects-page__intro">
          Reuní tus actividades en objetivos compartidos: creá actividades para avanzar y consultá el progreso del equipo.
        </p>
      </header>

      <ProjectForm />

      {status === "loading" && (
        <p className="projects-page__state" role="status" aria-live="polite">
          Cargando proyectos...
        </p>
      )}

      {status === "failed" && (
        <p className="projects-page__state projects-page__state--error" role="alert">
          {error}
        </p>
      )}

      {status === "succeeded" && items.length === 0 && (
        <p className="projects-page__state">Todavía no tenés proyectos.</p>
      )}

      {status === "succeeded" && items.length > 0 && (
        <ul className="projects-page__grid">
          {items.map((project) => (
            <li className="project-card" key={project.id}>
              <article>
                <h2>{project.nombre}</h2>
                {project.descripcion && <p>{project.descripcion}</p>}
                <p className="project-card__lifecycle">
                  Creá actividades para este proyecto y seguí su cumplimiento agregado.
                </p>
                <nav className="project-card__quick-actions" aria-label={`Acciones para ${project.nombre}`}>
                  <Link to={`/?projectId=${encodeURIComponent(project.id)}`}>
                    Crear actividad
                  </Link>
                  <Link to={`/progress?projectId=${encodeURIComponent(project.id)}`}>
                    Ver progreso
                  </Link>
                </nav>
                {project.creador_id === user?.id && (
                  <>
                    <ProjectEditor project={project} />
                    <ProjectMembers project={project} />
                  </>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
