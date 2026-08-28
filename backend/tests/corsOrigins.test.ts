import { describe, expect, it } from "vitest";
import cors from "cors";
import express from "express";
import request from "supertest";
import {
  DEFAULT_CORS_ORIGINS,
  parseCorsOrigins,
} from "../src/config/corsOrigins.js";

describe("parseCorsOrigins", () => {
  it("defaults when missing, blank, or only *", () => {
    const expected = [...DEFAULT_CORS_ORIGINS];
    expect(parseCorsOrigins(undefined)).toEqual(expected);
    expect(parseCorsOrigins("")).toEqual(expected);
    expect(parseCorsOrigins("   ")).toEqual(expected);
    expect(parseCorsOrigins("*")).toEqual(expected);
  });

  it("splits, trims, and drops *", () => {
    expect(parseCorsOrigins("http://192.168.1.5:5173")).toEqual([
      "http://192.168.1.5:5173",
    ]);
    expect(
      parseCorsOrigins(" http://localhost:5173 , http://127.0.0.1:5173 "),
    ).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
    expect(parseCorsOrigins("*,http://localhost:5173")).toEqual([
      "http://localhost:5173",
    ]);
  });
});

describe("cors allowlist", () => {
  function app() {
    const e = express();
    e.use(
      cors({
        origin: parseCorsOrigins(undefined),
        credentials: true,
      }),
    );
    e.get("/health", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    return e;
  }

  it("reflects a listed origin", async () => {
    const res = await request(app())
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not reflect an unknown LAN origin", async () => {
    const res = await request(app())
      .get("/health")
      .set("Origin", "http://192.168.9.9:5173");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
