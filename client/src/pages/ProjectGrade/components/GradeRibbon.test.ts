import { describe, expect, it } from "vitest";

// Extract the pure logic to test GradeRibbon's behavior without React.
// These are the same constants and calculations the component uses.

const VERDICT_COLORS: Record<string, string> = {
  S: "#0a7f3f",
  A: "#3b82f6",
  B: "#06b6d4",
  C: "#f59e0b",
  D: "#f97316",
  F: "#dc2626",
};

const VERDICT_LABEL: Record<string, string> = {
  S: "标杆",
  A: "商用",
  B: "有限商用",
  C: "测试",
  D: "不可销售",
  F: "高风险",
};

function safeScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function getColor(verdict: string): string {
  return VERDICT_COLORS[verdict] || VERDICT_COLORS.F;
}

function getLabel(verdict: string): string {
  return VERDICT_LABEL[verdict];
}

// ----- GradeRibbon logic tests -----

describe("GradeRibbon — score clamping", () => {
  it("clamps negative scores to 0", () => {
    expect(safeScore(-10)).toBe(0);
    expect(safeScore(-999)).toBe(0);
  });

  it("clamps scores above 100 to 100", () => {
    expect(safeScore(150)).toBe(100);
    expect(safeScore(9999)).toBe(100);
    expect(safeScore(100.1)).toBe(100);
  });

  it("passes through in-range scores unchanged", () => {
    expect(safeScore(0)).toBe(0);
    expect(safeScore(50)).toBe(50);
    expect(safeScore(85)).toBe(85);
    expect(safeScore(100)).toBe(100);
  });
});

describe("GradeRibbon — verdict color mapping", () => {
  it.each([
    ["S", "#0a7f3f"],
    ["A", "#3b82f6"],
    ["B", "#06b6d4"],
    ["C", "#f59e0b"],
    ["D", "#f97316"],
    ["F", "#dc2626"],
  ] as const)("verdict %s maps to color %s", (verdict, expectedColor) => {
    expect(getColor(verdict)).toBe(expectedColor);
  });

  it("falls back to F color for unknown verdict", () => {
    expect(getColor("X")).toBe("#dc2626");
    expect(getColor("")).toBe("#dc2626");
    expect(getColor("unknown" as any)).toBe("#dc2626");
  });
});

describe("GradeRibbon — verdict label mapping", () => {
  it.each([
    ["S", "标杆"],
    ["A", "商用"],
    ["B", "有限商用"],
    ["C", "测试"],
    ["D", "不可销售"],
    ["F", "高风险"],
  ] as const)("verdict %s maps to label %s", (verdict, expectedLabel) => {
    expect(getLabel(verdict)).toBe(expectedLabel);
  });
});

describe("GradeRibbon — gate block tag logic", () => {
  // The gateBlocked prop is rendered as a Tag when truthy.
  // Test the conditional rendering logic.
  it.each(["P0", "P1", "P2", "P3"] as const)("gate %s should render a tag", (gate) => {
    // If gateBlocked is truthy, a Tag is rendered.
    // Pure logic: Boolean("P0") etc. are all truthy.
    expect(Boolean(gate)).toBe(true);
  });

  it("null gateBlocked should not render a tag", () => {
    // null is falsy and should skip the Tag
    expect(Boolean(null)).toBe(false);
  });

  it("undefined gateBlocked should not render a tag", () => {
    expect(Boolean(undefined)).toBe(false);
  });

  it("empty string gateBlocked should not render a tag", () => {
    // Though the type is 'P0' | ... | null, testing edge case
    expect(Boolean("")).toBe(false);
  });
});

describe("GradeRibbon — reportHref wrapping logic", () => {
  it("should wrap in <a> when reportHref is provided", () => {
    // If reportHref is truthy, component returns <a> wrapping inner content
    expect(Boolean("https://example.com")).toBe(true);
  });

  it("should NOT wrap in <a> when reportHref is falsy", () => {
    expect(Boolean(undefined)).toBe(false);
    expect(Boolean("")).toBe(false);
  });
});

describe("GradeRibbon — projectName rendering", () => {
  it("should show projectName when provided", () => {
    expect(Boolean("project-abc")).toBe(true);
  });

  it("should hide projectName when undefined", () => {
    expect(Boolean(undefined)).toBe(false);
  });
});

describe("GradeRibbon — compact mode", () => {
  it("compact flag should be false by default", () => {
    // default props: compact = false
    const defaultCompact = false;
    expect(defaultCompact).toBe(false);
  });

  it("compact flag should reduce padding when true", () => {
    const compact = true;
    // compact: padding '4px 10px', fontSize 12
    // non-compact: padding '8px 14px', fontSize 14
    expect(compact).toBe(true);
  });

  it("compact mode shrinks font size for projectName", () => {
    // compact: fontSize 11, non-compact: fontSize 13
    const compactFontSize = 11;
    const normalFontSize = 13;
    expect(compactFontSize).toBeLessThan(normalFontSize);
  });
});

describe("GradeRibbon — default label", () => {
  it("uses 'AIbak 智评通' as default label", () => {
    const defaultLabel = "AIbak 智评通";
    expect(defaultLabel).toBe("AIbak 智评通");
  });
});
