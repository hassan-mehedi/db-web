import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
import { getAuth } from "@/lib/auth";
import { hasUsers } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasUsers()) {
    const session = await getAuth().api.getSession({
      headers: new Headers({ cookie: (await cookies()).toString() }),
    });
    if (!session) redirect("/login");
    if (session.user.twoFactorEnabled) redirect("/projects");
  }
  return <SetupForm />;
}
