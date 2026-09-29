/**
 * Public distribution of the VS Code extension: the single place to change.
 *
 * The extension is not yet published (its manifest has no Marketplace
 * publisher and installs from a supplied `.vsix`), so there is no official
 * public install URL and the homepage shows an intentional “coming soon”
 * state. On Marketplace (or Open VSX) publication, set this to the official
 * listing, e.g. `https://marketplace.visualstudio.com/items?itemName=<publisher>.stack-stats-vscode`.
 * Note: a new publisher ID also needs the extension callback allowlist change
 * described in docs/EXTENSION_AUTH.md before account linking works.
 */
export const VSCODE_EXTENSION_URL: string | null = null;

const officialHosts = new Set(["marketplace.visualstudio.com", "open-vsx.org"]);

/** Only an official HTTPS listing counts; anything else keeps the coming-soon state. */
export function extensionInstallUrl(url: string | null = VSCODE_EXTENSION_URL): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && officialHosts.has(parsed.hostname) && parsed.pathname.length > 1 ? parsed.toString() : null;
  } catch {
    return null;
  }
}
