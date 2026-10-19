import { expect, it } from "vitest";
import { managedValuationAssumptionsStorageEnabled } from "./managed-valuation-assumptions-config";
it.each([
  undefined,
  null,
  false,
  true,
  "",
  "TRUE",
  " true",
  "true ",
  "false",
  1,
  {},
])("leaves storage disabled for %j", (value) => {
  expect(managedValuationAssumptionsStorageEnabled(value)).toBe(false);
});
it("enables only exact server true", () => {
  expect(managedValuationAssumptionsStorageEnabled("true")).toBe(true);
});
