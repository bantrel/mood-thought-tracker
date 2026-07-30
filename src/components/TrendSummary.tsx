import type { TrendDay } from '../types';

type TrendSummaryProps = {
  days: TrendDay[];
  loading: boolean;
};

export function TrendSummary({ days, loading }: TrendSummaryProps) {
  const maxActivity = Math.max(...days.map((day) => day.checkIns + day.abcdReflections), 1);
  const totalCheckIns = days.reduce((sum, day) => sum + day.checkIns, 0);
  const totalReflections = days.reduce((sum, day) => sum + day.abcdReflections, 0);
  const activeDays = days.filter((day) => day.checkIns + day.abcdReflections > 0).length;
  const averageMood =
    days.filter((day) => day.averageIntensity !== null).reduce((sum, day) => sum + (day.averageIntensity ?? 0), 0) /
      Math.max(days.filter((day) => day.averageIntensity !== null).length, 1) || 0;

  return (
    <div className="panelCard">
      <div className="cardHeader">
        <div>
          <p className="eyebrow">Cross-day insights</p>
          <h2>Last 7 days</h2>
        </div>
        <div className="summaryPills">
          <span>{activeDays} active days</span>
          <span>{totalCheckIns} check-ins</span>
          <span>{totalReflections} reflections</span>
        </div>
      </div>

      {loading ? (
        <p className="emptyState">Loading recent trends...</p>
      ) : !activeDays ? (
        <p className="emptyState">No entries yet across the last week. Add a check-in to start building patterns.</p>
      ) : (
        <>
          <div className="trendMeta">
            <strong>Average mood across active days: {averageMood.toFixed(1)}/10</strong>
          </div>
          <div className="trendList" role="list">
            {days.map((day) => {
              const totalActivity = day.checkIns + day.abcdReflections;
              const width = `${(totalActivity / maxActivity) * 100}%`;

              return (
                <div key={day.date} className="trendRow" role="listitem">
                  <div>
                    <strong>{day.shortLabel}</strong>
                    <p>
                      {totalActivity} item{totalActivity === 1 ? '' : 's'} · {day.dominantEmotion ?? 'No dominant mood'}
                    </p>
                  </div>
                  <div className="trendMetrics">
                    <span>{day.averageIntensity === null ? '-' : `${day.averageIntensity.toFixed(1)}/10`}</span>
                    <div className="trendBarTrack">
                      <div className="trendBarFill" style={{ width }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
