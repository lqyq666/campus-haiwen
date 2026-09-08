import { aggregateFunnel } from "@/domain/analytics/funnel";
import type { AnalyticsEventFilter } from "@/domain/analytics/models";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter: AnalyticsEventFilter = {
    cohortTag: url.searchParams.get("cohortTag") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  };
  if (!isDate(filter.from) || !isDate(filter.to)) {
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  }
  const events =
    await getRuntimeSchoolDataRepositories().analyticsEventRepository.list(
      filter
    );
  return Response.json(aggregateFunnel(events, filter));
}

function isDate(value: string | undefined) {
  return value === undefined || !Number.isNaN(Date.parse(value));
}
