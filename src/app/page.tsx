import { redirect } from "next/navigation";
import { getConfig } from "@/shared/config";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect(`/e/${getConfig().event.slug}`);
}
