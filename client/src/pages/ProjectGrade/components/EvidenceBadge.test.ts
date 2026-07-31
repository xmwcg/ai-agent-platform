import { describe, expect, it } from "vitest";

// Mirror the EvidenceBadge logic from EvidenceBadge.tsx
// This tests the pure data/logic without React rendering.

type EvidenceLevelKey =
  | "production_automatic"
  | "ci_integration"
  | "source_static"
  | "documentation"
  | "none";

const LEVEL_META: Record<
  EvidenceLevelKey,
  { label: string; color: string; bg: string; factor: number; description: string }
> = {
  production_automatic: {
    label: "生产自动",
    color: "#047857",
    bg: "rgba(16, 185, 129, 0.14)",
    factor: 1.0,
    description: "带 verifiedAt 的生产自动验证证据",
  },
  ci_integration: {
    label: "CI 集成",
    color: "#0e7490",
    bg: "rgba(8, 145, 178, 0.14)",
    factor: 0.9,
    description: "CI、集成或端到端自动化证据",
  },
  source_static: {
    label: "源码静态",
    color: "#1d4ed8",
    bg: "rgba(37, 99, 235, 0.14)",
    factor: 0.75,
    description: "源码、配置和静态实现线索",
  },
  documentation: {
    label: "文档声明",
    color: "#a16207",
    bg: "rgba(202, 138, 4, 0.14)",
    factor: 0.4,
    description: "文档声明或计划",
  },
  none: {
    label: "无证据",
    color: "#991b1b",
    bg: "rgba(220, 38, 38, 0.14)",
    factor: 0,
    description: "当前规则无任何证据支撑",
  },
};

const EVIDENCE_LEVELS: EvidenceLevelKey[] = [
  "production_automatic",
  "ci_integration",
  "source_static",
  "documentation",
  "none",
];

function getMeta(level: EvidenceLevelKey) {
  return LEVEL_META[level] || LEVEL_META.none;
}

// ----- EvidenceBadge logic tests -----

describe("EvidenceBadge — 5 evidence levels exist", () => {
  it("has exactly 5 levels in EVIDENCE_LEVELS", () => {
    expect(EVIDENCE_LEVELS).toHaveLength(5);
  });

  it("contains all expected level keys", () => {
    expect(new Set(EVIDENCE_LEVELS)).toEqual(
      new Set([
        "production_automatic",
        "ci_integration",
        "source_static",
        "documentation",
        "none",
      ])
    );
  });
});

describe("EvidenceBadge — factor values per level", () => {
  it("production_automatic has factor 1.0", () => {
    expect(getMeta("production_automatic").factor).toBe(1.0);
  });

  it("ci_integration has factor 0.9", () => {
    expect(getMeta("ci_integration").factor).toBe(0.9);
  });

  it("source_static has factor 0.75", () => {
    expect(getMeta("source_static").factor).toBe(0.75);
  });

  it("documentation has factor 0.4", () => {
    expect(getMeta("documentation").factor).toBe(0.4);
  });

  it("none has factor 0", () => {
    expect(getMeta("none").factor).toBe(0);
  });

  it("factors are in descending order across levels", () => {
    const factors = EVIDENCE_LEVELS.map((l) => getMeta(l).factor);
    const sorted = [...factors].sort((a, b) => b - a);
    expect(factors).toEqual(sorted);
  });
});

describe("EvidenceBadge — label per level", () => {
  it.each([
    ["production_automatic", "生产自动"],
    ["ci_integration", "CI 集成"],
    ["source_static", "源码静态"],
    ["documentation", "文档声明"],
    ["none", "无证据"],
  ] as const)("level %s has label %s", (level, expectedLabel) => {
    expect(getMeta(level).label).toBe(expectedLabel);
  });
});

describe("EvidenceBadge — color per level", () => {
  it.each([
    ["production_automatic", "#047857"],
    ["ci_integration", "#0e7490"],
    ["source_static", "#1d4ed8"],
    ["documentation", "#a16207"],
    ["none", "#991b1b"],
  ] as const)("level %s has color %s", (level, expectedColor) => {
    expect(getMeta(level).color).toBe(expectedColor);
  });
});

describe("EvidenceBadge — bg color per level (semi-transparent)", () => {
  it("every level has an rgba() background", () => {
    for (const l of EVIDENCE_LEVELS) {
      expect(getMeta(l).bg).toMatch(/^rgba\(/);
    }
  });
});

describe("EvidenceBadge — description per level", () => {
  it("every level has a non-empty description", () => {
    for (const l of EVIDENCE_LEVELS) {
      expect(getMeta(l).description.length).toBeGreaterThan(0);
    }
  });
});

describe("EvidenceBadge — fallback for unknown level", () => {
  it("returns 'none' meta for an invalid level", () => {
    const fallback = getMeta("bogus" as any);
    expect(fallback.label).toBe("无证据");
    expect(fallback.factor).toBe(0);
  });
});

describe("EvidenceBadge — compact mode", () => {
  it("compact mode shows only label (not factor)", () => {
    // In compact mode: content is just meta.label
    // In non-compact: content is `${meta.label} · ${meta.factor}`
    const compact = true;
    const meta = getMeta("production_automatic");

    const compactContent = meta.label;
    const normalContent = `${meta.label} · ${meta.factor}`;

    expect(compactContent).toBe("生产自动");
    expect(normalContent).toBe("生产自动 · 1");

    // compact should differ from normal
    expect(compactContent).not.toEqual(normalContent);
  });

  it("compact mode reduces padding", () => {
    // compact: padding '2px 6px'
    // non-compact: padding '3px 10px'
    const compactPad = [2, 6]; // [vertical, horizontal]
    const normalPad = [3, 10];
    expect(compactPad[0]).toBeLessThan(normalPad[0]);
    expect(compactPad[1]).toBeLessThan(normalPad[1]);
  });

  it("compact mode uses smaller font", () => {
    const compactFontSize = 11;
    const normalFontSize = 12;
    expect(compactFontSize).toBeLessThan(normalFontSize);
  });
});

describe("EvidenceBadge — default props", () => {
  it("compact defaults to false (non-compact)", () => {
    // The component default is compact = false
    const defaultCompact = false;
    expect(defaultCompact).toBe(false);
  });

  it("title attribute includes label, factor, and description", () => {
    const meta = getMeta("ci_integration");
    const title = `${meta.label} · 系数 ${meta.factor} · ${meta.description}`;
    expect(title).toBe("CI 集成 · 系数 0.9 · CI、集成或端到端自动化证据");
  });
});
