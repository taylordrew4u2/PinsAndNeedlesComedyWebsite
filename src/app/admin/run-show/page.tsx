import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import LoginForm from "../LoginForm";
import RunShow from "./RunShow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Run Show", robots: { index: false, follow: false } };

export default async function RunShowPage() {
  if (!(await isAuthed())) return <LoginForm />;
  return <RunShow />;
}
