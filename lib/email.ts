import nodemailer from "nodemailer";

import { formatPriorityLabel } from "@/lib/utils";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function preserveLineBreaks(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass
    }
  });
}

export async function sendEmail(options: SendEmailOptions) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "mailer@example.com";

  if (!transporter) {
    console.warn("SMTP not configured. Email skipped:", options.subject);
    return {
      sent: false
    };
  }

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo
  });

  return {
    sent: true
  };
}

export async function sendNewTicketAlert(input: {
  adminEmails: string[];
  clientName: string;
  clientEmail: string;
  projectName: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const subject = `New ticket: ${input.title}`;
  const html = `
    <div style="font-family: Avenir Next, Segoe UI, sans-serif; line-height: 1.6; color: #11203b;">
      <h2 style="margin-bottom: 8px;">New ticket submitted</h2>
      <p><strong>Client:</strong> ${escapeHtml(input.clientName)} (${escapeHtml(input.clientEmail)})</p>
      <p><strong>Project:</strong> ${escapeHtml(input.projectName)}</p>
      <p><strong>Priority:</strong> ${formatPriorityLabel(input.priority)}</p>
      <p><strong>Title:</strong> ${escapeHtml(input.title)}</p>
      <p style="white-space: pre-wrap;"><strong>Description:</strong><br />${preserveLineBreaks(input.description)}</p>
    </div>
  `;
  const text = [
    "New ticket submitted",
    `Client: ${input.clientName} (${input.clientEmail})`,
    `Project: ${input.projectName}`,
    `Priority: ${formatPriorityLabel(input.priority)}`,
    `Title: ${input.title}`,
    "",
    input.description
  ].join("\n");

  return sendEmail({
    to: input.adminEmails,
    subject,
    html,
    text
  });
}

export async function sendClientReviewEmail(input: {
  clientEmail: string;
  clientName: string;
  projectName: string;
  ticketTitle: string;
  resolutionSummary: string;
  approvalUrl: string;
  adminReplyTo: string;
}) {
  const subject = `Review requested: ${input.ticketTitle}`;
  const html = `
    <div style="font-family: Avenir Next, Segoe UI, sans-serif; line-height: 1.7; color: #11203b;">
      <h2 style="margin-bottom: 10px;">Your ticket is ready for review</h2>
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p><strong>Project:</strong> ${escapeHtml(input.projectName)}</p>
      <p><strong>Ticket:</strong> ${escapeHtml(input.ticketTitle)}</p>
      <p><strong>What was completed:</strong></p>
      <p style="white-space: pre-wrap;">${preserveLineBreaks(input.resolutionSummary)}</p>
      <p>
        If everything looks good, use this link to confirm completion:
        <br />
        <a href="${input.approvalUrl}">${input.approvalUrl}</a>
      </p>
      <p>If you still want changes, simply reply to this email and I’ll review the feedback.</p>
    </div>
  `;
  const text = [
    `Hi ${input.clientName},`,
    "",
    "Your ticket is ready for review.",
    `Project: ${input.projectName}`,
    `Ticket: ${input.ticketTitle}`,
    "",
    "What was completed:",
    input.resolutionSummary,
    "",
    `Approve the work: ${input.approvalUrl}`,
    "",
    "If you still want changes, reply to this email."
  ].join("\n");

  return sendEmail({
    to: input.clientEmail,
    subject,
    html,
    text,
    replyTo: input.adminReplyTo
  });
}
