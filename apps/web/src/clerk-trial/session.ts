/** A verified SDK session. A native adapter can supply the same interface. */
export interface TrialSession {
  readonly userId: string;
  readonly sessionId: string;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}
