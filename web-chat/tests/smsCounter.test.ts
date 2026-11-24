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

  it("counts each newline as one GSM-7 septet across the single-part boundary", () => {
    const twoLines = `${"a".repeat(75)}\n${"b".repeat(76)}`;
    expect(calculateSmsMetrics("Gadiel", twoLines)).toEqual({
      formattedText: `Gadiel: ${twoLines}`,
      encoding: "GSM-7",
      segmentCount: 1,
      used: 160,
      limit: 160,
    });

    const threeLines = twoLines.replace("\n", "\n\n");
    expect(calculateSmsMetrics("Gadiel", threeLines)).toEqual({
      formattedText: `Gadiel: ${threeLines}`,
      encoding: "GSM-7",
      segmentCount: 2,
      used: 161,
      limit: 306,
    });
  });

  it("matches Android multipart boundaries when 2-septet GSM-7 extended chars cross septet 153", () => {
    // "Seb: €" -> 5 basic septets + 2 septets for '€' = 7 septets
    const single = calculateSmsMetrics("Seb", "€");
    expect(single.encoding).toBe("GSM-7");
    expect(single.used).toBe(7);
    expect(single.segmentCount).toBe(1);

    // 152 'a' + '€' (2 septets, cannot split at 153 -> starts segment 2) + 152 'a' (154 in seg 2 -> spills 1 into seg 3)
    const boundary = calculateSmsMetrics(
      "",
      "a".repeat(152) + "€" + "a".repeat(152)
    );
    expect(boundary.encoding).toBe("GSM-7");
    expect(boundary.used).toBe(306);
    expect(boundary.segmentCount).toBe(3);
    expect(boundary.limit).toBe(459);
  });

  it("switches to UCS-2 for emojis and curly quotes and never splits surrogate pairs across 67-unit boundaries", () => {
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

    // 66 'a' + '😊' (2 UTF-16 units, cannot split at 67 -> moves to seg 2) + 66 'a' (68 in seg 2 -> spills into seg 3)
    const ucsBoundary = calculateSmsMetrics(
      "",
      "a".repeat(66) + "😊" + "a".repeat(66)
    );
    expect(ucsBoundary.encoding).toBe("UCS-2");
    expect(ucsBoundary.used).toBe(134);
    expect(ucsBoundary.segmentCount).toBe(3);
    expect(ucsBoundary.limit).toBe(201);
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
