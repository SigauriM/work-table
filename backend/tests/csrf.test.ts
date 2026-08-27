import { describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { requireCsrf } from "../src/modules/auth/auth.csrf.js";

describe("requireCsrf", () => {
  function app() {
    const e = express();
    e.use(cookieParser());
    e.post("/refresh", requireCsrf, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    e.post("/shifts", (_req, res) => {
      res.status(201).json({ ok: true });
    });
    e.use(errorHandler);
    return e;
  }

  it("rejects refresh without the CSRF header", async () => {
    const res = await request(app())
      .post("/refresh")
      .set("Cookie", "csrf=secret-token");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("rejects refresh when header and cookie differ", async () => {
    const res = await request(app())
      .post("/refresh")
      .set("Cookie", "csrf=secret-token")
      .set("X-CSRF-Token", "other");
    expect(res.status).toBe(403);
  });

  it("allows refresh when header matches cookie", async () => {
    const res = await request(app())
      .post("/refresh")
      .set("Cookie", "csrf=secret-token")
      .set("X-CSRF-Token", "secret-token");
    expect(res.status).toBe(200);
  });

  it("does not require CSRF on other POST routes", async () => {
    const res = await request(app()).post("/shifts");
    expect(res.status).toBe(201);
  });
});
