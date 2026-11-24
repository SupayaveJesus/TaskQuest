import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  addProjectMemberByEmailRequest,
  createProjectRequest,
  deleteProjectRequest,
  getProjectMembersRequest,
  getProjectsRequest,
  removeProjectMemberRequest,
  updateProjectRequest,
} from "./projectsApi";
import { logout, sessionStarted } from "../auth/sessionActions";

function getErrorMessage(error) {
  return error.response?.data?.error?.message ?? "Ocurrió un error inesperado";
}

function mergeFetchedProjects(currentItems, fetchedItems, protectedProjectIds, deletedProjectIds) {
  const protectedIdSet = new Set(protectedProjectIds);

  return [
    ...currentItems.filter((project) => protectedIdSet.has(project.id)),
    ...fetchedItems.filter(
      (project) => !protectedIdSet.has(project.id) && !deletedProjectIds.includes(project.id),
    ),
  ];
}

function reconcileFetchedProjectMembers(fetchedMembers, additions, removedMemberIds) {
  const removedIdSet = new Set(removedMemberIds);
  const memberIds = new Set(fetchedMembers.map((member) => member.id));

  return [
    ...fetchedMembers.filter((member) => !removedIdSet.has(member.id)),
    ...additions.filter((member) => (
      !memberIds.has(member.id) && !removedIdSet.has(member.id)
    )),
  ];
}

