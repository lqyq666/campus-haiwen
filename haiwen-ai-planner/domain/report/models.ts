import { z } from "zod";

export const reportPromptVersion = "haiwen-report-prompt-v0.1" as const;

export const generatedReportNarrativeSchema = z.object({
  disclaimer: z.string().min(1),
  executiveSummary: z.string().min(1),
  pathExplanation: z.string().min(1),
  riskAnalysis: z.array(z.string().min(1)),
  roadmap: z.object({
    days0To30: z.array(z.string().min(1)).min(1),
    days31To60: z.array(z.string().min(1)).min(1),
    days61To90: z.array(z.string().min(1)).min(1),
  }),
  schoolExplanations: z.array(
    z.object({
      evidenceIds: z.array(z.string()),
      explanation: z.string().min(1),
      programId: z.string().min(1),
    })
  ),
  strengthAnalysis: z.array(z.string().min(1)),
});

export type GeneratedReportNarrative = z.infer<
  typeof generatedReportNarrativeSchema
>;
export type ModelMetadata = {
  model: string;
  promptVersion: typeof reportPromptVersion;
  provider: string;
};

export type NarrativeValidation = { issues: string[]; valid: boolean };
