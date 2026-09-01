import { describe, expect, it } from "vitest";

import {
  preparePersonalFilingDossier,
  type PersonalFilingDossierInput,
} from "./personal-filing-dossier";
import {
  buildPersonalFilingDossierInput,
  personalFilingDossierQuarantineFixture,
} from "./test-personal-filing-dossier-builder";

describe("personal filing dossier security", () => {
  it("rejects aliases, Buffer carriers, proxies, accessors, and extra keys without invoking canaries", () => {
    const input = buildPersonalFilingDossierInput();
    expect(
      preparePersonalFilingDossier({ ...input, manifest: input.declaration }),
    ).toEqual(personalFilingDossierQuarantineFixture());
    expect(
      preparePersonalFilingDossier({
        ...input,
        declaration: Buffer.from(input.declaration),
      }),
    ).toEqual(personalFilingDossierQuarantineFixture());
    expect(preparePersonalFilingDossier(new Proxy(input, {}))).toEqual(
      personalFilingDossierQuarantineFixture(),
    );

    let invoked = false;
    const hostile = { ...input } as Record<string, unknown>;
    Object.defineProperty(hostile, "manifest", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("private-canary");
      },
    });
    expect(
      preparePersonalFilingDossier(
        hostile as unknown as PersonalFilingDossierInput,
      ),
    ).toEqual(personalFilingDossierQuarantineFixture());
    expect(invoked).toBe(false);
    expect(
      preparePersonalFilingDossier({
        ...input,
        extra: "private-canary",
      } as unknown as PersonalFilingDossierInput),
    ).toEqual(personalFilingDossierQuarantineFixture());
  });

  it("owns every input and control array before composition", () => {
    const generated = buildPersonalFilingDossierInput(true, 1);
    const factKeys = [...generated.dossierPlan.factKeys];
    const chartFactKeys = [...generated.dossierPlan.chartFactKeys];
    const input = {
      ...generated,
      dossierPlan: { ...generated.dossierPlan, chartFactKeys, factKeys },
    };
    const result = preparePersonalFilingDossier(input);
    expect(result.status).toBe("prepared_personal_dossier_for_personal_use");
    const before = JSON.stringify(result);

    input.declaration.fill(120);
    input.sourceDocuments[0]?.fill(121);
    factKeys.splice(0);
    chartFactKeys.splice(0);

    expect(JSON.stringify(result)).toBe(before);
  });

  it("does not read, validate, hash, or depend on document-array suffixes beyond the fixed prefix", () => {
    const input = buildPersonalFilingDossierInput(true, 0);
    const baseline = preparePersonalFilingDossier(input);
    expect(baseline.status).toBe("prepared_personal_dossier_for_personal_use");

    const corruptSuffix = new Uint8Array([255]);
    expect(
      preparePersonalFilingDossier({
        ...input,
        rawFilingDocuments: [
          input.rawFilingDocuments[0] as Uint8Array,
          corruptSuffix,
        ],
        sourceDocuments: [
          input.sourceDocuments[0] as Uint8Array,
          corruptSuffix,
        ],
      }),
    ).toEqual(baseline);

    let proxyInvoked = false;
    const proxySuffix = new Proxy(new Uint8Array([254]), {
      get() {
        proxyInvoked = true;
        throw new Error("suffix-proxy-canary");
      },
      getOwnPropertyDescriptor() {
        proxyInvoked = true;
        throw new Error("suffix-proxy-canary");
      },
      getPrototypeOf() {
        proxyInvoked = true;
        throw new Error("suffix-proxy-canary");
      },
    });
    expect(
      preparePersonalFilingDossier({
        ...input,
        rawFilingDocuments: [
          input.rawFilingDocuments[0] as Uint8Array,
          proxySuffix,
        ],
        sourceDocuments: [input.sourceDocuments[0] as Uint8Array, proxySuffix],
      }),
    ).toEqual(baseline);
    expect(proxyInvoked).toBe(false);

    let getterInvoked = false;
    const rawFilingDocuments = [input.rawFilingDocuments[0] as Uint8Array];
    const sourceDocuments = [input.sourceDocuments[0] as Uint8Array];
    for (const documents of [rawFilingDocuments, sourceDocuments]) {
      Object.defineProperty(documents, "1", {
        configurable: true,
        enumerable: true,
        get() {
          getterInvoked = true;
          throw new Error("suffix-getter-canary");
        },
      });
    }
    expect(
      preparePersonalFilingDossier({
        ...input,
        rawFilingDocuments,
        sourceDocuments,
      }),
    ).toEqual(baseline);
    expect(getterInvoked).toBe(false);
  });

  it("still rejects proxies inside the selected prefix", () => {
    const input = buildPersonalFilingDossierInput();
    const selectedProxy = new Proxy(input.sourceDocuments[0] as Uint8Array, {});
    expect(
      preparePersonalFilingDossier({
        ...input,
        sourceDocuments: [selectedProxy],
      }),
    ).toEqual(personalFilingDossierQuarantineFixture());
    expect(
      preparePersonalFilingDossier({
        ...input,
        dossierPlan: new Proxy(input.dossierPlan, {}),
      }),
    ).toEqual(personalFilingDossierQuarantineFixture());
    expect(
      preparePersonalFilingDossier({
        ...input,
        dossierPlan: {
          ...input.dossierPlan,
          factKeys: new Proxy([...input.dossierPlan.factKeys], {}),
        },
      }),
    ).toEqual(personalFilingDossierQuarantineFixture());
  });

  it("returns only the shared value-free quarantine graph after source corruption", () => {
    const input = buildPersonalFilingDossierInput();
    const privateValue = "120000000";
    const source = input.sourceDocuments[0];
    if (source === undefined) throw new TypeError("Fixture is incomplete.");
    const changed = new Uint8Array(source);
    changed[8] = (changed[8] ?? 0) ^ 1;

    const result = preparePersonalFilingDossier({
      ...input,
      sourceDocuments: [changed],
    });

    expect(result).toEqual(personalFilingDossierQuarantineFixture());
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(JSON.stringify(result)).not.toContain("sha256:");
  });

  it("exposes only response-local fact identifiers and keeps every graph reference closed", () => {
    const result = preparePersonalFilingDossier(
      buildPersonalFilingDossierInput(true, 1),
    );
    expect(result.status).toBe("prepared_personal_dossier_for_personal_use");
    if (result.status !== "prepared_personal_dossier_for_personal_use") return;

    const factIds = new Set(result.facts.map((fact) => fact.id));
    const evidenceIds = new Set(result.evidence.map((item) => item.id));
    expect(factIds.size).toBe(result.facts.length);
    expect(evidenceIds.size).toBe(result.evidence.length);
    expect([...factIds].every((id) => /^fact-[0-9]{4}$/u.test(id))).toBe(true);
    expect([...factIds].every((id) => !id.includes("sha256"))).toBe(true);
    for (const fact of result.facts)
      expect(evidenceIds.has(fact.evidenceId)).toBe(true);
    for (const item of result.evidence)
      expect(factIds.has(item.factId)).toBe(true);
    for (const event of result.lineage.events) {
      expect(factIds.has(event.predecessorFactId)).toBe(true);
      expect(factIds.has(event.successorFactId)).toBe(true);
    }
    if (result.chart.status === "ready") {
      for (const series of result.chart.series) {
        for (const point of series.points)
          expect(factIds.has(point.factId)).toBe(true);
      }
    }
    if (result.valuationInputs.status === "ready") {
      for (const id of [
        result.valuationInputs.baseRevenueFactId,
        result.valuationInputs.cashFactId,
        result.valuationInputs.debtFactId,
        result.valuationInputs.dilutedSharesFactId,
      ]) {
        expect(factIds.has(id)).toBe(true);
      }
    }
  });
});
