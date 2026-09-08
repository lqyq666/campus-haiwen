import { describe, expect, it } from "vitest";
import { postgraduateRuleSet, recommendationRuleSet } from "./rule-set";

describe("rules-v0.2 registry", () => {
  it("registers the current scoring behavior as a reviewable compatibility rule set", () => {
    for (const ruleSet of [recommendationRuleSet, postgraduateRuleSet]) {
      expect(ruleSet.version).toBe("rules-v0.2");
      expect(ruleSet.semanticsVersion).toBe("rules-v0.1-compatible");
      expect(ruleSet.status).toBe("PROVISIONAL_PENDING_EXPERT_CALIBRATION");
      expect(
        ruleSet.rules.reduce(
          (sum, rule) => sum + rule.contribution.weightPercent,
          0
        )
      ).toBe(100);
      expect(ruleSet.rules.every((rule) => rule.conditions.length > 0)).toBe(
        true
      );
    }
  });
});
