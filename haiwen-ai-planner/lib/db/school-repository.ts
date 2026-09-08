import type postgres from "postgres";
import { verifyEvidenceSpan } from "@/domain/evidence/integrity";
import type { Evidence, SourceDocument } from "@/domain/evidence/models";
import type {
  EvidenceRepository,
  EvidenceSearchCriteria,
} from "@/domain/evidence/repository";
import {
  fixtureAdmissionPolicies,
  fixtureDepartments,
  fixtureEvidence,
  fixturePrograms,
  fixtureRecommendationPolicies,
  fixtureSourceDocuments,
  fixtureUniversities,
} from "@/domain/school/fixtures";
import type {
  AdmissionPolicy,
  Department,
  Program,
  RecommendationPolicy,
  University,
} from "@/domain/school/models";
import type {
  CandidateProgram,
  ProgramCandidateSearchResult,
  ProgramSearchCriteria,
  SchoolRepository,
} from "@/domain/school/repository";

type Sql = ReturnType<typeof postgres>;

export class PostgresSchoolDataRepository
  implements SchoolRepository, EvidenceRepository
{
  private readonly sql: Sql;
  private readonly officialOnly: boolean;

  constructor(sql: Sql, options: { officialOnly?: boolean } = {}) {
    this.sql = sql;
    this.officialOnly = options.officialOnly ?? false;
  }

  async seedFixtures() {
    await Promise.all(
      fixtureUniversities.map((item) => insertUniversity(this.sql, item))
    );
    await Promise.all(
      fixtureDepartments.map((item) => insertDepartment(this.sql, item))
    );
    await Promise.all(
      fixturePrograms.map((item) => insertProgram(this.sql, item))
    );
    await Promise.all(
      fixtureSourceDocuments.map((item) => insertSource(this.sql, item))
    );
    await Promise.all(
      fixtureAdmissionPolicies.map((item) => insertAdmission(this.sql, item))
    );
    await Promise.all(
      fixtureRecommendationPolicies.map((item) =>
        insertRecommendation(this.sql, item)
      )
    );
    await Promise.all(
      fixtureEvidence.map((item) => insertEvidenceRow(this.sql, item))
    );
  }

  async findProgramCandidates(
    criteria: ProgramSearchCriteria
  ): Promise<ProgramCandidateSearchResult> {
    const programs = await this.findPrograms(criteria);
    const candidates = await Promise.all(
      programs.map(async (program): Promise<CandidateProgram> => {
        const [
          university,
          departmentRows,
          admissionPolicy,
          recommendationPolicies,
        ] = await Promise.all([
          this.getUniversity(program.universityId),
          this.sql<
            Department[]
          >`SELECT id, university_id AS "universityId", name,
              short_name AS "shortName", official_website AS "officialWebsite",
              created_at AS "createdAt", updated_at AS "updatedAt"
              FROM departments WHERE id = ${program.departmentId}`,
          this.getAdmissionPolicy(program.id, criteria.admissionYear),
          this.getRecommendationPolicies(program.id, criteria.admissionYear),
        ]);
        const [department] = departmentRows;
        if (!(university && department)) {
          throw new Error(`Broken school relationship for ${program.id}`);
        }
        const evidence = await this.searchEvidence({
          admissionYear: criteria.admissionYear,
          keywords: [],
          programIds: [program.id],
        });
        return {
          admissionPolicy,
          department,
          evidence,
          program,
          recommendationPolicies,
          university,
        };
      })
    );
    return {
      candidates,
      criteria,
      missingCriteria: missingCriteria(criteria),
    };
  }

  async findPrograms(criteria: ProgramSearchCriteria): Promise<Program[]> {
    const rows = await this.sql<Program[]>`SELECT DISTINCT p.id,
      p.university_id AS "universityId", p.department_id AS "departmentId",
      p.name, p.code, p.degree_type AS "degreeType",
      p.discipline_category AS "disciplineCategory", p.study_mode AS "studyMode",
      p.admission_type AS "admissionType", p.active,
      p.created_at AS "createdAt", p.updated_at AS "updatedAt"
      FROM programs p
      LEFT JOIN admission_policies ap ON ap.program_id = p.id AND ap.admission_year = ${criteria.admissionYear}
      LEFT JOIN recommendation_policies rp ON rp.program_id = p.id AND rp.admission_year = ${criteria.admissionYear}
      LEFT JOIN source_documents aps ON aps.id = ap.source_document_id
      LEFT JOIN source_documents rps ON rps.id = rp.source_document_id
      WHERE p.active = true AND (ap.id IS NOT NULL OR rp.id IS NOT NULL)
      AND (${this.officialOnly} = false OR aps.source_trust = 'OFFICIAL' OR rps.source_trust = 'OFFICIAL')`;
    const universities = new Map(
      (
        await this.sql<
          University[]
        >`SELECT id, name, short_name AS "shortName", province,
        city, type, tags, official_website AS "officialWebsite", active,
        created_at AS "createdAt", updated_at AS "updatedAt" FROM universities`
      ).map((item) => [item.id, item])
    );
    return rows.filter((program) =>
      matchesCriteria(program, universities, criteria)
    );
  }

  async findUniversities(values: string[]) {
    const normalized = values.map(normalize);
    const rows = await this.sql<
      University[]
    >`SELECT id, name, short_name AS "shortName",
      province, city, type, tags, official_website AS "officialWebsite", active,
      created_at AS "createdAt", updated_at AS "updatedAt" FROM universities`;
    return rows.filter((item) =>
      normalized.some(
        (value) =>
          normalize(item.name).includes(value) ||
          normalize(item.city ?? "").includes(value)
      )
    );
  }

  async getAdmissionPolicy(programId: string, admissionYear: number) {
    const rows = await this.sql<
      AdmissionPolicy[]
    >`SELECT id, program_id AS "programId",
      admission_year AS "admissionYear", planned_enrollment AS "plannedEnrollment",
      recommendation_exempt_quota AS "recommendationExemptQuota",
      exam_subjects AS "examSubjects", retest_score AS "retestScore", notes,
      source_document_id AS "sourceDocumentId", created_at AS "createdAt",
      updated_at AS "updatedAt" FROM admission_policies
      WHERE program_id = ${programId} AND admission_year = ${admissionYear}`;
    return rows[0];
  }

  async getProgram(id: string) {
    const rows = await this.sql<
      Program[]
    >`SELECT id, university_id AS "universityId",
      department_id AS "departmentId", name, code, degree_type AS "degreeType",
      discipline_category AS "disciplineCategory", study_mode AS "studyMode",
      admission_type AS "admissionType", active, created_at AS "createdAt",
      updated_at AS "updatedAt" FROM programs WHERE id = ${id}`;
    return rows[0];
  }

  getRecommendationPolicies(programId: string, admissionYear: number) {
    return this.sql<
      RecommendationPolicy[]
    >`SELECT id, program_id AS "programId",
      admission_year AS "admissionYear", stage, application_start AS "applicationStart",
      application_end AS "applicationEnd", ranking_requirement AS "rankingRequirement",
      english_requirement AS "englishRequirement", research_requirement AS "researchRequirement",
      competition_requirement AS "competitionRequirement", eligibility_notes AS "eligibilityNotes",
      source_document_id AS "sourceDocumentId", created_at AS "createdAt",
      updated_at AS "updatedAt" FROM recommendation_policies
      WHERE program_id = ${programId} AND admission_year = ${admissionYear}`;
  }

  async getUniversity(id: string) {
    const rows = await this.sql<
      University[]
    >`SELECT id, name, short_name AS "shortName",
      province, city, type, tags, official_website AS "officialWebsite", active,
      created_at AS "createdAt", updated_at AS "updatedAt"
      FROM universities WHERE id = ${id}`;
    return rows[0];
  }

  findEvidenceForProgram(programId: string) {
    return this.sql<
      Evidence[]
    >`SELECT id, source_document_id AS "sourceDocumentId",
      program_id AS "programId", evidence_type AS "evidenceType", excerpt,
      start_offset AS "startOffset", end_offset AS "endOffset",
      normalized_excerpt AS "normalizedExcerpt", content_hash AS "contentHash",
      created_at AS "createdAt" FROM evidences WHERE program_id = ${programId}`;
  }

  async getEvidence(id: string) {
    const rows = await this.sql<
      Evidence[]
    >`SELECT id, source_document_id AS "sourceDocumentId",
      program_id AS "programId", evidence_type AS "evidenceType", excerpt,
      start_offset AS "startOffset", end_offset AS "endOffset",
      normalized_excerpt AS "normalizedExcerpt", content_hash AS "contentHash",
      created_at AS "createdAt" FROM evidences WHERE id = ${id}`;
    return rows[0];
  }

  async getSourceDocument(id: string) {
    const rows = await this.sql<
      SourceDocument[]
    >`SELECT id, source_type AS "sourceType",
      source_trust AS "sourceTrust", source_url AS "sourceUrl",
      canonical_url AS "canonicalUrl", title, publisher, published_at AS "publishedAt",
      fetched_at AS "fetchedAt", admission_year AS "admissionYear",
      content_hash AS "contentHash", raw_text AS "rawText",
      created_at AS "createdAt", updated_at AS "updatedAt"
      FROM source_documents WHERE id = ${id}`;
    return rows[0];
  }

  async searchEvidence(criteria: EvidenceSearchCriteria) {
    const rows = await this.sql<Evidence[]>`SELECT e.id,
      e.source_document_id AS "sourceDocumentId", e.program_id AS "programId",
      e.evidence_type AS "evidenceType", e.excerpt, e.start_offset AS "startOffset",
      e.end_offset AS "endOffset", e.normalized_excerpt AS "normalizedExcerpt",
      e.content_hash AS "contentHash", e.created_at AS "createdAt"
      FROM evidences e JOIN source_documents s ON s.id = e.source_document_id
      WHERE (${criteria.admissionYear ?? null}::integer IS NULL OR s.admission_year = ${criteria.admissionYear ?? null})
      AND (${this.officialOnly} = false OR s.source_trust = 'OFFICIAL')`;
    const keywords = criteria.keywords.map(normalize).filter(Boolean);
    const ids = new Set(criteria.programIds ?? []);
    return rows.filter(
      (item) =>
        (ids.size === 0 || ids.has(item.programId)) &&
        (keywords.length === 0 ||
          keywords.every((keyword) =>
            normalize(item.excerpt).includes(keyword)
          ))
    );
  }

  async insertEvidence(evidence: Evidence) {
    const source = await this.getSourceDocument(evidence.sourceDocumentId);
    if (!source) {
      throw new Error("Evidence source document does not exist");
    }
    const verification = verifyEvidenceSpan(evidence, source);
    if (!verification.valid) {
      throw new Error(`Invalid evidence: ${verification.reason}`);
    }
    await insertEvidenceRow(this.sql, evidence);
  }

  async upsertSourceDocument(document: SourceDocument) {
    await insertSource(this.sql, document);
    const rows = await this.sql<
      SourceDocument[]
    >`SELECT id, source_type AS "sourceType",
      source_trust AS "sourceTrust", source_url AS "sourceUrl",
      canonical_url AS "canonicalUrl", title, publisher, published_at AS "publishedAt",
      fetched_at AS "fetchedAt", admission_year AS "admissionYear",
      content_hash AS "contentHash", raw_text AS "rawText",
      created_at AS "createdAt", updated_at AS "updatedAt" FROM source_documents
      WHERE COALESCE(canonical_url, source_url) = ${document.canonicalUrl ?? document.sourceUrl}
      AND content_hash = ${document.contentHash}`;
    return rows[0];
  }
}

