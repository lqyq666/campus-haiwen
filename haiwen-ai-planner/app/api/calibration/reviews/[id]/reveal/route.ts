import { z } from "zod";
import { requireCalibrationAdmin } from "@/domain/calibration/security";
import {
  calibrationError,
  calibrationRuntime,
  jsonBody,
} from "../../../shared";

const revealSchema = z
  .object({ reviewerCode: z.string().trim().min(3).max(64) })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  const input = revealSchema.safeParse(await jsonBody(request));
  if (!input.success) {
    return Response.json({ error: input.error.issues }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return Response.json(
      await calibrationRuntime().workbench.revealReview(
        id,
        input.data.reviewerCode
      )
    );
  } catch (error) {
    return calibrationError(error);
  }
}
