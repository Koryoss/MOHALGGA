/** Minimal, dependency-free `<meta property="...">` content extractor.
 *  Good enough for og:title / og:image / og:description scraping without
 *  pulling in a full HTML parser. */
export function extractMetaContent(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(pattern);
  return match?.[1]?.trim() || undefined;
}
