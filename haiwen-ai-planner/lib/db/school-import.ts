import type postgres from "postgres";
import type { TransactionSql } from "postgres";
import type { SchoolDataset } from "@/domain/school/dataset";
import {
  type ExistingSchoolImportState,
  SchoolImportAction,
  SchoolImportEntityType,
  type SchoolImportPlan,
  type SchoolImportPlanEntry,
} from "@/domain/school/import-plan";

type Sql = ReturnType<typeof postgres>;
type QuerySql = Sql | TransactionSql;
export type SchoolImportResult = {
  datasetVersion: string;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  committed: boolean;
  byEntityType: Record<SchoolImportEntityType, number>;
};

export async function readExistingSchoolImportState(
  sql: Sql
): Promise<ExistingSchoolImportState> {
  const [
    universities,
    departments,
    programs,
    sourceDocuments,
    admissionPolicies,
    recommendationPolicies,
    evidences,
  ] = await Promise.all([
    sql`SELECT id,name,short_name AS "shortName",province,city,type,tags,official_website AS "officialWebsite",active,created_at AS "createdAt",updated_at AS "updatedAt" FROM universities`,
    sql`SELECT id,university_id AS "universityId",name,short_name AS "shortName",official_website AS "officialWebsite",created_at AS "createdAt",updated_at AS "updatedAt" FROM departments`,
    sql`SELECT id,university_id AS "universityId",department_id AS "departmentId",name,code,degree_type AS "degreeType",discipline_category AS "disciplineCategory",study_mode AS "studyMode",admission_type AS "admissionType",active,created_at AS "createdAt",updated_at AS "updatedAt" FROM programs`,
    sql`SELECT id,source_type AS "sourceType",source_trust AS "sourceTrust",source_url AS "sourceUrl",canonical_url AS "canonicalUrl",title,publisher,published_at AS "publishedAt",fetched_at AS "fetchedAt",admission_year AS "admissionYear",content_hash AS "contentHash",raw_text AS "rawText",created_at AS "createdAt",updated_at AS "updatedAt" FROM source_documents`,
    sql`SELECT id,program_id AS "programId",admission_year AS "admissionYear",planned_enrollment AS "plannedEnrollment",recommendation_exempt_quota AS "recommendationExemptQuota",exam_subjects AS "examSubjects",retest_score AS "retestScore",notes,source_document_id AS "sourceDocumentId",created_at AS "createdAt",updated_at AS "updatedAt" FROM admission_policies`,
    sql`SELECT id,program_id AS "programId",admission_year AS "admissionYear",stage,application_start AS "applicationStart",application_end AS "applicationEnd",ranking_requirement AS "rankingRequirement",english_requirement AS "englishRequirement",research_requirement AS "researchRequirement",competition_requirement AS "competitionRequirement",eligibility_notes AS "eligibilityNotes",source_document_id AS "sourceDocumentId",created_at AS "createdAt",updated_at AS "updatedAt" FROM recommendation_policies`,
    sql`SELECT id,source_document_id AS "sourceDocumentId",program_id AS "programId",evidence_type AS "evidenceType",excerpt,content_hash AS "contentHash",created_at AS "createdAt" FROM evidences`,
  ]);
  return {
    admissionPolicies:
      admissionPolicies as unknown as ExistingSchoolImportState["admissionPolicies"],
    departments:
      departments as unknown as ExistingSchoolImportState["departments"],
    evidences: evidences as unknown as ExistingSchoolImportState["evidences"],
    programs: programs as unknown as ExistingSchoolImportState["programs"],
    recommendationPolicies:
      recommendationPolicies as unknown as ExistingSchoolImportState["recommendationPolicies"],
    sourceDocuments:
      sourceDocuments as unknown as ExistingSchoolImportState["sourceDocuments"],
    universities:
      universities as unknown as ExistingSchoolImportState["universities"],
  };
}

