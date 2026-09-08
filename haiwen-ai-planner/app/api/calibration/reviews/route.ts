import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { expertReviewSubmissionV02Schema } from "@/domain/calibration/workbench-schema";
import { calibrationError, calibrationRuntime, jsonBody } from "../shared";

export async function POST(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  const input = expertReviewSubmissionV02Schema.safeParse(
    await jsonBody(request)
  );
  if (!input.success) {
    return Response.json({ error: input.error.issues }, { status: 400 });
  }
  try {
    return Response.json(
      { review: await calibrationRuntime().workbench.submitReview(input.data) },
      { status: 201 }
    );
  } catch (error) {
    return calibrationError(error);
  }
}
