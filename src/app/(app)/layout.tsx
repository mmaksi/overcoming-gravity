import { getCurrentUser } from "@/lib/auth";
import { BottomNav } from "@/components/shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav isAdmin={user?.isAdmin ?? false} />
    </div>
  );
}
