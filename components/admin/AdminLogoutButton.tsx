import { signOutAction } from "@/app/actions/auth";

export default function AdminLogoutButton() {
  return (
    <form action={signOutAction}>
      <button className="bd-logout-btn" type="submit">
        Déconnexion
      </button>
    </form>
  );
}
