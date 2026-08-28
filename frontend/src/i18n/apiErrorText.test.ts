import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { apiErrorText } from "./apiErrorText";
import { messages } from "./messages";

describe("apiErrorText", () => {
  const tDe = (key: keyof typeof messages.de) => messages.de[key];
  const tEn = (key: keyof typeof messages.en) => messages.en[key];

  it("maps SHIFT_OVERLAP to German when locale is de", () => {
    const err = new ApiError(409, "Overlapping shift", "SHIFT_OVERLAP");
    expect(apiErrorText(err, tDe)).toBe("Schicht überschneidet sich");
  });

  it("keeps English from the dictionary when locale is en", () => {
    const err = new ApiError(409, "Overlapping shift", "SHIFT_OVERLAP");
    expect(apiErrorText(err, tEn)).toBe("Overlapping shift");
  });

  it("falls back to the API message when code is unknown", () => {
    const err = new ApiError(400, "some unique msg");
    expect(apiErrorText(err, tDe)).toBe("some unique msg");
  });
});
