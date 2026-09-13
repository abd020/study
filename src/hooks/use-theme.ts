import { useContext } from "react";
import { ThemeContext } from "@/providers/theme-provider";

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme doit être utilisé dans un ThemeProvider.");
  return context;
}
