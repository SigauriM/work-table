import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  createLoginRateLimiter,
  createRefreshRateLimiters,
  peekRefreshTokenId,
} from "../src/modules/auth/auth.rateLimit.js";

describe("peekRefreshTokenId", () => {
  it("reads id without verifying the secret", () => {
    expect(peekRefreshTokenId("abc-uuid.deadbeef")).toBe("abc-uuid");
  });

  it("returns null for garbage", () => {
    expect(peekRefreshTokenId("nosecret")).toBeNull();
    expect(peekRefreshTokenId("")).toBeNull();
    expect(peekRefreshTokenId(".")).toBeNull();
  });
});

describe("login rate limit", () => {
  it("returns 429 on the 6th failed login for the same IP+login", async () => {
    const app = express();
    app.use(express.json());
    app.post("/login", createLoginRateLimiter(true), (_req, res) => {
      res.status(401).json({ error: "Invalid credentials" });
    });

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post("/login").send({ login: "anna", password: "x" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    }
    const blocked = await request(app).post("/login").send({ login: "anna", password: "x" });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests" });
  });

  it("does not share the limit across different logins on the same IP", async () => {
    const app = express();
    app.use(express.json());
    app.post("/login", createLoginRateLimiter(true), (_req, res) => {
      res.status(401).json({ error: "Invalid credentials" });
    });
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/login").send({ login: "anna", password: "x" });
    }
    const other = await request(app).post("/login").send({ login: "boris", password: "x" });
    expect(other.status).toBe(401);
  });

  it("is a no-op when disabled (test env)", async () => {
    const app = express();
    app.use(express.json());
    app.post("/login", createLoginRateLimiter(false), (_req, res) => {
      res.status(401).json({ error: "Invalid credentials" });
    });
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post("/login").send({ login: "anna", password: "x" });
      expect(res.status).toBe(401);
    }
  });
});

describe("refresh rate limit", () => {
  function refreshApp() {
    const app = express();
    app.use(express.json());
    app.post("/refresh", ...createRefreshRateLimiters(true), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    return app;
  }

  it("allows two different token ids from the same IP", async () => {
    const app = refreshApp();
    const a = await request(app).post("/refresh").set("Cookie", "refresh=id-one.secret");
    const b = await request(app).post("/refresh").set("Cookie", "refresh=id-two.secret");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it("returns 429 on the 31st refresh of the same token id", async () => {
    const app = refreshApp();
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app).post("/refresh").set("Cookie", "refresh=same-id.secret");
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/refresh").set("Cookie", "refresh=same-id.secret");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests" });
  });

  it("does not apply the login 5/15min ceiling to junk refresh cookies", async () => {
    const app = refreshApp();
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post("/refresh").set("Cookie", "refresh=not-a-token");
      expect(res.status).toBe(200);
    }
  });
});
