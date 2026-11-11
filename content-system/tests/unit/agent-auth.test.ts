import { describe, expect, it } from "vitest";
import { KEY_PREFIX, generateKey, hashKey } from "@/lib/agent-auth";

describe("editor access keys", () => {
  it("are long, random, and stored only as a hash", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.key.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.key.length).toBeGreaterThanOrEqual(KEY_PREFIX.length + 40);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.key.slice(KEY_PREFIX.length));
    // The prefix kept for display is too short to be useful to an attacker.
    expect(a.prefix.length).toBe(KEY_PREFIX.length + 6);
    expect(a.key.startsWith(a.prefix)).toBe(true);
  });
});
