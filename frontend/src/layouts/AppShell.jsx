import { useDispatch, useSelector } from "react-redux";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/authSlice";

export default function AppShell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  function handleLogout() {
    dispatch(logout());
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header className="app-shell__header">
        <nav className="app-shell__nav" aria-label="Navegación principal">
          <NavLink aria-label="TaskQuest, ir a actividades" className="app-shell__brand" to="/" end>
            <span aria-hidden="true">TQ</span>
            <strong>TaskQuest</strong>
          </NavLink>
          <div className="app-shell__links">
            <NavLink to="/" end>Actividades</NavLink>
            <NavLink to="/projects">Proyectos</NavLink>
            <NavLink to="/progress">Progreso</NavLink>
          </div>
          <div className="app-shell__user">
            {user && (
              <>
                <span className="app-shell__user-name">{user.nombre}</span>
                <span aria-label={`${user.puntos} puntos de experiencia`} className="app-shell__xp" title={`${user.puntos} XP`}>
                  {user.puntos} XP
                </span>
              </>
            )}
            <button type="button" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  );
}
