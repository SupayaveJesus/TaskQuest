import { createAction } from "@reduxjs/toolkit";

export const logout = createAction("auth/logout");
export const sessionStarted = createAction("auth/sessionStarted");
