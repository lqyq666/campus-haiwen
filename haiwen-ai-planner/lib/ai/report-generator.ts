import { generateObject } from "ai";
import type { AssessmentReport } from "@/domain/recommendation/models";
import {
  type GeneratedReportNarrative,
  generatedReportNarrativeSchema,
  type ModelMetadata,
  reportPromptVersion,
} from "@/domain/report/models";
import type { EvidencePack } from "@/domain/retrieval/models";
import { createLanguageModel, loadLLMConfig } from "./provider";

export type ReportGenerator = {
  generate: (input: {
    evidencePack: EvidencePack;
    report: AssessmentReport;
  }) => Promise<GeneratedReportNarrative>;
  metadata: ModelMetadata;
};

export function createReportGenerator(): ReportGenerator {
  const config = loadLLMConfig();
  return {
    generate: async ({ evidencePack, report }) => {
      const result = await generateObject({
        abortSignal: AbortSignal.timeout(20_000),
        maxRetries: 1,
        model: createLanguageModel(config),
        prompt: JSON.stringify({
          actionPriorities: report.actionPriorities,
          allowedEvidenceIds: evidencePack.allowedEvidenceIds,
          path: report.pathDecision.path,
          schoolRecommendations: report.schoolRecommendations.map((item) => ({
            programId: item.programId,
            tier: item.tier,
          })),
          suppliedFacts: evidencePack.facts,
        }),
        schema: generatedReportNarrativeSchema,
        schemaName: "haiwen_report_narrative",
        system:
          "Explain only supplied facts. Never create scores, tiers, program IDs, policies, dates, or evidence IDs. Cite only allowedEvidenceIds.",
      });
      return result.object;
    },
    metadata: {
      model: config.model,
      promptVersion: reportPromptVersion,
      provider: config.provider,
    },
  };
}

export function createFakeReportGenerator(): ReportGenerator {
  return {
    generate: async ({ evidencePack, report }) => ({
      disclaimer:
        "本结果为规划辅助，不代表任何院校录取承诺。招生政策可能变化，请以招生单位最新官方通知为准。",
      executiveSummary: "这是基于系统事实生成的测试解读。",
      pathExplanation: `当前推荐路径为 ${report.pathDecision.path}。`,
      riskAnalysis: report.topRisks.map((risk) => risk.message).slice(0, 3),
      roadmap: {
        days0To30: report.actionPriorities
          .filter((item) => item.timeWindow === "DAYS_0_30")
          .map((item) => item.action)
          .concat(
            report.actionPriorities.length === 0
              ? ["整理成绩、排名、英语和代表性项目材料目录"]
              : []
          ),
        days31To60: report.actionPriorities
          .filter((item) => item.timeWindow === "DAYS_31_60")
          .map((item) => item.action)
          .concat(
            report.actionPriorities.length === 0
              ? ["按最新政策校准分层候选清单"]
              : []
          ),
        days61To90: report.actionPriorities
          .filter((item) => item.timeWindow === "DAYS_61_90")
          .map((item) => item.action)
          .concat(
            report.actionPriorities.length === 0
              ? ["重新测评并记录分数、风险和优先任务变化"]
              : []
          ),
      },
      schoolExplanations: report.schoolRecommendations.map((item) => ({
        evidenceIds: item.evidenceIds.filter((id) =>
          evidencePack.allowedEvidenceIds.includes(id)
        ),
        explanation: "该项目的系统匹配结论和证据已在报告中列明。",
        programId: item.programId,
      })),
      strengthAnalysis: ["系统评分和路径判断由确定性规则提供。"],
    }),
    metadata: {
      model: "fake-report-v1",
      promptVersion: reportPromptVersion,
      provider: "fake",
    },
  };
}
