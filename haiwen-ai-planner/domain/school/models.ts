export type University = {
  active: boolean;
  city?: string;
  createdAt: string;
  id: string;
  name: string;
  officialWebsite?: string;
  province?: string;
  shortName?: string;
  tags: string[];
  type?: string;
  updatedAt: string;
};

export type Department = {
  createdAt: string;
  id: string;
  name: string;
  officialWebsite?: string;
  shortName?: string;
  universityId: string;
  updatedAt: string;
};

export type DegreeType = "ACADEMIC" | "PROFESSIONAL" | "UNKNOWN";
export type StudyMode = "FULL_TIME" | "PART_TIME" | "UNKNOWN";
export type AdmissionType = "EXAM" | "RECOMMENDATION" | "BOTH" | "UNKNOWN";

export type Program = {
  active: boolean;
  admissionType: AdmissionType;
  code?: string;
  createdAt: string;
  degreeType: DegreeType;
  departmentId: string;
  disciplineCategory?: string;
  id: string;
  name: string;
  studyMode: StudyMode;
  universityId: string;
  updatedAt: string;
};

export type ExamSubjectCategory =
  | "POLITICS"
  | "ENGLISH"
  | "MATHEMATICS"
  | "PROFESSIONAL"
  | "OTHER";

export type ExamSubject = {
  category: ExamSubjectCategory;
  code?: string;
  name: string;
};

export type AdmissionPolicy = {
  admissionYear: number;
  createdAt: string;
  examSubjects: ExamSubject[];
  id: string;
  notes?: string;
  plannedEnrollment?: number;
  programId: string;
  recommendationExemptQuota?: number;
  retestScore?: number;
  sourceDocumentId: string;
  updatedAt: string;
};

export type RecommendationStage =
  | "SUMMER_CAMP"
  | "PRE_RECOMMENDATION"
  | "FORMAL_RECOMMENDATION"
  | "OTHER";

export type RecommendationPolicy = {
  admissionYear: number;
  applicationEnd?: string;
  applicationStart?: string;
  competitionRequirement?: string;
  createdAt: string;
  eligibilityNotes?: string;
  englishRequirement?: string;
  id: string;
  programId: string;
  rankingRequirement?: string;
  researchRequirement?: string;
  sourceDocumentId: string;
  stage: RecommendationStage;
  updatedAt: string;
};
