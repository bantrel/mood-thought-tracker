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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;


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

const emptyForm = {
  activity_behaviour: "",
  mood_emotion: "Neutral",
  mood_intensity: 5,
  automatic_thoughts: "",
  physical_reaction: "",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<
  "dashboard" |
  "mood" |
  "abcd" |
  "review" |
  "history"
>("dashboard");
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    loadRecords();
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

  setAuthMessage("Signed in successfully");
}
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRecords([]);
  }

  async function loadRecords() {
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
      alert(error.message);
      return;
    }


    setRecords(data || []);
  }

  async function saveRecord() {
    if (!supabase || !session?.user) return;


    setSaving(true);


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
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }

    setForm(emptyForm);
    await loadRecords();
    setActiveTab("history");
  }

  async function deleteRecord(id: string) {
    if (!supabase || !session?.user) return;


    const { error } = await supabase
      .from("thought_records")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);


    if (error) {
      alert(error.message);
      return;
    }


    await loadRecords();
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
    return [...records].sort((a, b) => sortTime(a.time).localeCompare(sortTime(b.time)));
  }, [records]);


  const averageIntensity = useMemo(() => {
    if (!sortedRecords.length) return 0;
    const total = sortedRecords.reduce((sum, record) => sum + record.mood_intensity, 0);
    return total / sortedRecords.length;
  }, [sortedRecords]);


  const highestRecord = useMemo(() => {
    if (!sortedRecords.length) return null;
    return [...sortedRecords].sort((a, b) => b.mood_intensity - a.mood_intensity)[0];
  }, [sortedRecords]);


  const emotionCounts = useMemo(() => {
    const counts = sortedRecords.reduce<Record<string, number>>((acc, record) => {
      acc[record.mood_emotion] = (acc[record.mood_emotion] || 0) + 1;
      return acc;
    }, {});


    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count);
  }, [sortedRecords]);


  const topEmotion = emotionCounts[0]?.emotion || "-";


  if (!session) {
    return (
      <>
        <Styles />
        <main className="loginPage">
          <section className="loginCard">
            <div className="logo">♥</div>
            <h1>Mood & Thought Tracker</h1>
            <p>
              Sign in with email. Each person gets a private cloud journal. Thought records are not stored in browser local storage.
            </p>


            {!supabase && (
              <div className="warning">
                Supabase is not configured. Confirm your .env.local file has VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
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

            <button className="primaryButton" onClick={signIn} disabled={!email || loadingAuth}>
              {loadingAuth ? "Sending..." : "Sign In"}
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
            <p>Signed in as {session.user.email}. Records are saved to Supabase for the selected date.</p>
          </div>
          <button className="secondaryButton" onClick={signOut}>Sign out</button>
        </header>

        <section className="dateRow">
          <label>Select day</label>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </section>
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
  <section className="card">
    <h2>Dashboard</h2>

    <div className="statsGrid">
      <div className="statBox">
        <span>Entries Today</span>
        <strong>{records.length}</strong>
      </div>

      <div className="statBox">
        <span>Average Mood</span>
        <strong>{averageIntensity.toFixed(1)}</strong>
      </div>

      <div className="statBox">
        <span>Top Emotion</span>
        <strong>{topEmotion}</strong>
      </div>

      <div className="statBox">
        <span>Status</span>
        <strong>Version 2</strong>
      </div>
    </div>
  </section>
)}  
{activeTab === "abcd" && (
  <section className="card">
    <h2>ABCD Reflection</h2>

    <p>This is where the new REBT/ABCD workflow will live.</p>

    <ul>
      <li>A - Activating Event (Situation)</li>
      <li>B - Belief / Thought</li>
      <li>C - Consequence</li>
      <li>D - Disputation</li>
    </ul>
  </section>
)} 
     {activeTab === "mood" && (
          <section className="gridTwo">
            <div className="card">
              <h2>New Thought Record</h2>
              <label>1) Activity / Behaviour</label>
              <textarea
                value={form.activity_behaviour}
                placeholder="What are you doing? Where are you? Who are you with?"
                onChange={(event) => setForm({ ...form, activity_behaviour: event.target.value })}
              />
              <div className="splitRow">
                <div>
                  <label>2) Mood</label>
                  <select
                    value={form.mood_emotion}
                    onChange={(event) => setForm({ ...form, mood_emotion: event.target.value })}
                  >
                    {emotions.map((emotion) => (
                      <option key={emotion} value={emotion}>{emotion}</option>
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
                    onChange={(event) => setForm({ ...form, mood_intensity: Number(event.target.value) })}
                  />
                </div>
              </div>
              <label>3) Automatic Thoughts</label>
              <textarea
                value={form.automatic_thoughts}
                placeholder="What's on your mind? What are you thinking?"
                onChange={(event) => setForm({ ...form, automatic_thoughts: event.target.value })}
              />
              <label>4) Physical Reaction</label>
              <textarea
                value={form.physical_reaction}
                placeholder="How is your body feeling? e.g., tight chest, headache, tired, restless, tense shoulders"
                onChange={(event) => setForm({ ...form, physical_reaction: event.target.value })}
              />


              <button
                className="primaryButton"
                onClick={saveRecord}
                disabled={saving || (!form.activity_behaviour && !form.automatic_thoughts && !form.physical_reaction)}
              >
                {saving ? "Saving..." : "Save entry at current time"}
              </button>
            </div>

            <SummaryCard
              loading={loadingRecords}
              count={sortedRecords.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
            />
          </section>
        )}
        {activeTab === "review" && (
          <section className="reportStack">
            <SummaryCard
              loading={loadingRecords}
              count={sortedRecords.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
            />
            <div className="card">
              <div className="cardHeaderRow">
                <h2>Daily Report for {selectedDate}</h2>
                <button className="secondaryButton" onClick={exportCsv} disabled={!sortedRecords.length}>Export CSV</button>
              </div>
              {!sortedRecords.length ? (
                <p className="empty">No entries for this day yet.</p>
              ) : (
                <>
                  <p>
                    You recorded <strong>{sortedRecords.length}</strong> entr{sortedRecords.length === 1 ? "y" : "ies"}. Average mood intensity was <strong>{averageIntensity.toFixed(1)}/10</strong>. The most common emotion was <strong>{topEmotion}</strong>.
                  </p>


                  {highestRecord && (
                    <div className="highlightBox">
                      <strong>Highest intensity entry:</strong> {highestRecord.time} - {highestRecord.mood_emotion} at {highestRecord.mood_intensity}/10.
                    </div>
                  )}


                  <h3>Mood Timeline</h3>
                  <div className="timeline">
                    {sortedRecords.map((record) => (
                      <div key={record.id} className="timelineRow">
                        <span>{record.time}</span>
                        <div className="barBackground">
                          <div className="barFill" style={{ width: `${record.mood_intensity * 10}%` }} />
                        </div>
                        <span>{record.mood_emotion} {record.mood_intensity}/10</span>
                      </div>
                    ))}
                  </div>

                  <h3>Emotion Frequency</h3>
                  <div className="emotionList">
                    {emotionCounts.map((item) => (
                      <div key={item.emotion} className="emotionRow">
                        <span>{item.emotion}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        {activeTab === "history" && (
          <section className="card">
            <div className="cardHeaderRow">
              <h2>Entries for {selectedDate}</h2>
              <button className="secondaryButton" onClick={loadRecords}>Refresh</button>
            </div>

            {loadingRecords ? (
              <p className="empty">Loading...</p>
            ) : !sortedRecords.length ? (
              <p className="empty">No entries for this date yet.</p>
            ) : (
              <div className="entriesList">
                {sortedRecords.map((record) => (
                  <article key={record.id} className="entryCard">
                    <div className="entryTop">
                      <strong>{record.time}</strong>
                      <span className={badgeClass(record.mood_intensity)}>{record.mood_emotion} {record.mood_intensity}/10</span>
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


                    <button className="dangerButton" onClick={() => deleteRecord(record.id)}>Delete</button>
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

function SummaryCard({
  loading,
  count,
  average,
  topEmotion,
  highest,
}: {
  loading: boolean;
  count: number;
  average: number;
  topEmotion: string;
  highest: ThoughtRecord | null;
}) {
  return (
    <div className="card">
      <h2>Day at a Glance</h2>
      <div className="statsGrid">
        <div className="statBox">
          <span>Entries</span>
          <strong>{loading ? "..." : count}</strong>
        </div>
        <div className="statBox">
          <span>Average intensity</span>
          <strong>{average.toFixed(1)}/10</strong>
        </div>
        <div className="statBox">
          <span>Top emotion</span>
          <strong>{topEmotion}</strong>
        </div>
        <div className="statBox">
          <span>Highest</span>
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
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      button, input, textarea, select { font: inherit; }
      label { display: block; font-weight: 700; margin-bottom: 0.45rem; color: #334155; }
      input, textarea, select { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 0.8rem 0.9rem; background: white; color: #0f172a; }
      textarea { min-height: 118px; resize: vertical; line-height: 1.45; }
      input[type="range"] { padding-left: 0; padding-right: 0; }
      h1, h2, h3, h4, p { margin-top: 0; }
      .loginPage { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
      .loginCard { width: 100%; max-width: 460px; background: white; border: 1px solid #e2e8f0; border-radius: 28px; padding: 2rem; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
      .logo { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 18px; background: #ffe4e6; color: #e11d48; font-size: 1.8rem; margin-bottom: 1rem; }
      .loginCard h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
      .loginCard p { color: #475569; line-height: 1.55; }
      .warning { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 0.85rem; border-radius: 14px; margin: 1rem 0; }
      .message { margin-top: 1rem; color: #475569; }
      .appShell { width: min(1180px, 100%); margin: 0 auto; padding: 1rem; }
      .topBar { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin: 1rem 0 1.5rem; }
      .topBar h1 { margin-bottom: 0.35rem; font-size: clamp(1.8rem, 3vw, 2.6rem); }
      .topBar p { color: #475569; line-height: 1.45; }
      .dateRow { display: flex; align-items: center; gap: 0.75rem; background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 1rem; margin-bottom: 1rem; width: fit-content; }
      .dateRow label { margin: 0; white-space: nowrap; }
      .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; background: #e2e8f0; border-radius: 18px; padding: 0.35rem; margin-bottom: 1rem; max-width: 520px; }
      .tabs button { border: 0; border-radius: 14px; padding: 0.8rem; background: transparent; cursor: pointer; color: #475569; font-weight: 700; }
      .tabs button.active { background: white; color: #0f172a; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
      .gridTwo { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr); gap: 1rem; align-items: start; }
      .reportStack { display: grid; gap: 1rem; }
      .card { background: white; border: 1px solid #e2e8f0; border-radius: 24px; padding: 1.25rem; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); }
      .card h2 { margin-bottom: 1rem; }
      .cardHeaderRow { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
      .splitRow { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .primaryButton, .secondaryButton, .dangerButton { border: 0; border-radius: 14px; padding: 0.85rem 1rem; cursor: pointer; font-weight: 800; }
      .primaryButton { width: 100%; background: #4f46e5; color: white; margin-top: 1rem; }
      .secondaryButton { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
      .dangerButton { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; margin-top: 1rem; }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
      .statsGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
      .statBox { border: 1px solid #e2e8f0; border-radius: 18px; padding: 1rem; background: #f8fafc; }
      .statBox span { display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.03em; }
      .statBox strong { font-size: 1.4rem; }
      .highlightBox { border: 1px solid #fecdd3; background: #fff1f2; color: #881337; border-radius: 18px; padding: 1rem; margin: 1rem 0; }
      .timeline { display: grid; gap: 0.65rem; margin-bottom: 1.5rem; }
      .timelineRow { display: grid; grid-template-columns: 90px 1fr 180px; gap: 0.75rem; align-items: center; color: #334155; }
      .barBackground { height: 14px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
      .barFill { height: 100%; background: linear-gradient(90deg, #6366f1, #f43f5e); border-radius: 999px; }
      .emotionList { display: grid; gap: 0.5rem; }
      .emotionRow { display: flex; justify-content: space-between; border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.75rem 0.9rem; background: #f8fafc; }
      .entriesList { display: grid; gap: 1rem; }
      .entryCard { border: 1px solid #e2e8f0; border-radius: 20px; padding: 1rem; background: #ffffff; }
      .entryTop { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 1rem; }
      .entryGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
      .entryGrid h4 { margin-bottom: 0.35rem; font-size: 0.9rem; color: #334155; }
      .entryGrid p { color: #475569; line-height: 1.5; white-space: pre-wrap; }
      .badge { display: inline-block; border-radius: 999px; padding: 0.35rem 0.65rem; border: 1px solid; font-weight: 800; white-space: nowrap; }
      .badge.green { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
      .badge.yellow { background: #fef3c7; color: #92400e; border-color: #fde68a; }
      .badge.red { background: #ffe4e6; color: #be123c; border-color: #fecdd3; }
      .empty { color: #64748b; padding: 1rem 0; }
      @media (max-width: 820px) {
        .topBar { flex-direction: column; }
        .gridTwo { grid-template-columns: 1fr; }
        .dateRow { width: 100%; flex-direction: column; align-items: stretch; }
        .splitRow { grid-template-columns: 1fr; }
        .entryGrid { grid-template-columns: 1fr; }
        .timelineRow { grid-template-columns: 1fr; }
        .tabs { max-width: none; }
        .cardHeaderRow { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
