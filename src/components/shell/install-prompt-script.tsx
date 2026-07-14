/**
 * Captures `beforeinstallprompt` before hydration. Chrome fires it once,
 * often before React mounts — a useEffect listener would miss it and the
 * install button would stay dead. The event is stashed on window and
 * re-announced so the button can pick it up whenever it mounts.
 */
const INSTALL_PROMPT_SCRIPT = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.caliInstallPrompt = e;
  window.dispatchEvent(new Event("strong-journal-install-ready"));
});
window.addEventListener("appinstalled", function () {
  window.caliInstallPrompt = undefined;
  window.dispatchEvent(new Event("strong-journal-install-ready"));
});
`;

export function InstallPromptScript() {
  return <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_SCRIPT }} />;
}
