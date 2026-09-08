import { describe, expect, it } from "vitest";
import { blindCaseMarkdown } from "./expert-review";
import { calibrationCaseSchema, expertReviewSubmissionSchema } from "./models";

const caseItem = calibrationCaseSchema.parse({
  admissionYear: 2026,
  caseId: "case-001",
  expertExpectation: {
    expectationSource: "SYNTHETIC_TEST",
    expectedPath: "DUAL_TRACK",
  },
  profile: {
    cet6Score: 530,
    cohortSize: 100,
    competitionExperiences: [],
    grade: "SOPHOMORE",
    rank: 8,
    researchExperiences: [],
    targetCities: ["上海"],
    targetMajors: ["计算机"],
    targetUniversities: [],
  },
  title: "匿名案例",
});
describe("blind expert review", () => {
  it("exports profile facts without system output, lead data, or PII fields", () => {
    const markdown = blindCaseMarkdown(caseItem);
    expect(markdown).toContain("年级：SOPHOMORE");
    expect(markdown).not.toMatch(/DUAL_TRACK|Lead|手机号|微信|邮箱/i);
  });
  it("accepts separate reviews by multiple reviewers", () => {
    expect(
      expertReviewSubmissionSchema.parse({
        reviews: [review("保研规划老师"), review("考研规划老师")],
      }).reviews
    ).toHaveLength(2);
  });
  it("rejects invalid paths, score ranges, and tiers", () => {
    expect(() =>
      expertReviewSubmissionSchema.parse({
        reviews: [
          {
            caseId: "case-001",
            expertExpectation: {
              expectationSource: "EXPERT_REVIEW",
              expectedPath: "WRONG",
            },
          },
        ],
      })
    ).toThrow();
    expect(() =>
      expertReviewSubmissionSchema.parse({
        reviews: [
          {
            caseId: "case-001",
            expertExpectation: {
              ...review("老师").expertExpectation,
              recommendationScoreRange: { max: 10, min: 90 },
            },
          },
        ],
      })
    ).toThrow();
    expect(() =>
      expertReviewSubmissionSchema.parse({
        reviews: [
          {
            caseId: "case-001",
            expertExpectation: {
              ...review("老师").expertExpectation,
              schoolExpectations: [{ expectedTier: "INVALID", programId: "p" }],
            },
          },
        ],
      })
    ).toThrow();
  });
});
function review(role: string) {
  return {
    caseId: "case-001",
    expertExpectation: {
      expectationSource: "EXPERT_REVIEW",
      expectedActionPriorities: [],
      expectedMissingData: [],
      expectedPath: "DUAL_TRACK",
      expectedTopRisks: [],
      reviewerRole: role,
      schoolExpectations: [],
    },
  };
}
