import { describe, expect, it } from "vitest";
import { FINDING_NOTES } from "./finding-notes";

describe("FINDING_NOTES", () => {
  const entries = Object.entries(FINDING_NOTES);

  it("covers the finding codes", () => {
    expect(entries.length).toBeGreaterThanOrEqual(11);
    expect(FINDING_NOTES.PROVENTO_NAO_CLASSIFICADO).toBeTruthy();
  });

  it.each(entries)("%s has a short text with no digit", (_code, text) => {
    expect(text.trim()).not.toBe("");
    expect(text).not.toMatch(/\d/);
    expect(text.length).toBeLessThanOrEqual(300);
  });
});
