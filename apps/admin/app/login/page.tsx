import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { hasUsers } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasUsers())) redirect("/setup");
  return <LoginForm />;
}
