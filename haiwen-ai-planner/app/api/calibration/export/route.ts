import { requireCalibrationAdmin } from "@/domain/calibration/security";
import { calibrationError, calibrationRuntime } from "../shared";

export async function GET(request: Request) {
  const denied = requireCalibrationAdmin(request);
  if (denied) {
    return denied;
  }
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "csv") {
      return Response.json(
        { error: "format must be json or csv" },
        { status: 400 }
      );
    }
    const { repository } = calibrationRuntime();
    const [cases, reviews] = await Promise.all([
      repository.listCases(),
      repository.listReviews(),
    ]);
    const caseCodes = new Map(cases.map((item) => [item.id, item.caseCode]));
    const reviewerRefs = new Map<string, string>();
    const rows = reviews.map((review) => {
      if (!reviewerRefs.has(review.reviewerId)) {
        reviewerRefs.set(
          review.reviewerId,
          `reviewer-${reviewerRefs.size + 1}`
        );
      }
      const { notes: _notes, ...anonymousJudgment } = review.judgment;
      return {
        caseCode: caseCodes.get(review.caseId) ?? review.caseId,
        judgment: anonymousJudgment,
        reviewerRef: reviewerRefs.get(review.reviewerId),
        submittedAt: review.submittedAt,
      };
    });
    if (format === "json") {
      return Response.json({ reviews: rows, version: "calibration-v0.2" });
    }
    const header = [
      "case_code",
      "reviewer_ref",
      "submitted_at",
      "judgment_json",
    ];
    const body = rows.map((row) =>
      [
        row.caseCode,
        row.reviewerRef ?? "",
        row.submittedAt,
        JSON.stringify(row.judgment),
      ]
        .map(csvCell)
        .join(",")
    );
    return new Response([header.join(","), ...body].join("\n"), {
      headers: {
        "Content-Disposition": "attachment; filename=calibration-v0.2.csv",
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return calibrationError(error);
  }
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
