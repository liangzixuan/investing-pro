import type {
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerPayload,
  PersonalPortfolioLedgerTransaction,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PersonalPortfolioLedgerEditor,
  type PersonalPortfolioLedgerEditorProps,
} from "./PersonalPortfolioLedgerEditor";

vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));

let props: PersonalPortfolioLedgerEditorProps;

vi.mock(
  "@/lib/personal-portfolio-ledger-csv",
  () => import("../../lib/personal-portfolio-ledger-csv"),
);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T10:00:00.000Z"));
  harness.reset();
  props = {
    ledger: ledger(),
    disabled: false,
    selectedListing: identity(1),
    onChange: vi.fn((next: PersonalPortfolioLedgerPayload) => {
      props = { ...props, ledger: next };
    }),
  };
});
afterEach(() => {
  harness.unmount();
  vi.useRealTimers();
});

describe("PersonalPortfolioLedgerEditor", () => {
  it("records a manual buy with a generated stable ID and derives FIFO basis and cash", async () => {
    await mount();
    expect(props.onChange).not.toHaveBeenCalled();
    change(render(), "Transaction shares", "2");
    change(render(), "Transaction amount", "50");
    change(render(), "Transaction fee", "1");
    click(render(), "Add transaction to draft");
    render();
    render();
    expect(props.ledger.transactions).toHaveLength(1);
    expect(props.ledger.transactions[0]).toMatchObject({
      date: "2026-09-09",
      type: "buy",
      listingId: "listing-one",
      shares: "2",
      grossUsd: "50",
      feeUsd: "1",
    });
    expect(props.ledger.transactions[0]?.id).toMatch(/^[a-f0-9-]{36}$/u);
    expect(text(render())).toContain(
      "Buy 2026-09-09 · 2 shares remaining · Remaining basis 51.00 USD",
    );
    expect(text(render())).toContain("Save My Portfolio to keep it");
  });

  it.each(["deposit", "withdrawal", "dividend", "fee"] as const)(
    "uses the correct nullable transaction fields for %s",
    async (type) => {
      await mount();
      change(render(), "Transaction type", type);
      change(render(), "Transaction amount", "5");
      click(render(), "Add transaction to draft");
      expect(props.ledger.transactions[0]).toMatchObject({
        type,
        listingId: type === "dividend" ? "listing-one" : null,
        shares: null,
        grossUsd: "5",
        feeUsd: "0",
      });
    },
  );

  it.each([
    ["Transaction shares", "20", "sell", "more shares"],
    ["Transaction amount", "1001", "buy", "cash negative"],
    ["Transaction date", "2026-09-01", "buy", "strictly after"],
    ["Transaction date", "2026-09-10", "buy", "future"],
    ["Transaction shares", "0.0000001", "buy", "Check the amount"],
    ["Transaction amount", "1.001", "buy", "Check the amount"],
  ])(
    "rejects invalid ledger activity for %s=%s",
    async (label, value, type, expected) => {
      await mount();
      change(render(), "Transaction type", type);
      change(render(), "Transaction shares", "1");
      change(render(), "Transaction amount", "10");
      change(render(), label, value);
      click(render(), "Add transaction to draft");
      expect(props.onChange).not.toHaveBeenCalled();
      expect(text(render())).toContain(expected);
      expect(input(render(), label).props.value).toBe(value);
    },
  );

  it("edits an existing transaction without replacing its ID or moving its position", async () => {
    props = { ...props, ledger: ledger([transaction("deposit-one")]) };
    await mount();
    click(render(), "Edit deposit-one");
    change(render(), "Transaction amount", "25");
    click(render(), "Apply transaction edit");
    expect(props.ledger.transactions).toEqual([
      { ...transaction("deposit-one"), grossUsd: "25" },
    ]);
    expect(props.onChange).toHaveBeenCalledOnce();
  });

  it("rejects a backdated append without silently sorting existing activity", async () => {
    props = { ...props, ledger: ledger([transaction("later")]) };
    await mount();
    change(render(), "Transaction type", "deposit");
    change(render(), "Transaction date", "2026-09-07");
    change(render(), "Transaction amount", "25");
    click(render(), "Add transaction to draft");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.ledger.transactions).toEqual([transaction("later")]);
    expect(text(render())).toContain("Transactions must remain in date order");
  });

  it("prevents removing or moving funding behind a same-day withdrawal", async () => {
    props = {
      ...props,
      ledger: {
        ...ledger([
          transaction("fund"),
          { ...transaction("spend"), type: "withdrawal" },
        ]),
        opening: { ...ledger().opening, cashUsd: "0" },
      },
    };
    await mount();
    click(render(), "Remove fund");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(text(render())).toContain("cash negative");
    click(render(), "Move fund later");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.ledger.transactions[0]?.id).toBe("fund");
  });

  it("permits only valid adjacent same-day moves and preserves all transaction IDs", async () => {
    props = {
      ...props,
      ledger: ledger([
        transaction("a"),
        transaction("b"),
        { ...transaction("c"), date: "2026-09-09" },
      ]),
    };
    await mount();
    expect(button(render(), "Move b later").props.disabled).toBe(true);
    click(render(), "Move b earlier");
    expect(props.ledger.transactions.map((entry) => entry.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("paginates 250 transactions and prevents appending beyond the limit", async () => {
    props = {
      ...props,
      ledger: ledger(
        Array.from({ length: 250 }, (_, index) =>
          transaction(`entry-${String(index)}`),
        ),
      ),
    };
    await mount();
    expect(
      elements(render()).filter((entry) => entry.type === "article"),
    ).toHaveLength(25);
    expect(button(render(), "Add transaction to draft").props.disabled).toBe(
      true,
    );
    click(render(), "Next transactions");
    expect(text(render())).toContain("Page 2 of 10");
    expect(text(render())).toContain("ID entry-25");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("registers an admitted identity and permits removing only unused registry entries", async () => {
    await mount();
    expect(button(render(), "Remove unused ONE").props.disabled).toBe(true);
    click(render(), "Register selected listing");
    render();
    render();
    expect(props.ledger.identities).toEqual([identity(), identity(1)]);
    expect(button(render(), "Register selected listing").props.disabled).toBe(
      true,
    );
    click(render(), "Remove unused ONE1");
    expect(props.ledger.identities).toEqual([identity()]);
  });

  it("stages opening edits until explicit validated apply and preserves unknown basis", async () => {
    await mount();
    change(render(), "Opening shares for ONE", "12");
    change(render(), "Opening cost basis for ONE", "");
    change(render(), "Ledger opening cash", "");
    expect(props.onChange).not.toHaveBeenCalled();
    click(render(), "Apply opening changes");
    expect(props.ledger.opening).toMatchObject({
      cashUsd: null,
      holdings: [{ shares: "12", totalCostBasisUsd: null }],
    });
    render();
    render();
    expect(text(render())).toContain(
      "Cash solvency and the current cash balance cannot be verified",
    );
  });

  it("blocks opening changes that invalidate a later sale and lets the owner reset them", async () => {
    props = {
      ...props,
      ledger: ledger([
        {
          ...transaction("sale"),
          type: "sell",
          listingId: "listing-one",
          shares: "5",
          grossUsd: "70",
        },
      ]),
    };
    await mount();
    click(render(), "Remove opening ONE");
    click(render(), "Apply opening changes");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(text(render())).toContain("more shares");
    click(render(), "Reset opening edits");
    expect(input(render(), "Opening shares for ONE").props.value).toBe("10");
  });

  it("preserves staged opening edits when another ledger action is attempted", async () => {
    await mount();
    change(render(), "Ledger opening cash", "500");
    click(render(), "Register selected listing");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(input(render(), "Ledger opening cash").props.value).toBe("500");
    expect(text(render())).toContain(
      "Apply or reset your opening balance edits",
    );
    click(render(), "Apply opening changes");
    expect(props.ledger.opening.cashUsd).toBe("500");
  });

  it.each(["registry", "opening", "CSV"])(
    "preserves an entered transaction when applying an unrelated %s change",
    async (kind) => {
      await mount();
      change(render(), "Transaction shares", "2");
      change(render(), "Transaction amount", "25");
      if (kind === "registry") click(render(), "Register selected listing");
      if (kind === "opening") {
        change(render(), "Ledger opening cash", "500");
        click(render(), "Apply opening changes");
      }
      if (kind === "CSV") {
        change(
          render(),
          "Ledger CSV text",
          csv("csv-row,2026-09-08,deposit,,,,10,0"),
        );
        click(render(), "Preview CSV import");
        click(render(), "Apply reviewed transactions");
      }
      expect(props.onChange).not.toHaveBeenCalled();
      expect(input(render(), "Transaction shares").props.value).toBe("2");
      expect(input(render(), "Transaction amount").props.value).toBe("25");
      expect(text(render())).toContain("Apply or reset your transaction form");
      click(render(), "Reset transaction form");
      expect(input(render(), "Transaction amount").props.value).toBe("");
    },
  );

  it("keeps transaction edit mode pending until explicit update or cancel and reports clean on unmount", async () => {
    const onPendingEditsChange = vi.fn();
    props = {
      ...props,
      ledger: ledger([transaction("first"), transaction("second")]),
      onPendingEditsChange,
    };
    await mount();
    expect(onPendingEditsChange).toHaveBeenLastCalledWith(false);
    click(render(), "Edit first");
    render();
    expect(onPendingEditsChange).toHaveBeenLastCalledWith(true);
    click(render(), "Edit second");
    expect(text(render())).toContain("before editing another transaction");
    click(render(), "Register selected listing");
    expect(props.onChange).not.toHaveBeenCalled();
    click(render(), "Cancel transaction edit");
    render();
    expect(onPendingEditsChange).toHaveBeenLastCalledWith(false);
    change(render(), "Transaction amount", "12");
    render();
    expect(onPendingEditsChange).toHaveBeenLastCalledWith(true);
    harness.unmount();
    expect(onPendingEditsChange).toHaveBeenLastCalledWith(false);
  });

  it.each(["opening", "CSV", "file"])(
    "reports pending %s edits and clears the signal after explicit reset",
    async (kind) => {
      const onPendingEditsChange = vi.fn();
      props = { ...props, onPendingEditsChange };
      await mount();
      if (kind === "opening") change(render(), "Ledger opening cash", "500");
      if (kind === "CSV")
        change(
          render(),
          "Ledger CSV text",
          csv("csv-row,2026-09-08,deposit,,,,10,0"),
        );
      if (kind === "file")
        upload(render(), {
          size: 20,
          arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined),
        });
      render();
      expect(onPendingEditsChange).toHaveBeenLastCalledWith(true);
      click(
        render(),
        kind === "opening" ? "Reset opening edits" : "Clear CSV input",
      );
      render();
      expect(onPendingEditsChange).toHaveBeenLastCalledWith(false);
    },
  );

  it("shows concise row controls while retaining unique accessible transaction labels", async () => {
    props = { ...props, ledger: ledger([transaction("unique-id")]) };
    await mount();
    expect(text(button(render(), "Edit unique-id"))).toBe("Edit");
    expect(text(button(render(), "Remove unique-id"))).toBe("Remove");
    expect(text(button(render(), "Move unique-id earlier"))).toBe(
      "Move earlier",
    );
    expect(text(button(render(), "Move unique-id later"))).toBe("Move later");
  });

  it.each(["CSV", "file"])(
    "preserves pending %s input when another ledger mutation is attempted",
    async (kind) => {
      await mount();
      if (kind === "CSV")
        change(
          render(),
          "Ledger CSV text",
          csv("csv-row,2026-09-08,deposit,,,,10,0"),
        );
      else
        upload(render(), {
          size: 20,
          arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined),
        });
      click(render(), "Register selected listing");
      expect(props.onChange).not.toHaveBeenCalled();
      expect(text(render())).toContain("Apply or clear your CSV input");
      if (kind === "CSV")
        expect(input(render(), "Ledger CSV text").props.value).toContain(
          "csv-row",
        );
      click(render(), "Clear CSV input");
      click(render(), "Register selected listing");
      expect(props.onChange).toHaveBeenCalledOnce();
    },
  );

  it("shows known realized subtotal separately when an opening pool has unknown basis", async () => {
    const original = ledger([
      {
        ...transaction("sale"),
        type: "sell",
        listingId: "listing-one",
        shares: "5",
        grossUsd: "70",
      },
    ]);
    props = {
      ...props,
      ledger: {
        ...original,
        opening: {
          ...original.opening,
          holdings: [
            {
              listingId: "listing-one",
              shares: "10",
              totalCostBasisUsd: null,
              confirmedOn: "2026-09-01",
            },
          ],
        },
      },
    };
    await mount();
    expect(metric(render(), "Known realized gain / loss subtotal")).toBe(
      "0.00 USD",
    );
    expect(metric(render(), "Total realized gain / loss")).toBe("Unknown");
    expect(metric(render(), "Sales with unknown basis")).toBe("1 of 1");
  });

  it("previews CSV locally and applies reviewed rows only after explicit action", async () => {
    await mount();
    change(
      render(),
      "Ledger CSV text",
      csv("csv-one,2026-09-08,deposit,,, ,25,0".replace(", ,", ",,")),
    );
    click(render(), "Preview CSV import");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(text(render())).toContain("Review 1 imported transactions");
    click(render(), "Apply reviewed transactions");
    expect(props.ledger.transactions).toEqual([
      { ...transaction("csv-one"), grossUsd: "25" },
    ]);
    render();
    render();
    expect(input(render(), "Ledger CSV text").props.value).toBe("");
    expect(text(render())).toContain("Save My Portfolio to keep them");
  });

  it("requires acknowledgment for economic duplicates and rejects repeated transaction IDs", async () => {
    props = { ...props, ledger: ledger([transaction("existing")]) };
    await mount();
    change(
      render(),
      "Ledger CSV text",
      csv("possible,2026-09-08,deposit,,,,10,0"),
    );
    click(render(), "Preview CSV import");
    expect(button(render(), "Apply reviewed transactions").props.disabled).toBe(
      true,
    );
    check(render(), "Acknowledge possible duplicate transactions", true);
    click(render(), "Apply reviewed transactions");
    render();
    render();
    expect(props.ledger.transactions).toHaveLength(2);
    change(
      render(),
      "Ledger CSV text",
      csv("existing,2026-09-08,deposit,,,,10,0"),
    );
    click(render(), "Preview CSV import");
    expect(text(render())).toContain("transaction ID is repeated");
    expect(props.ledger.transactions).toHaveLength(2);
  });

  it.each(["text", "ledger", "disabled"])(
    "invalidates a reviewed import when %s changes",
    async (kind) => {
      await mount();
      change(
        render(),
        "Ledger CSV text",
        csv("row,2026-09-08,deposit,,,,10,0"),
      );
      click(render(), "Preview CSV import");
      const staleApply = button(render(), "Apply reviewed transactions");
      if (kind === "text")
        change(
          render(),
          "Ledger CSV text",
          csv("changed,2026-09-08,deposit,,,,20,0"),
        );
      if (kind === "ledger")
        props = {
          ...props,
          ledger: {
            ...props.ledger,
            snapshotSha256: `sha256:${"b".repeat(64)}`,
          },
        };
      if (kind === "disabled") props = { ...props, disabled: true };
      render();
      render();
      staleApply.props.onClick?.();
      expect(props.onChange).not.toHaveBeenCalled();
      expect(text(render())).not.toContain("Apply reviewed transactions");
    },
  );

  it("rejects text exceeding the UTF-8 byte limit even when character count is lower", async () => {
    await mount();
    change(render(), "Ledger CSV text", "é".repeat(32_769));
    expect(input(render(), "Ledger CSV text").props.value).toBe("");
    expect(text(render())).toContain("exceeds 64 KiB");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it.each(["clear", "ledger", "disabled", "unmount"])(
    "ignores late local file reads after %s",
    async (kind) => {
      await mount();
      const pending = deferred<ArrayBuffer>();
      upload(render(), { size: 20, arrayBuffer: () => pending.promise });
      if (kind === "clear") click(render(), "Clear CSV input");
      if (kind === "ledger")
        props = {
          ...props,
          ledger: {
            ...props.ledger,
            snapshotSha256: `sha256:${"c".repeat(64)}`,
          },
        };
      if (kind === "disabled") props = { ...props, disabled: true };
      if (kind === "unmount") harness.unmount();
      else {
        render();
        render();
      }
      pending.resolve(
        new TextEncoder().encode(csv("late,2026-09-08,deposit,,,,10,0")).buffer,
      );
      await flush();
      if (kind !== "unmount")
        expect(text(render())).not.toContain("CSV text loaded locally");
      if (kind !== "unmount" && kind !== "disabled")
        expect(input(render(), "Ledger CSV text").props.value).toBe("");
      expect(props.onChange).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed UTF-8 and checks actual file bytes independently of reported size", async () => {
    await mount();
    upload(render(), {
      size: 2,
      arrayBuffer: () => Promise.resolve(Uint8Array.from([0xc3, 0x28]).buffer),
    });
    await flush();
    expect(text(render())).toContain("valid UTF-8");
    upload(render(), {
      size: 1,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(65_537)),
    });
    await flush();
    expect(text(render())).toContain("within 64 KiB");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("reads a valid local file without applying or previewing transactions automatically", async () => {
    await mount();
    const content = `\uFEFF${csv("local-row,2026-09-08,deposit,,,,25,0")}`;
    const bytes = new TextEncoder().encode(content);
    upload(render(), {
      size: bytes.byteLength,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    });
    await flush();
    expect(input(render(), "Ledger CSV text").props.value).toBe(content);
    expect(props.onChange).not.toHaveBeenCalled();
    expect(text(render())).not.toContain("Apply reviewed transactions");
    click(render(), "Preview CSV import");
    expect(text(render())).toContain("Review 1 imported transactions");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("applies the same single-BOM CSV rule to local files and pasted text", async () => {
    await mount();
    const content = `\uFEFF\uFEFF${csv("local-row,2026-09-08,deposit,,,,25,0")}`;
    const bytes = new TextEncoder().encode(content);
    upload(render(), {
      size: bytes.byteLength,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    });
    await flush();
    click(render(), "Preview CSV import");
    expect(text(render())).toContain("The CSV syntax is invalid");
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

function identity(index = 0): PersonalPortfolioIdentity {
  const suffix = index === 0 ? "one" : String(index);
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: index === 0 ? "ONE" : `ONE${String(index)}`,
  };
}
function transaction(id: string): PersonalPortfolioLedgerTransaction {
  return {
    id,
    date: "2026-09-08",
    type: "deposit",
    listingId: null,
    shares: null,
    grossUsd: "10",
    feeUsd: "0",
  };
}
function ledger(
  transactions: readonly PersonalPortfolioLedgerTransaction[] = [],
): PersonalPortfolioLedgerPayload {
  return {
    schemaVersion: 2,
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
function csv(row: string) {
  return `id,date,type,listingId,symbol,shares,grossUsd,feeUsd\n${row}\n`;
}
function check(value: unknown, label: string, checked: boolean) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === label,
  ) as
    | React.ReactElement<{
        onChange: (event: { target: { checked: boolean } }) => void;
      }>
    | undefined;
  if (!found) throw new Error(`Missing checkbox ${label}`);
  found.props.onChange({ target: { checked } });
}
function upload(
  value: unknown,
  file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> },
) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === "Ledger CSV file",
  ) as
    | React.ReactElement<{
        onChange: (event: {
          target: { files: readonly unknown[]; value: string };
        }) => void;
      }>
    | undefined;
  if (!found) throw new Error("Missing file input");
  found.props.onChange({ target: { files: [file], value: "local.csv" } });
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
  const view = PersonalPortfolioLedgerEditor(props);
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
