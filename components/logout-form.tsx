import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function LogoutForm() {
  return (
    <form action={logoutAction}>
      <SubmitButton
        label="Log out"
        pendingLabel="Logging out..."
        className="button button-secondary"
      />
    </form>
  );
}
