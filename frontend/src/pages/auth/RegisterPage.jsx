import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { clearAuthError, register } from "../../features/auth/authSlice";
import "./AuthPage.css";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { registrationStatus, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const action = await dispatch(
      register({
        nombre: formData.get("nombre"),
        correo: formData.get("correo"),
        password: formData.get("password"),
      }),
    );

    if (register.fulfilled.match(action)) {
      navigate("/login", { replace: true });
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="register-title" className="auth-card">
        <Link aria-label="TaskQuest, crear cuenta" className="auth-card__brand" to="/register">
          <span aria-hidden="true" className="auth-card__brand-mark">TQ</span>
          <span>TaskQuest</span>
        </Link>

        <header className="auth-card__header">
          <p className="auth-card__eyebrow">Empezá tu misión</p>
          <h1 className="auth-card__title" id="register-title">Crear cuenta</h1>
          <p className="auth-card__intro">Organizá tus objetivos y celebrá cada avance.</p>
        </header>

        {error && <p className="auth-form__error" role="alert">{error}</p>}

        <form aria-busy={registrationStatus === "loading"} className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" required autoComplete="name" />
          </div>

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
            autoComplete="new-password"
          />
          </div>

          <button className="auth-form__submit" type="submit" disabled={registrationStatus === "loading"}>
          {registrationStatus === "loading" ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-card__footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>.
        </p>
      </section>
    </main>
  );
}
