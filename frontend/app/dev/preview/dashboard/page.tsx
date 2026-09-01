"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  activeDashboardFixture,
  completedDashboardFixture,
  lockedDashboardFixture,
} from "@/features/dashboard/dashboard-fixtures";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["locked", "active", "completed"] as const;
const fixtures = {
  locked: lockedDashboardFixture,
  active: activeDashboardFixture,
  completed: completedDashboardFixture,
};

export default function DashboardPreviewPage({ searchParams }: PageProps<"/dev/preview/dashboard">) {
  const router = useRouter();
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "active");

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="dashboard" activeFixture={state} states={states} />
      <DashboardView
        model={fixtures[state]}
        onNavigate={(href) => {
          router.push(toDevPreviewHref(href));
        }}
        onLogout={() => {
          router.push("/dev/preview");
        }}
      />
    </div>
  );
}
