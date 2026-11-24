import { describe, expect, it } from "vitest";
import activitiesReducer, {
  completionKeyForActivity,
  deleteActivity,
  fetchActivities,
} from "./activitiesSlice";

describe("completionKeyForActivity", () => {
  it("uses the configured local day for daily recurring activities", () => {
    const activity = {
      id: 8,
      recurrente: 1,
      frecuencia: "diaria",
      zona_horaria: "America/Argentina/Buenos_Aires",
    };

    expect(completionKeyForActivity(activity, new Date("2026-05-12T02:30:00.000Z")))
      .toBe("8:2026-05-11");
  });

  it("uses Monday as the weekly period key", () => {
    const activity = {
      id: 4,
      recurrente: 1,
      frecuencia: "semanal",
      zona_horaria: "UTC",
    };

    expect(completionKeyForActivity(activity, new Date("2026-05-17T20:00:00.000Z")))
      .toBe("4:2026-05-11");
  });

  it("keeps a one-time activity keyed only by its id", () => {
    expect(completionKeyForActivity({ id: 12, recurrente: 0 })).toBe("12");
  });
});

describe("activity refresh guards", () => {
  it("does not restore an activity deleted while an older refresh is in flight", () => {
    let state = activitiesReducer(undefined, fetchActivities.pending("refresh-1"));
    state = activitiesReducer(state, deleteActivity.pending("delete-1", 8));
    state = activitiesReducer(state, deleteActivity.fulfilled(8, "delete-1", 8));
    state = activitiesReducer(state, fetchActivities.fulfilled([
      { id: 8, recurrente: 0, estado: "pendiente" },
      { id: 9, recurrente: 0, estado: "pendiente" },
    ], "refresh-1"));

    expect(state.items.map((activity) => activity.id)).toEqual([9]);
  });
});
