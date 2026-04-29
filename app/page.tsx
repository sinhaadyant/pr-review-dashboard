"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityCharts } from "@/components/charts/ActivityCharts";
import { DashboardHero } from "@/components/DashboardHero";
import { FilterBar } from "@/components/filters/FilterBar";
import { Footer } from "@/components/Footer";
import { PRList } from "@/components/pr/PRList";
import { ReposGrid } from "@/components/repos/ReposGrid";
import { StatCards } from "@/components/StatCards";
import {
  DetailedLoadingState,
  EmptyState,
  ErrorState,
  PartialDataBanner,
  StaleDataBanner,
} from "@/components/states/States";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Tabs } from "@/components/Tabs";
import { TopBar } from "@/components/TopBar";
import { TopProgressBar } from "@/components/TopProgressBar";
import { UsersChartGrid } from "@/components/users/UsersChartGrid";
import { UsersLeaderboardTable } from "@/components/users/UsersLeaderboardTable";
import { useAggregate } from "@/hooks/use-aggregate";
import { useConfig, useDiscover } from "@/hooks/use-discover";
import { useFilters } from "@/hooks/use-filters";

export default function Home() {
  const [filters] = useFilters();
  const { data, error, isFetching, refetch } = useAggregate(filters);
  const discoverQuery = useDiscover();
  const configQuery = useConfig();

  // Keep last successful data so we can decide between "first load" vs
  // "refetch with previous data". Cleared when a new fetch starts so the
  // detailed loader shows on refresh and filter changes.
  const [shownData, setShownData] = useState(data);
  const lastFetchingRef = useRef(false);

  useEffect(() => {
    if (isFetching && !lastFetchingRef.current) {
      // Fetch just started — drop displayed data so loader takes over.
      setShownData(undefined);
    } else if (!isFetching && data) {
      // Fetch finished — promote new data.
      setShownData(data);
    }
    lastFetchingRef.current = isFetching;
  }, [isFetching, data]);

  const sprintLabel = useMemo(() => {
    const sprintId = filters.sprint ?? configQuery.data?.activeSprintId;
    const sprint = configQuery.data?.sprints.find((s) => s.id === sprintId);
    return sprint?.name ?? sprintId ?? "the active sprint";
  }, [configQuery.data, filters.sprint]);

  const filteredPRs = useMemo(() => {
    if (!shownData || !filters.q) return shownData?.prs ?? [];
    const q = filters.q.toLowerCase();
    return shownData.prs.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q),
    );
  }, [shownData, filters.q]);

  const showLoader = isFetching && !shownData;

  return (
    <div className="flex min-h-screen flex-col">
      <TopProgressBar active={isFetching} />
      <TopBar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 space-y-6">
        {error && !showLoader ? (
          <ErrorState
            title="Could not load data"
            description={error instanceof Error ? error.message : String(error)}
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <DashboardHero data={shownData} sprintLabel={sprintLabel} />
            {shownData && <StaleDataBanner cache={shownData.cache} />}
            {shownData && (
              <PartialDataBanner reposSkipped={shownData.reposSkipped} />
            )}

            <StatCards data={shownData} loading={showLoader} />

            <FilterBar />

            {showLoader && (
              <DetailedLoadingState
                discovery={discoverQuery.data}
                discoveryLoading={discoverQuery.isLoading}
                sprintLabel={sprintLabel}
              />
            )}

            {shownData && shownData.stats.totalPRs === 0 && !showLoader ? (
              <EmptyState
                title="No PRs in this window"
                description="Try selecting a different sprint, expanding the date range, or clearing filters."
              />
            ) : (
              shownData &&
              !showLoader && (
                <div className="space-y-6 animate-fade-in">
                  <Tabs />

                  {filters.tab === "users" && (
                    <div key="users" className="space-y-4 animate-tab-in">
                      <UsersChartGrid users={shownData.users} />
                      <UsersLeaderboardTable
                        users={shownData.users}
                        searchQuery={filters.q}
                      />
                    </div>
                  )}

                  {filters.tab === "repos" && (
                    <div key="repos" className="animate-tab-in">
                      <ReposGrid repos={shownData.repos} />
                    </div>
                  )}

                  {filters.tab === "activity" && (
                    <div key="activity" className="space-y-4 animate-tab-in">
                      <ActivityCharts data={shownData} />
                      <PRList prs={filteredPRs} searchQuery={filters.q} />
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </main>
      <Footer data={shownData} />
      <ScrollToTop />
    </div>
  );
}
