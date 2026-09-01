import { describe, expect, it, vi } from "vitest";

import {
  CONNECTED_SOURCE_POLICY_HARD_LIMITS,
  CONNECTED_SOURCE_POLICY_NOT_PROVEN,
  createConnectedSourcePolicy,
  createConnectedSourceTransportCapability,
  parseConnectedSourcePolicyConfig,
  type ConnectedSourceBudget,
  type ConnectedSourceBudgetReservationCapability,
  type ConnectedSourceExecutionResult,
  type ConnectedSourceTransportAdapter,
} from "./connected-source-policy";
import {
  SYNTHETIC_CONNECTED_SOURCE_NOW,
  buildSyntheticConnectedSourcePolicyConfig,
  buildSyntheticConnectedSourcePolicyDocument,
  buildSyntheticConnectedSourceReservationInput,
} from "./test-connected-source-policy-builder";

type MutableBudget = {
  -readonly [Key in keyof ConnectedSourceBudget]: ConnectedSourceBudget[Key];
};

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createReadyController(
  execute: ConnectedSourceTransportAdapter["execute"],
  options?: { now?: () => string; secretBytes?: Uint8Array },
) {
  const secretBytes = options?.secretBytes ?? new Uint8Array([41, 42, 43]);
  const capture = vi.fn(() => Promise.resolve({ bytes: secretBytes }));
  const deleteCaptured = vi.fn(() => Promise.resolve());
  const transport = vi.fn(execute);
  const controller = createConnectedSourcePolicy(
    buildSyntheticConnectedSourcePolicyConfig(),
    {
      clock: { now: options?.now ?? (() => SYNTHETIC_CONNECTED_SOURCE_NOW) },
      secretAdapter: { capture, delete: deleteCaptured },
      transportCapability: createConnectedSourceTransportCapability({
        execute: transport,
      }),
    },
  );
  controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
  return { capture, controller, deleteCaptured, secretBytes, transport };
}

function reserveReadyController(
  controller: ReturnType<typeof createConnectedSourcePolicy>,
  replayKey = "security:request:1",
) {
  const reservation = controller.reserveBudget(
    buildSyntheticConnectedSourceReservationInput(replayKey),
  );
  if (reservation.status !== "reserved") throw new Error("unreachable");
  return reservation.reservation;
}

