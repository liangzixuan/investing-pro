/** Keep delayed focus with the initiating action, including native disabled-button blur. */
export function portfolioReportFocusLease(opener: HTMLElement) {
  let active = true;
  const moved = (event: FocusEvent) => {
    if (event.target !== opener && event.target !== document.body)
      active = false;
  };
  document.addEventListener("focusin", moved);
  return {
    current: () =>
      active &&
      opener.isConnected &&
      (document.activeElement === opener ||
        document.activeElement === document.body),
    dispose: () => {
      active = false;
      document.removeEventListener("focusin", moved);
    },
  };
}
