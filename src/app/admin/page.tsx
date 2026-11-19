import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/auth";
import { getContent, storageWarning } from "@/lib/store";
import AdminApp from "./AdminApp";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const role = await currentRole();
  // A producer's login only reaches the Control Center: send them there rather than to a login form that would not let them in.
  if (role === "producer") redirect("/admin/run-show");
  if (role !== "admin") return <LoginForm />;
  return <AdminApp initial={await getContent()} warning={await storageWarning()} />;
}
