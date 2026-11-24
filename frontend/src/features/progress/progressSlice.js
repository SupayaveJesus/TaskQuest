import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getPersonalProgressRequest, getProjectProgressRequest } from "./progressApi";
import { logout, sessionStarted } from "../auth/sessionActions";

function getErrorMessage(error) {
  return error.response?.data?.error?.message ?? "No se pudo cargar tu progreso";
}

function getProjectErrorMessage(error) {
  if (error.response?.status === 403) {
    return "No tenés acceso al informe de este proyecto.";
  }

  return error.response?.data?.error?.message ?? "No se pudo cargar el informe del proyecto";
}

export const fetchPersonalProgress = createAsyncThunk(
  "progress/fetchPersonalProgress",
  async (_, { rejectWithValue }) => {
    try {
      return await getPersonalProgressRequest();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchProjectProgress = createAsyncThunk(
  "progress/fetchProjectProgress",
  async (projectId, { rejectWithValue }) => {
    try {
      return await getProjectProgressRequest(projectId);
    } catch (error) {
      return rejectWithValue(getProjectErrorMessage(error));
    }
  },
);

function createInitialState() {
  return {
    personal: null,
    status: "idle",
    error: null,
    fetchRequestId: null,
    projectReport: null,
    projectStatus: "idle",
    projectError: null,
    projectFetchRequestId: null,
  };
}

const progressSlice = createSlice({
  name: "progress",
  initialState: createInitialState(),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(logout, createInitialState)
      .addCase(sessionStarted, createInitialState)
      .addCase(fetchPersonalProgress.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.fetchRequestId = action.meta.requestId;
      })
      .addCase(fetchPersonalProgress.fulfilled, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "succeeded";
        state.personal = action.payload;
        state.fetchRequestId = null;
      })
      .addCase(fetchPersonalProgress.rejected, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "failed";
        state.error = action.payload;
        state.fetchRequestId = null;
      })
      .addCase(fetchProjectProgress.pending, (state, action) => {
        state.projectReport = null;
        state.projectStatus = "loading";
        state.projectError = null;
        state.projectFetchRequestId = action.meta.requestId;
      })
      .addCase(fetchProjectProgress.fulfilled, (state, action) => {
        if (state.projectFetchRequestId !== action.meta.requestId) return;

        state.projectStatus = "succeeded";
        state.projectReport = action.payload;
        state.projectFetchRequestId = null;
      })
      .addCase(fetchProjectProgress.rejected, (state, action) => {
        if (state.projectFetchRequestId !== action.meta.requestId) return;

        state.projectStatus = "failed";
        state.projectError = action.payload;
        state.projectFetchRequestId = null;
      });
  },
});

export default progressSlice.reducer;
