import type {
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerPayloadV3,
  PersonalPortfolioLedgerSplit,
  PersonalPortfolioLedgerActivity,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PersonalPortfolioSplitEditor,
  type PersonalPortfolioSplitEditorProps,
} from "./PersonalPortfolioSplitEditor";
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
let props: PersonalPortfolioSplitEditorProps;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T10:00:00.000Z"));
  harness.reset();
  props = {
    ledger: ledger(),
    disabled: false,
    editing: null,
    onPendingEditsChange: vi.fn(),
    onCancelEdit: vi.fn(() => {
      props = { ...props, editing: null };
    }),
    onApply: vi.fn((candidate: PersonalPortfolioLedgerPayloadV3) => {
      props = { ...props, ledger: candidate };
      return true;
    }),
  };
});
afterEach(() => {
  harness.unmount();
  vi.useRealTimers();
});

describe("PersonalPortfolioSplitEditor", () => {
  it.each([
    ["2", "1", "20"],
    ["1", "10", "1"],
  ])(
    "previews %s:%s and applies only the reviewed manual record",
    async (numerator, denominator, shares) => {
      await mount();
      configure(numerator, denominator);
      click(render(), "Preview split adjustment");
      expect(props.onApply).not.toHaveBeenCalled();
      expect(metric(render(), "Shares immediately before split")).toBe("10");
      expect(metric(render(), "Shares immediately after split")).toBe(shares);
      expect(metric(render(), "Projected current basis")).toBe(
        "100.00 USD → 100.00 USD",
      );
      click(render(), "Apply reviewed split");
      expect(props.ledger.transactions).toHaveLength(1);
      expect(props.ledger.transactions[0]).toMatchObject({
        type: "split",
        date: "2026-09-05",
        listingId: "listing-one",
        ratioNumerator: numerator,
        ratioDenominator: denominator,
      });
      expect(Object.keys(props.ledger.transactions[0] ?? {}).sort()).toEqual([
        "date",
        "id",
        "listingId",
        "ratioDenominator",
        "ratioNumerator",
        "type",
      ]);
      expect(props.onCancelEdit).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["0", "1"],
    ["1", "0"],
    ["1.5", "1"],
    ["1000001", "1"],
    ["01", "1"],
    ["2", "2"],
  ])(
    "rejects invalid or unchanged ratio %s:%s",
    async (numerator, denominator) => {
      await mount();
      configure(numerator, denominator);
      click(render(), "Preview split adjustment");
      expect(props.onApply).not.toHaveBeenCalled();
      expect(text(render())).toContain(
        "different positive whole-number share counts",
      );
      expect(text(render())).not.toContain("Apply reviewed split");
    },
  );

  it("requires an explicit dated insertion position", async () => {
    await mount();
    configure();
    change(render(), "Split insertion position", "");
    click(render(), "Preview split adjustment");
    expect(text(render())).toContain("Choose where this split belongs");
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "10", "21"],
    ["1", "11", "22"],
  ])(
    "shows the consequence of same-day insertion at %s",
    async (position, before, afterAll) => {
      props = {
        ...props,
        ledger: ledger([
          {
            id: "same-day-buy",
            date: "2026-09-05",
            type: "buy",
            listingId: "listing-one",
            shares: "1",
            grossUsd: "10",
            feeUsd: "0",
          },
        ]),
      };
      await mount();
      configure();
      change(render(), "Split insertion position", position);
      click(render(), "Preview split adjustment");
      expect(metric(render(), "Shares immediately before split")).toBe(before);
      expect(metric(render(), "Projected current shares")).toBe(
        `11 → ${afterAll}`,
      );
      click(render(), "Apply reviewed split");
      expect(props.ledger.transactions[Number(position)]?.type).toBe("split");
      expect(
        props.ledger.transactions.find((entry) => entry.id === "same-day-buy"),
      ).toMatchObject({ shares: "1", grossUsd: "10" });
    },
  );

  it("rejects reverse splits requiring unsupported fractional precision", async () => {
    await mount();
    configure("1", "3");
    click(render(), "Preview split adjustment");
    expect(text(render())).toContain("beyond six decimal places");
    expect(text(render())).not.toContain("Apply reviewed split");
  });

  it("rejects a split without an open position and a split that breaks a later sale", async () => {
    props = {
      ...props,
      ledger: { ...ledger(), opening: { ...ledger().opening, holdings: [] } },
    };
    await mount();
    configure();
    click(render(), "Preview split adjustment");
    expect(text(render())).toContain("no open shares");
    props = {
      ...props,
      ledger: ledger([
        {
          id: "later-sale",
          date: "2026-09-07",
          type: "sell",
          listingId: "listing-one",
          shares: "8",
          grossUsd: "80",
          feeUsd: "0",
        },
      ]),
    };
    render();
    render();
    configure("1", "10");
    click(render(), "Preview split adjustment");
    expect(text(render())).toContain("later sale would exceed");
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("rejects economically equivalent duplicate split records", async () => {
    props = { ...props, ledger: ledger([split()]) };
    await mount();
    configure("4", "2");
    change(render(), "Split insertion position", "1");
    click(render(), "Preview split adjustment");
    expect(text(render())).toContain("An equivalent split is already recorded");
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("edits an existing split preserving its ID and excluding itself from duplicate checks", async () => {
    props = { ...props, ledger: ledger([split()]), editing: split() };
    await mount();
    expect(input(render(), "Split insertion position").props.value).toBe("0");
    change(render(), "Split new share count", "3");
    click(render(), "Preview split adjustment");
    click(render(), "Apply reviewed split");
    expect(props.ledger.transactions).toEqual([
      { ...split(), ratioNumerator: "3" },
    ]);
  });

  it.each(["input", "ledger", "disabled", "unmount"])(
    "invalidates a preview and captured Apply handler after %s changes",
    async (kind) => {
      await mount();
      configure();
      click(render(), "Preview split adjustment");
      const stale = button(render(), "Apply reviewed split");
      if (kind === "input") change(render(), "Split new share count", "3");
      if (kind === "ledger")
        props = {
          ...props,
          ledger: {
            ...props.ledger,
            snapshotSha256: `sha256:${"b".repeat(64)}`,
          },
        };
      if (kind === "disabled") props = { ...props, disabled: true };
      if (kind === "unmount") harness.unmount();
      else {
        render();
        render();
      }
      stale.props.onClick?.();
      expect(props.onApply).not.toHaveBeenCalled();
      if (kind !== "unmount")
        expect(text(render())).not.toContain("Apply reviewed split");
    },
  );

  it("preserves reviewed inputs when a parent pending-input guard refuses apply", async () => {
    props = { ...props, onApply: vi.fn(() => false) };
    await mount();
    configure();
    click(render(), "Preview split adjustment");
    click(render(), "Apply reviewed split");
    expect(input(render(), "Split new share count").props.value).toBe("2");
    expect(text(render())).toContain("Apply reviewed split");
    expect(props.onCancelEdit).not.toHaveBeenCalled();
  });

  it("reports pending split inputs and clears them explicitly and on unmount", async () => {
    await mount();
    expect(props.onPendingEditsChange).toHaveBeenLastCalledWith(false);
    configure();
    render();
    expect(props.onPendingEditsChange).toHaveBeenLastCalledWith(true);
    click(render(), "Clear split inputs");
    render();
    expect(props.onPendingEditsChange).toHaveBeenLastCalledWith(false);
    change(render(), "Split new share count", "3");
    render();
    harness.unmount();
    expect(props.onPendingEditsChange).toHaveBeenLastCalledWith(false);
  });
});

function identity(): PersonalPortfolioIdentity {
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: "issuer-one",
    issuerName: "Issuer one",
    listingId: "listing-one",
    securityId: "security-one",
    securityName: "Security one",
    shareClassId: "class-one",
    shareClassName: "Common",
    symbol: "ONE",
  };
}
function ledger(
  transactions: readonly PersonalPortfolioLedgerActivity[] = [],
): PersonalPortfolioLedgerPayloadV3 {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity()],
    opening: {
      asOfDate: "2026-09-01",
      cashUsd: "1000",
      holdings: [
        {
          listingId: "listing-one",
          shares: "10",
          totalCostBasisUsd: "100",
          confirmedOn: "2026-09-01",
        },
      ],
    },
    transactions,
  };
}
function split(): PersonalPortfolioLedgerSplit {
  return {
    id: "split-one",
    date: "2026-09-05",
    type: "split",
    listingId: "listing-one",
    ratioNumerator: "2",
    ratioDenominator: "1",
  };
}
function configure(numerator = "2", denominator = "1") {
  change(render(), "Split effective date", "2026-09-05");
  change(render(), "Split new share count", numerator);
  change(render(), "Split old share count", denominator);
  change(render(), "Split insertion position", "0");
}

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++;
      const previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});
function render() {
  harness.begin();
  const view = PersonalPortfolioSplitEditor(props);
  harness.effects();
  return view;
}
async function mount() {
  render();
  await flush();
  return render();
}
async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return typeof element.type === "function"
    ? text(Reflect.apply(element.type, undefined, [element.props]) as unknown)
    : text(element.props.children);
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function input(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === label,
  );
  if (!found) throw new Error(`Missing input: ${label}`);
  return found as React.ReactElement<{
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }>;
}
function change(value: unknown, label: string, next: string) {
  input(value, label).props.onChange({ target: { value: next } });
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) =>
      element.type === "button" &&
      (text(element) === label || element.props["aria-label"] === label),
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  const found = button(value, label);
  if (found.props.disabled) throw new Error(`Disabled button: ${label}`);
  found.props.onClick?.();
}
function metric(value: unknown, label: string) {
  const found = elements(value).find(
    (element) =>
      element.type === "div" &&
      elements(element).some(
        (child) => child.type === "dt" && text(child) === label,
      ) &&
      elements(element).filter((child) => child.type === "dt").length === 1,
  );
  return text(elements(found).find((element) => element.type === "dd"));
}
