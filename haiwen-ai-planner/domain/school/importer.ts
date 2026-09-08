import type { Evidence, SourceDocument } from "../evidence/models";
import type {
  AdmissionPolicy,
  Department,
  Program,
  RecommendationPolicy,
  University,
} from "./models";

export type NormalizedSchoolRecord = {
  department: Department;
  program: Program;
  university: University;
};

export type NormalizedPolicyRecord = {
  admissionPolicy?: AdmissionPolicy;
  recommendationPolicies: RecommendationPolicy[];
};

export type NormalizedEvidenceRecord = {
  evidence: Evidence[];
  sourceDocument: SourceDocument;
};

export interface SchoolDataImporter {
  importEvidence: (record: NormalizedEvidenceRecord) => Promise<void>;
  importPolicy: (record: NormalizedPolicyRecord) => Promise<void>;
  importSchool: (record: NormalizedSchoolRecord) => Promise<void>;
}
