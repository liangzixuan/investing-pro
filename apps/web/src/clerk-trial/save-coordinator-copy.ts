import type { SaveCopyProfile } from "./save-coordinator";

export const MANAGED_PORTFOLIO_SAVE_COPY: Readonly<SaveCopyProfile> =
  Object.freeze({
    loadPrompt: "Load your saved portfolio to begin.",
    retired:
      "This session has ended. Its local portfolio data has been cleared.",
    signedOut: "Signed out. Local portfolio data has been cleared.",
    signOutFailed:
      "Local portfolio data has been cleared, but sign-out could not be confirmed. Try signing out again.",
    invalidDraft:
      "Review the portfolio amounts, dates and current catalog identities before saving.",
    saveRejected:
      "The save was rejected. Review the portfolio ledger before saving again.",
    accessDenied:
      "This session cannot access your saved portfolio. Its local data has been cleared.",
    loadFailed:
      "The saved portfolio could not be loaded. Your draft is unchanged; try loading again.",
  });

export const TRIAL_WATCHLIST_SAVE_COPY: Readonly<SaveCopyProfile> =
  Object.freeze({
    loadPrompt: "Load the shared trial watchlist to begin.",
    retired: "This session has ended. Its local trial data has been cleared.",
    signedOut: "Signed out. Local trial data has been cleared.",
    signOutFailed:
      "Local trial data has been cleared, but sign-out could not be confirmed. Try signing out again.",
    invalidDraft:
      "Use at most 1,000 characters without control characters in the note.",
    saveRejected:
      "The save was rejected. Review the trial entries and note before saving again.",
    accessDenied:
      "This session cannot access the isolated trial. No trial data is available.",
    loadFailed:
      "The saved watchlist could not be loaded. Your draft is unchanged; try loading again.",
  });

export const MANAGED_WATCHLIST_SAVE_COPY: Readonly<SaveCopyProfile> =
  Object.freeze({
    loadPrompt: "Load your shared watchlist to begin.",
    retired:
      "This session has ended. Its local watchlist data has been cleared.",
    signedOut: "Signed out. Local watchlist data has been cleared.",
    signOutFailed:
      "Local watchlist data has been cleared, but sign-out could not be confirmed. Try signing out again.",
    invalidDraft:
      "Review the watchlist entries and notes, and keep the watchlist within its size limit.",
    saveRejected:
      "The save was rejected. Review the watchlist entries and notes before saving again.",
    accessDenied:
      "This session cannot access the shared watchlist. Its local data has been cleared.",
    loadFailed:
      "The saved watchlist could not be loaded. Your draft is unchanged; try loading again.",
  });

export const MANAGED_FOLLOWUPS_SAVE_COPY: Readonly<SaveCopyProfile> =
  Object.freeze({
    loadPrompt: "Load your saved follow-ups to begin.",
    retired:
      "This session has ended. Its local follow-up data has been cleared.",
    signedOut: "Signed out. Local follow-up data has been cleared.",
    signOutFailed:
      "Local follow-up data has been cleared, but sign-out could not be confirmed. Try signing out again.",
    invalidDraft:
      "Review the follow-up checks, dates and results, and keep the list within its size limit.",
    saveRejected:
      "The save was rejected. Review the follow-up checks, dates and results before saving again.",
    accessDenied:
      "This session cannot access your saved follow-ups. Its local data has been cleared.",
    loadFailed:
      "The saved follow-ups could not be loaded. Your draft is unchanged; try loading again.",
  });
