import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "auditorias-tema";

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Tema elegido por el usuario (por defecto claro; no sigue al sistema). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#03215c" : "#ffffff");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Sin almacenamiento (modo privado): el tema dura solo la sesión.
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  return { theme, toggle };
}
