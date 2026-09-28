import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import LoginForm from "../LoginForm";
import ControlCenter from "./ControlCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control Center", robots: { index: false, follow: false } };

/** The show-night page: only reachable signed in, and only linked from the admin. */
export default async function ControlCenterPage() {
  if (!(await isAuthed())) return <LoginForm />;
  return <ControlCenter />;
}
