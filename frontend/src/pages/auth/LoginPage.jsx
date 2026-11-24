import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthError, login } from "../../features/auth/authSlice";
import "./AuthPage.css";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginStatus, error } = useSelector((state) => state.auth);
  const from = location.state?.from ?? { pathname: "/" };

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const action = await dispatch(
      login({
        correo: formData.get("correo"),
        password: formData.get("password"),
      }),
    );

    if (login.fulfilled.match(action)) {
      navigate(from, { replace: true });
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="login-title" className="auth-card">
        <Link aria-label="TaskQuest, ir al inicio de sesión" className="auth-card__brand" to="/login">
          <span aria-hidden="true" className="auth-card__brand-mark">TQ</span>
          <span>TaskQuest</span>
        </Link>

        <header className="auth-card__header">
          <p className="auth-card__eyebrow">Bienvenido de vuelta</p>
          <h1 className="auth-card__title" id="login-title">Iniciar sesión</h1>
          <p className="auth-card__intro">Retomá tus actividades y seguí avanzando.</p>
        </header>

        {error && <p className="auth-form__error" role="alert">{error}</p>}

        <form aria-busy={loginStatus === "loading"} className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
          <label htmlFor="correo">Correo</label>
          <input id="correo" name="correo" type="email" required autoComplete="email" />
          </div>

          <div className="auth-form__field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          </div>

          <button className="auth-form__submit" type="submit" disabled={loginStatus === "loading"}>
          {loginStatus === "loading" ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="auth-card__footer">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>.
        </p>
      </section>
    </main>
  );
}
