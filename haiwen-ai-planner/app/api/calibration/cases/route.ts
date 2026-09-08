import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { calibrationError, calibrationRuntime } from "../shared";

export async function GET(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  try {
    return Response.json({
      cases: await calibrationRuntime().repository.listCases(),
      version: "calibration-v0.2",
    });
  } catch (error) {
    return calibrationError(error);
  }
}
