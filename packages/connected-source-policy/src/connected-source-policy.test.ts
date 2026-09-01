import { describe, expect, it, vi } from "vitest";

import {
  CONNECTED_SOURCE_POLICY_PROFILE,
  CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
  createConnectedSourcePolicy,
  createConnectedSourceTransportCapability,
  isConnectedSourceAdmittedOperationCapability,
  parseConnectedSourcePolicyConfig,
  readConnectedSourceResponse,
  type ConnectedSourceTransportAdapter,
} from "./connected-source-policy";
import {
  SYNTHETIC_CONNECTED_SOURCE_NOW,
  buildSyntheticConnectedSourcePolicyConfig,
  buildSyntheticConnectedSourcePolicyDocument,
  buildSyntheticConnectedSourceReservationInput,
} from "./test-connected-source-policy-builder";

function createHarness(
  execute: ConnectedSourceTransportAdapter["execute"] = () =>
    Promise.resolve({
      body: new Uint8Array([7, 8]),
      estimatedSpendMicrounits: 200,
      storageBytes: 300,
    }),
) {
  const secretBytes = new Uint8Array([11, 22, 33]);
  const capture = vi.fn(() => Promise.resolve({ bytes: secretBytes }));
  const deleteCaptured = vi.fn(() => Promise.resolve());
  const transportExecute = vi.fn(execute);
  const controller = createConnectedSourcePolicy(
    buildSyntheticConnectedSourcePolicyConfig(),
    {
      clock: { now: () => SYNTHETIC_CONNECTED_SOURCE_NOW },
      secretAdapter: { capture, delete: deleteCaptured },
      transportCapability: createConnectedSourceTransportCapability({
        execute: transportExecute,
      }),
    },
  );
  return {
    capture,
    controller,
    deleteCaptured,
    secretBytes,
    transportExecute,
  };
}

