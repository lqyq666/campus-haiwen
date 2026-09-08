import {
  InMemoryEvidenceRepository,
  InMemorySchoolRepository,
} from "@/domain/school/in-memory-repository";

const schools = new InMemorySchoolRepository();
const evidence = new InMemoryEvidenceRepository();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admissionYear = Number(url.searchParams.get("year") ?? "2026");
  if (
    !Number.isInteger(admissionYear) ||
    admissionYear < 2000 ||
    admissionYear > 2100
  ) {
    return Response.json({ error: "Invalid admission year" }, { status: 400 });
  }
  const result = await schools.findProgramCandidates({
    admissionYear,
    targetCities: optionalList(url.searchParams.get("city")),
    targetMajors: optionalList(url.searchParams.get("major")),
  });
  const sourceIds = new Set(
    result.candidates.flatMap((candidate) => [
      ...candidate.evidence.map((item) => item.sourceDocumentId),
      ...(candidate.admissionPolicy
        ? [candidate.admissionPolicy.sourceDocumentId]
        : []),
      ...candidate.recommendationPolicies.map((item) => item.sourceDocumentId),
    ])
  );
  const sourceDocuments = Object.fromEntries(
    (
      await Promise.all(
        [...sourceIds].map((id) => evidence.getSourceDocument(id))
      )
    )
      .filter((item) => item !== undefined)
      .map((item) => [item.id, item])
  );
  return Response.json({ ...result, sourceDocuments });
}

function optionalList(value: string | null) {
  const normalized = value?.trim();
  return normalized ? [normalized] : [];
}
