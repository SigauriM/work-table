import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "../auth/session";
import { ApiError, apiFetch } from "./client";

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("apiFetch refresh", () => {
  beforeEach(() => {
    clearSession();
    document.cookie = "csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearSession();
    document.cookie = "csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("on 401 refreshes with CSRF only on /auth/refresh then retries", async () => {
    document.cookie = "csrf=csrf-token";
    setAccessToken("old-access");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      if (url === "/api/v1/auth/refresh") {
        expect(init?.method).toBe("POST");
        expect(init?.credentials).toBe("include");
        expect(headers.get("X-CSRF-Token")).toBe("csrf-token");
        return jsonResponse(200, {
          accessToken: "new-access",
          user: {
            id: "u1",
            login: "ivan",
            role: "EMPLOYEE",
            employeeId: "e1",
            mustChangePassword: false,
          },
        });
      }
      if (url === "/api/v1/shifts") {
        expect(headers.get("X-CSRF-Token")).toBeNull();
        if (headers.get("Authorization") === "Bearer old-access") {
          return jsonResponse(401, { error: "Unauthorized" });
        }
        expect(headers.get("Authorization")).toBe("Bearer new-access");
        return jsonResponse(200, []);
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetch("/api/v1/shifts");
    expect(data).toEqual([]);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(["/api/v1/shifts", "/api/v1/auth/refresh", "/api/v1/shifts"]);
  });

  it("does not send CSRF on a non-auth POST", async () => {
    document.cookie = "csrf=csrf-token";
    setAccessToken("access");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(url).toBe("/api/v1/shifts");
      expect(headers.get("X-CSRF-Token")).toBeNull();
      expect(headers.get("Authorization")).toBe("Bearer access");
      return jsonResponse(201, { id: "s1" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/shifts", { method: "POST", body: { date: "2026-03-02" } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws ApiError when refresh fails after 401", async () => {
    document.cookie = "csrf=csrf-token";
    setAccessToken("old-access");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/v1/auth/refresh") {
          return jsonResponse(401, { error: "Unauthorized" });
        }
        return jsonResponse(401, { error: "Unauthorized" });
      }),
    );

    await expect(apiFetch("/api/v1/me/stats")).rejects.toBeInstanceOf(ApiError);
  });
});
