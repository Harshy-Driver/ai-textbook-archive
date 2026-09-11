import { Outlet } from "react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0 vintage-texture">
        {children || <Outlet />}
      </main>
      <BottomNav />
    </div>
  );
}
