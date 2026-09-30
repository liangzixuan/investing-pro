import {
  createClerkTrialStorageProofFunction,
  type ClerkTrialProofEnvironment,
} from "./clerk-trial-storage-proof";

declare const __CLERK_TRIAL_PROOF_PROFILE__: ClerkTrialProofEnvironment;
declare const __CLERK_TRIAL_PROOF_BUILD__: string;

export default createClerkTrialStorageProofFunction(
  __CLERK_TRIAL_PROOF_PROFILE__,
  __CLERK_TRIAL_PROOF_BUILD__,
);
