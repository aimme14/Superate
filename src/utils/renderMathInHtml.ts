import katex from "katex";

/**
 * Renderiza fórmulas matemáticas LaTeX en HTML.
 * Procesa elementos [data-latex] y los reemplaza con el output de KaTeX.
 */
export function renderMathInHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (typeof document === "undefined") return html;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  const mathElements = tempDiv.querySelectorAll("[data-latex]");
  mathElements.forEach((el) => {
    const latex = el.getAttribute("data-latex");
    if (latex) {
      const hasKaTeX = el.querySelector(".katex") !== null;
      if (!hasKaTeX) {
        try {
          const isDisplay =
            el.classList.contains("katex-display") || el.tagName === "DIV";
          const rendered = katex.renderToString(latex, {
            throwOnError: false,
            displayMode: isDisplay,
            strict: false,
          });
          if (
            rendered &&
            rendered.trim() !== "" &&
            rendered.includes("katex")
          ) {
            el.innerHTML = rendered;
            el.classList.add("katex-formula");
            if (isDisplay) el.classList.add("katex-display");
          }
        } catch {
          // Fallback: dejar el latex como texto
        }
      }
    }
  });

  return tempDiv.innerHTML;
}
