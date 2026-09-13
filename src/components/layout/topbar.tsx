import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { SearchDialog } from "@/components/layout/search-dialog";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Revia</span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground shadow-subtle transition-colors hover:bg-accent/50 lg:flex"
        >
          <Search className="h-4 w-4" />
          <span>Rechercher…</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Rechercher"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <NotificationsMenu />
          {/* Sur desktop, le menu utilisateur vit dans la sidebar. */}
          <div className="w-11 lg:hidden">
            <UserMenu />
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
