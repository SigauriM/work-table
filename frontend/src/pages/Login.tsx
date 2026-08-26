import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { btnPrimary, inputClass } from "../ui";

export default function LoginPage() {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(loginName.trim(), password);
      // редирект: App увидит user и уведёт с /login
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
      <h1 className="text-2xl font-semibold">Work Table</h1>
      <p className="text-sm text-neutral-600">Sign in</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Login
          <input
            className={inputClass}
            name="login"
            autoComplete="username"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            required
            disabled={pending}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={pending}
          />
        </label>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className={btnPrimary}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}