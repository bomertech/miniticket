import Link from "next/link";

import { FlashMessage } from "@/components/flash-message";
import { getFlashMessage } from "@/lib/flash";

export const dynamic = "force-dynamic";

export default async function ReviewApprovedPage({
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const flash = await getFlashMessage();

  return (
    <main className="review-page">
      <div className="review-card review-card--success">
        <p className="eyebrow">Ticket approved</p>
        <h1>The ticket is marked done.</h1>
        <FlashMessage message={flash?.message} tone={flash?.tone || "success"} />
        <p className="review-copy">
          Thanks for confirming the work. If anything still needs attention, reply to the review
          email and it will go directly back to BomerTech.
        </p>
        <Link className="button button-secondary" href="/">
          Return to login
        </Link>
      </div>
    </main>
  );
}