export async function executeSchoolImport(
  sql: Sql,
  dataset: SchoolDataset,
  plan: SchoolImportPlan
): Promise<SchoolImportResult> {
  const result: SchoolImportResult = {
    byEntityType: Object.fromEntries(
      Object.values(SchoolImportEntityType).map((type) => [type, 0])
    ) as Record<SchoolImportEntityType, number>,
    committed: false,
    created: 0,
    datasetVersion: plan.datasetVersion,
    failed: 0,
    skipped: 0,
    unchanged: 0,
    updated: 0,
  };
  const rows = new Map<string, Record<string, unknown>>();
  for (const [type, values] of [
    [SchoolImportEntityType.UNIVERSITY, dataset.universities],
    [SchoolImportEntityType.DEPARTMENT, dataset.departments],
    [SchoolImportEntityType.PROGRAM, dataset.programs],
    [SchoolImportEntityType.SOURCE_DOCUMENT, dataset.sources],
    [SchoolImportEntityType.ADMISSION_POLICY, dataset.admissionPolicies],
    [
      SchoolImportEntityType.RECOMMENDATION_POLICY,
      dataset.recommendationPolicies,
    ],
    [SchoolImportEntityType.EVIDENCE, dataset.evidences],
  ] as const) {
    for (const value of values) {
      rows.set(`${type}:${value.id}`, value as Record<string, unknown>);
    }
  }
  try {
    await sql.begin(async (tx) => {
      for (const [type, entries] of [
        [SchoolImportEntityType.UNIVERSITY, plan.universities],
        [SchoolImportEntityType.DEPARTMENT, plan.departments],
        [SchoolImportEntityType.PROGRAM, plan.programs],
        [SchoolImportEntityType.SOURCE_DOCUMENT, plan.sourceDocuments],
        [SchoolImportEntityType.ADMISSION_POLICY, plan.admissionPolicies],
        [
          SchoolImportEntityType.RECOMMENDATION_POLICY,
          plan.recommendationPolicies,
        ],
        [SchoolImportEntityType.EVIDENCE, plan.evidences],
      ] as const) {
        for (const entry of entries) {
          const row = rows.get(`${type}:${entry.externalId}`);
          if (!row) {
            throw new Error("Plan entry has no dataset record");
          }
          // biome-ignore lint/performance/noAwaitInLoops: FK-safe order is required.
          await write(tx, type, entry, row, result);
        }
      }
    });
    result.committed = true;
  } catch {
    result.failed += 1;
  }
  return result;
}