describe("connected source policy", () => {
  it("is disabled unless the exact connected personal profile is configured", () => {
    expect(parseConnectedSourcePolicyConfig(undefined)).toEqual({
      config: {
        enabled: false,
        profile: CONNECTED_SOURCE_POLICY_PROFILE,
        schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
      },
      status: "parsed",
    });
    const controller = createConnectedSourcePolicy(undefined);
    expect(controller.status()).toMatchObject({
      budget: null,
      reasonCode: "NOT_EXPLICITLY_ENABLED",
      status: "disabled",
    });
    expect(
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({ reasonCode: "DISABLED", status: "rejected" });
  });

  it("admits one compatible synthetic policy and enforces the exact host-operation allowlist", () => {
    const { controller } = createHarness();
    expect(
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({
      policyStatus: { reasonCode: null, status: "ready" },
      status: "admitted",
    });
    expect(
      controller.authorizeOperation({
        host: "source.example.invalid",
        operation: "fetch_snapshot",
        sourceId: "synthetic_source",
      }),
    ).toEqual({
      host: "source.example.invalid",
      operation: "fetch_snapshot",
      sourceId: "synthetic_source",
      status: "authorized",
    });
    expect(
      controller.authorizeOperation({
        host: "other.example.invalid",
        operation: "fetch_snapshot",
        sourceId: "synthetic_source",
      }),
    ).toEqual({ reasonCode: "HOST_NOT_ALLOWED", status: "denied" });
    expect(
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({ reasonCode: "POLICY_REPLAYED", status: "rejected" });
  });

  it("reserves worst-case budgets before work, executes through the active brand, and reconciles actuals", async () => {
    let transportedPayload: Uint8Array | undefined;
    let transportedCredential: Uint8Array | undefined;
    let transportedCapability: unknown;
    const harness = createHarness(
      (capability, request, payload, credential) => {
        expect(isConnectedSourceAdmittedOperationCapability(capability)).toBe(
          true,
        );
        expect(Object.isFrozen(request)).toBe(true);
        expect(request.maximumResponseBytes).toBe(1_000);
        transportedCapability = capability;
        transportedPayload = payload;
        transportedCredential = credential;
        return Promise.resolve({
          body: new Uint8Array([7, 8]),
          estimatedSpendMicrounits: 200,
          storageBytes: 300,
        });
      },
    );
    harness.controller.admitSourcePolicy(
      buildSyntheticConnectedSourcePolicyDocument(),
    );
    const reservation = harness.controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput(),
    );
    expect(reservation.status).toBe("reserved");
    if (reservation.status !== "reserved") throw new Error("unreachable");
    expect(reservation.budget).toMatchObject({
      estimatedSpendMicrounits: { used: 500 },
      requestBytes: { used: 3 },
      requests: { used: 1 },
      responseBytes: { used: 1_000 },
      storageBytes: { used: 1_000 },
    });

    const result = await harness.controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation: reservation.reservation,
    });
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("unreachable");
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.budget).toMatchObject({
      estimatedSpendMicrounits: { used: 200 },
      requestBytes: { used: 3 },
      requests: { used: 1 },
      responseBytes: { used: 2 },
      storageBytes: { used: 300 },
    });
    expect(readConnectedSourceResponse(result.response)).toEqual([7, 8]);
    expect(readConnectedSourceResponse(result.response)).toBeUndefined();
    expect(harness.capture).toHaveBeenCalledOnce();
    expect(harness.deleteCaptured).toHaveBeenCalledOnce();
    expect(harness.secretBytes).toEqual(new Uint8Array([0, 0, 0]));
    expect(transportedPayload).toEqual(new Uint8Array([0, 0, 0]));
    expect(transportedCredential).toEqual(new Uint8Array([0, 0, 0]));
    expect(
      isConnectedSourceAdmittedOperationCapability(transportedCapability),
    ).toBe(false);
  });

  it("makes the owner kill switch irreversible and invalidates dependent capabilities", async () => {
    const { controller } = createHarness();
    controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
    const first = controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput("request:kill:1"),
    );
    const second = controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput("request:kill:2"),
    );
    if (first.status !== "reserved" || second.status !== "reserved") {
      throw new Error("unreachable");
    }
    const response = await controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation: first.reservation,
    });
    if (response.status !== "succeeded") throw new Error("unreachable");

    expect(controller.kill()).toMatchObject({
      policyStatus: {
        reasonCode: "OWNER_KILL_SWITCH",
        status: "killed",
      },
      status: "killed",
    });
    expect(readConnectedSourceResponse(response.response)).toBeUndefined();
    await expect(
      controller.execute({
        payload: new Uint8Array([1, 2, 3]),
        reservation: second.reservation,
      }),
    ).resolves.toMatchObject({ status: "denied" });
    expect(controller.kill()).toMatchObject({ status: "already_killed" });
    expect(controller.status()).toMatchObject({ status: "killed" });
  });

  it.each([
    ["2025-12-01T00:00:00.000Z", "incompatible", "POLICY_NOT_EFFECTIVE"],
    ["2026-12-15T00:00:00.000Z", "incompatible", "POLICY_REVIEW_DUE"],
    ["2027-01-01T00:00:00.000Z", "expired", "POLICY_EXPIRED"],
  ] as const)(
    "terminalizes an invalid policy clock window at %s",
    (now, status, reasonCode) => {
      const controller = createConnectedSourcePolicy(
        buildSyntheticConnectedSourcePolicyConfig(),
        { clock: { now: () => now } },
      );
      expect(
        controller.admitSourcePolicy(
          buildSyntheticConnectedSourcePolicyDocument(),
        ),
      ).toMatchObject({ status: "rejected" });
      expect(controller.status()).toMatchObject({ reasonCode, status });
    },
  );

  it("terminalizes an actual transport overrun and permits no second request", async () => {
    const oversizedBody = new Uint8Array(1_001);
    const { controller, transportExecute } = createHarness(() =>
      Promise.resolve({
        body: oversizedBody,
        estimatedSpendMicrounits: 200,
        storageBytes: 300,
      }),
    );
    controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
    const reservation = controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput(),
    );
    if (reservation.status !== "reserved") throw new Error("unreachable");
    const setSpy = vi.spyOn(Uint8Array.prototype, "set");
    try {
      await expect(
        controller.execute({
          payload: new Uint8Array([1, 2, 3]),
          reservation: reservation.reservation,
        }),
      ).resolves.toMatchObject({
        reasonCode: "BUDGET_OVERRUN",
        status: "failed",
      });
      expect(
        setSpy.mock.calls.some(([source]) => source === oversizedBody),
      ).toBe(false);
    } finally {
      setSpy.mockRestore();
    }
    expect(controller.status()).toMatchObject({ status: "budget_exhausted" });
    expect(
      controller.reserveBudget(
        buildSyntheticConnectedSourceReservationInput("request:2"),
      ),
    ).toMatchObject({ reasonCode: "NOT_READY", status: "denied" });
    expect(transportExecute).toHaveBeenCalledOnce();
    expect(oversizedBody.every((byte) => byte === 0)).toBe(true);
  });
});
