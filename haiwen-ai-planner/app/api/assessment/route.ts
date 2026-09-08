import { ipAddress } from "@vercel/functions";
import { haiwenGraph } from "@/agent/graph";
import {
  type AssessmentContractVersion,
  serializeAssessmentReport,
} from "@/domain/recommendation/serialization";
import { studentProfileSchema } from "@/domain/student/schema";
import { withAssessmentTimeContext } from "@/domain/student/time-context";
import { ChatbotError } from "@/lib/errors";
import { logBusinessEvent } from "@/lib/observability/business-log";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

export async function POST(request: Request) {
  try {
    const channelKey = request.headers.get("x-campus-channel-key");
    const trustedChannel =
      Boolean(process.env.CAMPUS_CHANNEL_API_KEY) &&
      channelKey === process.env.CAMPUS_CHANNEL_API_KEY;
    await checkIpRateLimit(
      ipAddress(request),
      trustedChannel ? "assessment-channel" : "assessment"
    );
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const startedAt = performance.now();
  const body = (await request.json()) as {
    admissionYear?: unknown;
    assessmentVersion?: unknown;
    profile?: unknown;
  };
  const { admissionYear } = body;
  if (
    !(
      typeof admissionYear === "number" &&
      Number.isInteger(admissionYear) &&
      admissionYear >= 2000 &&
      admissionYear <= 2100
    )
  ) {
    return Response.json(
      { error: "A valid admissionYear is required" },
      { status: 400 }
    );
  }
  const profile = studentProfileSchema.safeParse(body.profile);
  if (!profile.success) {
    return Response.json(
      { error: profile.error.issues.map((issue) => issue.message) },
      { status: 400 }
    );
  }
  if (
    body.assessmentVersion !== undefined &&
    body.assessmentVersion !== "assessment-v0.1" &&
    body.assessmentVersion !== "assessment-v0.2"
  ) {
    return Response.json(
      { error: "Unsupported assessmentVersion" },
      { status: 400 }
    );
  }
  const assessmentVersion: AssessmentContractVersion =
    body.assessmentVersion === "assessment-v0.2"
      ? "assessment-v0.2"
      : "assessment-v0.1";
  try {
    const assessmentProfile = withAssessmentTimeContext(
      profile.data,
      admissionYear
    );
    const result = await haiwenGraph.invoke({
      admissionYear,
      errors: [],
      evidence: [],
      evidencePack: null,
      generatedNarrative: null,
      leadContact: null,
      leadEvents: [],
      leadHandoffContext: null,
      leadScore: null,
      modelMetadata: null,
      pathDecision: null,
      recommendations: [],
      report: null,
      retrievalMode: null,
      retrievalQuery: null,
      retrievedChunks: [],
      roadmap: [],
      schoolCandidates: [],
      schoolMatches: [],
      scores: null,
      studentProfile: assessmentProfile,
      validationResult: null,
      warnings: [],
    });
    if (!result.report) {
      return Response.json({ error: result.errors }, { status: 422 });
    }
    const sourceDocumentIds = [
      ...new Set(
        Object.values(result.report.evidenceIndex).map(
          (evidence) => evidence.sourceDocumentId
        )
      ),
    ];
    const repositories = getRuntimeSchoolDataRepositories();
    const sourceDocuments = await Promise.all(
      sourceDocumentIds.map(async (id) => {
        const source =
          await repositories.evidenceRepository.getSourceDocument(id);
        return source
          ? ([
              id,
              {
                ...source,
                freshness:
                  source.admissionYear === admissionYear
                    ? "CURRENT"
                    : "LATEST_OFFICIAL_HISTORICAL",
              },
            ] as const)
          : undefined;
      })
    );
    const response = {
      assessmentVersion,
      narrative: result.generatedNarrative,
      profile: assessmentProfile,
      report: serializeAssessmentReport(result.report, assessmentVersion),
      sourceDocuments: Object.fromEntries(
        sourceDocuments.filter(
          (entry): entry is readonly [string, NonNullable<typeof entry>[1]] =>
            Boolean(entry)
        )
      ),
      warnings: result.warnings,
    };
    logBusinessEvent("assessment_completed", {
      admissionYear,
      durationMs: Math.round(performance.now() - startedAt),
      programCount: result.report.schoolRecommendations.length,
      requestId,
      rulesVersion: result.report.rulesVersion,
    });
    return Response.json(response, { headers: { "x-request-id": requestId } });
  } catch (error) {
    logBusinessEvent("assessment_failed", {
      durationMs: Math.round(performance.now() - startedAt),
      requestId,
    });
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Assessment runtime failed",
      },
      { status: 503 }
    );
  }
}
