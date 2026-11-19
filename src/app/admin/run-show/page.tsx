import type { Metadata } from "next";
import { currentRole } from "@/lib/auth";
import LoginForm from "../LoginForm";
import { currentBuild } from "@/lib/build";
import ControlCenter from "./ControlCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control Center", robots: { index: false, follow: false } };

/** The show-night page: only reachable signed in, and only linked from the admin. */
export default async function ControlCenterPage() {
  const role = await currentRole();
  if (!role) return <LoginForm />;
  return <ControlCenter build={currentBuild()} producer={role === "producer"} />;
}
