import { describe, expect, it } from "vitest";
import { matchesCronAuth } from "./cron-auth";

const password = "senha-do-cron-job-org-12345";
const basic = (user: string, secret: string) =>
  `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;

describe("matchesCronAuth", () => {
  it("aceita o Basic do cron-job.org (usuário cron e a senha)", () => {
    expect(matchesCronAuth(basic("cron", password), password)).toBe(true);
  });

  it("recusa senha, usuário ou esquema errados", () => {
    expect(matchesCronAuth(basic("cron", "outra"), password)).toBe(false);
    expect(matchesCronAuth(basic("outro", password), password)).toBe(false);
    expect(matchesCronAuth(`Bearer ${password}`, password)).toBe(false);
    expect(matchesCronAuth(password, password)).toBe(false);
  });

  it("recusa cabeçalho ausente", () => {
    expect(matchesCronAuth(null, password)).toBe(false);
    expect(matchesCronAuth(undefined, password)).toBe(false);
    expect(matchesCronAuth("", password)).toBe(false);
  });

  it("sem senha configurada, fica fechado", () => {
    expect(matchesCronAuth(basic("cron", ""), undefined)).toBe(false);
    expect(matchesCronAuth(basic("cron", "x"), undefined)).toBe(false);
  });
});
