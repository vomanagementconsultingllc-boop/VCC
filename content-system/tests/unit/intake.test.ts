import { describe, expect, it } from "vitest";
import { INTAKE_FIELDS, missingRequired, readIntake, shootingContext } from "@/lib/intake";

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

describe("the intake questionnaire", () => {
  it("asks in detail about where the client will shoot", () => {
    const keys = INTAKE_FIELDS.map((f) => f.key);
    for (const key of ["locations", "best_light", "noise", "on_show", "off_limits"]) expect(keys).toContain(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("turns the search words into a clean list and keeps the rest as written", () => {
    const answers = readIntake(
      form({
        what_you_do: "  Family dentist  ",
        niche_keywords: "Dentist, teeth whitening ,, nervous patients",
        locations: "Front desk\nRoom 2",
        platforms: ["Instagram", "TikTok"],
        not_a_question: "ignored",
        phone: "   ",
      }),
    );
    expect(answers).toEqual({
      what_you_do: "Family dentist",
      niche_keywords: ["Dentist", "teeth whitening", "nervous patients"],
      locations: "Front desk\nRoom 2",
      platforms: ["Instagram", "TikTok"],
    });
    expect(missingRequired(answers)).toEqual([]);
  });

  it("says which required answers are missing", () => {
    const missing = missingRequired(readIntake(form({ what_you_do: "Bakery" }))).map((f) => f.key);
    expect(missing).toEqual(["niche_keywords", "locations"]);
  });

  it("gives the script writer only the filming details", () => {
    const context = shootingContext({
      what_you_do: "Family dentist",
      niche_keywords: ["dentist"],
      locations: "Front desk\nRoom 2",
      best_light: "Room 2, mornings",
      off_limits: "Patient faces",
      phone: "iPhone 14",
    });
    expect(context).toBe(
      ["Places they can film: Front desk\nRoom 2", "Best light: Room 2, mornings", "Never in shot: Patient faces", "Phone: iPhone 14"].join("\n"),
    );
    expect(shootingContext(null)).toBe("");
  });
});