export const fetchProjects = createAsyncThunk(
  "projects/fetchProjects",
  async (_, { rejectWithValue }) => {
    try {
      return await getProjectsRequest();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createProject = createAsyncThunk(
  "projects/createProject",
  async (project, { rejectWithValue }) => {
    try {
      return await createProjectRequest(project);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateProject = createAsyncThunk(
  "projects/updateProject",
  async ({ projectId, project }, { rejectWithValue }) => {
    try {
      return await updateProjectRequest(projectId, project);
    } catch (error) {
      return rejectWithValue({ projectId, message: getErrorMessage(error) });
    }
  },
);

export const deleteProject = createAsyncThunk(
  "projects/deleteProject",
  async (projectId, { rejectWithValue }) => {
    try {
      await deleteProjectRequest(projectId);
      return projectId;
    } catch (error) {
      return rejectWithValue({ projectId, message: getErrorMessage(error) });
    }
  },
);

export const fetchProjectMembers = createAsyncThunk(
  "projects/fetchProjectMembers",
  async (projectId, { rejectWithValue }) => {
    try {
      const members = await getProjectMembersRequest(projectId);
      return { projectId, members };
    } catch (error) {
      return rejectWithValue({ projectId, message: getErrorMessage(error) });
    }
  },
  {
    condition: (projectId, { getState }) => (
      getState().projects.memberListStatusByProjectId[projectId] !== "loading"
    ),
  },
);

export const addProjectMemberByEmail = createAsyncThunk(
  "projects/addProjectMemberByEmail",
  async ({ projectId, correo }, { rejectWithValue }) => {
    try {
      const member = await addProjectMemberByEmailRequest(projectId, correo);
      return { projectId, member };
    } catch (error) {
      return rejectWithValue({ projectId, message: getErrorMessage(error) });
    }
  },
);

export const removeProjectMember = createAsyncThunk(
  "projects/removeProjectMember",
  async ({ projectId, userId }, { rejectWithValue }) => {
    try {
      await removeProjectMemberRequest(projectId, userId);
      return { projectId, userId };
    } catch (error) {
      return rejectWithValue({ projectId, userId, message: getErrorMessage(error) });
    }
  },
);

function createInitialState() {
  return {
    items: [],
    status: "idle",
    error: null,
    fetchRequestId: null,
    createdProjectIdsByFetchRequestId: {},
    protectedProjectIdsByFetchRequestId: {},
    deletedProjectIds: [],
    creationStatus: "idle",
    creationError: null,
    creationRequestId: null,
    updateStatusById: {},
    updateErrorById: {},
    updateRequestIdById: {},
    deletionStatusById: {},
    deletionErrorById: {},
    deletionRequestIdById: {},
    membersByProjectId: {},
    memberListStatusByProjectId: {},
    memberListErrorByProjectId: {},
    memberListFetchRequestIdByProjectId: {},
    memberAdditionsByFetchRequestId: {},
    memberRemovalIdsByFetchRequestId: {},
    memberAdditionStatusByProjectId: {},
    memberAdditionErrorByProjectId: {},
    memberAdditionRequestIdByProjectId: {},
    memberAdditionFetchRequestIdByRequestId: {},
    memberRemovalStatusById: {},
    memberRemovalErrorById: {},
    memberRemovalRequestIdById: {},
    memberRemovalFetchRequestIdByRequestId: {},
  };
}

const projectsSlice = createSlice({
  name: "projects",
  initialState: createInitialState(),
  reducers: {
    clearProjectCreationError(state) {
      state.creationError = null;
    },
    clearProjectMemberAdditionError(state, action) {
      delete state.memberAdditionErrorByProjectId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, createInitialState)
      .addCase(sessionStarted, createInitialState)
      .addCase(fetchProjects.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.fetchRequestId = action.meta.requestId;
        state.createdProjectIdsByFetchRequestId[action.meta.requestId] = [];
        state.protectedProjectIdsByFetchRequestId[action.meta.requestId] = [];
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "succeeded";
        state.items = mergeFetchedProjects(
          state.items,
          action.payload,
          [
            ...state.createdProjectIdsByFetchRequestId[action.meta.requestId],
            ...state.protectedProjectIdsByFetchRequestId[action.meta.requestId],
          ],
          state.deletedProjectIds,
        );
        delete state.createdProjectIdsByFetchRequestId[action.meta.requestId];
        delete state.protectedProjectIdsByFetchRequestId[action.meta.requestId];
        state.fetchRequestId = null;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;

        state.status = "failed";
        state.error = action.payload;
        delete state.createdProjectIdsByFetchRequestId[action.meta.requestId];
        delete state.protectedProjectIdsByFetchRequestId[action.meta.requestId];
        state.fetchRequestId = null;
      })
      .addCase(createProject.pending, (state, action) => {
        state.creationStatus = "loading";
        state.creationError = null;
        state.creationRequestId = action.meta.requestId;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        if (state.creationRequestId !== action.meta.requestId) return;

        state.creationStatus = "succeeded";
        state.items.unshift(action.payload);
        state.status = "succeeded";
        state.creationRequestId = null;
        if (state.fetchRequestId) {
          state.createdProjectIdsByFetchRequestId[state.fetchRequestId].push(action.payload.id);
        }
      })
      .addCase(createProject.rejected, (state, action) => {
        if (state.creationRequestId !== action.meta.requestId) return;

        state.creationStatus = "failed";
        state.creationError = action.payload;
        state.creationRequestId = null;
      })
      .addCase(updateProject.pending, (state, action) => {
        const { projectId } = action.meta.arg;
        state.updateStatusById[projectId] = "loading";
        state.updateRequestIdById[projectId] = action.meta.requestId;
        delete state.updateErrorById[projectId];
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        const project = action.payload;
        if (state.updateRequestIdById[project.id] !== action.meta.requestId) return;

        state.updateStatusById[project.id] = "succeeded";
        state.items = state.items.map((item) => item.id === project.id ? project : item);
        if (state.fetchRequestId) {
          state.protectedProjectIdsByFetchRequestId[state.fetchRequestId].push(project.id);
        }
        delete state.updateRequestIdById[project.id];
      })
      .addCase(updateProject.rejected, (state, action) => {
        const { projectId, message } = action.payload;
        if (state.updateRequestIdById[projectId] !== action.meta.requestId) return;

        state.updateStatusById[projectId] = "failed";
        state.updateErrorById[projectId] = message;
        delete state.updateRequestIdById[projectId];
      })
      .addCase(deleteProject.pending, (state, action) => {
        const projectId = action.meta.arg;
        state.deletionStatusById[projectId] = "loading";
        state.deletionRequestIdById[projectId] = action.meta.requestId;
        delete state.deletionErrorById[projectId];
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        const projectId = action.payload;
        if (state.deletionRequestIdById[projectId] !== action.meta.requestId) return;

        state.deletionStatusById[projectId] = "succeeded";
        state.items = state.items.filter((item) => item.id !== projectId);
        delete state.membersByProjectId[projectId];
        if (!state.deletedProjectIds.includes(projectId)) state.deletedProjectIds.push(projectId);
        delete state.deletionRequestIdById[projectId];
      })
      .addCase(deleteProject.rejected, (state, action) => {
        const { projectId, message } = action.payload;
        if (state.deletionRequestIdById[projectId] !== action.meta.requestId) return;

        state.deletionStatusById[projectId] = "failed";
        state.deletionErrorById[projectId] = message;
        delete state.deletionRequestIdById[projectId];
      })
      .addCase(fetchProjectMembers.pending, (state, action) => {
        const projectId = action.meta.arg;
        state.memberListStatusByProjectId[projectId] = "loading";
        state.memberListFetchRequestIdByProjectId[projectId] = action.meta.requestId;
        state.memberAdditionsByFetchRequestId[action.meta.requestId] = [];
        state.memberRemovalIdsByFetchRequestId[action.meta.requestId] = [];
        delete state.memberListErrorByProjectId[projectId];
      })
      .addCase(fetchProjectMembers.fulfilled, (state, action) => {
        const { projectId, members } = action.payload;
        if (state.memberListFetchRequestIdByProjectId[projectId] !== action.meta.requestId) return;

        state.memberListStatusByProjectId[projectId] = "succeeded";
        state.membersByProjectId[projectId] = reconcileFetchedProjectMembers(
          members,
          state.memberAdditionsByFetchRequestId[action.meta.requestId],
          state.memberRemovalIdsByFetchRequestId[action.meta.requestId],
        );
        delete state.memberAdditionsByFetchRequestId[action.meta.requestId];
        delete state.memberRemovalIdsByFetchRequestId[action.meta.requestId];
        delete state.memberListFetchRequestIdByProjectId[projectId];
      })
      .addCase(fetchProjectMembers.rejected, (state, action) => {
        const { projectId, message } = action.payload;
        if (state.memberListFetchRequestIdByProjectId[projectId] !== action.meta.requestId) return;

        state.memberListStatusByProjectId[projectId] = "failed";
        state.memberListErrorByProjectId[projectId] = message;
        delete state.memberAdditionsByFetchRequestId[action.meta.requestId];
        delete state.memberRemovalIdsByFetchRequestId[action.meta.requestId];
        delete state.memberListFetchRequestIdByProjectId[projectId];
      })
      .addCase(addProjectMemberByEmail.pending, (state, action) => {
        const { projectId } = action.meta.arg;
        state.memberAdditionStatusByProjectId[projectId] = "loading";
        state.memberAdditionRequestIdByProjectId[projectId] = action.meta.requestId;
        const fetchRequestId = state.memberListFetchRequestIdByProjectId[projectId];
        if (fetchRequestId) {
          state.memberAdditionFetchRequestIdByRequestId[action.meta.requestId] = fetchRequestId;
        }
        delete state.memberAdditionErrorByProjectId[projectId];
      })
      .addCase(addProjectMemberByEmail.fulfilled, (state, action) => {
        const { projectId, member } = action.payload;
        if (state.memberAdditionRequestIdByProjectId[projectId] !== action.meta.requestId) return;

        const members = state.membersByProjectId[projectId] ?? [];
        state.memberAdditionStatusByProjectId[projectId] = "succeeded";
        state.membersByProjectId[projectId] = [...members, member];
        const fetchRequestId = state.memberAdditionFetchRequestIdByRequestId[action.meta.requestId];
        if (state.memberListFetchRequestIdByProjectId[projectId] === fetchRequestId) {
          state.memberAdditionsByFetchRequestId[fetchRequestId].push(member);
        }
        delete state.memberRemovalStatusById[`${projectId}-${member.id}`];
        delete state.memberRemovalErrorById[`${projectId}-${member.id}`];
        delete state.memberAdditionRequestIdByProjectId[projectId];
        delete state.memberAdditionFetchRequestIdByRequestId[action.meta.requestId];
      })
      .addCase(addProjectMemberByEmail.rejected, (state, action) => {
        const { projectId, message } = action.payload;
        if (state.memberAdditionRequestIdByProjectId[projectId] !== action.meta.requestId) return;

        state.memberAdditionStatusByProjectId[projectId] = "failed";
        state.memberAdditionErrorByProjectId[projectId] = message;
        delete state.memberAdditionRequestIdByProjectId[projectId];
        delete state.memberAdditionFetchRequestIdByRequestId[action.meta.requestId];
      })
      .addCase(removeProjectMember.pending, (state, action) => {
        const { projectId, userId } = action.meta.arg;
        const memberKey = `${projectId}-${userId}`;
        state.memberRemovalStatusById[memberKey] = "loading";
        state.memberRemovalRequestIdById[memberKey] = action.meta.requestId;
        const fetchRequestId = state.memberListFetchRequestIdByProjectId[projectId];
        if (fetchRequestId) {
          state.memberRemovalFetchRequestIdByRequestId[action.meta.requestId] = fetchRequestId;
        }
        delete state.memberRemovalErrorById[memberKey];
      })
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        const { projectId, userId } = action.payload;
        const memberKey = `${projectId}-${userId}`;
        if (state.memberRemovalRequestIdById[memberKey] !== action.meta.requestId) return;

        state.memberRemovalStatusById[memberKey] = "succeeded";
        state.membersByProjectId[projectId] = state.membersByProjectId[projectId]
          .filter((member) => member.id !== userId);
        const fetchRequestId = state.memberRemovalFetchRequestIdByRequestId[action.meta.requestId];
        if (state.memberListFetchRequestIdByProjectId[projectId] === fetchRequestId) {
          state.memberRemovalIdsByFetchRequestId[fetchRequestId].push(userId);
        }
        delete state.memberRemovalRequestIdById[memberKey];
        delete state.memberRemovalFetchRequestIdByRequestId[action.meta.requestId];
      })
      .addCase(removeProjectMember.rejected, (state, action) => {
        const { projectId, userId, message } = action.payload;
        const memberKey = `${projectId}-${userId}`;
        if (state.memberRemovalRequestIdById[memberKey] !== action.meta.requestId) return;

        state.memberRemovalStatusById[memberKey] = "failed";
        state.memberRemovalErrorById[memberKey] = message;
        delete state.memberRemovalRequestIdById[memberKey];
        delete state.memberRemovalFetchRequestIdByRequestId[action.meta.requestId];
      });
  },
});

export const {
  clearProjectCreationError,
  clearProjectMemberAdditionError,
} = projectsSlice.actions;

export default projectsSlice.reducer;
