import { describe, it, expect } from "vitest";
import { gradeFromRatio } from "./grade";

describe("gradeFromRatio", () => {
  it("returns A when ratio is 0.5", () => {
    expect(gradeFromRatio(0.5)).toBe("A");
  });

  it("returns A when ratio is within 5% of 0.5", () => {
    expect(gradeFromRatio(0.48)).toBe("A");
    expect(gradeFromRatio(0.52)).toBe("A");
  });

  it("returns B when ratio is within 10% but outside 5% of 0.5", () => {
    expect(gradeFromRatio(0.44)).toBe("B");
    expect(gradeFromRatio(0.56)).toBe("B");
  });

  it("returns C when ratio is within 20% of 0.5", () => {
    expect(gradeFromRatio(0.3)).toBe("C");
    expect(gradeFromRatio(0.7)).toBe("C");
  });

  it("returns D when ratio is within 35% of 0.5", () => {
    expect(gradeFromRatio(0.15)).toBe("D");
    expect(gradeFromRatio(0.85)).toBe("D");
  });

  it("returns F when ratio is outside 35% of 0.5", () => {
    expect(gradeFromRatio(0.05)).toBe("F");
    expect(gradeFromRatio(0.95)).toBe("F");
    expect(gradeFromRatio(0)).toBe("F");
    expect(gradeFromRatio(1)).toBe("F");
  });
});
