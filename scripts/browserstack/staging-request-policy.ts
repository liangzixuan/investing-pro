export function isAllowedStagingRequest({
  url,
  method,
  resourceType,
  expectedOrigin,
}: {
  url: URL;
  method: string;
  resourceType: string;
  expectedOrigin: string;
}): boolean {
  const document = resourceType === "document" && url.pathname === "/";
  const asset =
    ["script", "stylesheet", "font", "image"].includes(resourceType) &&
    /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/u.test(
      url.pathname,
    );
  const font =
    resourceType === "font" &&
    /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8,}\.woff2$/u.test(url.pathname);
  return (
    method === "GET" &&
    url.origin === expectedOrigin &&
    url.search === "" &&
    (document || asset || font)
  );
}
