import type { StudyPath } from "@/domain/assessment/path-router";
import type { EvidenceRepository } from "@/domain/evidence/repository";
import type { AdmissionType } from "@/domain/school/models";
import type { SchoolRepository } from "@/domain/school/repository";
import { studentProfileSchema } from "@/domain/student/schema";
import type { HaiwenGraphStateType, HaiwenGraphUpdate } from "../state";

export type SchoolDataNodeDependencies = {
  evidenceRepository: EvidenceRepository;
  schoolRepository: SchoolRepository;
};

export function createSchoolDataNodes(
  dependencies: SchoolDataNodeDependencies | (() => SchoolDataNodeDependencies)
) {
  const getDependencies = () =>
    typeof dependencies === "function" ? dependencies() : dependencies;
  return {
    evidenceRetrieval: async (
      state: HaiwenGraphStateType
    ): Promise<HaiwenGraphUpdate> => {
      if (!validAdmissionYear(state.admissionYear)) {
        return admissionYearError("evidence_retrieval");
      }
      const programIds = state.schoolCandidates.map((item) => item.program.id);
      if (programIds.length === 0) {
        return { evidence: [] };
      }
      const evidence =
        await getDependencies().evidenceRepository.searchEvidence({
          admissionYear: state.admissionYear,
          keywords: [],
          programIds,
        });
      return { evidence };
    },
    schoolCandidateSearch: async (
      state: HaiwenGraphStateType
    ): Promise<HaiwenGraphUpdate> => {
      if (!validAdmissionYear(state.admissionYear)) {
        return admissionYearError("school_candidate_search");
      }
      const profile = studentProfileSchema.safeParse(state.studentProfile);
      if (!profile.success) {
        return {
          errors: [
            {
              code: "SCHOOL_SEARCH_SKIPPED_INVALID_PROFILE",
              message: "School search requires a valid student profile",
              node: "school_candidate_search",
            },
          ],
          schoolCandidates: [],
        };
      }
      const result =
        await getDependencies().schoolRepository.findProgramCandidates({
          admissionType: admissionTypeForPath(state.pathDecision?.path),
          admissionYear: state.admissionYear,
          targetCities: profile.data.targetCities,
          targetMajors: profile.data.targetMajors,
          targetUniversities: profile.data.targetUniversities,
        });
      return { schoolCandidates: result.candidates };
    },
  };
}

function admissionTypeForPath(
  path: StudyPath | undefined
): AdmissionType | undefined {
  if (path === "RECOMMENDATION") {
    return "RECOMMENDATION";
  }
  if (path === "POSTGRAD_EXAM") {
    return "EXAM";
  }
}

function admissionYearError(node: string): HaiwenGraphUpdate {
  return {
    errors: [
      {
        code: "ADMISSION_YEAR_REQUIRED",
        message:
          "A valid explicit admissionYear is required for school data retrieval",
        node,
      },
    ],
    evidence: [],
    schoolCandidates: [],
  };
}

function validAdmissionYear(value: number | null): value is number {
  return (
    value !== null && Number.isInteger(value) && value >= 2000 && value <= 2100
  );
}
