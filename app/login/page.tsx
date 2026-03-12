import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getFlashMessage } from "@/lib/flash";

export const dynamic = "force-dynamic";

export default async function LoginPage({
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/client");
  }

  const flash = await getFlashMessage();

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__brand">
          <div className="auth-card__mark">B</div>
          <span className="auth-card__brand-name">BomerTech</span>
        </div>

        <h1>Sign in</h1>
        <p className="auth-card__subtitle">Access your ticketing dashboard</p>

        <FlashMessage message={flash?.message} tone={flash?.tone || "error"} />

        <form action={loginAction} className="stack-form">
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" placeholder="you@company.com" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" placeholder="Enter your password" required />
          </label>

          <SubmitButton label="Sign in" pendingLabel="Signing in..." />
        </form>
      </section>
    </main>
  );
}
