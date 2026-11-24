import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  completeActivityRequest,
  createActivityRequest,
  deleteActivityRequest,
  getActivitiesRequest,
  updateActivityAssignmentRequest,
  updateActivityRequest,
} from "./activitiesApi";
import { setUserPoints } from "../auth/authSlice";
import { logout, sessionStarted } from "../auth/sessionActions";

function getErrorMessage(error) {
  return error.response?.data?.error?.message ?? "Ocurrió un error inesperado";
}

function mergeFetchedActivities(currentItems, fetchedItems, protectedIds, deletedIds) {
  const protectedIdSet = new Set(protectedIds);

  return [
    ...currentItems.filter((activity) => protectedIdSet.has(activity.id)),
    ...fetchedItems.filter(
      (activity) => !protectedIdSet.has(activity.id) && !deletedIds.includes(activity.id),
    ),
  ];
}

function localDate(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function monday(date) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 1 - weekday);
  return value.toISOString().slice(0, 10);
}

export function completionKeyForActivity(activity, now = new Date()) {
  if (Number(activity.recurrente) !== 1) return String(activity.id);

  const date = localDate(activity.zona_horaria || "UTC", now);
  const period = activity.frecuencia === "semanal" ? monday(date) : date;
  return `${activity.id}:${period}`;
}

