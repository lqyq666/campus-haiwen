import { validateGeneratedNarrative } from "@/domain/report/validation";
import { buildRetrievalQuery } from "@/domain/retrieval/hybrid";
import { buildEvidencePack, hybridRetrieve } from "@/domain/retrieval/pipeline";
import type { RetrievalRepository } from "@/domain/retrieval/repository";
import { studentProfileSchema } from "@/domain/student/schema";
import { createEmbeddingModel } from "@/lib/ai/embedding-provider";
import { createReportGenerator } from "@/lib/ai/report-generator";
import type { HaiwenGraphStateType, HaiwenGraphUpdate } from "../state";

export function createRagNodes(dependencies: {
  retrievalRepository: RetrievalRepository | (() => RetrievalRepository);
  getSourceDocument: (
    id: string
  ) => Promise<import("@/domain/evidence/models").SourceDocument | undefined>;
}) {
  const repository = () =>
    typeof dependencies.retrievalRepository === "function"
      ? dependencies.retrievalRepository()
      : dependencies.retrievalRepository;
  return {
    hybridRetrieval: async (
      state: HaiwenGraphStateType
    ): Promise<HaiwenGraphUpdate> => {
      if (
        !(
          state.admissionYear &&
          state.pathDecision &&
          state.schoolMatches.length
        )
      ) {
        return { evidencePack: null, retrievedChunks: [] };
      }
      const profile = studentProfileSchema.safeParse(state.studentProfile);
      const query = buildRetrievalQuery({
        admissionYear: state.admissionYear,
        path: state.pathDecision.path,
        programIds: state.schoolMatches.map((item) => item.programId),
        targetMajors: profile.success ? profile.data.targetMajors : [],
      });
      let embed: ((values: string[]) => Promise<number[][]>) | undefined;
      try {
        ({ embed } = createEmbeddingModel());
      } catch {
        /* keyword fallback is explicit below */
      }
      const retrieved = await hybridRetrieve({
        embed,
        evidence: state.evidence,
        query,
        repository: repository(),
      });
      const sources = (
        await Promise.all(
          state.evidence.map((item) =>
            dependencies.getSourceDocument(item.sourceDocumentId)
          )
        )
      ).filter(
        (item): item is import("@/domain/evidence/models").SourceDocument =>
          Boolean(item)
      );
      return {
        evidencePack: buildEvidencePack({
          evidences: [...state.evidence],
          programId: state.schoolMatches[0]?.programId ?? "",
          retrievedChunks: retrieved.retrievedChunks,
          sourceDocuments: sources,
        }),
        retrievalMode: retrieved.mode,
        retrievalQuery: query,
        retrievedChunks: retrieved.retrievedChunks,
        sourceDocuments: sources,
        ...(retrieved.mode === "KEYWORD_FALLBACK"
          ? { warnings: ["KEYWORD_FALLBACK"] }
          : {}),
      };
    },
    reportGeneration: async (
      state: HaiwenGraphStateType
    ): Promise<HaiwenGraphUpdate> => {
      if (!(state.report && state.evidencePack)) {
        return { warnings: ["AI_REPORT_UNAVAILABLE"] };
      }
      try {
        const generator = createReportGenerator();
        const narrative = await generator.generate({
          evidencePack: state.evidencePack,
          report: state.report,
        });
        const validation = validateGeneratedNarrative(
          narrative,
          state.report,
          state.evidencePack.allowedEvidenceIds
        );
        if (!validation.valid) {
          return { warnings: ["AI_REPORT_UNAVAILABLE"] };
        }
        return {
          generatedNarrative: narrative,
          modelMetadata: generator.metadata,
        };
      } catch {
        return { warnings: ["AI_REPORT_UNAVAILABLE"] };
      }
    },
  };
}