async function write(
  sql: QuerySql,
  type: SchoolImportEntityType,
  entry: SchoolImportPlanEntry,
  row: Record<string, unknown>,
  result: SchoolImportResult
) {
  if (entry.action === SchoolImportAction.UNCHANGED) {
    result.unchanged += 1;
    return;
  }
  if (entry.action === SchoolImportAction.SKIP) {
    result.skipped += 1;
    return;
  }
  const update = entry.action === SchoolImportAction.UPDATE;
  if (type === SchoolImportEntityType.UNIVERSITY) {
    await (update
      ? await sql`UPDATE universities SET name=${row.name as string}, short_name=${(row.shortName as string) ?? null}, province=${(row.province as string) ?? null}, city=${(row.city as string) ?? null}, type=${(row.type as string) ?? null}, tags=${row.tags as string[]}, official_website=${(row.officialWebsite as string) ?? null}, active=${row.active as boolean}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO universities (id,name,short_name,province,city,type,tags,official_website,active,created_at,updated_at) VALUES (${row.id as string},${row.name as string},${(row.shortName as string) ?? null},${(row.province as string) ?? null},${(row.city as string) ?? null},${(row.type as string) ?? null},${row.tags as string[]},${(row.officialWebsite as string) ?? null},${row.active as boolean},${row.createdAt as string},${row.updatedAt as string})`);
  } else if (type === SchoolImportEntityType.DEPARTMENT) {
    // biome-ignore lint/suspicious/noUnusedExpressions: selects the planned SQL write.
    update
      ? await sql`UPDATE departments SET name=${row.name as string}, short_name=${(row.shortName as string) ?? null}, official_website=${(row.officialWebsite as string) ?? null}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO departments (id,university_id,name,short_name,official_website,created_at,updated_at) VALUES (${row.id as string},${row.universityId as string},${row.name as string},${(row.shortName as string) ?? null},${(row.officialWebsite as string) ?? null},${row.createdAt as string},${row.updatedAt as string})`;
  } else if (type === SchoolImportEntityType.PROGRAM) {
    // biome-ignore lint/suspicious/noUnusedExpressions: selects the planned SQL write.
    update
      ? await sql`UPDATE programs SET name=${row.name as string}, code=${(row.code as string) ?? null}, discipline_category=${(row.disciplineCategory as string) ?? null}, active=${row.active as boolean}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO programs (id,university_id,department_id,name,code,degree_type,discipline_category,study_mode,admission_type,active,created_at,updated_at) VALUES (${row.id as string},${row.universityId as string},${row.departmentId as string},${row.name as string},${(row.code as string) ?? null},${row.degreeType as string},${(row.disciplineCategory as string) ?? null},${row.studyMode as string},${row.admissionType as string},${row.active as boolean},${row.createdAt as string},${row.updatedAt as string})`;
  } else if (type === SchoolImportEntityType.SOURCE_DOCUMENT) {
    // biome-ignore lint/suspicious/noUnusedExpressions: selects the planned SQL write.
    update
      ? await sql`UPDATE source_documents SET source_type=${row.sourceType as string}, source_trust=${row.sourceTrust as string}, source_url=${row.sourceUrl as string}, canonical_url=${(row.canonicalUrl as string) ?? null}, title=${row.title as string}, publisher=${(row.publisher as string) ?? null}, published_at=${(row.publishedAt as string) ?? null}, fetched_at=${row.fetchedAt as string}, admission_year=${(row.admissionYear as number) ?? null}, content_hash=${row.contentHash as string}, raw_text=${row.rawText as string}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO source_documents (id,source_type,source_trust,source_url,canonical_url,title,publisher,published_at,fetched_at,admission_year,content_hash,raw_text,created_at,updated_at) VALUES (${row.id as string},${row.sourceType as string},${row.sourceTrust as string},${row.sourceUrl as string},${(row.canonicalUrl as string) ?? null},${row.title as string},${(row.publisher as string) ?? null},${(row.publishedAt as string) ?? null},${row.fetchedAt as string},${(row.admissionYear as number) ?? null},${row.contentHash as string},${row.rawText as string},${row.createdAt as string},${row.updatedAt as string})`;
  } else if (type === SchoolImportEntityType.ADMISSION_POLICY) {
    // biome-ignore lint/suspicious/noUnusedExpressions: selects the planned SQL write.
    update
      ? await sql`UPDATE admission_policies SET planned_enrollment=${(row.plannedEnrollment as number) ?? null}, recommendation_exempt_quota=${(row.recommendationExemptQuota as number) ?? null}, exam_subjects=${sql.json(row.examSubjects as never)}, retest_score=${(row.retestScore as number) ?? null}, notes=${(row.notes as string) ?? null}, source_document_id=${row.sourceDocumentId as string}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO admission_policies (id,program_id,admission_year,planned_enrollment,recommendation_exempt_quota,exam_subjects,retest_score,notes,source_document_id,created_at,updated_at) VALUES (${row.id as string},${row.programId as string},${row.admissionYear as number},${(row.plannedEnrollment as number) ?? null},${(row.recommendationExemptQuota as number) ?? null},${sql.json(row.examSubjects as never)},${(row.retestScore as number) ?? null},${(row.notes as string) ?? null},${row.sourceDocumentId as string},${row.createdAt as string},${row.updatedAt as string})`;
  } else if (type === SchoolImportEntityType.RECOMMENDATION_POLICY) {
    // biome-ignore lint/suspicious/noUnusedExpressions: selects the planned SQL write.
    update
      ? await sql`UPDATE recommendation_policies SET stage=${row.stage as string}, application_start=${(row.applicationStart as string) ?? null}, application_end=${(row.applicationEnd as string) ?? null}, ranking_requirement=${(row.rankingRequirement as string) ?? null}, english_requirement=${(row.englishRequirement as string) ?? null}, research_requirement=${(row.researchRequirement as string) ?? null}, competition_requirement=${(row.competitionRequirement as string) ?? null}, eligibility_notes=${(row.eligibilityNotes as string) ?? null}, source_document_id=${row.sourceDocumentId as string}, updated_at=${row.updatedAt as string} WHERE id=${row.id as string}`
      : await sql`INSERT INTO recommendation_policies (id,program_id,admission_year,stage,application_start,application_end,ranking_requirement,english_requirement,research_requirement,competition_requirement,eligibility_notes,source_document_id,created_at,updated_at) VALUES (${row.id as string},${row.programId as string},${row.admissionYear as number},${row.stage as string},${(row.applicationStart as string) ?? null},${(row.applicationEnd as string) ?? null},${(row.rankingRequirement as string) ?? null},${(row.englishRequirement as string) ?? null},${(row.researchRequirement as string) ?? null},${(row.competitionRequirement as string) ?? null},${(row.eligibilityNotes as string) ?? null},${row.sourceDocumentId as string},${row.createdAt as string},${row.updatedAt as string})`;
  } else if (update) {
    await sql`UPDATE evidences SET excerpt=${row.excerpt as string}, content_hash=${row.contentHash as string} WHERE id=${row.id as string}`;
  } else {
    await sql`INSERT INTO evidences (id,source_document_id,program_id,evidence_type,excerpt,content_hash,created_at) VALUES (${row.id as string},${row.sourceDocumentId as string},${row.programId as string},${row.evidenceType as string},${row.excerpt as string},${row.contentHash as string},${row.createdAt as string})`;
  }
  if (update) {
    result.updated += 1;
  } else {
    result.created += 1;
  }
  result.byEntityType[type] += 1;
}
