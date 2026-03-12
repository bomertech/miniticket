import { approveReviewAction } from "@/app/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { getReviewRequestContext } from "@/lib/data";
import { getFlashMessage } from "@/lib/flash";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParamValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function ReviewApprovalPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = getParamValue(params, "token") || null;
  const lookup = getReviewRequestContext(token);
  const flash = await getFlashMessage();

  return (
    <main className="review-page">
      <div className="review-card">
        <div className="auth-card__brand" style={{ marginBottom: 24 }}>
          <div className="auth-card__mark">B</div>
          <span className="auth-card__brand-name">BomerTech</span>
        </div>

        <h1>Review completed work</h1>
        <FlashMessage message={flash?.message} tone={flash?.tone || "error"} />

        {lookup.kind === "valid" ? (
          <>
            <p className="review-copy">
              This ticket is ready for your confirmation. If everything looks right, approve
              below. To request changes, reply to the email you received.
            </p>

            <div className="review-summary">
              <div className="review-summary__item">
                <span>Ticket</span>
                <strong>{lookup.context.ticketTitle}</strong>
              </div>
              <div className="review-summary__item">
                <span>Project</span>
                <strong>{lookup.context.projectName}</strong>
              </div>
              <div className="review-summary__item">
                <span>Client</span>
                <strong>{lookup.context.clientName}</strong>
              </div>
              <div className="review-summary__item">
                <span>Expires</span>
                <strong>{formatDateTime(lookup.context.expiresAt)}</strong>
              </div>
            </div>

            <section className="panel panel-muted" style={{ marginBottom: 20 }}>
              <div className="panel__header">
                <h2 className="panel__title">What was done</h2>
              </div>
              <p className="review-details">
                {lookup.context.resolutionSummary || "No completion summary was provided."}
              </p>
            </section>

            <form action={approveReviewAction} className="stack-form">
              <input type="hidden" name="token" value={token || ""} />
              <SubmitButton label="Approve and mark done" pendingLabel="Approving..." />
            </form>
          </>
        ) : (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <h3>
              {lookup.kind === "missing" && "Missing approval link"}
              {lookup.kind === "invalid" && "This approval link is invalid"}
              {lookup.kind === "expired" && "This approval link expired"}
              {lookup.kind === "used" && "This ticket was already approved"}
            </h3>
            <p>
              If you still need help, reply to the review email and BomerTech will pick it back
              up.
            </p>
          </div>
        )}

        <p className="text-link">
          Need changes instead? Reply to the original review email.
        </p>
      </div>
    </main>
  );
}
