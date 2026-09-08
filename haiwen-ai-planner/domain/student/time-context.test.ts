import { describe, expect, it } from "vitest";
import { parseStudentProfile } from "./schema";
import { withAssessmentTimeContext } from "./time-context";

describe("withAssessmentTimeContext", () => {
  it("adds deterministic server time context without overwriting supplied values", () => {
    const profile = parseStudentProfile({ grade: "SOPHOMORE" });
    const enriched = withAssessmentTimeContext(
      profile,
      2028,
      new Date("2026-08-30T12:00:00.000Z")
    );

    expect(enriched.currentDate).toBe("2026-08-30");
    expect(enriched.targetAdmissionYear).toBe(2028);
    expect(enriched.monthsRemaining).toBe(24);
    expect(enriched.currentStage).toBe("UNKNOWN");
    expect(enriched.timeContext).toEqual({
      currentDate: "2026-08-30",
      currentStage: "UNKNOWN",
      monthsRemaining: 24,
      targetAdmissionYear: 2028,
    });

    const supplied = withAssessmentTimeContext(
      parseStudentProfile({
        currentStage: "APPLICATION_PREP",
        monthsRemaining: 6,
      }),
      2028,
      new Date("2026-08-30T12:00:00.000Z")
    );
    expect(supplied.currentStage).toBe("APPLICATION_PREP");
    expect(supplied.monthsRemaining).toBe(6);
  });
});
