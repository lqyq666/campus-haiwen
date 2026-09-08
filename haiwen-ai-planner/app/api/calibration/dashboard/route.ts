import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { calculateCalibrationMetrics } from "@/domain/calibration/workbench";
import { calibrationError, calibrationRuntime } from "../shared";

export async function GET(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  try {
    const { repository } = calibrationRuntime();
    const [reviews, predictions, disagreements] = await Promise.all([
      repository.listReviews(),
      repository.listPredictions(),
      repository.listAllDisagreements(),
    ]);
    return Response.json(
      calculateCalibrationMetrics({ disagreements, predictions, reviews })
    );
  } catch (error) {
    return calibrationError(error);
  }
}
