import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { hydrateUser } from "./features/auth/authSlice";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    if (token) {
      dispatch(hydrateUser());
    }
  }, [dispatch, token]);

  return <AppRoutes />;
}
