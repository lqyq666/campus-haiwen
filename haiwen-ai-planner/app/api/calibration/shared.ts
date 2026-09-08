import { CalibrationWorkbench } from "@/domain/calibration/workbench";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

export function calibrationRuntime() {
  const repository = getRuntimeSchoolDataRepositories().calibrationRepository;
  return { repository, workbench: new CalibrationWorkbench(repository) };
}

export function calibrationError(error: unknown) {
  const code = error instanceof Error ? error.message : "CALIBRATION_FAILED";
  if (code === "EXPERT_REVIEW_LOCKED") {
    return Response.json({ error: code }, { status: 409 });
  }
  if (
    code === "CALIBRATION_CASE_NOT_FOUND" ||
    code === "CALIBRATION_REVIEW_NOT_FOUND" ||
    code === "SYSTEM_PREDICTION_NOT_FOUND"
  ) {
    return Response.json({ error: code }, { status: 404 });
  }
  if (
    code === "EXPERT_REVIEWER_NOT_REGISTERED" ||
    code === "DECISION_CHANGE_CONDITIONS_REQUIRED" ||
    code === "INVALID_EXPERT_SCORE_RANGE"
  ) {
    return Response.json({ error: code }, { status: 400 });
  }
  return Response.json(
    { error: "Calibration workbench is temporarily unavailable" },
    { status: 503 }
  );
}

export async function jsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    // Invalid JSON is normalized to an undefined body for the route validator.
  }
}
