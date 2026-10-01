import {
  createClerkTrialStorageProofFunction,
  type ClerkTrialProofEnvironment,
} from "./clerk-trial-storage-proof";
import type { ClerkTrialFunctionContext } from "./clerk-trial-function";
import {
  createManagedContextProofFunction,
  isManagedContextProofRequest,
} from "./managed-workspace-context-proof";

declare const __CLERK_TRIAL_PROOF_PROFILE__: ClerkTrialProofEnvironment;
declare const __CLERK_TRIAL_PROOF_BUILD__: string;

const storageProof = createClerkTrialStorageProofFunction(
  __CLERK_TRIAL_PROOF_PROFILE__,
  __CLERK_TRIAL_PROOF_BUILD__,
);
const contextProof =
  __CLERK_TRIAL_PROOF_PROFILE__ === "managed"
    ? createManagedContextProofFunction(__CLERK_TRIAL_PROOF_BUILD__)
    : null;

type ProofContext = ClerkTrialFunctionContext & {
  readonly req: { readonly bodyBinary?: unknown };
};

export default function main(context: ProofContext) {
  if (contextProof && isManagedContextProofRequest(context.req))
    return contextProof(context);
  return storageProof(context);
}
