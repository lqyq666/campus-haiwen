import type { Evidence } from "../evidence/models";
import type {
  AdmissionPolicy,
  AdmissionType,
  Department,
  Program,
  RecommendationPolicy,
  University,
} from "./models";

export type ProgramSearchCriteria = {
  admissionType?: AdmissionType;
  admissionYear: number;
  targetCities?: string[];
  targetMajors?: string[];
  targetUniversities?: string[];
};

export type CandidateProgram = {
  admissionPolicy?: AdmissionPolicy;
  department: Department;
  evidence: Evidence[];
  program: Program;
  recommendationPolicies: RecommendationPolicy[];
  university: University;
};

export type ProgramCandidateSearchResult = {
  candidates: CandidateProgram[];
  criteria: ProgramSearchCriteria;
  missingCriteria: Array<
    "targetCities" | "targetMajors" | "targetUniversities"
  >;
};

export interface SchoolRepository {
  findProgramCandidates: (
    criteria: ProgramSearchCriteria
  ) => Promise<ProgramCandidateSearchResult>;
  findPrograms: (criteria: ProgramSearchCriteria) => Promise<Program[]>;
  findUniversities: (namesOrCities: string[]) => Promise<University[]>;
  getAdmissionPolicy: (
    programId: string,
    admissionYear: number
  ) => Promise<AdmissionPolicy | undefined>;
  getProgram: (id: string) => Promise<Program | undefined>;
  getRecommendationPolicies: (
    programId: string,
    admissionYear: number
  ) => Promise<RecommendationPolicy[]>;
  getUniversity: (id: string) => Promise<University | undefined>;
}
