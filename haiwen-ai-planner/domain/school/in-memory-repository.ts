import { normalizeEvidenceText } from "../evidence/integrity";
import type {
  EvidenceRepository,
  EvidenceSearchCriteria,
} from "../evidence/repository";
import {
  fixtureAdmissionPolicies,
  fixtureDepartments,
  fixtureEvidence,
  fixturePrograms,
  fixtureRecommendationPolicies,
  fixtureSourceDocuments,
  fixtureUniversities,
} from "./fixtures";
import type { Program } from "./models";
import type {
  CandidateProgram,
  ProgramCandidateSearchResult,
  ProgramSearchCriteria,
  SchoolRepository,
} from "./repository";

export class InMemorySchoolRepository implements SchoolRepository {
  async findProgramCandidates(
    criteria: ProgramSearchCriteria
  ): Promise<ProgramCandidateSearchResult> {
    const programs = await this.findPrograms(criteria);
    const candidates = await Promise.all(
      programs.map((program) =>
        this.toCandidate(program, criteria.admissionYear)
      )
    );
    return {
      candidates,
      criteria,
      missingCriteria: missingCriteria(criteria),
    };
  }

  findPrograms(criteria: ProgramSearchCriteria) {
    return Promise.resolve(
      fixturePrograms.filter((program) => matchesProgram(program, criteria))
    );
  }

  findUniversities(namesOrCities: string[]) {
    const values = namesOrCities.map(normalizeFilter);
    return Promise.resolve(
      fixtureUniversities.filter((university) =>
        values.some(
          (value) =>
            normalizeFilter(university.name).includes(value) ||
            normalizeFilter(university.city ?? "").includes(value)
        )
      )
    );
  }

  getAdmissionPolicy(programId: string, admissionYear: number) {
    return Promise.resolve(
      fixtureAdmissionPolicies.find(
        (policy) =>
          policy.programId === programId &&
          policy.admissionYear === admissionYear
      )
    );
  }

  getProgram(id: string) {
    return Promise.resolve(
      fixturePrograms.find((program) => program.id === id)
    );
  }

  getRecommendationPolicies(programId: string, admissionYear: number) {
    return Promise.resolve(
      fixtureRecommendationPolicies.filter(
        (policy) =>
          policy.programId === programId &&
          policy.admissionYear === admissionYear
      )
    );
  }

  getUniversity(id: string) {
    return Promise.resolve(
      fixtureUniversities.find((university) => university.id === id)
    );
  }

  private async toCandidate(
    program: Program,
    admissionYear: number
  ): Promise<CandidateProgram> {
    const university = fixtureUniversities.find(
      (item) => item.id === program.universityId
    );
    const department = fixtureDepartments.find(
      (item) => item.id === program.departmentId
    );
    if (!(university && department)) {
      throw new Error(`Broken fixture relationship for ${program.id}`);
    }
    const sourceIds = new Set(
      fixtureSourceDocuments
        .filter((source) => source.admissionYear === admissionYear)
        .map((source) => source.id)
    );
    return {
      admissionPolicy: await this.getAdmissionPolicy(program.id, admissionYear),
      department,
      evidence: fixtureEvidence.filter(
        (item) =>
          item.programId === program.id && sourceIds.has(item.sourceDocumentId)
      ),
      program,
      recommendationPolicies: await this.getRecommendationPolicies(
        program.id,
        admissionYear
      ),
      university,
    };
  }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  findEvidenceForProgram(programId: string) {
    return Promise.resolve(
      fixtureEvidence.filter((item) => item.programId === programId)
    );
  }

  getEvidence(id: string) {
    return Promise.resolve(fixtureEvidence.find((item) => item.id === id));
  }

  getSourceDocument(id: string) {
    return Promise.resolve(
      fixtureSourceDocuments.find((item) => item.id === id)
    );
  }

  searchEvidence(criteria: EvidenceSearchCriteria) {
    const keywords = criteria.keywords.map(normalizeFilter).filter(Boolean);
    const programIds = new Set(criteria.programIds ?? []);
    const sourceIds = new Set(
      fixtureSourceDocuments
        .filter(
          (source) =>
            criteria.admissionYear === undefined ||
            source.admissionYear === criteria.admissionYear
        )
        .map((source) => source.id)
    );
    return Promise.resolve(
      fixtureEvidence.filter((evidence) => {
        const haystack = normalizeFilter(evidence.excerpt);
        return (
          sourceIds.has(evidence.sourceDocumentId) &&
          (programIds.size === 0 || programIds.has(evidence.programId)) &&
          (keywords.length === 0 ||
            keywords.every((keyword) => haystack.includes(keyword)))
        );
      })
    );
  }
}

function matchesProgram(program: Program, criteria: ProgramSearchCriteria) {
  if (!program.active) {
    return false;
  }
  const university = fixtureUniversities.find(
    (item) => item.id === program.universityId
  );
  if (!university) {
    return false;
  }
  const cities = normalized(criteria.targetCities);
  const majors = normalized(criteria.targetMajors);
  const universities = normalized(criteria.targetUniversities);
  const hasYearPolicy =
    fixtureAdmissionPolicies.some(
      (policy) =>
        policy.programId === program.id &&
        policy.admissionYear === criteria.admissionYear
    ) ||
    fixtureRecommendationPolicies.some(
      (policy) =>
        policy.programId === program.id &&
        policy.admissionYear === criteria.admissionYear
    );
  return (
    hasYearPolicy &&
    (cities.length === 0 ||
      cities.includes(normalizeFilter(university.city ?? ""))) &&
    (universities.length === 0 ||
      universities.some((value) =>
        normalizeFilter(university.name).includes(value)
      )) &&
    (majors.length === 0 ||
      majors.some((value) => normalizeFilter(program.name).includes(value))) &&
    (!criteria.admissionType ||
      program.admissionType === "BOTH" ||
      program.admissionType === criteria.admissionType)
  );
}

function missingCriteria(criteria: ProgramSearchCriteria) {
  const missing: ProgramCandidateSearchResult["missingCriteria"] = [];
  if (!criteria.targetCities?.length) {
    missing.push("targetCities");
  }
  if (!criteria.targetMajors?.length) {
    missing.push("targetMajors");
  }
  if (!criteria.targetUniversities?.length) {
    missing.push("targetUniversities");
  }
  return missing;
}

function normalizeFilter(value: string) {
  return normalizeEvidenceText(value).toLocaleLowerCase();
}

function normalized(values: string[] | undefined) {
  return (values ?? []).map(normalizeFilter).filter(Boolean);
}
