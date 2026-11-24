import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import authReducer, { login } from "../features/auth/authSlice";
import activitiesReducer from "../features/activities/activitiesSlice";
import projectsReducer from "../features/projects/projectsSlice";
import progressReducer from "../features/progress/progressSlice";
import { sessionStarted } from "../features/auth/sessionActions";

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  predicate: (action, currentState) => (
    login.fulfilled.match(action) &&
    currentState.auth.acceptedLoginRequestId === action.meta.requestId
  ),
  effect: (_, listenerApi) => {
    listenerApi.dispatch(sessionStarted());
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    activities: activitiesReducer,
    projects: projectsReducer,
    progress: progressReducer,
  },
  middleware: (getDefaultMiddleware) => (
    getDefaultMiddleware().prepend(listenerMiddleware.middleware)
  ),
});
