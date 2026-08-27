import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { btnPrimary, inputClass } from "../ui";

export default function ChangePasswordPage() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Change password</h1>
      <p className="text-sm text-[var(--ts-mute)]">
        You must set a new password before using the timesheet.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--ts-mute)]">
          Current password
          <input
            className={inputClass}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={pending}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--ts-mute)]">
          New password
          <input
            className={inputClass}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={pending}
          />
        </label>

        {error ? (
          <p className="text-sm text-[var(--ts-under)]" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>

      <button
        type="button"
        className="text-sm font-semibold text-[var(--ts-mute)]"
        onClick={() => void logout()}
      >
        Log out
      </button>
    </div>
  );
}
