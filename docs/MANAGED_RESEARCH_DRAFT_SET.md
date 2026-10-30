# Research draft-set files

Status: source merged in PR258. [Current work](CURRENT_WORK.md) records original
main qualification and Android delivery separately.

## Intended workflow

Select the loaded, settled research drafts to include: Watchlist, Portfolio,
Follow-ups and staged valuation inputs. A loaded empty collection is valid.
An unloaded resource is unavailable for capture and must not appear as empty.
Show included and omitted resources before capture and in the complete preview.

Capture preserves each included collection's full identities, order, authored
strings and independent metadata. Inspect all content before choosing a private
file destination. Capture and file Save do not save online or stage the current
valuation editor. Opening the controls makes no financial-source request.

In a fresh session, load the current resource before comparing it with the file.
Inspect the complete imported and current collections, then restore that one
resource explicitly. Retain its current loaded online save base. Other drafts
and the valuation editor, calculation and unsaved state remain unchanged.
Catalog identity review, draft Review, online Save and fresh Load stay separate.
Restoring another resource requires its own current comparison and action.

## File and lifetime boundaries

The private file composes typed resource payloads under one strict envelope.
Each member retains its existing parser and payload limits. The complete file
has a derived UTF-8 byte bound. It excludes credentials, provider packets,
calculated results and the independent valuation editor. Preserve admitted raw
text without clipping or numeric conversion.

Refuse the whole file before mutation when its scope or version is unsupported,
a member is invalid, or keys, Unicode, advertised size or actual size fail
validation. Cancellation leaves current drafts unchanged. Keep existing
single-resource files usable.

Capture uses settled snapshots and rechecks each included resource before
publishing a preview or starting file delivery. Pending or uncertain saves and
unresolved edits or identity reviews make an included resource unavailable.
Unselected resources remain independent.

Session retirement clears the private file inventory. Route changes retire a
restore comparison. Draft, saved-base, catalog or relevant file activity changes
retire stale actions, even if values later return to the same text. Consume an
action before notifying observers. Late reads, chooser results and reentrant
callbacks cannot change newer work or move focus away from an unrelated control.

This workflow makes no combined Save, transaction, rollback, automatic backup
or cloud recovery claim.

## Acceptance examples

- Capture invented drafts from all four resources, including an empty collection,
  full notes and results, exact decimal spellings and unfinished valuation input.
- Save through the real chosen-document adapter. Reopen in a fresh session with
  newer saved bases and inspect the complete file.
- Restore Portfolio alone and verify every other draft and the valuation editor
  remain unchanged. Restore valuation separately, review identities, then Save
  and freshly Load each restored resource.
- Verify subset capture, explicit omissions, malformed-member whole-file refusal,
  cancellation, size and encoding failures, save recovery, stale actions,
  reentrant callbacks and exact action-owned focus.
- Preserve prior native journeys. A retained screenshot establishes only its
  visible scope; executed assertions verify complete collections below it.
