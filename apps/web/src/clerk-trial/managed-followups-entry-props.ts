import type { ComponentProps } from "react";
import type { ManagedFollowupsEntry } from "./ManagedFollowupsEntry";
import type { managedResearchOpener } from "./managed-research-company-navigation-props";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

type EntryProps = ComponentProps<typeof ManagedFollowupsEntry>;
type EntryComposition = Omit<EntryProps, "onResearch" | "routeActive"> & {
  readonly navigation: ManagedCompanyNavigation | undefined;
  readonly routeActive: () => boolean;
  readonly openResearch: ReturnType<typeof managedResearchOpener>;
};

/** Bind Follow-ups files and Research to the same live root navigation owner. */
export function managedFollowupsEntryProps({
  navigation,
  routeActive,
  openResearch,
  ...props
}: EntryComposition): EntryProps {
  return {
    ...props,
    routeActive: () =>
      routeActive() &&
      !navigation?.isPending() &&
      props.workspace.sessionOwner.getSnapshot().phase === "active",
    onResearch: (entry, opener) => {
      if (navigation?.isPending()) return;
      void props.workspace.prepareFollowupResearch(entry).then((capture) => {
        if (capture)
          openResearch(opener, () =>
            props.workspace.openFollowupResearch(capture),
          );
      });
    },
  };
}
