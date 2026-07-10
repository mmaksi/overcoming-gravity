import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return (
      <Alert>
        <AlertTitle>Admin area</AlertTitle>
        <AlertDescription>
          You need admin rights to manage skills and exercises. In development
          you can enable admin mode in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <AdminTabs />
      {children}
    </div>
  );
}
