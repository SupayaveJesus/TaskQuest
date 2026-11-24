import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getCurrentUserRequest,
  loginRequest,
  registerRequest,
} from "./authApi";
import { logout } from "./sessionActions";

const TOKEN_STORAGE_KEY = "taskquest_token";

function getErrorMessage(error) {
  return error.response?.data?.error?.message ?? "Ocurrió un error inesperado";
}

export const login = createAsyncThunk(
    'auth/login',
    async (credentials, { getState, rejectWithValue }) => {
        const sessionGeneration = getState().auth.sessionGeneration;

        try {
            const data = await loginRequest(credentials);
            return { data, sessionGeneration };
        } catch (error) {
            return rejectWithValue(getErrorMessage(error));
        }
    }
);

export const register = createAsyncThunk(
    "auth/register",
    async(userData, { rejectWithValue}) =>{
        try {
            return await registerRequest(userData);
        } catch (error) {
            return rejectWithValue(getErrorMessage(error));
        }
    },
);

export const hydrateUser = createAsyncThunk(
  "auth/hydrateUser",
  async (_, { dispatch, getState, rejectWithValue }) => {
    const { sessionGeneration, token } = getState().auth;

    try {
      const user = await getCurrentUserRequest();
      return { sessionGeneration, token, user };
    } catch (error) {
      const status = error.response?.status ?? null;

      const auth = getState().auth;
      if (
        status === 401 &&
        auth.sessionGeneration === sessionGeneration &&
        auth.token === token &&
        auth.loginRequestId === null
      ) {
        dispatch(logout());
      }

      return rejectWithValue({
        message: getErrorMessage(error),
        status,
        sessionGeneration,
        token,
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const { token, user, hydrationStatus } = getState().auth;
      return Boolean(token) && user === null && hydrationStatus === "idle";
    },
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_STORAGE_KEY),
    user: null,
    latestPoints: null,
    sessionGeneration: 0,
    loginRequestId: null,
    hydrationRequestId: null,
    acceptedLoginRequestId: null,
    hydrationStatus: "idle",
    loginStatus: "idle",
    registrationStatus: "idle",
    error: null,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      if (state.user && state.latestPoints !== null) {
        state.user.puntos = Math.max(state.user.puntos, state.latestPoints);
      }
    },
    setUserPoints(state, action) {
      const points = typeof action.payload === "object"
        ? action.payload.points
        : action.payload;
      const sessionGeneration = action.payload?.sessionGeneration;

      if (
        !Number.isFinite(points) ||
        (sessionGeneration !== undefined && sessionGeneration !== state.sessionGeneration)
      ) {
        return;
      }

      // Completion totals are monotonic on the server, so never let an older response win.
      state.latestPoints = Math.max(state.latestPoints ?? points, points);
      if (state.user) {
        state.user.puntos = Math.max(state.user.puntos, state.latestPoints);
      }
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, (state) => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return {
          token: null,
          user: null,
          latestPoints: null,
          sessionGeneration: state.sessionGeneration + 1,
          loginRequestId: null,
          hydrationRequestId: null,
          acceptedLoginRequestId: null,
          hydrationStatus: "idle",
          loginStatus: "idle",
          registrationStatus: "idle",
          error: null,
        };
      })
      .addCase(login.pending, (state, action) => {
        state.loginStatus = "loading";
        state.error = null;
        state.loginRequestId = action.meta.requestId;
        state.acceptedLoginRequestId = null;
      })
       .addCase(login.fulfilled, (state, action) => {
        const { data, sessionGeneration } = action.payload;
        if (
          state.loginRequestId !== action.meta.requestId ||
          state.sessionGeneration !== sessionGeneration
        ) {
          return;
        }

        state.loginStatus = "succeeded";
        state.token = data.token;
        state.user = data.usuario;
        state.latestPoints = data.usuario.puntos;
        state.sessionGeneration += 1;
        state.loginRequestId = null;
        state.hydrationRequestId = null;
        state.acceptedLoginRequestId = action.meta.requestId;
        state.hydrationStatus = "succeeded";
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      })
      .addCase(login.rejected, (state, action) => {
        if (state.loginRequestId !== action.meta.requestId) {
          return;
        }

        state.loginStatus = "failed";
        state.error = action.payload;
        state.loginRequestId = null;
      })
      .addCase(register.pending, (state) => {
        state.registrationStatus = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.registrationStatus = "succeeded";
      })
       .addCase(register.rejected, (state, action) => {
         state.registrationStatus = "failed";
         state.error = action.payload;
       })
       .addCase(hydrateUser.pending, (state, action) => {
          state.hydrationStatus = "loading";
          state.hydrationRequestId = action.meta.requestId;
        })
         .addCase(hydrateUser.fulfilled, (state, action) => {
           const { sessionGeneration, token, user } = action.payload;
           if (
             state.hydrationRequestId !== action.meta.requestId ||
             state.sessionGeneration !== sessionGeneration ||
             state.token !== token
           ) {
             return;
           }

           state.hydrationStatus = "succeeded";
           state.user = user;
           if (state.latestPoints !== null) {
             state.user.puntos = Math.max(state.user.puntos, state.latestPoints);
           }
           state.hydrationRequestId = null;
        })
          .addCase(hydrateUser.rejected, (state, action) => {
            if (
              state.hydrationRequestId !== action.meta.requestId ||
              state.sessionGeneration !== action.payload?.sessionGeneration ||
              state.token !== action.payload?.token
            ) {
              return;
            }

            if (action.payload?.status === 401) {
              return;
            }

            state.hydrationStatus = "failed";
            state.error = action.payload?.message ?? "No se pudo verificar la sesión";
            state.hydrationRequestId = null;
          });
  },
});

export { logout } from "./sessionActions";
export const { clearAuthError, setUser, setUserPoints } = authSlice.actions;

export default authSlice.reducer;
