import type { ComponentProps } from "react";
import type { ManagedPortfolioEntry } from "./ManagedPortfolioEntry";
import type { managedResearchOpener } from "./managed-research-company-navigation-props";

type EntryProps = ComponentProps<typeof ManagedPortfolioEntry>;
type EntryComposition = Omit<EntryProps, "onResearch"> & {
  readonly openResearch: ReturnType<typeof managedResearchOpener>;
};

/** Bind Portfolio entry to the root route's guarded Research and return-focus owner. */
export function managedPortfolioEntryProps({
  openResearch,
  ...props
}: EntryComposition): EntryProps {
  return {
    ...props,
    onResearch: (draft, listing, opener) =>
      openResearch(opener, () =>
        props.workspace.openPortfolioResearch(draft, listing),
      ),
  };
}
