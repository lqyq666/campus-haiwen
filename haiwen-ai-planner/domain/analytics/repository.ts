import type { AnalyticsEvent, AnalyticsEventFilter } from "./models";

export interface AnalyticsEventRepository {
  ingest: (event: AnalyticsEvent) => Promise<boolean>;
  list: (filter: AnalyticsEventFilter) => Promise<AnalyticsEvent[]>;
}

export class InMemoryAnalyticsEventRepository
  implements AnalyticsEventRepository
{
  private readonly events = new Map<string, AnalyticsEvent>();

  ingest(event: AnalyticsEvent) {
    if (this.events.has(event.eventId)) {
      return Promise.resolve(false);
    }
    this.events.set(event.eventId, event);
    return Promise.resolve(true);
  }

  list(filter: AnalyticsEventFilter) {
    return Promise.resolve(
      [...this.events.values()]
        .filter((event) => matches(event, filter))
        .sort(
          (left, right) =>
            left.occurredAt.localeCompare(right.occurredAt) ||
            left.eventId.localeCompare(right.eventId)
        )
    );
  }
}

export function matches(event: AnalyticsEvent, filter: AnalyticsEventFilter) {
  return (
    (!filter.cohortTag || event.cohortTag === filter.cohortTag) &&
    (!filter.from || event.occurredAt >= filter.from) &&
    (!filter.to || event.occurredAt < filter.to)
  );
}