describe("connected source policy security boundary", () => {
  it("rejects proxies and accessors without invoking their traps or getters", () => {
    const trap = vi.fn(() => {
      throw new Error("must-not-run");
    });
    const proxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: trap,
        ownKeys: trap,
      },
    );
    expect(parseConnectedSourcePolicyConfig(proxy)).toEqual({
      reasonCode: "CONFIG_INVALID",
      status: "rejected",
    });
    expect(trap).not.toHaveBeenCalled();

    const config = buildSyntheticConnectedSourcePolicyConfig();
    const enabledGetter = vi.fn(() => true);
    Object.defineProperty(config, "enabled", {
      configurable: true,
      enumerable: true,
      get: enabledGetter,
    });
    expect(parseConnectedSourcePolicyConfig(config)).toMatchObject({
      status: "rejected",
    });
    expect(enabledGetter).not.toHaveBeenCalled();

    const controller = createConnectedSourcePolicy(undefined);
    const policy = buildSyntheticConnectedSourcePolicyDocument();
    const sourceGetter = vi.fn(() => "synthetic_source");
    Object.defineProperty(policy, "sourceId", {
      configurable: true,
      enumerable: true,
      get: sourceGetter,
    });
    expect(controller.admitSourcePolicy(policy)).toMatchObject({
      reasonCode: "DISABLED",
      status: "rejected",
    });
    expect(sourceGetter).not.toHaveBeenCalled();
  });

  it("rejects Unicode confusables, noncanonical URLs, and invalid clocks", () => {
    const unicodeConfig = buildSyntheticConnectedSourcePolicyConfig();
    if (!unicodeConfig.enabled) throw new Error("unreachable");
    (unicodeConfig as unknown as { sourceId: string }).sourceId =
      "synthetic_sourc\u00e9";
    expect(parseConnectedSourcePolicyConfig(unicodeConfig)).toMatchObject({
      status: "rejected",
    });
    const credentialShapedReference =
      buildSyntheticConnectedSourcePolicyConfig();
    if (!credentialShapedReference.enabled) throw new Error("unreachable");
    (
      credentialShapedReference as unknown as {
        secretReference: string;
      }
    ).secretReference = "sk_live_private_canary";
    expect(
      parseConnectedSourcePolicyConfig(credentialShapedReference),
    ).toMatchObject({ status: "rejected" });

    const urlPolicy = buildSyntheticConnectedSourcePolicyDocument();
    (
      urlPolicy.legal as unknown as {
        termsUri: string;
      }
    ).termsUri = "https://legal.example.invalid/terms/v1?copy=1";
    const urlController = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      { clock: { now: () => SYNTHETIC_CONNECTED_SOURCE_NOW } },
    );
    expect(urlController.admitSourcePolicy(urlPolicy)).toMatchObject({
      reasonCode: "POLICY_INVALID",
      status: "rejected",
    });

    const numericSourcePolicy = buildSyntheticConnectedSourcePolicyDocument();
    (numericSourcePolicy as unknown as { sourceId: string }).sourceId =
      "1synthetic_source";
    const identifierController = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      { clock: { now: () => SYNTHETIC_CONNECTED_SOURCE_NOW } },
    );
    expect(
      identifierController.admitSourcePolicy(numericSourcePolicy),
    ).toMatchObject({ reasonCode: "POLICY_INVALID", status: "rejected" });
    expect(
      identifierController.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({ status: "admitted" });
    expect(
      identifierController.authorizeOperation({
        host: "source.example.invalid",
        operation: "fetch_snapshot",
        sourceId: "1synthetic_source",
      }),
    ).toEqual({ reasonCode: "INPUT_INVALID", status: "denied" });
    const numericSourceReservation =
      buildSyntheticConnectedSourceReservationInput("security:numeric-source");
    (
      numericSourceReservation as unknown as {
        sourceId: string;
      }
    ).sourceId = "1synthetic_source";
    expect(
      identifierController.reserveBudget(numericSourceReservation),
    ).toMatchObject({ reasonCode: "INPUT_INVALID", status: "denied" });

    const clockController = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      { clock: { now: () => "2026-09-01T12:00:00Z" } },
    );
    expect(
      clockController.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({ status: "rejected" });
    expect(clockController.status()).toMatchObject({
      reasonCode: "CLOCK_INVALID",
      status: "incompatible",
    });
  });

  it("uses one validated clock snapshot for the atomic admission decision", () => {
    let clockCalls = 0;
    const controller = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      {
        clock: {
          now: () => {
            clockCalls += 1;
            if (clockCalls === 1) return SYNTHETIC_CONNECTED_SOURCE_NOW;
            throw new Error("nondeterministic-clock");
          },
        },
      },
    );
    expect(
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({
      policyStatus: { reasonCode: null, status: "ready" },
      status: "admitted",
    });
    expect(clockCalls).toBe(1);
    expect(controller.status()).toMatchObject({
      reasonCode: "CLOCK_INVALID",
      status: "incompatible",
    });
    expect(clockCalls).toBe(2);
  });

  it("fails admission closed when clock evaluation reentrantly kills the registry", () => {
    const holder: {
      controller?: ReturnType<typeof createConnectedSourcePolicy>;
    } = {};
    const controller = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      {
        clock: {
          now: () => {
            holder.controller?.kill();
            return SYNTHETIC_CONNECTED_SOURCE_NOW;
          },
        },
      },
    );
    holder.controller = controller;
    expect(
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      ),
    ).toMatchObject({
      policyStatus: {
        reasonCode: "OWNER_KILL_SWITCH",
        status: "killed",
      },
      reasonCode: "KILLED",
      status: "rejected",
    });
    expect(controller.status()).toMatchObject({ status: "killed" });
  });

  it("snapshots configuration, policy, clock, and transport methods against later mutation", async () => {
    const config = buildSyntheticConnectedSourcePolicyConfig();
    const clock: { now: () => string } = {
      now: () => SYNTHETIC_CONNECTED_SOURCE_NOW,
    };
    const oldExecute = vi.fn(() =>
      Promise.resolve({
        body: new Uint8Array([9]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const replacementExecute = vi.fn(() =>
      Promise.resolve({
        body: new Uint8Array([99]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const adapter = { execute: oldExecute };
    const controller = createConnectedSourcePolicy(config, {
      clock,
      secretAdapter: {
        capture: () => Promise.resolve({ bytes: new Uint8Array([1]) }),
        delete: () => Promise.resolve(),
      },
      transportCapability: createConnectedSourceTransportCapability(adapter),
    });
    (config as unknown as { enabled: boolean }).enabled = false;
    clock.now = () => "2027-01-01T00:00:00.000Z";
    adapter.execute = replacementExecute;
    const policy = buildSyntheticConnectedSourcePolicyDocument();
    expect(controller.admitSourcePolicy(policy)).toMatchObject({
      status: "admitted",
    });
    (policy.allowlist[0] as unknown as { host: string }).host =
      "mutated.example.invalid";
    const reservation = reserveReadyController(controller);
    await controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    expect(oldExecute).toHaveBeenCalledOnce();
    expect(replacementExecute).not.toHaveBeenCalled();
  });

  it.each([
    ["requestByteLimit", 2],
    ["responseByteLimit", 999],
    ["storageByteLimit", 999],
    ["estimatedSpendMicrounitsLimit", 499],
  ] as const)(
    "fails the %s reservation before secret capture or transport",
    (budgetKey, limit) => {
      const config = buildSyntheticConnectedSourcePolicyConfig();
      if (!config.enabled) throw new Error("unreachable");
      (config.budgets as MutableBudget)[budgetKey] = limit;
      const capture = vi.fn(() =>
        Promise.resolve({ bytes: new Uint8Array([1]) }),
      );
      const transport = vi.fn(() =>
        Promise.resolve({
          body: new Uint8Array([1]),
          estimatedSpendMicrounits: 0,
          storageBytes: 0,
        }),
      );
      const controller = createConnectedSourcePolicy(config, {
        clock: { now: () => SYNTHETIC_CONNECTED_SOURCE_NOW },
        secretAdapter: { capture, delete: () => Promise.resolve() },
        transportCapability: createConnectedSourceTransportCapability({
          execute: transport,
        }),
      });
      controller.admitSourcePolicy(
        buildSyntheticConnectedSourcePolicyDocument(),
      );
      expect(
        controller.reserveBudget(
          buildSyntheticConnectedSourceReservationInput(),
        ),
      ).toMatchObject({
        reasonCode: "BUDGET_EXCEEDED",
        status: "denied",
      });
      expect(controller.status()).toMatchObject({
        status: "budget_exhausted",
      });
      expect(capture).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("accepts hard budget ceilings and rejects every value above them", () => {
    expect(CONNECTED_SOURCE_POLICY_HARD_LIMITS).toEqual({
      requestByteLimit: 1_048_576,
      requestLimit: 10_000,
      responseByteLimit: 1_048_576,
    });
    const boundary = buildSyntheticConnectedSourcePolicyConfig();
    if (!boundary.enabled) throw new Error("unreachable");
    const boundaryBudgets = boundary.budgets as MutableBudget;
    boundaryBudgets.requestByteLimit = 1_048_576;
    boundaryBudgets.requestLimit = 10_000;
    boundaryBudgets.responseByteLimit = 1_048_576;
    expect(parseConnectedSourcePolicyConfig(boundary)).toMatchObject({
      status: "parsed",
    });

    for (const [key, value] of [
      ["requestByteLimit", 1_048_577],
      ["requestLimit", 10_001],
      ["responseByteLimit", 1_048_577],
    ] as const) {
      const overLimit = buildSyntheticConnectedSourcePolicyConfig();
      if (!overLimit.enabled) throw new Error("unreachable");
      (overLimit.budgets as MutableBudget)[key] = value;
      expect(parseConnectedSourcePolicyConfig(overLimit)).toEqual({
        reasonCode: "CONFIG_INVALID",
        status: "rejected",
      });
    }
    expect(CONNECTED_SOURCE_POLICY_NOT_PROVEN).toContain(
      "injected_secret_and_transport_adapters_are_a_credential_confidentiality_trust_boundary",
    );
    expect(CONNECTED_SOURCE_POLICY_NOT_PROVEN).toContain(
      "hostile_adapters_may_retain_transform_or_exfiltrate_credential_bytes_and_core_cannot_generically_detect_it",
    );
  });

  it("atomically rejects replay and concurrent execution of one reservation", async () => {
    const gate = createDeferred<void>();
    const started = createDeferred<void>();
    const harness = createReadyController(async () => {
      started.resolve();
      await gate.promise;
      return {
        body: new Uint8Array([1]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      };
    });
    const reservation = reserveReadyController(harness.controller);
    expect(
      harness.controller.reserveBudget(
        buildSyntheticConnectedSourceReservationInput("security:request:1"),
      ),
    ).toMatchObject({ reasonCode: "REPLAYED", status: "denied" });

    const first = harness.controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    await started.promise;
    const second = harness.controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    await expect(second).resolves.toMatchObject({
      reasonCode: "RESERVATION_INVALID",
      status: "denied",
    });
    gate.resolve();
    await expect(first).resolves.toMatchObject({ status: "succeeded" });
    expect(harness.transport).toHaveBeenCalledOnce();
  });

  it("invalidates a reservation before a reentrant clock can execute it", async () => {
    const holder: {
      controller?: ReturnType<typeof createConnectedSourcePolicy>;
      reentrantExecution?: Promise<ConnectedSourceExecutionResult>;
      reservation?: ConnectedSourceBudgetReservationCapability;
    } = {};
    let reenter = false;
    const capture = vi.fn(() =>
      Promise.resolve({ bytes: new Uint8Array([4, 5, 6]) }),
    );
    const transport = vi.fn(() =>
      Promise.resolve({
        body: new Uint8Array([1]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const controller = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      {
        clock: {
          now: () => {
            if (
              reenter &&
              holder.reservation !== undefined &&
              holder.controller !== undefined
            ) {
              reenter = false;
              holder.reentrantExecution = holder.controller.execute({
                payload: new Uint8Array([1, 2, 3]),
                reservation: holder.reservation,
              });
            }
            return SYNTHETIC_CONNECTED_SOURCE_NOW;
          },
        },
        secretAdapter: { capture, delete: () => Promise.resolve() },
        transportCapability: createConnectedSourceTransportCapability({
          execute: transport,
        }),
      },
    );
    holder.controller = controller;
    controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
    const reserved = controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput("reentrant:1"),
    );
    if (reserved.status !== "reserved") throw new Error("unreachable");
    const reservation = reserved.reservation;
    holder.reservation = reservation;
    reenter = true;
    await expect(
      controller.execute({
        payload: new Uint8Array([1, 2, 3]),
        reservation,
      }),
    ).resolves.toMatchObject({ status: "succeeded" });
    const reentrantExecution = holder.reentrantExecution;
    if (reentrantExecution === undefined) throw new Error("unreachable");
    await expect(reentrantExecution).resolves.toMatchObject({
      reasonCode: "RESERVATION_INVALID",
      status: "denied",
    });
    expect(capture).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledOnce();
  });

  it("rejects a forged reservation before copying an oversized payload", async () => {
    const harness = createReadyController(() =>
      Promise.resolve({
        body: new Uint8Array([1]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const setSpy = vi.spyOn(Uint8Array.prototype, "set");
    try {
      await expect(
        harness.controller.execute({
          payload: new Uint8Array(10_001),
          reservation: Object.freeze({}),
        }),
      ).resolves.toMatchObject({
        reasonCode: "RESERVATION_INVALID",
        status: "denied",
      });
      expect(setSpy).not.toHaveBeenCalled();
      expect(harness.capture).not.toHaveBeenCalled();
      expect(harness.transport).not.toHaveBeenCalled();
    } finally {
      setSpy.mockRestore();
    }
  });

  it("consumes a genuine reservation before rejecting a wrong payload length", async () => {
    const harness = createReadyController(() =>
      Promise.resolve({
        body: new Uint8Array([1]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const reservationResult = harness.controller.reserveBudget(
      buildSyntheticConnectedSourceReservationInput("wrong-length:1"),
    );
    if (reservationResult.status !== "reserved") {
      throw new Error("unreachable");
    }
    const setSpy = vi.spyOn(Uint8Array.prototype, "set");
    try {
      await expect(
        harness.controller.execute({
          payload: new Uint8Array([1, 2, 3, 4]),
          reservation: reservationResult.reservation,
        }),
      ).resolves.toMatchObject({
        budget: {
          estimatedSpendMicrounits: { used: 500 },
          requestBytes: { used: 3 },
          requests: { used: 1 },
          responseBytes: { used: 1_000 },
          storageBytes: { used: 1_000 },
        },
        reasonCode: "INPUT_INVALID",
        status: "denied",
      });
      expect(setSpy).not.toHaveBeenCalled();
      await expect(
        harness.controller.execute({
          payload: new Uint8Array([1, 2, 3]),
          reservation: reservationResult.reservation,
        }),
      ).resolves.toMatchObject({
        reasonCode: "RESERVATION_INVALID",
        status: "denied",
      });
      expect(setSpy).not.toHaveBeenCalled();
      expect(harness.capture).not.toHaveBeenCalled();
      expect(harness.transport).not.toHaveBeenCalled();
    } finally {
      setSpy.mockRestore();
    }
  });

  it("discards and wipes an in-flight result after an owner kill", async () => {
    const gate = createDeferred<void>();
    const started = createDeferred<void>();
    const rawBody = new Uint8Array([5, 6, 7]);
    let credentialSeen: Uint8Array | undefined;
    const harness = createReadyController(
      async (_capability, _request, _payload, credential) => {
        credentialSeen = credential;
        started.resolve();
        await gate.promise;
        return {
          body: rawBody,
          estimatedSpendMicrounits: 0,
          storageBytes: 0,
        };
      },
    );
    const reservation = reserveReadyController(harness.controller);
    const execution = harness.controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    await started.promise;
    harness.controller.kill();
    gate.resolve();
    await expect(execution).resolves.toMatchObject({
      reasonCode: "KILLED_DURING_EXECUTION",
      status: "denied",
    });
    expect(rawBody).toEqual(new Uint8Array([0, 0, 0]));
    expect(credentialSeen).toEqual(new Uint8Array([0, 0, 0]));
    expect(harness.secretBytes).toEqual(new Uint8Array([0, 0, 0]));
    expect(harness.deleteCaptured).toHaveBeenCalledOnce();
  });

  it("cannot mint a response when kill occurs during deferred secret deletion", async () => {
    const deleteStarted = createDeferred<void>();
    const deleteGate = createDeferred<void>();
    const rawBody = new Uint8Array([3, 4, 5]);
    const secretBytes = new Uint8Array([7, 7, 7]);
    const transport = vi.fn(() =>
      Promise.resolve({
        body: rawBody,
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const controller = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      {
        clock: { now: () => SYNTHETIC_CONNECTED_SOURCE_NOW },
        secretAdapter: {
          capture: () => Promise.resolve({ bytes: secretBytes }),
          delete: async () => {
            deleteStarted.resolve();
            await deleteGate.promise;
          },
        },
        transportCapability: createConnectedSourceTransportCapability({
          execute: transport,
        }),
      },
    );
    controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
    const reservation = reserveReadyController(controller);
    const execution = controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    await deleteStarted.promise;
    controller.kill();
    deleteGate.resolve();
    await expect(execution).resolves.toEqual(
      expect.objectContaining({
        reasonCode: "KILLED_DURING_EXECUTION",
        status: "denied",
      }),
    );
    expect(transport).toHaveBeenCalledOnce();
    expect(rawBody).toEqual(new Uint8Array([0, 0, 0]));
    expect(secretBytes).toEqual(new Uint8Array([0, 0, 0]));
    expect(controller.status()).toMatchObject({ status: "killed" });
  });

  it("rechecks automatic expiry after secret capture and before transport", async () => {
    let now = SYNTHETIC_CONNECTED_SOURCE_NOW as string;
    const captured = createDeferred<{ bytes: Uint8Array }>();
    const secretBytes = new Uint8Array([8, 8, 8]);
    const transport = vi.fn(() =>
      Promise.resolve({
        body: new Uint8Array([1]),
        estimatedSpendMicrounits: 0,
        storageBytes: 0,
      }),
    );
    const controller = createConnectedSourcePolicy(
      buildSyntheticConnectedSourcePolicyConfig(),
      {
        clock: { now: () => now },
        secretAdapter: {
          capture: () => captured.promise,
          delete: () => Promise.resolve(),
        },
        transportCapability: createConnectedSourceTransportCapability({
          execute: transport,
        }),
      },
    );
    controller.admitSourcePolicy(buildSyntheticConnectedSourcePolicyDocument());
    const reservation = reserveReadyController(controller);
    const execution = controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    now = "2027-01-01T00:00:00.000Z";
    captured.resolve({ bytes: secretBytes });
    await expect(execution).resolves.toMatchObject({
      reasonCode: "KILLED_DURING_EXECUTION",
      status: "denied",
    });
    expect(controller.status()).toMatchObject({ status: "expired" });
    expect(transport).not.toHaveBeenCalled();
    expect(secretBytes).toEqual(new Uint8Array([0, 0, 0]));
  });

  it("never reflects secret or transport exception text in decisions and wipes secret copies", async () => {
    const marker = "DO_NOT_LOG_SECRET_90210";
    let credentialSeen: Uint8Array | undefined;
    const secretBytes = new Uint8Array([9, 0, 2, 1, 0]);
    const harness = createReadyController(
      (_capability, _request, _payload, credential) => {
        credentialSeen = credential;
        return Promise.reject(new Error(marker));
      },
      { secretBytes },
    );
    const reservation = reserveReadyController(harness.controller);
    const result = await harness.controller.execute({
      payload: new Uint8Array([1, 2, 3]),
      reservation,
    });
    expect(result).toMatchObject({
      reasonCode: "TRANSPORT_FAILED",
      status: "failed",
    });
    expect(JSON.stringify(result)).not.toContain(marker);
    expect(JSON.stringify(harness.controller.status())).not.toContain(marker);
    expect(secretBytes).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    expect(credentialSeen).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    expect(harness.deleteCaptured).toHaveBeenCalledOnce();
  });
});
