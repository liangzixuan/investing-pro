import { expect, it } from "vitest";
import {
  managedPortfolioStorageEnabled,
  MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY,
} from "./managed-portfolio-config";

it("has one server-only fixed enable setting", () => {
  expect(MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY).toBe(
    "MANAGED_PORTFOLIO_STORAGE_ENABLED",
  );
  expect(managedPortfolioStorageEnabled("true")).toBe(true);
});
it.each([
  undefined,
  null,
  false,
  true,
  "",
  "false",
  "TRUE",
  " true",
  "true ",
  1,
  {},
  [],
])(
  "keeps Portfolio disabled for %j without changing other configuration",
  (value) => {
    expect(managedPortfolioStorageEnabled(value)).toBe(false);
  },
);
