import { useMemo, useState } from "react";
import type { PreparedCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";

export function CompanyReportDocument({
  report,
}: {
  report: PreparedCompanyReport;
}) {
  const [open, setOpen] = useState(false);
  const document = useMemo(
    () => (open ? formatCompanyReportDocument(report) : null),
    [open, report],
  );
  return (
    <details
      className="managed-report-document"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Inspect report document (JSON)</summary>
      {open && <CompanyReportDocumentView document={document} />}
    </details>
  );
}

export function CompanyReportDocumentView({
  document,
}: {
  document: ReturnType<typeof formatCompanyReportDocument>;
}) {
  if (!document)
    return (
      <p role="status">
        Report document unavailable. Its text exceeds the document limit or
        contains unsupported note characters. The preview and draft are
        unchanged.
      </p>
    );
  return (
    <>
      <p id="managed-report-document-scope">
        Exact authored draft and full admitted source packets, including
        original financial inputs, filing references and source dates. Missing
        sources stay missing. This inspection makes no request or saved change
        and does not download a file. JSON escapes preserve the note when
        decoded.
      </p>
      <label htmlFor="managed-report-document">
        Report document · {document.byteLength} UTF-8 bytes
      </label>
      <textarea
        id="managed-report-document"
        aria-describedby="managed-report-document-scope"
        readOnly
        spellCheck={false}
        rows={12}
        value={document.text}
      />
    </>
  );
}
