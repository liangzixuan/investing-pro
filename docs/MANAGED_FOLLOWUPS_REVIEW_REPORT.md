# Follow-ups review report

Android 1.46 provides a readable private copy of the complete Follow-ups draft
from accepted source cf30baa9d23a02f2c9440d2e635c4bc8817e796e. Original required
PR/main checks, the complete synthetic native 91-case scope and full guarded APK
verification passed. Installation and physical-device acceptance remain separate.

## Capture, inspect and save

1. Open Follow-ups and explicitly load its saved version.
2. Finish any Save, conflict recovery, catalog review or draft-file operation.
   Correct invalid text or dates in the editor.
3. Open **Keep a readable follow-ups report** and choose **Capture follow-ups
   report**.
4. Inspect every complete question, authored assessment, identity, catalog
   reference, due date and completion date. The capture includes all entries in
   resource order, including completed or later checks and checks outside the
   current filter, chosen review or My Watchlist.
5. Choose **Save report (HTML)**. Android asks for one document destination;
   the browser requests a download. Check the destination after a failed or
   uncertain handoff.
6. Continue editing or use the independent **Save follow-ups** action. The file
   does not save the online resource.

The report shows authored capture UTC, the loaded online base version and
whether the draft had unsaved changes. Due dates are planning dates; completion
dates record authored actions. Assessments remain the author's observations.
An authored citation does not establish that the source body was read.

A missing current catalog does not prevent a report of a fresh loaded resource.
The report labels that reference unavailable and preserves each entry's recorded
identity and catalog digest. Capture does not resolve, update or qualify an
identity for company research.

## Capture lifetime

An edit, Load, Save/recovery change, catalog change, navigation or session
retirement withdraws the capture and cancels a pending handoff. Selecting,
reading, exporting or reviewing a draft file also withdraws it. Restoring the
previous values does not revive an old capture; capture again after the activity
finishes. A filter or selected-check change alone does not remove entries from
the complete captured resource.

**Close captured report** clears the preview. Closing its disclosure has the
same effect. **Cancel report save** stops the current handoff; a file already
written remains a file. No action changes the draft automatically.

## File and privacy boundaries

The standalone HTML contains the full reading view and complete captured JSON
appendix. It escapes authored markup and uses no scripts, forms, active generated
links, remote assets or source requests. Its fixed purpose and timestamped
filename are separate from draft recovery files. Its UTF-8 size cannot exceed
8 MiB. Invalid, noncanonical or oversized input is refused as a whole; text is
not clipped or silently normalized.

Keep the file private. It contains authored research and exact listing
identities. It is a reading snapshot, not cloud backup, immutable history or a
restorable draft. It does not add a feed, storage resource, provider entitlement,
notification, dependency or fee. Existing website/API activation and physical
device acceptance remain separate.
