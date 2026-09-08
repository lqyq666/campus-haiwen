import { parseStudentProfile, type StudentProfile } from "./schema";

const DEFAULT_ADMISSION_MONTH = 8;
const DEFAULT_ADMISSION_DAY = 1;

export function withAssessmentTimeContext(
  profile: StudentProfile,
  targetAdmissionYear: number,
  now = new Date()
): StudentProfile {
  const currentDate = profile.currentDate ?? now.toISOString().slice(0, 10);
  const monthsRemaining =
    profile.monthsRemaining ??
    calendarMonthsUntil(
      new Date(`${currentDate}T00:00:00.000Z`),
      new Date(
        Date.UTC(
          targetAdmissionYear,
          DEFAULT_ADMISSION_MONTH,
          DEFAULT_ADMISSION_DAY
        )
      )
    );
  const currentStage = profile.currentStage ?? "UNKNOWN";
  return parseStudentProfile({
    ...profile,
    currentDate,
    currentStage,
    monthsRemaining,
    targetAdmissionYear: profile.targetAdmissionYear ?? targetAdmissionYear,
    timeContext: {
      currentDate,
      currentStage,
      monthsRemaining,
      targetAdmissionYear: profile.targetAdmissionYear ?? targetAdmissionYear,
    },
  });
}

function calendarMonthsUntil(current: Date, target: Date) {
  const raw =
    (target.getUTCFullYear() - current.getUTCFullYear()) * 12 +
    target.getUTCMonth() -
    current.getUTCMonth();
  const adjusted = raw - (target.getUTCDate() < current.getUTCDate() ? 1 : 0);
  return Math.max(0, adjusted);
}
