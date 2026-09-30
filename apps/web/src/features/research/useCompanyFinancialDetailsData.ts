"use client";

import type {
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import { useRef, useState } from "react";
import {
  fetchPersonalQuarterlyFinancials,
  fetchPersonalValuationHistory,
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface CompanyFinancialDetailsDataContext {
  readonly selection: PersonalMarketSelection | null;
  readonly range: PersonalMarketDataRangeDto;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly getSessionGeneration: () => number;
  readonly onSessionUnavailable: () => void;
}

/** Explicit detail loads share the host's session and company lifetime. */
export function useCompanyFinancialDetailsData(
  context: CompanyFinancialDetailsDataContext,
) {
  const [quarterlyFinancials, setQuarterlyFinancials] =
    useState<PersonalQuarterlyFinancialsDto | null>(null);
  const [quarterlyFinancialsRequestState, setQuarterlyFinancialsRequestState] =
    useState<"idle" | "loading">("idle");
  const [quarterlyFinancialsErrorCode, setQuarterlyFinancialsErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const [valuationHistory, setValuationHistory] =
    useState<PersonalValuationHistoryDto | null>(null);
  const [valuationHistoryRequestState, setValuationHistoryRequestState] =
    useState<"idle" | "loading">("idle");
  const [valuationHistoryErrorCode, setValuationHistoryErrorCode] =
    useState<PersonalWorkspaceApiErrorCode | null>(null);
  const quarterlyFinancialsEpoch = useRef(0);
  const quarterlyFinancialsController = useRef<AbortController | null>(null);
  const valuationHistoryEpoch = useRef(0);
  const valuationHistoryController = useRef<AbortController | null>(null);

  function clearValuationHistoryState() {
    valuationHistoryController.current?.abort();
    valuationHistoryController.current = null;
    valuationHistoryEpoch.current += 1;
    setValuationHistory(null);
    setValuationHistoryRequestState("idle");
    setValuationHistoryErrorCode(null);
  }

  function reset() {
    quarterlyFinancialsController.current?.abort();
    quarterlyFinancialsController.current = null;
    quarterlyFinancialsEpoch.current += 1;
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsRequestState("idle");
    setQuarterlyFinancialsErrorCode(null);
    clearValuationHistoryState();
  }

  async function loadQuarterlyFinancials() {
    const selection = context.selection;
    if (selection === null || quarterlyFinancialsRequestState === "loading") {
      return;
    }
    if (context.providerStatus?.status === "not_configured") {
      setQuarterlyFinancialsErrorCode("not_configured");
      return;
    }
    if (context.providerStatus === null) {
      setQuarterlyFinancialsErrorCode("unavailable");
      return;
    }

    quarterlyFinancialsController.current?.abort();
    const controller = new AbortController();
    quarterlyFinancialsController.current = controller;
    const request = ++quarterlyFinancialsEpoch.current;
    const epoch = context.getSessionGeneration();
    setQuarterlyFinancials(null);
    setQuarterlyFinancialsErrorCode(null);
    setQuarterlyFinancialsRequestState("loading");
    try {
      const loaded = await fetchPersonalQuarterlyFinancials(
        {
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== context.getSessionGeneration() ||
        request !== quarterlyFinancialsEpoch.current
      ) {
        return;
      }
      setQuarterlyFinancials(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== context.getSessionGeneration() ||
        request !== quarterlyFinancialsEpoch.current
      ) {
        return;
      }
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "session_unavailable"
      ) {
        context.onSessionUnavailable();
        return;
      }
      setQuarterlyFinancialsErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (
        epoch === context.getSessionGeneration() &&
        request === quarterlyFinancialsEpoch.current
      ) {
        quarterlyFinancialsController.current = null;
        setQuarterlyFinancialsRequestState("idle");
      }
    }
  }

  async function loadValuationHistory() {
    const selection = context.selection;
    if (selection === null || valuationHistoryRequestState === "loading") {
      return;
    }
    if (context.providerStatus?.status === "not_configured") {
      setValuationHistoryErrorCode("not_configured");
      return;
    }
    if (context.providerStatus === null) {
      setValuationHistoryErrorCode("unavailable");
      return;
    }

    valuationHistoryController.current?.abort();
    const controller = new AbortController();
    valuationHistoryController.current = controller;
    const request = ++valuationHistoryEpoch.current;
    const epoch = context.getSessionGeneration();
    const range = context.range;
    setValuationHistory(null);
    setValuationHistoryErrorCode(null);
    setValuationHistoryRequestState("loading");
    try {
      const loaded = await fetchPersonalValuationHistory(
        {
          listingId: selection.listingId,
          range,
          symbol: selection.symbol,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== context.getSessionGeneration() ||
        request !== valuationHistoryEpoch.current
      ) {
        return;
      }
      setValuationHistory(loaded);
    } catch (error) {
      if (
        controller.signal.aborted ||
        epoch !== context.getSessionGeneration() ||
        request !== valuationHistoryEpoch.current
      ) {
        return;
      }
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "session_unavailable"
      ) {
        context.onSessionUnavailable();
        return;
      }
      setValuationHistoryErrorCode(
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable",
      );
    } finally {
      if (
        epoch === context.getSessionGeneration() &&
        request === valuationHistoryEpoch.current
      ) {
        valuationHistoryController.current = null;
        setValuationHistoryRequestState("idle");
      }
    }
  }

  return {
    quarterlyFinancials,
    quarterlyFinancialsRequestState,
    quarterlyFinancialsErrorCode,
    valuationHistory,
    valuationHistoryRequestState,
    valuationHistoryErrorCode,
    loadQuarterlyFinancials,
    loadValuationHistory,
    clearValuationHistoryState,
    reset,
  };
}
