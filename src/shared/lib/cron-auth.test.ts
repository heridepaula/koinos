import { describe, expect, it } from "vitest";
import { matchesCronAuth } from "./cron-auth";

const secrets = { secret: "segredo-da-vercel-1234", basicPassword: "senha-do-cron-job-org-12345" };
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("matchesCronAuth", () => {
  it("aceita o Bearer da Vercel Cron e o Basic do cron-job.org", () => {
    expect(matchesCronAuth(`Bearer ${secrets.secret}`, secrets)).toBe(true);
    expect(matchesCronAuth(basic("cron", secrets.basicPassword), secrets)).toBe(true);
  });

  it("recusa segredo, senha ou usuário errados", () => {
    expect(matchesCronAuth("Bearer outro", secrets)).toBe(false);
    expect(matchesCronAuth(basic("cron", "outra"), secrets)).toBe(false);
    expect(matchesCronAuth(basic("outro", secrets.basicPassword), secrets)).toBe(false);
    expect(matchesCronAuth(`Bearer ${secrets.basicPassword}`, secrets)).toBe(false);
    expect(matchesCronAuth(basic("cron", secrets.secret), secrets)).toBe(false);
  });

  it("recusa cabeçalho ausente", () => {
    expect(matchesCronAuth(null, secrets)).toBe(false);
    expect(matchesCronAuth("", secrets)).toBe(false);
  });

  it("sem um dos segredos, aquele caminho fica fechado", () => {
    expect(matchesCronAuth(basic("cron", ""), { secret: secrets.secret })).toBe(false);
    expect(matchesCronAuth("Bearer ", { basicPassword: secrets.basicPassword })).toBe(false);
    expect(matchesCronAuth("Bearer x", {})).toBe(false);
  });
});
