import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import { ManagedValuationCollectionDraftRecovery } from "./managed-valuation-collection-recovery";
import type { ManagedValuationCollectionDraftFileDeliveryAdapter } from "./valuation-collection-draft-file-delivery";
import { CompletePayload } from "./ValuationAssumptionsPanels";

export interface ValuationCollectionFilesProps {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationCollectionDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  navigationPending: boolean;
}
type Controller = ManagedValuationCollectionDraftRecovery;
type State = ReturnType<Controller["getSnapshot"]>;
const empty: State = {
  phase: "idle",
  preview: null,
  currentDraft: null,
  currentSavedVersion: null,
  canExport: false,
  canImport: false,
  message: "",
};
const emptySource = { subscribe: () => () => {}, getSnapshot: () => empty };
export function ManagedValuationCollectionDraftFiles(
  props: ValuationCollectionFilesProps,
) {
  const latest = useRef(props);
  latest.current = props;
  const active = useRef<Controller | null>(null);
  const [controller, setController] = useState<Controller | null>(null);
  const liveRender = useRef<object | null>(null),
    render = {};
  const capture = useRef<HTMLButtonElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null),
    heading = useRef<HTMLHeadingElement | null>(null);
  const requested = useRef<{
    state: State;
    source: HTMLElement;
    to: "input" | "heading" | "capture";
  } | null>(null);
  const reading = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const model = new ManagedValuationCollectionDraftRecovery({
      workspace: props.workspace,
      accountScope: props.accountScope,
      delivery: props.delivery,
      routeActive: () =>
        !latest.current.navigationPending && latest.current.routeActive(),
    });
    active.current = model;
    setController(model);
    return () => {
      if (active.current === model) active.current = null;
      model.dispose();
    };
  }, [props.workspace, props.accountScope, props.delivery]);
  const source = controller ?? emptySource;
  const state = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  const current = () =>
    liveRender.current === render &&
    active.current === controller &&
    controller !== null &&
    controller.getSnapshot() === state &&
    !latest.current.navigationPending &&
    latest.current.routeActive();
  useLayoutEffect(() => {
    liveRender.current = render;
    controller?.reconcile();
    return () => {
      liveRender.current = null;
    };
  });
  useLayoutEffect(() => {
    const request = requested.current;
    if (request) {
      requested.current = null;
      const owns =
        document.activeElement === request.source ||
        (!request.source.isConnected &&
          document.activeElement === document.body);
      if (request.state === state && current() && owns)
        (request.to === "input"
          ? input
          : request.to === "capture"
            ? capture
            : heading
        ).current?.focus();
    }
    if (reading.current && state.phase === "review") {
      const source = reading.current;
      reading.current = null;
      if (current() && document.activeElement === source)
        heading.current?.focus();
    }
    if (state.phase === "idle" || state.phase === "retired")
      reading.current = null;
  }, [state]);
  const pending = state.phase !== "idle" && state.phase !== "retired";
  const available = !props.navigationPending && props.routeActive();
  const captured = state.phase === "capture" || state.phase === "exporting";
  return (
    <details
      id="managed-valuation-collection-files"
      className="managed-valuation-input-files"
    >
      <summary>Valuation collection files</summary>
      <p>
        Capture every staged valuation entry in order, inspect the complete
        collection, then save a private JSON file. It includes each listing and
        all text entered for both models, including unfinished inputs.
      </p>
      <p>
        This file excludes the current workbench editor, calculated results,
        prices and source packets. It does not stage the editor. Restore changes
        only the valuation draft and keeps its loaded online save base. Catalog
        review, Review and Save remain separate.
      </p>
      <button
        id="managed-valuation-collection-capture"
        ref={capture}
        type="button"
        disabled={!available || !state.canExport}
        onClick={(event) => {
          if (state.canExport && current() && controller?.captureDraft())
            requested.current = {
              state: controller.getSnapshot(),
              source: event.currentTarget,
              to: "heading",
            };
        }}
      >
        Capture valuation collection
      </button>
      <label className="managed-draft-file-input">
        Select a valuation collection file
        <input
          id="managed-valuation-collection-file"
          ref={input}
          type="file"
          accept="application/json,.json"
          disabled={!available || !state.canImport}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file && state.canImport && current() && controller) {
              reading.current = event.currentTarget;
              void controller.readFile(file);
            }
          }}
        />
      </label>
      {!state.canImport && !pending && (
        <p>
          Load the current saved valuation inputs first and finish any save,
          recovery or identity review. No editor input or calculation is
          required.
        </p>
      )}
      {state.preview && state.currentDraft && (
        <section
          className="trial-review"
          aria-labelledby="managed-valuation-collection-review-heading"
        >
          <h4
            id="managed-valuation-collection-review-heading"
            ref={heading}
            tabIndex={-1}
          >
            {captured
              ? "Inspect the captured valuation collection"
              : "Review the complete collection file"}
          </h4>
          <p>
            Reported file capture time: {state.preview.capturedAt}. File
            metadata does not verify identities or assumptions. Current online
            save base: {state.currentSavedVersion}.
          </p>
          <CompletePayload
            label={
              captured
                ? "Captured staged valuation collection"
                : "Complete file collection"
            }
            payload={state.preview.payload}
          />
          {state.phase === "review" && (
            <CompletePayload
              label="Complete current draft that will be replaced"
              payload={state.currentDraft}
            />
          )}
          <div className="trial-actions">
            {state.phase === "capture" && (
              <button
                id="managed-valuation-collection-save-file"
                type="button"
                disabled={!available}
                onClick={() => {
                  if (current()) void controller?.saveFile();
                }}
              >
                Save captured collection file
              </button>
            )}
            {state.phase === "review" && (
              <button
                id="managed-valuation-collection-restore"
                type="button"
                disabled={!available}
                onClick={(event) => {
                  if (current() && controller?.restoreDraft())
                    requested.current = {
                      state: controller.getSnapshot(),
                      source: event.currentTarget,
                      to: "input",
                    };
                }}
              >
                Restore collection to valuation draft
              </button>
            )}
          </div>
        </section>
      )}
      {pending && (
        <button
          id="managed-valuation-collection-cancel"
          type="button"
          disabled={!available}
          className="trial-secondary"
          onClick={(event) => {
            if (current() && controller) {
              controller.cancel();
              requested.current = {
                state: controller.getSnapshot(),
                source: event.currentTarget,
                to: captured ? "capture" : "input",
              };
            }
          }}
        >
          Keep current draft / Cancel file operation
        </button>
      )}
      <p role="status">
        {state.phase === "reading"
          ? "Reading the collection file locally…"
          : state.phase === "exporting"
            ? "Saving the collection file…"
            : state.message}
      </p>
    </details>
  );
}
