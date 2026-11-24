import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addProjectMemberByEmail,
  clearProjectMemberAdditionError,
  fetchProjectMembers,
  removeProjectMember,
} from "./projectsSlice";

export default function ProjectMembers({ project }) {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [memberToRemove, setMemberToRemove] = useState(null);
  const removalDialogRef = useRef(null);
  const {
    membersByProjectId,
    memberListStatusByProjectId,
    memberListErrorByProjectId,
    memberAdditionStatusByProjectId,
    memberAdditionErrorByProjectId,
    memberRemovalStatusById,
    memberRemovalErrorById,
  } = useSelector((state) => state.projects);
  const members = membersByProjectId[project.id] ?? [];
  const listStatus = memberListStatusByProjectId[project.id] ?? "idle";
  const listError = memberListErrorByProjectId[project.id];
  const additionStatus = memberAdditionStatusByProjectId[project.id] ?? "idle";
  const additionError = memberAdditionErrorByProjectId[project.id];
  const panelId = `project-members-${project.id}`;

  function openPanel() {
    setIsOpen(true);
    if (listStatus === "idle") dispatch(fetchProjectMembers(project.id));
  }

  function handleEmailChange(event) {
    if (additionError) dispatch(clearProjectMemberAdditionError(project.id));
    setEmail(event.target.value);
  }

  useEffect(() => {
    const dialog = removalDialogRef.current;
    if (!dialog) return;

    if (memberToRemove) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [memberToRemove]);

  function handleRemoveConfirmation() {
    dispatch(removeProjectMember({ projectId: project.id, userId: memberToRemove.id }));
    setMemberToRemove(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const action = await dispatch(addProjectMemberByEmail({
      projectId: project.id,
      correo: email.trim(),
    }));

    if (addProjectMemberByEmail.fulfilled.match(action)) setEmail("");
  }

  return (
    <section className="project-members" aria-labelledby={`${panelId}-title`}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="project-members__toggle"
        onClick={openPanel}
        type="button"
      >
        Gestionar miembros
      </button>

      {isOpen && (
        <div className="project-members__panel" id={panelId}>
          <h3 id={`${panelId}-title`}>Miembros</h3>
          <form className="project-members__form" onSubmit={handleSubmit}>
            <label htmlFor={`${panelId}-email`}>Agregar por correo</label>
            <div>
              <input
                aria-describedby={additionError ? `${panelId}-error` : undefined}
                aria-invalid={Boolean(additionError)}
                id={`${panelId}-email`}
                onChange={handleEmailChange}
                required
                type="email"
                value={email}
              />
              <button
                disabled={additionStatus === "loading" || listStatus !== "succeeded"}
                type="submit"
              >
                {additionStatus === "loading" ? "Agregando..." : "Agregar"}
              </button>
            </div>
          </form>

          {additionError && <p className="project-members__error" id={`${panelId}-error`} role="alert">{additionError}</p>}
          {listStatus === "loading" && <p role="status">Cargando miembros...</p>}
          {listError && <p className="project-members__error" role="alert">{listError}</p>}
          {listStatus === "failed" && <button onClick={() => dispatch(fetchProjectMembers(project.id))} type="button">Reintentar</button>}
          {listStatus === "succeeded" && (
            <ul className="project-members__list">
              {members.map((member) => {
                const memberKey = `${project.id}-${member.id}`;
                const removalStatus = memberRemovalStatusById[memberKey];

                return (
                  <li key={member.id}>
                    <span><strong>{member.nombre}</strong> {member.correo}</span>
                    {member.id !== project.creador_id && (
                      <button
                        disabled={removalStatus === "loading"}
                        onClick={() => setMemberToRemove(member)}
                        type="button"
                      >
                        {removalStatus === "loading" ? "Quitando..." : "Quitar"}
                      </button>
                    )}
                    {memberRemovalErrorById[memberKey] && <p className="project-members__error" role="alert">{memberRemovalErrorById[memberKey]}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {memberToRemove && (
            <dialog
              aria-describedby={`${panelId}-removal-description`}
              aria-labelledby={`${panelId}-removal-title`}
              className="project-members__removal-dialog"
              onCancel={(event) => {
                event.preventDefault();
                setMemberToRemove(null);
              }}
              onClose={() => setMemberToRemove(null)}
              ref={removalDialogRef}
            >
              <h4 id={`${panelId}-removal-title`}>Quitar a {memberToRemove.nombre}</h4>
              <p id={`${panelId}-removal-description`}>
                Esta acción revoca su acceso al proyecto y desasigna sus actividades del proyecto.
              </p>
              <div className="project-members__removal-actions">
                <button onClick={() => setMemberToRemove(null)} type="button">Cancelar</button>
                <button className="project-members__remove-confirm" onClick={handleRemoveConfirmation} type="button">
                  Quitar miembro
                </button>
              </div>
            </dialog>
          )}
        </div>
      )}
    </section>
  );
}
