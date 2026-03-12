import { cookies } from "next/headers";

const SELECTED_PROJECT_COOKIE_NAME = "ticketing_selected_project";

export async function setSelectedProjectId(projectId: number) {
  const cookieStore = await cookies();

  cookieStore.set(SELECTED_PROJECT_COOKIE_NAME, String(projectId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function getSelectedProjectId() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SELECTED_PROJECT_COOKIE_NAME)?.value;
  const projectId = Number.parseInt(value || "", 10);

  return Number.isFinite(projectId) ? projectId : null;
}
