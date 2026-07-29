import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

type ThoughtRecord = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  activity_behaviour: string | null;
  mood_emotion: string;
  mood_intensity: number;
  automatic_thoughts: string | null;
  physical_reaction: string | null;
  inserted_at?: string;
};

type ABCDEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  created_at: string;
  activating_event: string;
  belief: string;
  emotion: string;
  emotion_intensity: number;
  behavioural_consequence: string | null;
  physical_consequence: string | null;
  evidence_for: string | null;
  evidence_against: string | null;
  balanced_perspective: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const emotions = [
  "Happy",
  "Calm",
  "Content",
  "Neutral",
  "Anxious",
  "Sad",
  "Angry",
  "Frustrated",
  "Overwhelmed",
  "Tired",
  "Excited",
  "Guilty",
  "Ashamed",
  "Hopeful",
];

const abcdEmotions = [
  "Anxiety",
  "Fear",
  "Anger",
  "Sadness",
  "Guilt",
  "Shame",
  "Frustration",
  "Hope",
  "Relief",
];

const emptyMoodForm = {
  activity_behaviour: "",
  mood_emotion: "Neutral",
  mood_intensity: 5,
  automatic_thoughts: "",
  physical_reaction: "",
};

const emptyABCDForm = {
  activating_event: "",
  belief: "",
  emotion: "Anxiety",
  emotion_intensity: 5,
  behavioural_consequence: "",
  physical_consequence: "",
  evidence_for: "",
  evidence_against: "",
  balanced_perspective: "",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortTime(value: string) {
  const match = value.match(/(\d+):(\d+)\s?(AM|PM)?/i);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3]?.toUpperCase();

  if (suffix === "PM" && hour !== 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeClass(intensity: number) {
  if (intensity <= 3) return "badge green";
  if (intensity <= 6) return "badge yellow";
  return "badge red";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayIso());

  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [abcdEntries, setAbcdEntries] = useState<ABCDEntry[]>([]);

  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savingMood, setSavingMood] = useState(false);
  const [savingABCD, setSavingABCD] = useState(false);

  const [form, setForm] = useState(emptyMoodForm);
  const [abcdForm, setAbcdForm] = useState(emptyABCDForm);

  const [statusMessage, setStatusMessage] = useState("");

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "mood" | "abcd" | "review" | "history"
  >("dashboard");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) return;

    loadMoodRecords();
    loadABCDEntries();
  }, [session?.user?.id, selectedDate]);

  async function signIn() {
    if (!supabase) return;

    setLoadingAuth(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoadingAuth(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("Signed in successfully.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRecords([]);
    setAbcdEntries([]);
  }

  async function loadMoodRecords() {
    if (!supabase || !session?.user) return;

    setLoadingRecords(true);

    const { data, error } = await supabase
      .from("thought_records")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", selectedDate)
      .order("time", { ascending: true });

    setLoadingRecords(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setRecords(data ?? []);
  }

  async function loadABCDEntries() {
    if (!supabase || !session?.user) return;

    const { data, error } = await supabase
      .from("abcd_entries")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("entry_date", selectedDate)
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setAbcdEntries(data ?? []);
  }

  async function saveMoodRecord() {
    if (!supabase || !session?.user) return;

    setSavingMood(true);
    setStatusMessage("");

    const { error } = await supabase.from("thought_records").insert({
      user_id: session.user.id,
      date: selectedDate,
      time: nowTime(),
      activity_behaviour: form.activity_behaviour,
      mood_emotion: form.mood_emotion,
      mood_intensity: form.mood_intensity,
      automatic_thoughts: form.automatic_thoughts,
      physical_reaction: form.physical_reaction,
    });

    setSavingMood(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setForm(emptyMoodForm);
    setStatusMessage("Quick Check-In saved.");
    await loadMoodRecords();
    setActiveTab("history");
  }

  async function saveABCDEntry() {
    if (!supabase || !session?.user) return;

    setSavingABCD(true);
    setStatusMessage("");

    const { error } = await supabase.from("abcd_entries").insert({
      user_id: session.user.id,
      entry_date: selectedDate,
      ...abcdForm,
    });

    setSavingABCD(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setAbcdForm(emptyABCDForm);
    setStatusMessage("ABCD Reflection saved.");
    await loadABCDEntries();
    setActiveTab("review");
  }

  async function deleteMoodRecord(id: string) {
    if (!supabase || !session?.user) return;

    const { error } = await supabase
      .from("thought_records")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    await loadMoodRecords();
  }

  function exportCsv() {
    const header = [
      "Date",
      "Time",
      "Activity/Behaviour",
      "Mood Emotion",
      "Mood Intensity",
      "Automatic Thoughts",
      "Physical Reaction",
    ];

    const rows = sortedRecords.map((record) => [
      record.date,
      record.time,
      record.activity_behaviour || "",
      record.mood_emotion,
      String(record.mood_intensity),
      record.automatic_thoughts || "",
      record.physical_reaction || "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thought-records-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      sortTime(a.time).localeCompare(sortTime(b.time))
    );
  }, [records]);

  const averageIntensity = useMemo(() => {
    if (!sortedRecords.length) return 0;
    const total = sortedRecords.reduce(
      (sum, record) => sum + record.mood_intensity,
      0
    );
    return total / sortedRecords.length;
  }, [sortedRecords]);

  const highestRecord = useMemo(() => {
    if (!sortedRecords.length) return null;
    return [...sortedRecords].sort(
      (a, b) => b.mood_intensity - a.mood_intensity
    )[0];
  }, [sortedRecords]);

  const emotionCounts = useMemo(() => {
    const counts = sortedRecords.reduce<Record<string, number>>(
      (acc, record) => {
        acc[record.mood_emotion] = (acc[record.mood_emotion] || 0) + 1;
        return acc;
      },
      {}
    );

    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count);
  }, [sortedRecords]);

  const topEmotion = emotionCounts[0]?.emotion || "-";

  const recentActivity = useMemo(() => {
    const moodItems = sortedRecords.map((record) => ({
      id: record.id,
      type: "Quick Check-In",
      time: record.time,
      title: record.mood_emotion,
      detail: record.automatic_thoughts || record.activity_behaviour || "",
      sortValue: `${record.date} ${sortTime(record.time)}`,
    }));

    const abcdItems = abcdEntries.map((entry) => ({
      id: entry.id,
      type: "ABCD Reflection",
      time: formatDateTime(entry.created_at),
      title: entry.emotion,
      detail: entry.belief || entry.activating_event || "",
      sortValue: entry.created_at,
    }));

    return [...moodItems, ...abcdItems]
      .sort((a, b) => b.sortValue.localeCompare(a.sortValue))
      .slice(0, 6);
  }, [sortedRecords, abcdEntries]);

  if (!session) {
    return (
      <>
        <Styles />
        <main className="loginPage">
          <section className="loginCard">
            <div className="logo">♥</div>
            <h1>Mood & Thought Tracker</h1>
            <p>
              Sign in with email and password. Each person gets a private cloud
              journal.
            </p>

            {!supabase && (
              <div className="warning">
                Supabase is not configured. Confirm your environment variables
                are set.
              </div>
            )}

            <label>Email address</label>
            <input
              type="email"
              value={email}
              placeholder="name@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button
              className="primaryButton"
              onClick={signIn}
              disabled={!email || !password || loadingAuth}
            >
              {loadingAuth ? "Signing in..." : "Sign In"}
            </button>

            {authMessage && <p className="message">{authMessage}</p>}
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Styles />
      <main className="appShell">
        <header className="topBar">
          <div>
            <h1>Mood & Thought Tracker</h1>
            <p>
              Signed in as {session.user.email}. Records are saved to Supabase
              for the selected date.
            </p>
          </div>

          <button className="secondaryButton" onClick={signOut}>
            Sign out
          </button>
        </header>

        <section className="dateRow">
          <label>Select day</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </section>

        {statusMessage && <div className="statusBox">{statusMessage}</div>}

        <nav className="tabs">
          <button
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activeTab === "mood" ? "active" : ""}
            onClick={() => setActiveTab("mood")}
          >
            Quick Check-In
          </button>

          <button
            className={activeTab === "abcd" ? "active" : ""}
            onClick={() => setActiveTab("abcd")}
          >
            ABCD Reflection
          </button>

          <button
            className={activeTab === "review" ? "active" : ""}
            onClick={() => setActiveTab("review")}
          >
            Review
          </button>

          <button
            className={activeTab === "history" ? "active" : ""}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </nav>

        {activeTab === "dashboard" && (
          <section className="dashboardGrid">
            <DayAtAGlance
              loading={loadingRecords}
              quickCheckIns={sortedRecords.length}
              abcdReflections={abcdEntries.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
            />

            <div className="card">
              <h2>Recent Activity</h2>

              {!recentActivity.length ? (
                <p className="empty">No activity for this date yet.</p>
              ) : (
                <div className="activityList">
                  {recentActivity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="activityRow">
                      <div>
                        <strong>{item.type}</strong>
                        <p>{item.detail || "-"}</p>
                      </div>
                      <span>{item.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "mood" && (
          <section className="gridTwo">
            <div className="card">
              <h2>Quick Check-In</h2>

              <label>1) Activity / Behaviour</label>
              <textarea
                value={form.activity_behaviour}
                placeholder="What are you doing? Where are you? Who are you with?"
                onChange={(event) =>
                  setForm({ ...form, activity_behaviour: event.target.value })
                }
              />

              <div className="splitRow">
                <div>
                  <label>2) Mood</label>
                  <select
                    value={form.mood_emotion}
                    onChange={(event) =>
                      setForm({ ...form, mood_emotion: event.target.value })
                    }
                  >
                    {emotions.map((emotion) => (
                      <option key={emotion} value={emotion}>
                        {emotion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Intensity: {form.mood_intensity}/10</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={form.mood_intensity}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        mood_intensity: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <label>3) Automatic Thoughts</label>
              <textarea
                value={form.automatic_thoughts}
                placeholder="What's on your mind? What are you thinking?"
                onChange={(event) =>
                  setForm({ ...form, automatic_thoughts: event.target.value })
                }
              />

              <label>4) Physical Reaction</label>
              <textarea
                value={form.physical_reaction}
                placeholder="How is your body feeling?"
                onChange={(event) =>
                  setForm({ ...form, physical_reaction: event.target.value })
                }
              />

              <button
                className="primaryButton"
                onClick={saveMoodRecord}
                disabled={
                  savingMood ||
                  (!form.activity_behaviour &&
                    !form.automatic_thoughts &&
                    !form.physical_reaction)
                }
              >
                {savingMood ? "Saving..." : "Save Quick Check-In"}
              </button>
            </div>

            <DayAtAGlance
              loading={loadingRecords}
              quickCheckIns={sortedRecords.length}
              abcdReflections={abcdEntries.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
            />
          </section>
        )}

        {activeTab === "abcd" && (
          <section className="card">
            <h2>ABCD Reflection</h2>

            <label>A - Activating Event / Situation</label>
            <textarea
              value={abcdForm.activating_event}
              placeholder="What happened? Who was involved? What triggered this?"
              onChange={(e) =>
                setAbcdForm({
                  ...abcdForm,
                  activating_event: e.target.value,
                })
              }
            />

            <label>B - Belief / Thought</label>
            <textarea
              value={abcdForm.belief}
              placeholder="What did you tell yourself? What meaning did you attach to the situation?"
              onChange={(e) =>
                setAbcdForm({ ...abcdForm, belief: e.target.value })
              }
            />

            <div className="splitRow">
              <div>
                <label>C - Emotion</label>
                <select
                  value={abcdForm.emotion}
                  onChange={(e) =>
                    setAbcdForm({ ...abcdForm, emotion: e.target.value })
                  }
                >
                  {abcdEmotions.map((emotion) => (
                    <option key={emotion}>{emotion}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>
                  Emotion Intensity: {abcdForm.emotion_intensity}/10
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={abcdForm.emotion_intensity}
                  onChange={(e) =>
                    setAbcdForm({
                      ...abcdForm,
                      emotion_intensity: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <label>Behavioural Consequence</label>
            <textarea
              value={abcdForm.behavioural_consequence}
              placeholder="What did you do next?"
              onChange={(e) =>
                setAbcdForm({
                  ...abcdForm,
                  behavioural_consequence: e.target.value,
                })
              }
            />

            <label>Physical Consequence</label>
            <textarea
              value={abcdForm.physical_consequence}
              placeholder="How did your body react?"
              onChange={(e) =>
                setAbcdForm({
                  ...abcdForm,
                  physical_consequence: e.target.value,
                })
              }
            />

            <label>D - Evidence For</label>
            <textarea
              value={abcdForm.evidence_for}
              placeholder="What evidence supports this belief?"
              onChange={(e) =>
                setAbcdForm({ ...abcdForm, evidence_for: e.target.value })
              }
            />

            <label>Evidence Against</label>
            <textarea
              value={abcdForm.evidence_against}
              placeholder="What evidence does not support this belief?"
              onChange={(e) =>
                setAbcdForm({ ...abcdForm, evidence_against: e.target.value })
              }
            />

            <label>Balanced Perspective</label>
            <textarea
              value={abcdForm.balanced_perspective}
              placeholder="What is a more balanced perspective?"
              onChange={(e) =>
                setAbcdForm({
                  ...abcdForm,
                  balanced_perspective: e.target.value,
                })
              }
            />

            <button
              className="primaryButton"
              onClick={saveABCDEntry}
              disabled={
                savingABCD ||
                !abcdForm.activating_event ||
                !abcdForm.belief
              }
            >
              {savingABCD ? "Saving..." : "Save ABCD Reflection"}
            </button>
          </section>
        )}

        {activeTab === "review" && (
          <section className="reportStack">
            <div className="card">
              <h2>ABCD Reflections</h2>
              <p>Total Reflections: {abcdEntries.length}</p>

              {!abcdEntries.length ? (
                <p className="empty">No ABCD reflections for this date yet.</p>
              ) : (
                abcdEntries.map((entry) => (
                  <div key={entry.id} className="reflectionCard">
                    <strong>A - Activating Event</strong>
                    <p>{entry.activating_event}</p>

                    <strong>B - Belief</strong>
                    <p>{entry.belief}</p>

                    <strong>C - Consequence</strong>
                    <p>
                      {entry.emotion} ({entry.emotion_intensity}/10)
                    </p>
                    <p>{entry.behavioural_consequence || "-"}</p>
                    <p>{entry.physical_consequence || "-"}</p>

                    <strong>D - Disputation</strong>
                    <p>{entry.evidence_for || "-"}</p>
                    <p>{entry.evidence_against || "-"}</p>
                    <p>{entry.balanced_perspective || "-"}</p>
                  </div>
                ))
              )}
            </div>

            <DayAtAGlance
              loading={loadingRecords}
              quickCheckIns={sortedRecords.length}
              abcdReflections={abcdEntries.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
            />

            <div className="card">
              <div className="cardHeaderRow">
                <h2>Quick Check-In Review for {selectedDate}</h2>
                <button
                  className="secondaryButton"
                  onClick={exportCsv}
                  disabled={!sortedRecords.length}
                >
                  Export CSV
                </button>
              </div>

              {!sortedRecords.length ? (
                <p className="empty">No quick check-ins for this day yet.</p>
              ) : (
                <>
                  <p>
                    You recorded <strong>{sortedRecords.length}</strong> quick
                    check-in entr{sortedRecords.length === 1 ? "y" : "ies"}.
                    Average mood intensity was{" "}
                    <strong>{averageIntensity.toFixed(1)}/10</strong>. The most
                    common mood was <strong>{topEmotion}</strong>.
                  </p>

                  {highestRecord && (
                    <div className="highlightBox">
                      <strong>Highest intensity entry:</strong>{" "}
                      {highestRecord.time} - {highestRecord.mood_emotion} at{" "}
                      {highestRecord.mood_intensity}/10.
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="card">
            <div className="cardHeaderRow">
              <h2>Quick Check-In History for {selectedDate}</h2>
              <button className="secondaryButton" onClick={loadMoodRecords}>
                Refresh
              </button>
            </div>

            {loadingRecords ? (
              <p className="empty">Loading...</p>
            ) : !sortedRecords.length ? (
              <p className="empty">No quick check-ins for this date yet.</p>
            ) : (
              <div className="entriesList">
                {sortedRecords.map((record) => (
                  <article key={record.id} className="entryCard">
                    <div className="entryTop">
                      <strong>{record.time}</strong>
                      <span className={badgeClass(record.mood_intensity)}>
                        {record.mood_emotion} {record.mood_intensity}/10
                      </span>
                    </div>

                    <div className="entryGrid">
                      <div>
                        <h4>Activity / Behaviour</h4>
                        <p>{record.activity_behaviour || "-"}</p>
                      </div>

                      <div>
                        <h4>Automatic Thoughts</h4>
                        <p>{record.automatic_thoughts || "-"}</p>
                      </div>

                      <div>
                        <h4>Physical Reaction</h4>
                        <p>{record.physical_reaction || "-"}</p>
                      </div>
                    </div>

                    <button
                      className="dangerButton"
                      onClick={() => deleteMoodRecord(record.id)}
                    >
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}

function DayAtAGlance({
  loading,
  quickCheckIns,
  abcdReflections,
  average,
  topEmotion,
  highest,
}: {
  loading: boolean;
  quickCheckIns: number;
  abcdReflections: number;
  average: number;
  topEmotion: string;
  highest: ThoughtRecord | null;
}) {
  const totalActivity = quickCheckIns + abcdReflections;

  return (
    <div className="card">
      <h2>Day at a Glance</h2>

      <div className="statsGrid">
        <div className="statBox">
          <span>Total Activity</span>
          <strong>{loading ? "..." : totalActivity}</strong>
        </div>

        <div className="statBox">
          <span>Quick Check-Ins</span>
          <strong>{loading ? "..." : quickCheckIns}</strong>
        </div>

        <div className="statBox">
          <span>ABCD Reflections</span>
          <strong>{abcdReflections}</strong>
        </div>

        <div className="statBox">
          <span>Average Mood Intensity</span>
          <strong>{average.toFixed(1)}/10</strong>
        </div>

        <div className="statBox">
          <span>Top Mood Emotion</span>
          <strong>{topEmotion}</strong>
        </div>

        <div className="statBox">
          <span>Highest Mood Entry</span>
          <strong>{highest ? `${highest.mood_intensity}/10` : "-"}</strong>
        </div>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }

      button, input, textarea, select {
        font: inherit;
      }

      label {
        display: block;
        font-weight: 700;
        margin-bottom: 0.45rem;
        color: #334155;
      }

      input, textarea, select {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        padding: 0.8rem 0.9rem;
        background: white;
        color: #0f172a;
        margin-bottom: 1rem;
      }

      textarea {
        min-height: 118px;
        resize: vertical;
        line-height: 1.45;
      }

      input[type="range"] {
        padding-left: 0;
        padding-right: 0;
      }

      h1, h2, h3, h4, p {
        margin-top: 0;
      }

      .loginPage {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .loginCard {
        width: 100%;
        max-width: 460px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 28px;
        padding: 2rem;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
      }

      .logo {
        width: 50px;
        height: 50px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: #ffe4e6;
        color: #e11d48;
        font-size: 1.8rem;
        margin-bottom: 1rem;
      }

      .warning {
        background: #fef3c7;
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 0.85rem;
        border-radius: 14px;
        margin: 1rem 0;
      }

      .message,
      .statusBox {
        color: #475569;
      }

      .statusBox {
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        border-radius: 16px;
        padding: 0.8rem 1rem;
        margin-bottom: 1rem;
      }

      .appShell {
        width: min(1180px, 100%);
        margin: 0 auto;
        padding: 1rem;
      }

      .topBar {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin: 1rem 0 1.5rem;
      }

      .topBar h1 {
        margin-bottom: 0.35rem;
        font-size: clamp(1.8rem, 3vw, 2.6rem);
      }

      .topBar p {
        color: #475569;
        line-height: 1.45;
      }

      .dateRow {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 1rem;
        margin-bottom: 1rem;
        width: fit-content;
      }

      .dateRow label {
        margin: 0;
        white-space: nowrap;
      }

      .tabs {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 0.35rem;
        background: #e2e8f0;
        border-radius: 18px;
        padding: 0.35rem;
        margin-bottom: 1rem;
      }

      .tabs button {
        border: 0;
        border-radius: 14px;
        padding: 0.8rem;
        background: transparent;
        cursor: pointer;
        color: #475569;
        font-weight: 700;
      }

      .tabs button.active {
        background: white;
        color: #0f172a;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
      }

      .dashboardGrid,
      .gridTwo {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
        gap: 1rem;
        align-items: start;
      }

      .reportStack {
        display: grid;
        gap: 1rem;
      }

      .card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        padding: 1.25rem;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
      }

      .card h2 {
        margin-bottom: 1rem;
      }

      .cardHeaderRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .splitRow {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .primaryButton,
      .secondaryButton,
      .dangerButton {
        border: 0;
        border-radius: 14px;
        padding: 0.85rem 1rem;
        cursor: pointer;
        font-weight: 800;
      }

      .primaryButton {
        width: 100%;
        background: #4f46e5;
        color: white;
        margin-top: 1rem;
      }

      .secondaryButton {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }

      .dangerButton {
        background: #fff1f2;
        color: #be123c;
        border: 1px solid #fecdd3;
        margin-top: 1rem;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .statsGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .statBox {
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 1rem;
        background: #f8fafc;
      }

      .statBox span {
        display: block;
        font-size: 0.8rem;
        color: #64748b;
        margin-bottom: 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .statBox strong {
        font-size: 1.4rem;
      }

      .highlightBox {
        border: 1px solid #fecdd3;
        background: #fff1f2;
        color: #881337;
        border-radius: 18px;
        padding: 1rem;
        margin: 1rem 0;
      }

      .activityList,
      .entriesList {
        display: grid;
        gap: 1rem;
      }

      .activityRow,
      .entryCard,
      .reflectionCard {
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 1rem;
        background: #ffffff;
      }

      .activityRow {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }

      .activityRow p,
      .entryGrid p,
      .reflectionCard p {
        color: #475569;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .entryTop {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
      }

      .entryGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .entryGrid h4 {
        margin-bottom: 0.35rem;
        font-size: 0.9rem;
        color: #334155;
      }

      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 0.35rem 0.65rem;
        border: 1px solid;
        font-weight: 800;
        white-space: nowrap;
      }

      .badge.green {
        background: #dcfce7;
        color: #166534;
        border-color: #bbf7d0;
      }

      .badge.yellow {
        background: #fef3c7;
        color: #92400e;
        border-color: #fde68a;
      }

      .badge.red {
        background: #ffe4e6;
        color: #be123c;
        border-color: #fecdd3;
      }

      .empty {
        color: #64748b;
        padding: 1rem 0;
      }

      @media (max-width: 820px) {
        .topBar {
          flex-direction: column;
        }

        .dashboardGrid,
        .gridTwo {
          grid-template-columns: 1fr;
        }

        .dateRow {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
        }

        .splitRow {
          grid-template-columns: 1fr;
        }

        .entryGrid {
          grid-template-columns: 1fr;
        }

        .tabs {
          grid-template-columns: 1fr;
        }

        .cardHeaderRow,
        .activityRow {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `}</style>
  );
}