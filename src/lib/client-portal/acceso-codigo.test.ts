import { describe, expect, it } from "vitest";

import {
  CODE_RESEND_MS,
  CODES_WINDOW_MS,
  MAX_CODES_PER_PHONE,
  codeCooldownMs,
  hashAccessCode,
  newAccessCode,
  normalizeAccessCode,
  whatsappWindowOpen,
} from "./identity";

const NOW = Date.parse("2026-09-28T15:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("newAccessCode", () => {
  it("son siempre seis dígitos, ceros a la izquierda incluidos", () => {
    for (let i = 0; i < 200; i++) expect(newAccessCode()).toMatch(/^[0-9]{6}$/);
  });
});

describe("hashAccessCode", () => {
  it("el mismo código de dos contactos no da el mismo hash", () => {
    expect(hashAccessCode("123456", "a")).not.toBe(hashAccessCode("123456", "b"));
    expect(hashAccessCode("123456", "a")).toBe(hashAccessCode("123456", "a"));
  });
});

describe("normalizeAccessCode", () => {
  it("acepta espacios y guiones, sólo seis dígitos", () => {
    expect(normalizeAccessCode(" 123 456 ")).toBe("123456");
    expect(normalizeAccessCode("123-456")).toBe("123456");
    expect(normalizeAccessCode("12345")).toBeNull();
    expect(normalizeAccessCode("1234567")).toBeNull();
    expect(normalizeAccessCode("")).toBeNull();
  });
});

describe("codeCooldownMs", () => {
  it("sin códigos previos se puede pedir ya", () => {
    expect(codeCooldownMs([], NOW)).toBe(0);
  });
  it("hay que esperar un minuto entre uno y otro", () => {
    expect(codeCooldownMs([ago(10_000)], NOW)).toBe(CODE_RESEND_MS - 10_000);
    expect(codeCooldownMs([ago(CODE_RESEND_MS + 1)], NOW)).toBe(0);
  });
  it("al tope por ventana, se espera a que salga el más viejo", () => {
    const enviados = Array.from({ length: MAX_CODES_PER_PHONE }, (_, i) => ago((i + 2) * 60_000));
    const oldest = (MAX_CODES_PER_PHONE + 1) * 60_000;
    expect(codeCooldownMs(enviados, NOW)).toBe(CODES_WINDOW_MS - oldest);
  });
  it("lo que salió de la ventana ya no cuenta", () => {
    expect(codeCooldownMs([ago(CODES_WINDOW_MS + 1)], NOW)).toBe(0);
  });
});

describe("whatsappWindowOpen", () => {
  it("abierta si escribió hace poco", () => {
    expect(whatsappWindowOpen(ago(60 * 60_000), NOW)).toBe(true);
  });
  it("cerrada si nunca escribió o pasaron casi 24 h", () => {
    expect(whatsappWindowOpen(null, NOW)).toBe(false);
    expect(whatsappWindowOpen(ago(24 * 60 * 60_000 - 60_000), NOW)).toBe(false);
    expect(whatsappWindowOpen(ago(25 * 60 * 60_000), NOW)).toBe(false);
  });
});