async function insertUniversity(sql: Sql, item: University) {
  await sql`INSERT INTO universities (id, name, short_name, province, city, type, tags,
    official_website, active, created_at, updated_at) VALUES (${item.id}, ${item.name},
    ${item.shortName ?? null}, ${item.province ?? null}, ${item.city ?? null}, ${item.type ?? null},
    ${item.tags}, ${item.officialWebsite ?? null}, ${item.active}, ${item.createdAt}, ${item.updatedAt})
    ON CONFLICT (id) DO NOTHING`;
}

async function insertDepartment(sql: Sql, item: Department) {
  await sql`INSERT INTO departments (id, university_id, name, short_name, official_website,
    created_at, updated_at) VALUES (${item.id}, ${item.universityId}, ${item.name},
    ${item.shortName ?? null}, ${item.officialWebsite ?? null}, ${item.createdAt}, ${item.updatedAt})
    ON CONFLICT (id) DO NOTHING`;
}

async function insertProgram(sql: Sql, item: Program) {
  await sql`INSERT INTO programs (id, university_id, department_id, name, code, degree_type,
    discipline_category, study_mode, admission_type, active, created_at, updated_at)
    VALUES (${item.id}, ${item.universityId}, ${item.departmentId}, ${item.name}, ${item.code ?? null},
    ${item.degreeType}, ${item.disciplineCategory ?? null}, ${item.studyMode}, ${item.admissionType},
    ${item.active}, ${item.createdAt}, ${item.updatedAt}) ON CONFLICT (id) DO NOTHING`;
}

