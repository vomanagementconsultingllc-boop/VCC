import { describe, expect, it } from "vitest";
import { findNeverSay, formatDuration, speakingSeconds } from "@/lib/voice";
import { dollarsToCents, splitList } from "@/lib/forms";

describe("findNeverSay", () => {
  const never = ["pamper", "smile makeover", "cheap", "A+"];

  it("finds whole-word matches, ignoring case", () => {
    expect(findNeverSay("Come in and PAMPER yourself.", never)).toEqual(["pamper"]);
    expect(findNeverSay("Book a smile   makeover today", never)).toEqual(["smile makeover"]);
  });

  it("does not flag a word that only contains the phrase", () => {
    expect(findNeverSay("It is cheaper than you think, and pampering is not our thing.", never)).toEqual([]);
  });

  it("handles punctuation in phrases and empty entries", () => {
    expect(findNeverSay("We give A+ service", [...never, "", "  "])).toEqual(["A+"]);
    expect(findNeverSay("Nothing to see here", never)).toEqual([]);
  });
});

describe("speaking time", () => {
  it("estimates about 150 words a minute", () => {
    expect(speakingSeconds(Array(150).fill("word").join(" "))).toBe(60);
    expect(speakingSeconds("")).toBe(0);
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(120)).toBe("2m");
  });
});

describe("form helpers", () => {
  it("splits lists on commas and new lines, dropping blanks and duplicates", () => {
    expect(splitList("a, b\n\nB , c,")).toEqual(["a", "b", "c"]);
  });

  it("parses dollars to cents", () => {
    expect(dollarsToCents("20")).toBe(2000);
    expect(dollarsToCents("$1,200.50")).toBe(120050);
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
  });
});
