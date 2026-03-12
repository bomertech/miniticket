"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  clearFailedLoginAttempts,
  destroySession,
  getLoginLockout,
  getRequestClientIp,
  loginWithPassword,
  normalizeLoginEmail,
  recordFailedLoginAttempt,
  requireUser
} from "@/lib/auth";
import {
  addTicketCommentByClient,
  approveTicketReview,
  createClientUser,
  createProjectForClient,
  createTicketForClient,
  getAdminRecipients,
  updateTicketByAdmin
} from "@/lib/data";
import { sendClientReviewEmail, sendNewTicketAlert } from "@/lib/email";
import { setFlashMessage } from "@/lib/flash";
import { setSelectedProjectId } from "@/lib/project-selection";
import { parseIntStrict } from "@/lib/utils";

function handleActionError(error: unknown, fallbackMessage: string): string {
  unstable_rethrow(error);

  if (error instanceof Error) {
    console.error(error);
    return error.message;
  }

  console.error("Unknown server action error", error);
  return fallbackMessage;
}

async function redirectWithMessage(
  path: string,
  kind: "success" | "error",
  message: string
): Promise<never> {
  const fallbackPath = path.startsWith("/") ? path : "/dashboard";

  await setFlashMessage({
    tone: kind,
    message
  });

  redirect(fallbackPath);
}

function safeRedirectTarget(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }

  return value;
}

function getActionRedirectTargets(formData: FormData, fallback: string) {
  const redirectTo = safeRedirectTarget(formData.get("redirectTo"), fallback);
  const errorRedirectTo = safeRedirectTarget(formData.get("errorRedirectTo"), redirectTo);

  return {
    redirectTo,
    errorRedirectTo
  };
}

