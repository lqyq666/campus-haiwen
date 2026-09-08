import postgres from "postgres";
import type { EvidenceRepository } from "@/domain/evidence/repository";
import { InMemoryRetrievalRepository } from "@/domain/retrieval/in-memory-repository";
import type { RetrievalRepository } from "@/domain/retrieval/repository";
import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "@/domain/school/in-memory-repository";
import type { SchoolRepository } from "@/domain/school/repository";
import type { LeadCRM } from "@/integrations/crm/contract";
import type { FeishuLeadSyncRepository } from "@/integrations/feishu/types";
import { PostgresAnalyticsEventRepository } from "@/lib/db/analytics-event-repository";
import { PostgresCalibrationRepository } from "@/lib/db/calibration-repository";
import { PostgresLeadRepository } from "@/lib/db/lead-repository";
import { PostgresRetrievalRepository } from "@/lib/db/retrieval-repository";
import { PostgresSchoolDataRepository } from "@/lib/db/school-repository";

export type SchoolDataRepositories = {
  analyticsEventRepository: PostgresAnalyticsEventRepository;
  calibrationRepository: PostgresCalibrationRepository;
  close: () => Promise<void>;
  evidenceRepository: EvidenceRepository;
  schoolRepository: SchoolRepository;
  retrievalRepository: RetrievalRepository;
  leadRepository: LeadCRM & FeishuLeadSyncRepository;
};

export type RuntimeSchoolReadRepositories = Pick<
  SchoolDataRepositories,
  "evidenceRepository" | "retrievalRepository" | "schoolRepository"
> & { close: () => Promise<void>; mode: "fixture" | "real" };

export async function createRuntimeSchoolReadRepositories(
  environment: Record<string, string | undefined> = process.env
): Promise<RuntimeSchoolReadRepositories> {
  const mode = environment.SCHOOL_DATA_MODE ?? "real";
  if (mode === "fixture") {
    return {
      close: async () => undefined,
      evidenceRepository: new InMemoryEvidenceRepository(),
      mode,
      retrievalRepository: new InMemoryRetrievalRepository(),
      schoolRepository: new InMemorySchoolRepository(),
    };
  }
  if (mode !== "real") {
    throw new Error("INVALID_SCHOOL_DATA_MODE");
  }
  const connectionUrl = environment.POSTGRES_URL;
  if (!connectionUrl) {
    throw new Error("REAL_SCHOOL_DATA_UNAVAILABLE");
  }
  const sql = postgres(connectionUrl);
  const [{ available }] = await sql<
    { available: boolean }[]
  >`SELECT EXISTS(SELECT 1 FROM source_documents WHERE source_trust = 'OFFICIAL') AS available`;
  if (!available) {
    await sql.end();
    throw new Error("REAL_SCHOOL_DATA_UNAVAILABLE");
  }
  const repository = new PostgresSchoolDataRepository(sql, {
    officialOnly: true,
  });
  return {
    close: () => sql.end(),
    evidenceRepository: repository,
    mode,
    retrievalRepository: new PostgresRetrievalRepository(sql),
    schoolRepository: repository,
  };
}

let runtimeRepositories: SchoolDataRepositories | undefined;

export function createSchoolDataRepositories(
  environment: Record<string, string | undefined> = process.env
): SchoolDataRepositories {
  if (
    environment.SCHOOL_DATA_SOURCE &&
    environment.SCHOOL_DATA_SOURCE !== "postgres"
  ) {
    throw new Error("SCHOOL_DATA_SOURCE must be postgres in runtime");
  }
  const connectionUrl = environment.POSTGRES_URL;
  if (!connectionUrl) {
    throw new Error("POSTGRES_URL is required for runtime school data");
  }
  const sql = postgres(connectionUrl);
  const repository = new PostgresSchoolDataRepository(sql);
  const retrievalRepository = new PostgresRetrievalRepository(sql);
  const leadRepository = new PostgresLeadRepository(sql);
  return {
    analyticsEventRepository: new PostgresAnalyticsEventRepository(sql),
    calibrationRepository: new PostgresCalibrationRepository(sql),
    close: () => sql.end(),
    evidenceRepository: repository,
    leadRepository,
    retrievalRepository,
    schoolRepository: repository,
  };
}

export function getRuntimeSchoolDataRepositories(): SchoolDataRepositories {
  runtimeRepositories ??= createSchoolDataRepositories();
  return runtimeRepositories;
}
