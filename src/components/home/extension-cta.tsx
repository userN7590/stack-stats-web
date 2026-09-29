import { extensionInstallUrl } from "@/lib/distribution";

/** Monochrome VS Code mark, used only to identify the editor the extension is for. */
function VsCodeMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="ext-cta-mark">
      <path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
    </svg>
  );
}

/**
 * The tracking-first entry path. With an official listing configured it is a
 * link; until then it is an intentional, non-interactive “coming soon” note —
 * never a dead or placeholder link.
 */
export function ExtensionCta({ url }: { url?: string | null }) {
  const href = extensionInstallUrl(url === undefined ? undefined : url);
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="ext-cta" data-extension-cta="available">
        <VsCodeMark />
        <span className="ext-cta-text">
          <span className="ext-cta-label">Get the VS Code extension<span className="sr-only"> (opens the extension listing in a new tab)</span></span>
          <span className="ext-cta-note">Start tracking now. Connect your account later.</span>
        </span>
      </a>
    );
  }
  return (
    <div className="ext-cta ext-cta-soon" data-extension-cta="coming-soon">
      <VsCodeMark />
      <span className="ext-cta-text">
        <span className="ext-cta-label">VS Code extension <span className="ext-cta-tag">Coming soon</span></span>
        <span className="ext-cta-note">Track locally. Connect your account later.</span>
      </span>
    </div>
  );
}
