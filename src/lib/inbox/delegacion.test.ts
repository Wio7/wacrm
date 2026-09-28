import { describe, expect, it } from "vitest";

import { textoDeDelegacion } from "./delegacion";

const nombres: Record<string, string> = { alex: "Alex" };
const nombre = (id: string | null | undefined) => (id ? nombres[id] ?? null : null);

describe("textoDeDelegacion", () => {
  it("nada si no se pasó", () => {
    expect(textoDeDelegacion({ delegated_at: null, assigned_agent_id: "sara" }, nombre)).toBeNull();
  });
  it("a quién y por qué", () => {
    expect(
      textoDeDelegacion(
        { delegated_at: "2026-09-28T15:00:00Z", delegation_reason: "agendo", assigned_agent_id: "alex" },
        nombre,
      ),
    ).toBe("Pasado a Alex · agendó");
    expect(
      textoDeDelegacion(
        { delegated_at: "2026-09-28T15:00:00Z", delegation_reason: "24h", assigned_agent_id: "alex" },
        nombre,
      ),
    ).toBe("Pasado a Alex · a las 24 h");
  });
  it("sin nombre conocido, dice un asesor", () => {
    expect(
      textoDeDelegacion({ delegated_at: "2026-09-28T15:00:00Z", assigned_agent_id: "otro" }, nombre),
    ).toBe("Pasado a un asesor");
  });
});
