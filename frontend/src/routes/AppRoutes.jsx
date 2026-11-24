import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../layouts/AppShell";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ActivitiesPage from "../pages/activities/ActivitiesPage";
import ProjectsPage from "../pages/projects/ProjectsPage";
import RequireAuth from "./RequireAuth";

const ProgressPage = lazy(() => import("../pages/progress/ProgressPage"));

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<ActivitiesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route
            path="progress"
            element={
              <Suspense fallback={<p role="status" aria-live="polite">Cargando progreso...</p>}>
                <ProgressPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
