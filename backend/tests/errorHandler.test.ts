import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { errorHandler, HttpError } from "../src/middleware/errorHandler.js";

function appWith(route: (e: express.Express) => void) {
  const e = express();
  e.use(express.json());
  route(e);
  e.use(errorHandler);
  return e;
}

describe("errorHandler codes", () => {
  it("adds code from the English message on HttpError", async () => {
    const app = appWith((e) => {
      e.get("/overlap", () => {
        throw new HttpError(409, "Overlapping shift");
      });
    });
    const res = await request(app).get("/overlap");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Overlapping shift",
      code: "SHIFT_OVERLAP",
    });
  });

  it("omits code when the message is unknown", async () => {
    const app = appWith((e) => {
      e.get("/plain", () => {
        throw new HttpError(400, "some unique msg");
      });
    });
    const res = await request(app).get("/plain");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "some unique msg" });
    expect(res.body.code).toBeUndefined();
  });

  it("maps ZodError to INVALID_REQUEST", async () => {
    const app = appWith((e) => {
      e.post("/zod", (req) => {
        z.object({ login: z.string() }).parse(req.body);
      });
    });
    const res = await request(app).post("/zod").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid request",
      code: "INVALID_REQUEST",
    });
  });

  it("maps JSON SyntaxError to INVALID_JSON", async () => {
    const app = appWith((e) => {
      e.post("/echo", (req, res) => {
        res.json(req.body);
      });
    });
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON", code: "INVALID_JSON" });
  });

  it("maps unknown errors to INTERNAL", async () => {
    const app = appWith((e) => {
      e.get("/boom", () => {
        throw new Error("boom");
      });
    });
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "Internal server error",
      code: "INTERNAL",
    });
  });
});
