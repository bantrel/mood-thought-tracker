import type { ThoughtRecord } from '../types';

type DayAtAGlanceProps = {
  loading: boolean;
  quickCheckIns: number;
  abcdReflections: number;
  average: number;
  topEmotion: string;
  highest: ThoughtRecord | null;
  activeDays: number;
};

export function DayAtAGlance({
  loading,
  quickCheckIns,
  abcdReflections,
  average,
  topEmotion,
  highest,
  activeDays,
}: DayAtAGlanceProps) {
  const totalActivity = quickCheckIns + abcdReflections;

  return (
    <div className="panelCard">
      <div className="cardHeader">
        <div>
          <p className="eyebrow">Daily overview</p>
          <h2>Day at a glance</h2>
        </div>
      </div>

      <div className="statsGrid">
        <div className="statBox">
          <span>Total Activity</span>
          <strong>{loading ? '...' : totalActivity}</strong>
        </div>
        <div className="statBox">
          <span>Quick Check-Ins</span>
          <strong>{loading ? '...' : quickCheckIns}</strong>
        </div>
        <div className="statBox">
          <span>ABCD Reflections</span>
          <strong>{loading ? '...' : abcdReflections}</strong>
        </div>
        <div className="statBox">
          <span>Average Mood Intensity</span>
          <strong>{quickCheckIns ? `${average.toFixed(1)}/10` : '-'}</strong>
        </div>
        <div className="statBox">
          <span>Top Mood Emotion</span>
          <strong>{topEmotion}</strong>
        </div>
        <div className="statBox">
          <span>Highest Mood Entry</span>
          <strong>{highest ? `${highest.mood_intensity}/10` : '-'}</strong>
        </div>
        <div className="statBox statBox--wide">
          <span>Active Days in Last 7</span>
          <strong>{activeDays}/7</strong>
        </div>
      </div>
    </div>
  );
}
