import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { createRuleCandidate } from "@/domain/calibration/workbench";
import {
  ruleCandidateProposalSchema,
  ruleCandidateStatusSchema,
} from "@/domain/calibration/workbench-schema";
import { calibrationError, calibrationRuntime, jsonBody } from "../shared";

export async function GET(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  try {
    return Response.json({
      candidates: await calibrationRuntime().repository.listRuleCandidates(),
    });
  } catch (error) {
    return calibrationError(error);
  }
}

export async function POST(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  const parsed = ruleCandidateProposalSchema.safeParse(await jsonBody(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    const candidate = createRuleCandidate(parsed.data);
    await calibrationRuntime().repository.saveRuleCandidate(candidate);
    return Response.json({ candidate }, { status: 201 });
  } catch (error) {
    return calibrationError(error);
  }
}

export async function PATCH(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  const parsed = ruleCandidateStatusSchema.safeParse(await jsonBody(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }
  try {
    const candidate =
      await calibrationRuntime().repository.updateRuleCandidateStatus(
        parsed.data.id,
        parsed.data.status,
        new Date().toISOString()
      );
    return candidate
      ? Response.json({ candidate })
      : Response.json({ error: "RULE_CANDIDATE_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return calibrationError(error);
  }
}
