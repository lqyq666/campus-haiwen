import { describe, expect, it } from "vitest";
import { authorizeCalibrationRequest } from "./security";

describe("calibration admin authorization", () => {
  it("fails closed and accepts only the environment-backed key", () => {
    const request = (key?: string) =>
      new Request("http://localhost/api/calibration/cases", {
        headers: key ? { "X-Calibration-Admin-Key": key } : {},
      });

    expect(authorizeCalibrationRequest(request("secret"), {})).toBe(false);
    expect(
      authorizeCalibrationRequest(request(), {
        CALIBRATION_ADMIN_KEY: "secret",
      })
    ).toBe(false);
    expect(
      authorizeCalibrationRequest(request("wrong"), {
        CALIBRATION_ADMIN_KEY: "secret",
      })
    ).toBe(false);
    expect(
      authorizeCalibrationRequest(request("secret"), {
        CALIBRATION_ADMIN_KEY: "secret",
      })
    ).toBe(true);
  });
});
