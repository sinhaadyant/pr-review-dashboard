"use client";

import { Filter as FilterIcon, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActiveScopeBanner } from "@/components/ActiveScopeBanner";
import { ActivityCharts } from "@/components/charts/ActivityCharts";
import { CommentClassificationCharts } from "@/components/charts/CommentClassificationCharts";
import { ReviewActivityHeatmap } from "@/components/charts/ReviewActivityHeatmap";
import { RiskHealthQuadrant } from "@/components/charts/RiskHealthQuadrant";
import { CompareDeltaStrip } from "@/components/CompareDeltaStrip";
import { Confetti } from "@/components/Confetti";
import { DashboardHero } from "@/components/DashboardHero";
import { FilterBar } from "@/components/filters/FilterBar";
import { Footer } from "@/components/Footer";
import { InsightStrip } from "@/components/InsightStrip";
import { LatencyPanel } from "@/components/LatencyPanel";
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
import { BestReviewersPanel } from "@/components/users/BestReviewersPanel";
import { UsersChartGrid } from "@/components/users/UsersChartGrid";
import { UsersLeaderboardTable } from "@/components/users/UsersLeaderboardTable";
import { useAggregate } from "@/hooks/use-aggregate";
import { useCompareAggregate } from "@/hooks/use-compare-aggregate";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useConfig, useDiscover } from "@/hooks/use-discover";
import { useFilters } from "@/hooks/use-filters";
import { useNow } from "@/hooks/use-now";
import {
  computeHealth,
  computeRisk,
  computeTrendInsights,
  splitPreviousWindow,
} from "@/lib/intelligence";

