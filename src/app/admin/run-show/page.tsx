import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import LoginForm from "../LoginForm";
import RunShow from "./RunShow";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Run Show", robots: { index: false, follow: false } };

/** `?mode=rehearsal` opens the dress rehearsal: the same controls on a separate practice copy. */
export default async function RunShowPage({ searchParams }: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  if (!(await isAuthed())) return <LoginForm />;
  const space = spaceOf((await searchParams).mode);
  return <RunShow key={space} space={space} />;
}
