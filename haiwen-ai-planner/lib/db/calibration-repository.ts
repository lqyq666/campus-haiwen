import type postgres from "postgres";
import type {
  CalibrationCaseV02,
  CalibrationDisagreement,
  CalibrationRepository,
  ExpertReview,
  ExpertReviewer,
  RuleCandidate,
  SystemPredictionSnapshot,
} from "@/domain/calibration/workbench";

type Sql = ReturnType<typeof postgres>;

export class PostgresCalibrationRepository implements CalibrationRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async findReview(caseId: string, reviewerId: string) {
    const rows = await this.sql<ExpertReview[]>`SELECT id,
      case_id AS "caseId", reviewer_id AS "reviewerId", judgment,
      submitted_at AS "submittedAt", locked_at AS "lockedAt",
      revealed_at AS "revealedAt" FROM expert_reviews
      WHERE case_id=${caseId} AND reviewer_id=${reviewerId}`;
    return rows[0];
  }

  async findReviewerByCode(code: string) {
    const rows = await this.sql<ExpertReviewer[]>`SELECT id,
      reviewer_code AS "reviewerCode", role_type AS "roleType",
      experience_level AS "experienceLevel", created_at AS "createdAt"
      FROM expert_reviewers WHERE reviewer_code=${code}`;
    return rows[0];
  }

  async getCase(id: string) {
    const rows = await this.sql<CalibrationCaseV02[]>`SELECT id,
      case_code AS "caseCode", student_profile_snapshot AS "studentProfileSnapshot",
      source_type AS "sourceType", status, created_at AS "createdAt"
      FROM calibration_cases WHERE id=${id}`;
    return rows[0];
  }

  async getPrediction(caseId: string) {
    const rows = await this.sql<
      Array<
        Omit<SystemPredictionSnapshot, "modelVersions"> & {
          modelVersions: Record<string, string>;
          prediction: Omit<
            SystemPredictionSnapshot,
            "caseId" | "createdAt" | "id" | "modelVersions"
          >;
        }
      >
    >`SELECT id, case_id AS "caseId", prediction, model_versions AS "modelVersions",
      created_at AS "createdAt" FROM system_prediction_snapshots
      WHERE case_id=${caseId}`;
    const [row] = rows;
    return row
      ? {
          ...row.prediction,
          caseId: row.caseId,
          createdAt: row.createdAt,
          id: row.id,
          modelVersions: row.modelVersions,
        }
      : undefined;
  }

  async getReview(id: string) {
    const rows = await this.sql<ExpertReview[]>`SELECT id,
      case_id AS "caseId", reviewer_id AS "reviewerId", judgment,
      submitted_at AS "submittedAt", locked_at AS "lockedAt",
      revealed_at AS "revealedAt" FROM expert_reviews WHERE id=${id}`;
    return rows[0];
  }

  listDisagreements(reviewId: string) {
    return this.sql<CalibrationDisagreement[]>`SELECT id,
      review_id AS "reviewId", type, system_value AS "systemValue",
      expert_value AS "expertValue", severity, expert_reason AS "expertReason"
      FROM calibration_disagreements WHERE review_id=${reviewId}
      ORDER BY type, id`;
  }

  async saveDisagreements(items: CalibrationDisagreement[]) {
    await Promise.all(
      items.map(
        (item) => this.sql`INSERT INTO calibration_disagreements
          (id, review_id, type, system_value, expert_value, severity, expert_reason)
          VALUES (${item.id}, ${item.reviewId}, ${item.type},
          ${this.sql.json(item.systemValue as never)},
          ${this.sql.json(item.expertValue as never)}, ${item.severity},
          ${item.expertReason ?? null}) ON CONFLICT (id) DO NOTHING`
      )
    );
  }

  async saveReview(review: ExpertReview) {
    await this.sql`INSERT INTO expert_reviews
      (id, case_id, reviewer_id, judgment, submitted_at, locked_at, revealed_at)
      VALUES (${review.id}, ${review.caseId}, ${review.reviewerId},
      ${this.sql.json(review.judgment as never)}, ${review.submittedAt},
      ${review.lockedAt}, ${review.revealedAt ?? null})`;
  }

  async saveReviewer(reviewer: ExpertReviewer) {
    await this.sql`INSERT INTO expert_reviewers
      (id, reviewer_code, role_type, experience_level, created_at)
      VALUES (${reviewer.id}, ${reviewer.reviewerCode}, ${reviewer.roleType},
      ${reviewer.experienceLevel}, ${reviewer.createdAt})
      ON CONFLICT (reviewer_code) DO NOTHING`;
  }

  async setReviewRevealedAt(reviewId: string, revealedAt: string) {
    await this.sql`UPDATE expert_reviews SET revealed_at=${revealedAt}
      WHERE id=${reviewId} AND revealed_at IS NULL`;
  }

  listCases() {
    return this.sql<CalibrationCaseV02[]>`SELECT id, case_code AS "caseCode",
      student_profile_snapshot AS "studentProfileSnapshot", source_type AS "sourceType",
      status, created_at AS "createdAt" FROM calibration_cases
      ORDER BY case_code`;
  }

  listReviews() {
    return this.sql<ExpertReview[]>`SELECT id, case_id AS "caseId",
      reviewer_id AS "reviewerId", judgment, submitted_at AS "submittedAt",
      locked_at AS "lockedAt", revealed_at AS "revealedAt"
      FROM expert_reviews ORDER BY submitted_at, id`;
  }

  async listPredictions() {
    const cases = await this.listCases();
    return (
      await Promise.all(cases.map((item) => this.getPrediction(item.id)))
    ).filter((item): item is SystemPredictionSnapshot => Boolean(item));
  }

  listAllDisagreements() {
    return this.sql<CalibrationDisagreement[]>`SELECT id,
      review_id AS "reviewId", type, system_value AS "systemValue",
      expert_value AS "expertValue", severity, expert_reason AS "expertReason"
      FROM calibration_disagreements ORDER BY type, id`;
  }

  async upsertCase(item: CalibrationCaseV02) {
    await this.sql`INSERT INTO calibration_cases
      (id, case_code, student_profile_snapshot, source_type, status, created_at)
      VALUES (${item.id}, ${item.caseCode},
      ${this.sql.json(item.studentProfileSnapshot as never)}, ${item.sourceType},
      ${item.status}, ${item.createdAt}) ON CONFLICT (case_code) DO NOTHING`;
  }

  async upsertPrediction(item: SystemPredictionSnapshot) {
    const { caseId, createdAt, id, modelVersions, ...prediction } = item;
    await this.sql`INSERT INTO system_prediction_snapshots
      (id, case_id, prediction, model_versions, created_at)
      VALUES (${id}, ${caseId}, ${this.sql.json(prediction as never)},
      ${this.sql.json(modelVersions as never)}, ${createdAt})
      ON CONFLICT (case_id) DO NOTHING`;
  }

  listRuleCandidates() {
    return this.sql<RuleCandidate[]>`SELECT id,
      disagreement_ids AS "disagreementIds", proposal, status,
      created_at AS "createdAt", updated_at AS "updatedAt"
      FROM calibration_rule_candidates ORDER BY created_at, id`;
  }

  async saveRuleCandidate(item: RuleCandidate) {
    await this.sql`INSERT INTO calibration_rule_candidates
      (id, disagreement_ids, proposal, status, created_at, updated_at)
      VALUES (${item.id}, ${this.sql.json(item.disagreementIds as never)},
      ${this.sql.json(item.proposal as never)}, ${item.status},
      ${item.createdAt}, ${item.updatedAt})`;
  }

  async updateRuleCandidateStatus(
    id: string,
    status: Exclude<RuleCandidate["status"], "PROPOSED">,
    updatedAt: string
  ) {
    const rows = await this.sql<
      RuleCandidate[]
    >`UPDATE calibration_rule_candidates
      SET status=${status}, updated_at=${updatedAt} WHERE id=${id}
      RETURNING id, disagreement_ids AS "disagreementIds", proposal, status,
      created_at AS "createdAt", updated_at AS "updatedAt"`;
    return rows[0];
  }
}
