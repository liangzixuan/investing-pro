import {
  managedEodHistoryWindow,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodIdentity,
  type ResearchFollowupsPayload,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { reviewFilingsResult } from "./review-filings-evidence-fixture-data";

export function datedReviewExpected(
  original: ResearchFollowupsPayload,
  day: string,
): ResearchFollowupsPayload {
  return {
    ...original,
    entries: original.entries.map<ResearchFollowup>((entry, index) =>
      index < 2
        ? {
            ...entry,
            result: reviewFilingsResult(index),
            ...(index === 1
              ? { status: "completed" as const, completedOn: day }
              : { status: "open" as const, completedOn: null }),
          }
        : entry,
    ),
  };
}
export function datedCloseDate(now: number) {
  return new Date(now - 2 * 86400000).toISOString().slice(0, 10);
}
export function datedClosePacket(
  request: ManagedEodHistoryRequestDto,
  security: ManagedEodIdentity,
  now: number,
) {
  const requestStartedAt = new Date(now).toISOString();
  const later = new Date(now - 86400000).toISOString().slice(0, 10);
  const close =
    security.symbol === "GOOG"
      ? "100.25"
      : security.symbol === "GOOGL"
        ? "120.5"
        : "50";
  const packet = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security,
      range: "1m",
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: managedEodHistoryWindow(requestStartedAt, "1m"),
      requestStartedAt,
      completedAt: new Date(now + 1000).toISOString(),
      rows:
        security.symbol === "MSFT"
          ? [{ date: later, close }]
          : [
              { date: datedCloseDate(now), close },
              { date: later, close: "130" },
            ],
    },
    request,
  );
  if (!packet) throw new Error("Invalid invented dated-review close packet");
  return packet;
}
