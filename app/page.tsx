"use client";

import { Filter as FilterIcon, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { ActivityCharts } from "@/components/charts/ActivityCharts";
import { DashboardHero } from "@/components/DashboardHero";
import { FilterBar } from "@/components/filters/FilterBar";
import { Footer } from "@/components/Footer";
import { PRList } from "@/components/pr/PRList";
import { ReposGrid } from "@/components/repos/ReposGrid";
import { ScrollToTop } from "@/components/ScrollToTop";
import { StalePRRadar } from "@/components/StalePRRadar";
import { StatCards } from "@/components/StatCards";
import {
  DetailedLoadingState,
  EmptyState,
  ErrorState,
  PartialDataBanner,
  StaleDataBanner,
} from "@/components/states/States";
import { Tabs } from "@/components/Tabs";
import { TopBar } from "@/components/TopBar";
import { TopProgressBar } from "@/components/TopProgressBar";
import { Button } from "@/components/ui/button";
import { UsersChartGrid } from "@/components/users/UsersChartGrid";
import { UsersLeaderboardTable } from "@/components/users/UsersLeaderboardTable";
import { useAggregate } from "@/hooks/use-aggregate";
import { useConfig, useDiscover } from "@/hooks/use-discover";
import { useFilters } from "@/hooks/use-filters";

export default function Home() {
  const [filters, setFilters] = useFilters();
  const { data, error, isFetching, refetch } = useAggregate(filters);
  const discoverQuery = useDiscover();
  const configQuery = useConfig();

  // Without `placeholderData`, `data` is undefined while a new query runs —
  // so `data` itself answers the "should I show the loader?" question.
  const shownData = data;
  const showLoader = isFetching && !data;

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

  const clearAllFilters = () => {
    setFilters({
      orgs: null,
      repos: null,
      users: null,
      state: null,
      reviewerType: null,
      q: null,
      from: null,
      to: null,
    });
  };

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
                description="Try expanding the date range, switching sprints, or clearing filters."
                actions={
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Clear filters
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ sprint: null })}
                    >
                      <FilterIcon className="h-3.5 w-3.5" />
                      Reset to default sprint
                    </Button>
                  </>
                }
              />
            ) : (
              shownData &&
              !showLoader && (
                <div className="space-y-6 animate-fade-in">
                  <Tabs />

                  {filters.tab === "users" && (
                    <div key="users" className="space-y-4 animate-tab-in">
                      <UsersChartGrid
                        users={shownData.users}
                        prs={shownData.prs}
                      />
                      <UsersLeaderboardTable
                        users={shownData.users}
                        prs={shownData.prs}
                        searchQuery={filters.q}
                      />
                    </div>
                  )}

                  {filters.tab === "repos" && (
                    <div key="repos" className="animate-tab-in">
                      <ReposGrid repos={shownData.repos} prs={shownData.prs} />
                    </div>
                  )}

                  {filters.tab === "activity" && (
                    <div key="activity" className="space-y-4 animate-tab-in">
                      <ActivityCharts data={shownData} />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <StalePRRadar prs={shownData.prs} />
                        <div className="lg:col-span-1">
                          <PRList prs={filteredPRs} searchQuery={filters.q} />
                        </div>
                      </div>
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
