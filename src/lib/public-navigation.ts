/** Hide the submission entry even if an old saved menu still contains it. */
export function isPublicNavigation(href: string): boolean {
  try {
    const path = new URL(href, "https://pinsandneedlescomedy.com").pathname.replace(/\/+$/, "");
    return path !== "/bad-decisions" && !path.startsWith("/bad-decisions/");
  } catch {
    return true;
  }
}
