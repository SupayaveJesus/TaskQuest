import { describe, expect, it } from "vitest";
import projectsReducer, {
  addProjectMemberByEmail,
  fetchProjectMembers,
  removeProjectMember,
} from "./projectsSlice";

describe("project member refresh guards", () => {
  it("uses a later member response as the authoritative list", () => {
    let state = projectsReducer(undefined, fetchProjectMembers.pending("initial", 4));
    state = projectsReducer(state, fetchProjectMembers.fulfilled({
      projectId: 4,
      members: [
        { id: 1, nombre: "Ada" },
        { id: 2, nombre: "Grace" },
      ],
    }, "initial", 4));
    state = projectsReducer(state, fetchProjectMembers.pending("refresh", 4));
    state = projectsReducer(state, fetchProjectMembers.fulfilled({
      projectId: 4,
      members: [{ id: 1, nombre: "Ada" }],
    }, "refresh", 4));

    expect(state.membersByProjectId[4].map((member) => member.id)).toEqual([1]);
  });

  it("preserves additions and removals made during the exact member refresh", () => {
    let state = projectsReducer(undefined, fetchProjectMembers.pending("initial", 4));
    state = projectsReducer(state, fetchProjectMembers.fulfilled({
      projectId: 4,
      members: [
        { id: 1, nombre: "Ada" },
        { id: 2, nombre: "Grace" },
      ],
    }, "initial", 4));
    state = projectsReducer(state, fetchProjectMembers.pending("refresh", 4));
    state = projectsReducer(state, addProjectMemberByEmail.pending("add", { projectId: 4 }));
    state = projectsReducer(state, addProjectMemberByEmail.fulfilled(
      { projectId: 4, member: { id: 3, nombre: "Lin" } },
      "add",
      { projectId: 4 },
    ));
    state = projectsReducer(state, removeProjectMember.pending("remove", { projectId: 4, userId: 1 }));
    state = projectsReducer(state, removeProjectMember.fulfilled(
      { projectId: 4, userId: 1 },
      "remove",
      { projectId: 4, userId: 1 },
    ));
    state = projectsReducer(state, fetchProjectMembers.fulfilled({
      projectId: 4,
      members: [
        { id: 1, nombre: "Ada" },
        { id: 2, nombre: "Grace" },
      ],
    }, "refresh", 4));

    expect(state.membersByProjectId[4].map((member) => member.id)).toEqual([2, 3]);
  });
});
