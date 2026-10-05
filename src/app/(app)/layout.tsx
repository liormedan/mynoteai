import { AppHeader } from "@/components/app-header";
import { AuthGate } from "@/components/auth-gate";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <AuthGate>{children}</AuthGate>
    </>
  );
}
