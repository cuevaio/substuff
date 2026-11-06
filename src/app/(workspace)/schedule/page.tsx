import { SchedulePage } from "@/components/schedule-page";
export default async function Page({ searchParams }: PageProps<"/schedule">) {
  const { view } = await searchParams;
  return <SchedulePage view={view === "list" ? "list" : "calendar"} />;
}
