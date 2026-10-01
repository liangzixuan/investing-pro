import assert from "node:assert/strict";
import { test } from "vitest";

import { validateManagedSecAnnualConfiguration } from "./managed-sec-annual-config";

test("managed SEC configuration copies its validated server contact", () => {
  const input = { userAgent: "Investment test operator@example.invalid" };
  const checked = validateManagedSecAnnualConfiguration(input);
  input.userAgent = "changed";
  assert.deepEqual(checked, {
    userAgent: "Investment test operator@example.invalid",
  });
  assert.equal(Object.isFrozen(checked), true);
});

test("null explicitly leaves the annual source unconfigured", () => {
  assert.equal(validateManagedSecAnnualConfiguration(null), null);
});

test("managed SEC configuration rejects omitted, injected and malformed input", () => {
  for (const input of [
    undefined,
    "operator@example.invalid",
    [],
    {},
    { userAgent: "Investment without contact" },
    { userAgent: " Investment operator@example.invalid" },
    { userAgent: "Investment operator@example.invalid\r\nX-Header: value" },
    { userAgent: "Investment opérator@example.invalid" },
    { userAgent: "a".repeat(257) + "@example.invalid" },
    { userAgent: 1 },
    { userAgent: "Investment operator@example.invalid", endpoint: "injected" },
    Object.assign(Object.create(null) as object, {
      userAgent: "Investment operator@example.invalid",
    }),
  ])
    assert.throws(() => validateManagedSecAnnualConfiguration(input));
});

test("managed SEC configuration never evaluates a contact accessor", () => {
  let reads = 0;
  const input = Object.defineProperty({}, "userAgent", {
    get() {
      reads += 1;
      return "Investment operator@example.invalid";
    },
  });
  assert.throws(() => validateManagedSecAnnualConfiguration(input));
  assert.equal(reads, 0);
});
