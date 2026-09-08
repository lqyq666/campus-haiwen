import { timingSafeEqual } from "node:crypto";

export function authorizeCalibrationRequest(
  request: Request,
  environment: Record<string, string | undefined> = process.env
) {
  const expected = environment.CALIBRATION_ADMIN_KEY;
  const provided = request.headers.get("X-Calibration-Admin-Key");
  if (!(expected && provided)) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export function requireCalibrationAdmin(request: Request) {
  return authorizeCalibrationRequest(request)
    ? undefined
    : Response.json(
        { error: "Calibration workbench access denied" },
        { status: 401 }
      );
}