export default function Home() {
  const [filters, setFilters] = useFilters();
  const { data, error, isFetching, refetch } = useAggregate(filters);
  const discoverQuery = useDiscover();
  const configQuery = useConfig();

  const shownData = data;
  const showLoader = isFetching && !data;
  // `useNow` advances at most once per minute so "stale" cutoff stays fresh
  // without making render impure.
  const now = useNow();

  const sprintLabel = useMemo(() => {
    const sprintId = filters.sprint ?? configQuery.data?.activeSprintId;
    const sprint = configQuery.data?.sprints.find((s) => s.id === sprintId);
    return sprint?.name ?? sprintId ?? "the active sprint";
  }, [configQuery.data, filters.sprint]);

  // Debounced text search — keeps keystroke latency snappy on large PR lists.
  const debouncedQ = useDebouncedValue(filters.q ?? "", 220);

  // Side-by-side compare with another sprint (defaults to the previous one in
  // sprint.json when the user clicks "Compare with previous"). Lives in URL
  // state via filters.compareWith.
  const compareSprintId = filters.compareWith ?? null;
  const compareQuery = useCompareAggregate(filters, compareSprintId);

  // Apply free-text search + "Problematic" quick-filter on top of the data the
  // server already filtered. These are pure client-side derivations so they
  // can't trigger an extra fetch.
  const filteredPRs = useMemo(() => {
    if (!shownData) return [];
    let out = shownData.prs;

    if (debouncedQ) {
      const q = debouncedQ.toLowerCase();
      out = out.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q),
      );
    }

    if (filters.problematic === "risk") {
      out = out.filter((p) => computeRisk(p).band === "high");
    } else if (filters.problematic === "stale") {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      out = out.filter((p) => {
        if (p.state !== "open") return false;
        const lastActivity = Math.max(
          Date.parse(p.createdAt),
          ...p.comments.map((c) => Date.parse(c.createdAt)),
        );
        return lastActivity < cutoff;
      });
    } else if (filters.problematic === "unhealthy") {
      out = out.filter((p) => computeHealth(p).band === "poor");
    }

    return out;
  }, [shownData, debouncedQ, filters.problematic, now]);

  // Confetti celebration: trigger ONCE per (sprint+filter combo) when the
  // currently-loaded data set has > 0 PRs and ALL of them are merged. Stored
  // in localStorage so navigating away/back doesn't re-trigger.
  const sprintKey = useMemo(
    () =>
      `${filters.sprint ?? configQuery.data?.activeSprintId ?? "active"}:` +
      `${filters.from ?? ""}:${filters.to ?? ""}:` +
      `${filters.repos.slice().sort().join(",")}:` +
      `${filters.orgs.slice().sort().join(",")}`,
    [
      filters.sprint,
      filters.from,
      filters.to,
      filters.repos,
      filters.orgs,
      configQuery.data?.activeSprintId,
    ],
  );
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!shownData) return;
    if (typeof window === "undefined") return;
    const stats = shownData.stats;
    const fullySprint =
      stats.totalPRs > 0 &&
      stats.merged === stats.totalPRs &&
      stats.open === 0 &&
      stats.closed === 0;
    if (!fullySprint) return;
    const seenKey = `pr-dashboard:confetti-shown:${sprintKey}`;
    try {
      if (window.localStorage.getItem(seenKey)) return;
      window.localStorage.setItem(seenKey, String(Date.now()));
    } catch {
      // ignore storage failures
    }
    // Defer the setState into an rAF so it doesn't fire synchronously during
    // the effect body (React 19 strict purity rule).
    const raf = requestAnimationFrame(() => setCelebrating(true));
    return () => cancelAnimationFrame(raf);
  }, [shownData, sprintKey]);

  // Derive trend insights without an extra API call by splitting the existing
  // PR set in half by date.
  const trendInsights = useMemo(() => {
    if (!shownData) return { insights: [], comparisonLabel: "" };
    const split = splitPreviousWindow(shownData.prs);
    if (!split) return { insights: [], comparisonLabel: "" };
    const insights = computeTrendInsights({
      current: { ...shownData, prs: split.current },
      previousPRs: split.previous,
    });
    return { insights, comparisonLabel: split.comparisonLabel };
  }, [shownData]);

  const clearAllFilters = () => {
    setFilters({
      orgs: null,
      repos: null,
      users: null,
      state: null,
      reviewerType: null,
      problematic: null,
      q: null,
      from: null,
      to: null,
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {celebrating && <Confetti onDone={() => setCelebrating(false)} />}
      <TopProgressBar active={isFetching} />
      <TopBar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 space-y-6 animate-page-in">
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

            {shownData && compareSprintId && compareQuery.data && (
              <CompareDeltaStrip
                current={shownData}
                compare={compareQuery.data}
                compareSprintId={compareSprintId}
                compareLabel={
                  configQuery.data?.sprints.find(
                    (s) => s.id === compareSprintId,
                  )?.name ?? compareSprintId
                }
                onClear={() => setFilters({ compareWith: null })}
                isFetching={compareQuery.isFetching}
              />
            )}

            {shownData && trendInsights.insights.length > 0 && (
              <InsightStrip
                insights={trendInsights.insights}
                comparisonLabel={trendInsights.comparisonLabel}
              />
            )}

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
                  <ActiveScopeBanner totalPRs={filteredPRs.length} />
                  <Tabs />

                  {filters.tab === "users" && (
                    <div key="users" className="space-y-4 animate-tab-in">
                      <BestReviewersPanel
                        users={shownData.users}
                        prs={shownData.prs}
                      />
                      <UsersChartGrid
                        users={shownData.users}
                        prs={shownData.prs}
                      />
                      <UsersLeaderboardTable
                        users={shownData.users}
                        prs={shownData.prs}
                        searchQuery={debouncedQ}
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
                      <CommentClassificationCharts prs={shownData.prs} />
                      <RiskHealthQuadrant prs={shownData.prs} />
                      <ReviewActivityHeatmap prs={shownData.prs} />
                      <LatencyPanel prs={shownData.prs} />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <StalePRRadar prs={shownData.prs} />
                        <div className="lg:col-span-1">
                          <PRList prs={filteredPRs} searchQuery={debouncedQ} />
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
