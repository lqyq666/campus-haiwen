import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { reviewerRegistrationSchema } from "@/domain/calibration/workbench-schema";
import {
  calibrationError,
  calibrationRuntime,
  jsonBody,
} from "../../../shared";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  const reviewer = reviewerRegistrationSchema.safeParse(
    await jsonBody(request)
  );
  if (!reviewer.success) {
    return Response.json({ error: reviewer.error.issues }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return Response.json(
      await calibrationRuntime().workbench.openCase(id, reviewer.data)
    );
  } catch (error) {
    return calibrationError(error);
  }
}
