import { describe, expect, it } from "vitest";
import { callCost, recommend, summarize, type Call, type Price } from "@/lib/metrics";

const prices: Price[] = [
  { model_id: "a", friendly_name: "A", size_tag: "small", input_per_m: 0.1, output_per_m: 0.4, sort: 1 },
  { model_id: "b", friendly_name: "B", size_tag: "large", input_per_m: 2, output_per_m: 12, sort: 2 },
];
const mk = (model_id: string, score: number | null, status = "ok"): Call => ({
  id: Math.random().toString(), model_id, status, input_position: 1, input_text: "", reference: null, output: "x",
  error: null, latency_ms: 100, input_tokens: 1000, output_tokens: 500, tokens_estimated: false, score, reason: null, grade_status: "graded",
});

describe("cost", () => {
  it("is tokens × price per 1M", () => {
    expect(callCost({ input_tokens: 1000, output_tokens: 500 }, prices[1])).toBeCloseTo(0.002 + 0.006);
  });
});

describe("recommendation", () => {
  it("picks the cheapest model meeting the 80% pass-rate target", () => {
    const calls = [...Array(5)].flatMap((_, i) => [mk("a", i < 4 ? 4 : 2), mk("b", 5)]);
    const s = summarize(calls, ["a", "b"], prices, 4);
    expect(s[0]!.passRate).toBe(80);
    expect(recommend(s, 80).cheapest?.model_id).toBe("a");
    expect(recommend(s, 81).cheapest?.model_id).toBe("b");
  });
  it("counts failed calls against the pass rate", () => {
    const s = summarize([mk("a", 5), mk("a", null, "failed")], ["a"], prices, 4);
    expect(s[0]!.passRate).toBe(50);
  });
});
