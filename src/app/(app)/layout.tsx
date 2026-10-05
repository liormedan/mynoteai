import { AppHeader } from "@/components/app-header";
import { AuthGate } from "@/components/auth-gate";
import { MobileSidebar, Sidebar } from "@/components/sidebar/sidebar";
import { PagesProvider } from "@/lib/pages/store";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <PagesProvider>
        <AppHeader>
          <MobileSidebar />
        </AppHeader>
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </PagesProvider>
    </AuthGate>
  );
}
