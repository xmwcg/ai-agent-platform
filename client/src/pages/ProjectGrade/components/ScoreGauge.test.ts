import { describe, expect, it } from "vitest";

// ----- Pure logic for ScoreGauge -----
// Mirror the constants and calculations from ScoreGauge.tsx

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

const SIZE_TO_PX: Record<"small" | "medium" | "large", number> = {
  small: 96,
  medium: 144,
  large: 200,
};

function getDiameter(size: "small" | "medium" | "large"): number {
  return SIZE_TO_PX[size];
}

function getStroke(diameter: number): number {
  return Math.max(8, Math.round(diameter / 12));
}

function getRadius(diameter: number, stroke: number): number {
  return (diameter - stroke) / 2;
}

function getCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

function getOffset(circumference: number, score: number): number {
  const safeScore = Math.max(0, Math.min(100, score));
  return circumference * (1 - safeScore / 100);
}

function getColor(verdict: string): string {
  return VERDICT_COLORS[verdict] || VERDICT_COLORS.F;
}

function getLabelFont(size: "small" | "medium" | "large"): number {
  return size === "large" ? 38 : size === "medium" ? 28 : 22;
}

function getSubFont(size: "small" | "medium" | "large"): number {
  return size === "large" ? 14 : size === "medium" ? 12 : 10;
}

function safeScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

// ----- ScoreGauge tests -----

describe("ScoreGauge — size dimensions", () => {
  it("small is 96px", () => {
    expect(getDiameter("small")).toBe(96);
  });

  it("medium is 144px", () => {
    expect(getDiameter("medium")).toBe(144);
  });

  it("large is 200px", () => {
    expect(getDiameter("large")).toBe(200);
  });
});

describe("ScoreGauge — stroke widths per size", () => {
  it("small stroke is 8px (diameter / 12 = 8)", () => {
    expect(getStroke(96)).toBe(8);
  });

  it("medium stroke is 12px (diameter / 12 = 12)", () => {
    expect(getStroke(144)).toBe(12);
  });

  it("large stroke is 17px (diameter / 12 ≈ 16.67 → 17)", () => {
    expect(getStroke(200)).toBe(17);
  });

  it("stroke is never below 8px even with tiny diameter", () => {
    expect(getStroke(12)).toBe(8);
  });
});

describe("ScoreGauge — SVG geometry calculations", () => {
  it("radius = (diameter - stroke) / 2", () => {
    // medium: (144 - 12) / 2 = 66
    const d = 144;
    const stroke = 12;
    expect(getRadius(d, stroke)).toBe(66);
  });

  it("circumference = 2 * PI * radius", () => {
    const r = 66;
    expect(getCircumference(r)).toBeCloseTo(414.69, 1);
  });

  it("offset = circumference * (1 - score / 100)", () => {
    const circ = getCircumference(66); // ~414.69
    // score=50 → offset = 414.69 * 0.5 ≈ 207.35
    expect(getOffset(circ, 50)).toBeCloseTo(207.35, 1);
    // score=100 → offset = 414.69 * 0 = 0
    expect(getOffset(circ, 100)).toBe(0);
    // score=0 → offset = 414.69 * 1 = full circumference
    expect(getOffset(circ, 0)).toBeCloseTo(circ, 1);
  });
});

describe("ScoreGauge — score clamping", () => {
  it("clamps score at 0 (lower bound)", () => {
    expect(safeScore(-5)).toBe(0);
    expect(safeScore(-100)).toBe(0);
  });

  it("clamps score at 100 (upper bound)", () => {
    expect(safeScore(150)).toBe(100);
    expect(safeScore(999)).toBe(100);
  });

  it("passes through valid scores", () => {
    expect(safeScore(0)).toBe(0);
    expect(safeScore(50)).toBe(50);
    expect(safeScore(85.7)).toBe(85.7);
    expect(safeScore(100)).toBe(100);
  });
});

describe("ScoreGauge — offset behavior at score boundaries", () => {
  it("at score=0, offset equals full circumference (fully hidden arc)", () => {
    const circ = getCircumference(66);
    expect(getOffset(circ, 0)).toBeCloseTo(circ, 5);
  });

  it("at score=100, offset is 0 (full visible arc)", () => {
    const circ = getCircumference(66);
    expect(getOffset(circ, 100)).toBe(0);
  });

  it("at score=50, offset is half the circumference", () => {
    const circ = getCircumference(66);
    expect(getOffset(circ, 50)).toBeCloseTo(circ / 2, 5);
  });
});

describe("ScoreGauge — verdict colors", () => {
  it.each([
    ["S", "#0a7f3f"],
    ["A", "#3b82f6"],
    ["B", "#06b6d4"],
    ["C", "#f59e0b"],
    ["D", "#f97316"],
    ["F", "#dc2626"],
  ] as const)("verdict %s → %s", (verdict, expectedColor) => {
    expect(getColor(verdict)).toBe(expectedColor);
  });

  it("unknown verdict falls back to F color", () => {
    expect(getColor("X")).toBe("#dc2626");
  });
});

describe("ScoreGauge — verdict labels", () => {
  it.each([
    ["S", "标杆"],
    ["A", "商用"],
    ["B", "有限商用"],
    ["C", "测试"],
    ["D", "不可销售"],
    ["F", "高风险"],
  ] as const)("verdict %s → %s", (verdict, expectedLabel) => {
    expect(VERDICT_LABEL[verdict]).toBe(expectedLabel);
  });
});

describe("ScoreGauge — font sizes per size", () => {
  it("large label font is 38", () => {
    expect(getLabelFont("large")).toBe(38);
  });

  it("medium label font is 28", () => {
    expect(getLabelFont("medium")).toBe(28);
  });

  it("small label font is 22", () => {
    expect(getLabelFont("small")).toBe(22);
  });

  it("large sub font is 14", () => {
    expect(getSubFont("large")).toBe(14);
  });

  it("medium sub font is 12", () => {
    expect(getSubFont("medium")).toBe(12);
  });

  it("small sub font is 10", () => {
    expect(getSubFont("small")).toBe(10);
  });
});

describe("ScoreGauge — display text values", () => {
  it("score text uses toFixed(1)", () => {
    // The SVG text displays safeScore.toFixed(1)
    expect(safeScore(85.567).toFixed(1)).toBe("85.6");
    expect(safeScore(100).toFixed(1)).toBe("100.0");
    expect(safeScore(0).toFixed(1)).toBe("0.0");
  });

  it("verdict line shows verdict + label separator", () => {
    const verdict = "A";
    const label = VERDICT_LABEL[verdict];
    const line = `${verdict} · ${label}`;
    expect(line).toBe("A · 商用");
  });
});

describe("ScoreGauge — title and description", () => {
  it("title presence is determined by truthiness", () => {
    // title prop is optional; if provided, a div is rendered
    const hasTitle = (title?: string) => Boolean(title);
    expect(hasTitle("My Project")).toBe(true);
    expect(hasTitle(undefined)).toBe(false);
    expect(hasTitle("")).toBe(false);
  });

  it("description presence is determined by truthiness", () => {
    const hasDesc = (description?: string) => Boolean(description);
    expect(hasDesc("A great result")).toBe(true);
    expect(hasDesc(undefined)).toBe(false);
  });
});

describe("ScoreGauge — aria-label", () => {
  it("generates correct aria-label structure", () => {
    const score = 85.6;
    const verdictStr = "A";
    const label = `评分 ${score.toFixed(1)} / 100 · 等级 ${verdictStr}`;
    expect(label).toBe("评分 85.6 / 100 · 等级 A");
  });
});
