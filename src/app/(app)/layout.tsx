import { AppHeader } from "@/components/app-header";
import { AuthGate } from "@/components/auth-gate";
import { CommandPaletteProvider } from "@/components/command/command-palette";
import { SearchButton } from "@/components/command/search-button";
import { MobileSidebar, Sidebar } from "@/components/sidebar/sidebar";
import { PagesProvider } from "@/lib/pages/store";
import { SearchProvider } from "@/lib/search/provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <PagesProvider>
        <SearchProvider>
          <CommandPaletteProvider>
            <AppHeader>
              <MobileSidebar />
              <SearchButton />
            </AppHeader>
            <div className="flex flex-1">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">{children}</div>
            </div>
          </CommandPaletteProvider>
        </SearchProvider>
      </PagesProvider>
    </AuthGate>
  );
}