async function insertSource(sql: Sql, item: SourceDocument) {
  await sql`INSERT INTO source_documents (id, source_type, source_trust, source_url,
    canonical_url, title, publisher, published_at, fetched_at, admission_year, content_hash,
    raw_text, created_at, updated_at) VALUES (${item.id}, ${item.sourceType}, ${item.sourceTrust},
    ${item.sourceUrl}, ${item.canonicalUrl ?? null}, ${item.title}, ${item.publisher ?? null},
    ${item.publishedAt ?? null}, ${item.fetchedAt}, ${item.admissionYear ?? null}, ${item.contentHash},
    ${item.rawText ?? null}, ${item.createdAt}, ${item.updatedAt})
    ON CONFLICT DO NOTHING`;
}

async function insertAdmission(sql: Sql, item: AdmissionPolicy) {
  await sql`INSERT INTO admission_policies (id, program_id, admission_year, planned_enrollment,
    recommendation_exempt_quota, exam_subjects, retest_score, notes, source_document_id,
    created_at, updated_at) VALUES (${item.id}, ${item.programId}, ${item.admissionYear},
    ${item.plannedEnrollment ?? null}, ${item.recommendationExemptQuota ?? null},
    ${sql.json(item.examSubjects)}, ${item.retestScore ?? null}, ${item.notes ?? null},
    ${item.sourceDocumentId}, ${item.createdAt}, ${item.updatedAt}) ON CONFLICT (id) DO NOTHING`;
}