function formatLockoutMessage(lockedUntil: Date) {
  const retryAfterMs = Math.max(lockedUntil.getTime() - Date.now(), 0);
  const retryAfterMinutes = Math.max(Math.ceil(retryAfterMs / (60 * 1000)), 1);

  return `Too many sign-in attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const normalizedEmail = normalizeLoginEmail(email);
  const clientIp = await getRequestClientIp();
  const activeLockout = getLoginLockout(normalizedEmail, clientIp);

  if (activeLockout) {
    return redirectWithMessage("/login", "error", formatLockoutMessage(activeLockout));
  }

  const user = await loginWithPassword(email, password);

  if (!user) {
    const lockout = recordFailedLoginAttempt(normalizedEmail, clientIp);

    if (lockout) {
      return redirectWithMessage("/login", "error", formatLockoutMessage(lockout));
    }

    return redirectWithMessage("/login", "error", "Invalid email or password.");
  }

  clearFailedLoginAttempts(normalizedEmail, clientIp);
  redirect(user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/client");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function createClientAction(formData: FormData) {
  await requireUser("ADMIN");
  const { redirectTo, errorRedirectTo } = getActionRedirectTargets(formData, "/dashboard/admin");

  try {
    createClientUser({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      companyName: String(formData.get("companyName") || ""),
      password: String(formData.get("password") || "")
    });

    revalidatePath("/dashboard/admin");
    return redirectWithMessage(redirectTo, "success", "Client account created.");
  } catch (error) {
    return redirectWithMessage(
      errorRedirectTo,
      "error",
      handleActionError(error, "Unable to create client.")
    );
  }
}

export async function createProjectAction(formData: FormData) {
  await requireUser("ADMIN");
  const { redirectTo, errorRedirectTo } = getActionRedirectTargets(formData, "/dashboard/admin");

  const clientId = parseIntStrict(formData.get("clientId"));

  try {
    createProjectForClient({
      clientId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "")
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/client");
    return redirectWithMessage(redirectTo, "success", "Project created.");
  } catch (error) {
    return redirectWithMessage(
      errorRedirectTo,
      "error",
      handleActionError(error, "Unable to create project.")
    );
  }
}

export async function createTicketAction(formData: FormData) {
  const currentUser = await requireUser("CLIENT");
  const redirectTo = safeRedirectTarget(formData.get("redirectTo"), "/dashboard/client");
  const projectId = parseIntStrict(formData.get("projectId"));
  const priority = String(formData.get("priority") || "MEDIUM");

  try {
    const ticket = createTicketForClient({
      clientId: currentUser.id,
      projectId,
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    });

    const adminEmails = getAdminRecipients();
    const emailResult =
      adminEmails.length > 0
        ? await sendNewTicketAlert({
            adminEmails,
            clientName: ticket.clientName,
            clientEmail: ticket.clientEmail,
            projectName: ticket.projectName,
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority
          })
        : { sent: false };

    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/admin");

    return redirectWithMessage(
      redirectTo,
      "success",
      emailResult.sent
        ? "Ticket created and emailed to the admin."
        : "Ticket created. Email was skipped because SMTP is not configured."
    );
  } catch (error) {
    return redirectWithMessage(
      redirectTo,
      "error",
      handleActionError(error, "Unable to create ticket.")
    );
  }
}

export async function selectProjectAction(formData: FormData) {
  await requireUser("CLIENT");

  const projectId = parseIntStrict(formData.get("projectId"));

  if (Number.isFinite(projectId)) {
    await setSelectedProjectId(projectId);
  }

  redirect("/dashboard/client");
}

export async function addTicketCommentAction(formData: FormData) {
  const currentUser = await requireUser("CLIENT");
  const redirectTo = safeRedirectTarget(formData.get("redirectTo"), "/dashboard/client");
  const ticketId = parseIntStrict(formData.get("ticketId"));

  try {
    addTicketCommentByClient({
      ticketId,
      clientId: currentUser.id,
      actorName: currentUser.name,
      body: String(formData.get("body") || "")
    });

    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/admin");
    return redirectWithMessage(redirectTo, "success", "Comment added.");
  } catch (error) {
    return redirectWithMessage(
      redirectTo,
      "error",
      handleActionError(error, "Unable to add a comment.")
    );
  }
}

export async function updateTicketAction(formData: FormData) {
  const currentUser = await requireUser("ADMIN");
  const { redirectTo, errorRedirectTo } = getActionRedirectTargets(formData, "/dashboard/admin");
  const ticketId = parseIntStrict(formData.get("ticketId"));
  const status = String(formData.get("status") || "");
  const priority = String(formData.get("priority") || "");

  try {
    const result = updateTicketByAdmin({
      ticketId,
      status: status as "NOT_STARTED" | "IN_PROGRESS" | "CLIENT_REVIEW" | "DONE",
      priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      resolutionSummary: String(formData.get("resolutionSummary") || ""),
      adminNotes: String(formData.get("adminNotes") || ""),
      actorName: currentUser.name
    });

    let message = "Ticket updated.";

    if (result.approvalUrl && result.resolutionSummary && result.replyTo) {
      const emailResult = await sendClientReviewEmail({
        clientEmail: result.clientEmail,
        clientName: result.clientName,
        projectName: result.projectName,
        ticketTitle: result.title,
        resolutionSummary: result.resolutionSummary,
        approvalUrl: result.approvalUrl,
        adminReplyTo: result.replyTo
      });

      message = emailResult.sent
        ? "Ticket updated and review email sent to the client."
        : "Ticket updated. Review email was skipped because SMTP is not configured.";
    }

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/client");
    return redirectWithMessage(redirectTo, "success", message);
  } catch (error) {
    return redirectWithMessage(
      errorRedirectTo,
      "error",
      handleActionError(error, "Unable to update ticket.")
    );
  }
}

export async function approveReviewAction(formData: FormData) {
  const token = String(formData.get("token") || "");

  try {
    const context = approveTicketReview(token);

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/client");
    await setFlashMessage({
      tone: "success",
      message: `"${context.ticketTitle}" marked done.`
    });
    redirect("/review/approved");
  } catch (error) {
    return redirectWithMessage(
      `/review/approve?token=${encodeURIComponent(token)}`,
      "error",
      handleActionError(error, "Unable to approve this ticket.")
    );
  }
}
