import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { NativeReportRevisitFixture } from "./native-report-revisit-fixture";

/** The fixed report scenario owns its explicit invented archive control. */
export function ReportRevisitFixtureControls({
  workspace,
  scenario,
}: {
  workspace: ManagedWorkspace | null;
  scenario: string | null | undefined;
}) {
  if (!workspace) return null;
  if (scenario !== "report-revisit") return null;
  return <NativeReportRevisitFixture />;
}
