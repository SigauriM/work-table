import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../pwa", () => ({
  registerPwa: vi.fn(async () => undefined),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const employeeUser = {
  id: "u1",
  login: "ivan",
  role: "EMPLOYEE" as const,
  employeeId: "e1",
  mustChangePassword: false,
};

async function renderProbe() {
  const { AuthProvider } = await import("./AuthContext");
  const { useAuth } = await import("./useAuth");
  function Probe() {
    const { user, ready, login } = useAuth();
    if (!ready) return <div>not-ready</div>;
    return (
      <div>
        <div data-testid="login">{user?.login ?? "none"}</div>
        <button type="button" onClick={() => void login("ivan", "ivanpass12ab")}>
          do-login
        </button>
      </div>
    );
  }
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.removeItem("worktable-locale");
    document.cookie = "csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    document.cookie = "csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.unstubAllGlobals();
  });

  it("is ready with no user when there is no csrf cookie", async () => {
    await renderProbe();
    expect((await screen.findByTestId("login")).textContent).toBe("none");
  });

  it("restores the session from refresh cookie + CSRF", async () => {
    document.cookie = "csrf=csrf-token; path=/";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/v1/auth/refresh");
        expect(init?.credentials).toBe("include");
        expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("csrf-token");
        return jsonResponse(200, { accessToken: "restored", user: employeeUser });
      }),
    );

    await renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId("login").textContent).toBe("ivan");
    });
  });

  it("login stores the user from /auth/login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/api/v1/auth/login");
        return jsonResponse(200, { accessToken: "logged-in", user: employeeUser });
      }),
    );

    await renderProbe();
    await screen.findByTestId("login");
    screen.getByText("do-login").click();
    await waitFor(() => {
      expect(screen.getByTestId("login").textContent).toBe("ivan");
    });
  });
});