export const fetchActivities = createAsyncThunk(
  "activities/fetchActivities",
  async (_, { rejectWithValue }) => {
    try {
      return await getActivitiesRequest();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createActivity = createAsyncThunk(
  "activities/createActivity",
  async (activity, { rejectWithValue }) => {
    try {
      return await createActivityRequest(activity);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateActivity = createAsyncThunk(
  "activities/updateActivity",
  async ({ activityId, activity }, { rejectWithValue }) => {
    try {
      return await updateActivityRequest(activityId, activity);
    } catch (error) {
      return rejectWithValue({ activityId, message: getErrorMessage(error) });
    }
  },
);

export const deleteActivity = createAsyncThunk(
  "activities/deleteActivity",
  async (activityId, { rejectWithValue }) => {
    try {
      await deleteActivityRequest(activityId);
      return activityId;
    } catch (error) {
      return rejectWithValue({ activityId, message: getErrorMessage(error) });
    }
  },
);

export const updateActivityAssignment = createAsyncThunk(
  "activities/updateActivityAssignment",
  async ({ activityId, asignadoUsuarioId }, { rejectWithValue }) => {
    try {
      const activity = await updateActivityAssignmentRequest(activityId, asignadoUsuarioId);
      return { activityId, activity };
    } catch (error) {
      return rejectWithValue({ activityId, message: getErrorMessage(error) });
    }
  },
);

export const completeActivity = createAsyncThunk(
  "activities/completeActivity",
  async ({ activityId, completionKey }, { dispatch, getState, rejectWithValue }) => {
    const { sessionGeneration, token } = getState().auth;

    try {
      const cumplimiento = await completeActivityRequest(activityId);
      const auth = getState().auth;
      if (
        auth.sessionGeneration === sessionGeneration &&
        auth.token === token
      ) {
        dispatch(setUserPoints({
          points: cumplimiento.puntosTotales,
          sessionGeneration,
        }));
      }

      return { activityId, completionKey, cumplimiento };
    } catch (error) {
      return rejectWithValue({ activityId, completionKey, message: getErrorMessage(error) });
    }
  },
  {
    condition: ({ activityId, completionKey }, { getState }) => {
      const state = getState().activities;
      const activity = state.items.find((item) => item.id === activityId);

      return (
        activity?.estado === "pendiente" &&
        completionKey === completionKeyForActivity(activity) &&
        state.completionStatusById[completionKey] !== "succeeded" &&
        state.completionStatusById[completionKey] !== "loading"
      );
    },
  },
);

function createInitialState() {
  return {
    items: [],
    status: "idle",
    error: null,
    fetchRequestId: null,
    protectedActivityIdsByFetchRequestId: {},
    deletedActivityIds: [],
    creationStatus: "idle",
    creationError: null,
    creationRequestId: null,
    updateStatusById: {},
    updateErrorById: {},
    updateRequestIdById: {},
    deletionStatusById: {},
    deletionErrorById: {},
    deletionRequestIdById: {},
    assignmentStatusById: {},
    assignmentErrorById: {},
    assignmentRequestIdById: {},
    completionStatusById: {},
    completionErrorById: {},
    completionRequestIdById: {},
    completionById: {},
  };
}

const activitiesSlice = createSlice({
  name: "activities",
  initialState: createInitialState(),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(logout, createInitialState)
      .addCase(sessionStarted, createInitialState)
      .addCase(fetchActivities.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.fetchRequestId = action.meta.requestId;
        state.protectedActivityIdsByFetchRequestId[action.meta.requestId] = [];
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "succeeded";
        state.items = mergeFetchedActivities(
          state.items,
          action.payload,
          state.protectedActivityIdsByFetchRequestId[action.meta.requestId],
          state.deletedActivityIds,
        ).map(
          (activity) => (
            Number(activity.recurrente) === 0 &&
            state.completionStatusById[activity.id] === "succeeded"
              ? { ...activity, estado: "completada" }
              : activity
          ),
        );
        delete state.protectedActivityIdsByFetchRequestId[action.meta.requestId];
        state.fetchRequestId = null;
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "failed";
        state.error = action.payload;
        delete state.protectedActivityIdsByFetchRequestId[action.meta.requestId];
        state.fetchRequestId = null;
      })
      .addCase(createActivity.pending, (state, action) => {
        state.creationStatus = "loading";
        state.creationError = null;
        state.creationRequestId = action.meta.requestId;
      })
      .addCase(createActivity.fulfilled, (state, action) => {
        if (state.creationRequestId !== action.meta.requestId) return;

        state.creationStatus = "succeeded";
        state.items.unshift(action.payload);
        state.status = "succeeded";
        state.creationRequestId = null;
        if (state.fetchRequestId) {
          state.protectedActivityIdsByFetchRequestId[state.fetchRequestId].push(action.payload.id);
        }
      })
       .addCase(createActivity.rejected, (state, action) => {
         if (state.creationRequestId !== action.meta.requestId) return;

         state.creationStatus = "failed";
         state.creationError = action.payload;
          state.creationRequestId = null;
        })
        .addCase(updateActivity.pending, (state, action) => {
          const { activityId } = action.meta.arg;
          state.updateStatusById[activityId] = "loading";
          state.updateRequestIdById[activityId] = action.meta.requestId;
          delete state.updateErrorById[activityId];
        })
        .addCase(updateActivity.fulfilled, (state, action) => {
          const activity = action.payload;
          if (state.updateRequestIdById[activity.id] !== action.meta.requestId) return;

          state.updateStatusById[activity.id] = "succeeded";
          state.items = state.items.map((item) => item.id === activity.id ? activity : item);
          if (state.fetchRequestId) {
            state.protectedActivityIdsByFetchRequestId[state.fetchRequestId].push(activity.id);
          }
          delete state.updateRequestIdById[activity.id];
        })
        .addCase(updateActivity.rejected, (state, action) => {
          const { activityId, message } = action.payload;
          if (state.updateRequestIdById[activityId] !== action.meta.requestId) return;

          state.updateStatusById[activityId] = "failed";
          state.updateErrorById[activityId] = message;
          delete state.updateRequestIdById[activityId];
        })
        .addCase(deleteActivity.pending, (state, action) => {
          const activityId = action.meta.arg;
          state.deletionStatusById[activityId] = "loading";
          state.deletionRequestIdById[activityId] = action.meta.requestId;
          delete state.deletionErrorById[activityId];
        })
        .addCase(deleteActivity.fulfilled, (state, action) => {
          const activityId = action.payload;
          if (state.deletionRequestIdById[activityId] !== action.meta.requestId) return;

          state.deletionStatusById[activityId] = "succeeded";
          state.items = state.items.filter((item) => item.id !== activityId);
          if (!state.deletedActivityIds.includes(activityId)) state.deletedActivityIds.push(activityId);
          delete state.deletionRequestIdById[activityId];
        })
        .addCase(deleteActivity.rejected, (state, action) => {
          const { activityId, message } = action.payload;
          if (state.deletionRequestIdById[activityId] !== action.meta.requestId) return;

          state.deletionStatusById[activityId] = "failed";
          state.deletionErrorById[activityId] = message;
          delete state.deletionRequestIdById[activityId];
        })
        .addCase(updateActivityAssignment.pending, (state, action) => {
          const { activityId } = action.meta.arg;
          state.assignmentStatusById[activityId] = "loading";
          state.assignmentRequestIdById[activityId] = action.meta.requestId;
          delete state.assignmentErrorById[activityId];
        })
        .addCase(updateActivityAssignment.fulfilled, (state, action) => {
          const { activityId, activity } = action.payload;
          if (state.assignmentRequestIdById[activityId] !== action.meta.requestId) return;

          state.assignmentStatusById[activityId] = "succeeded";
          state.items = state.items.map((item) => item.id === activityId ? activity : item);
          if (state.fetchRequestId) {
            state.protectedActivityIdsByFetchRequestId[state.fetchRequestId].push(activityId);
          }
          delete state.assignmentRequestIdById[activityId];
        })
        .addCase(updateActivityAssignment.rejected, (state, action) => {
          const { activityId, message } = action.payload;
          if (state.assignmentRequestIdById[activityId] !== action.meta.requestId) return;

          state.assignmentStatusById[activityId] = "failed";
          state.assignmentErrorById[activityId] = message;
          delete state.assignmentRequestIdById[activityId];
        })
        .addCase(completeActivity.pending, (state, action) => {
          const { completionKey } = action.meta.arg;
           state.completionStatusById[completionKey] = "loading";
           state.completionRequestIdById[completionKey] = action.meta.requestId;
           delete state.completionErrorById[completionKey];
           delete state.completionById[completionKey];
        })
        .addCase(completeActivity.fulfilled, (state, action) => {
            const { activityId, completionKey, cumplimiento } = action.payload;
           if (state.completionRequestIdById[completionKey] !== action.meta.requestId) return;

            const activity = state.items.find((item) => item.id === activityId);
            const responseKey = activity && Number(activity.recurrente) === 1
              ? `${activityId}:${cumplimiento.fecha}`
              : completionKey;

             state.completionStatusById[responseKey] = "succeeded";
             state.completionById[responseKey] = cumplimiento;
            delete state.completionRequestIdById[completionKey];
            if (responseKey !== completionKey) {
              delete state.completionStatusById[completionKey];
              delete state.completionById[completionKey];
            }
           if (activity) {
            if (Number(activity.recurrente) === 0) {
              activity.estado = "completada";
            }
          }
        })
        .addCase(completeActivity.rejected, (state, action) => {
           const { completionKey, message } = action.payload;
           if (state.completionRequestIdById[completionKey] !== action.meta.requestId) return;

           state.completionStatusById[completionKey] = "failed";
           state.completionErrorById[completionKey] = message;
           delete state.completionRequestIdById[completionKey];
        });
  },
});

export default activitiesSlice.reducer;
