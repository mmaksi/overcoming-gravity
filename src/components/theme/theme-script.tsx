/**
 * Applies the saved theme before first paint so there is no flash.
 * "system" (or nothing saved) follows the OS preference.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("strong-journal-theme");
    var dark =
      theme === "dark" ||
      ((!theme || theme === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
