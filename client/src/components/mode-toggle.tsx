import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative p-2 rounded-xl text-muted-foreground hover:bg-muted transition-all active:scale-90 group border border-transparent hover:border-border/50 focus:outline-none flex items-center justify-center h-10 w-10 overflow-hidden"
      title={theme === "dark" ? "Aydınlık Moda Geç" : "Karanlık Moda Geç"}
    >
      <Sun className="h-[22px] w-[22px] absolute transition-all dark:-rotate-90 dark:scale-0 group-hover:text-primary z-10" />
      <Moon className="h-[22px] w-[22px] absolute transition-all rotate-90 scale-0 dark:rotate-0 dark:scale-100 group-hover:text-primary z-10" />
      <span className="sr-only">Tema Değiştir</span>
    </button>
  )
}