async function insertRecommendation(sql: Sql, item: RecommendationPolicy) {
  await sql`INSERT INTO recommendation_policies (id, program_id, admission_year, stage,
    application_start, application_end, ranking_requirement, english_requirement,
    research_requirement, competition_requirement, eligibility_notes, source_document_id,
    created_at, updated_at) VALUES (${item.id}, ${item.programId}, ${item.admissionYear}, ${item.stage},
    ${item.applicationStart ?? null}, ${item.applicationEnd ?? null}, ${item.rankingRequirement ?? null},
    ${item.englishRequirement ?? null}, ${item.researchRequirement ?? null},
    ${item.competitionRequirement ?? null}, ${item.eligibilityNotes ?? null}, ${item.sourceDocumentId},
    ${item.createdAt}, ${item.updatedAt}) ON CONFLICT (id) DO NOTHING`;
}

async function insertEvidenceRow(sql: Sql, item: Evidence) {
  await sql`INSERT INTO evidences (id, source_document_id, program_id, evidence_type, excerpt,
    start_offset, end_offset, normalized_excerpt, content_hash, created_at) VALUES (${item.id},
    ${item.sourceDocumentId}, ${item.programId}, ${item.evidenceType}, ${item.excerpt},
    ${item.startOffset ?? null}, ${item.endOffset ?? null}, ${item.normalizedExcerpt ?? null},
    ${item.contentHash}, ${item.createdAt}) ON CONFLICT (id) DO NOTHING`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesCriteria(
  program: Program,
  universities: Map<string, University>,
  criteria: ProgramSearchCriteria
) {
  const university = universities.get(program.universityId);
  if (!university) {
    return false;
  }
  const cities = (criteria.targetCities ?? []).map(normalize).filter(Boolean);
  const majors = (criteria.targetMajors ?? []).map(normalize).filter(Boolean);
  const names = (criteria.targetUniversities ?? [])
    .map(normalize)
    .filter(Boolean);
  return (
    (cities.length === 0 ||
      cities.includes(normalize(university.city ?? ""))) &&
    (majors.length === 0 ||
      majors.some((item) => normalize(program.name).includes(item))) &&
    (names.length === 0 ||
      names.some((item) => normalize(university.name).includes(item))) &&
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
