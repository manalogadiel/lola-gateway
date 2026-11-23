import { describe, expect, it } from "vitest";
import { calculateSmsMetrics } from "../src/lib/smsCounter";

describe("calculateSmsMetrics", () => {
  it("computes single-part GSM-7 metrics including the sender prefix", () => {
    expect(calculateSmsMetrics("Gadiel", "Kumusta po?")).toEqual({
      formattedText: "Gadiel: Kumusta po?",
      encoding: "GSM-7",
      segmentCount: 1,
      used: 19,
      limit: 160,
    });
  });

  it("handles GSM-7 160 single-part and 153 multi-part boundaries", () => {
    // "Gadiel: " is 8 chars; 8 + 152 = 160 -> 1 segment
    const exactOne = calculateSmsMetrics("Gadiel", "a".repeat(152));
    expect(exactOne.encoding).toBe("GSM-7");
    expect(exactOne.used).toBe(160);
    expect(exactOne.segmentCount).toBe(1);
    expect(exactOne.limit).toBe(160);

    // 8 + 153 = 161 -> 2 segments (2 * 153 = 306)
    const twoParts = calculateSmsMetrics("Gadiel", "a".repeat(153));
    expect(twoParts.encoding).toBe("GSM-7");
    expect(twoParts.used).toBe(161);
    expect(twoParts.segmentCount).toBe(2);
    expect(twoParts.limit).toBe(306);
  });

  it("counts GSM-7 extended table characters as 2 septets without switching to UCS-2", () => {
    // "Seb: €" -> 5 basic septets + 2 septets for '€' = 7 septets
    const res = calculateSmsMetrics("Seb", "€");
    expect(res.encoding).toBe("GSM-7");
    expect(res.used).toBe(7);
    expect(res.segmentCount).toBe(1);
    expect(res.limit).toBe(160);
  });

  it("switches to UCS-2 for emojis and curly quotes with 70/67 limits", () => {
    const emojiRes = calculateSmsMetrics("Gadiel", "Kumusta 😊");
    expect(emojiRes.encoding).toBe("UCS-2");
    expect(emojiRes.used).toBe(18);
    expect(emojiRes.segmentCount).toBe(1);
    expect(emojiRes.limit).toBe(70);

    const curlyRes = calculateSmsMetrics("Gadiel", "“Kumain na po”");
    expect(curlyRes.encoding).toBe("UCS-2");
    expect(curlyRes.segmentCount).toBe(1);
    expect(curlyRes.limit).toBe(70);

    // 8 + 62 = 70 UTF-16 code units -> 1 segment
    const ucsExact = calculateSmsMetrics("Gadiel", "“" + "a".repeat(61));
    expect(ucsExact.encoding).toBe("UCS-2");
    expect(ucsExact.used).toBe(70);
    expect(ucsExact.segmentCount).toBe(1);
    expect(ucsExact.limit).toBe(70);

    // 8 + 63 = 71 UTF-16 code units -> 2 segments (2 * 67 = 134)
    const ucsTwo = calculateSmsMetrics("Gadiel", "“" + "a".repeat(62));
    expect(ucsTwo.encoding).toBe("UCS-2");
    expect(ucsTwo.used).toBe(71);
    expect(ucsTwo.segmentCount).toBe(2);
    expect(ucsTwo.limit).toBe(134);
  });

  it("returns zero segments for empty body input", () => {
    expect(calculateSmsMetrics("Gadiel", "")).toEqual({
      formattedText: "",
      encoding: "GSM-7",
      segmentCount: 0,
      used: 0,
      limit: 160,
    });
  });
});
