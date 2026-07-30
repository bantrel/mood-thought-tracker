import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import { AuthPanel } from './components/AuthPanel';
import { DayAtAGlance } from './components/DayAtAGlance';
import { TrendSummary } from './components/TrendSummary';
import {
  buildDateRange,
  currentLocalTime,
  formatDateTime,
  formatShortDate,
  normalizeSortableTime,
  shiftIsoDate,
  todayLocalIso,
} from './lib/date';
import { abcdEntryColumns, supabase, supabaseConfigured, thoughtRecordColumns } from './lib/supabase';
import type { ABCDEntry, ABCDFormState, AuthMode, MoodFormState, Notice, ThoughtRecord } from './types';

const emotions = [
  'Happy',
  'Calm',
  'Content',
  'Neutral',
  'Anxious',
  'Sad',
  'Angry',
  'Frustrated',
  'Overwhelmed',
  'Tired',
  'Excited',
  'Guilty',
  'Ashamed',
  'Hopeful',
];

const abcdEmotions = ['Anxiety', 'Fear', 'Anger', 'Sadness', 'Guilt', 'Shame', 'Frustration', 'Hope', 'Relief'];

function createEmptyMoodForm(): MoodFormState {
  return {
    time: currentLocalTime(),
    activity_behaviour: '',
    mood_emotion: 'Neutral',
    mood_intensity: 5,
    automatic_thoughts: '',
    physical_reaction: '',
  };
}

function createEmptyABCDForm(): ABCDFormState {
  return {
    activating_event: '',
    belief: '',
    emotion: 'Anxiety',
    emotion_intensity: 5,
    behavioural_consequence: '',
    physical_consequence: '',
    evidence_for: '',
    evidence_against: '',
    balanced_perspective: '',
  };
}

function badgeClass(intensity: number) {
  if (intensity <= 3) return 'badge badge--green';
  if (intensity <= 6) return 'badge badge--yellow';
  return 'badge badge--red';
}

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [authNotice, setAuthNotice] = useState<Notice | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayLocalIso());
  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [abcdEntries, setAbcdEntries] = useState<ABCDEntry[]>([]);
  const [trendMoodRecords, setTrendMoodRecords] = useState<ThoughtRecord[]>([]);
  const [trendAbcdEntries, setTrendAbcdEntries] = useState<ABCDEntry[]>([]);

  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savingMood, setSavingMood] = useState(false);
  const [savingABCD, setSavingABCD] = useState(false);
  const [deletingMoodId, setDeletingMoodId] = useState<string | null>(null);
  const [deletingABCDId, setDeletingABCDId] = useState<string | null>(null);

  const [form, setForm] = useState<MoodFormState>(createEmptyMoodForm());
  const [abcdForm, setAbcdForm] = useState<ABCDFormState>(createEmptyABCDForm());
  const [editingMoodId, setEditingMoodId] = useState<string | null>(null);
  const [editingABCDId, setEditingABCDId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<Notice | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'mood' | 'abcd' | 'review' | 'history'>('dashboard');

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        setRecords([]);
        setAbcdEntries([]);
        setTrendMoodRecords([]);
        setTrendAbcdEntries([]);
        setEditingMoodId(null);
        setEditingABCDId(null);
        setForm(createEmptyMoodForm());
        setAbcdForm(createEmptyABCDForm());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchAndStoreData(userId: string, date: string, options?: { cancelled?: () => boolean }) {
    if (!supabase) return;
    if (options?.cancelled?.()) return;

    setLoadingRecords(true);
    setLoadingInsights(true);

    const startDate = shiftIsoDate(date, -6);
    const [dayMood, dayAbcd, trendMood, trendAbcd] = await Promise.all([
      supabase
        .from('thought_records')
        .select(thoughtRecordColumns)
        .eq('user_id', userId)
        .eq('date', date)
        .order('time', { ascending: true }),
      supabase
        .from('abcd_entries')
        .select(abcdEntryColumns)
        .eq('user_id', userId)
        .eq('entry_date', date)
        .order('created_at', { ascending: false }),
      supabase
        .from('thought_records')
        .select(thoughtRecordColumns)
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', date)
        .order('date', { ascending: true })
        .order('time', { ascending: true }),
      supabase
        .from('abcd_entries')
        .select(abcdEntryColumns)
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', date)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (options?.cancelled?.()) return;

    setLoadingRecords(false);
    setLoadingInsights(false);

    const firstError = dayMood.error ?? dayAbcd.error ?? trendMood.error ?? trendAbcd.error;
    if (firstError) {
      setStatusNotice({ tone: 'error', text: firstError.message });
      return;
    }

    setRecords(((dayMood.data ?? []) as unknown) as ThoughtRecord[]);
    setAbcdEntries(((dayAbcd.data ?? []) as unknown) as ABCDEntry[]);
    setTrendMoodRecords(((trendMood.data ?? []) as unknown) as ThoughtRecord[]);
    setTrendAbcdEntries(((trendAbcd.data ?? []) as unknown) as ABCDEntry[]);
  }

  useEffect(() => {
    const userId = session?.user?.id;
    if (!supabase || !userId) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void fetchAndStoreData(userId, selectedDate, {
        cancelled: () => cancelled,
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedDate, session?.user?.id]);

  async function submitAuth() {
    if (!supabase) return;

    setLoadingAuth(true);
    setAuthNotice(null);

    const trimmedEmail = email.trim();

    if (authMode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: passphrase });
      setLoadingAuth(false);
      setAuthNotice(
        error
          ? { tone: 'error', text: error.message }
          : { tone: 'success', text: 'Signed in successfully.' },
      );
      return;
    }

    if (authMode === 'signUp') {
      const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password: passphrase });
      setLoadingAuth(false);

      if (error) {
        setAuthNotice({ tone: 'error', text: error.message });
        return;
      }

      setAuthNotice({
        tone: 'success',
        text: data.session
          ? 'Account created and signed in.'
          : 'Account created. Check your inbox to confirm your email before signing in.',
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: window.location.origin,
    });

    setLoadingAuth(false);
    setAuthNotice(
      error
        ? { tone: 'error', text: error.message }
        : { tone: 'info', text: 'If an account exists for this email, a reset link has been sent.' },
    );
  }

  async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatusNotice({ tone: 'error', text: error.message });
      return;
    }

    setStatusNotice({ tone: 'info', text: 'Signed out.' });
  }

  async function saveMoodRecord() {
    const userId = session?.user?.id;
    if (!supabase || !userId) return;

    setSavingMood(true);
    setStatusNotice(null);

    const payload = {
      user_id: userId,
      date: selectedDate,
      time: form.time,
      activity_behaviour: toNullableText(form.activity_behaviour),
      mood_emotion: form.mood_emotion,
      mood_intensity: form.mood_intensity,
      automatic_thoughts: toNullableText(form.automatic_thoughts),
      physical_reaction: toNullableText(form.physical_reaction),
    };

    const result = editingMoodId
      ? await supabase.from('thought_records').update(payload).eq('id', editingMoodId).eq('user_id', userId)
      : await supabase.from('thought_records').insert(payload);

    setSavingMood(false);

    if (result.error) {
      setStatusNotice({ tone: 'error', text: result.error.message });
      return;
    }

    setEditingMoodId(null);
    setForm(createEmptyMoodForm());
    setStatusNotice({
      tone: 'success',
      text: editingMoodId ? 'Quick Check-In updated.' : 'Quick Check-In saved.',
    });
    await fetchAndStoreData(userId, selectedDate);
    setActiveTab('history');
  }

  async function saveABCDEntry() {
    const userId = session?.user?.id;
    if (!supabase || !userId) return;

    setSavingABCD(true);
    setStatusNotice(null);

    const payload = {
      user_id: userId,
      entry_date: selectedDate,
      activating_event: abcdForm.activating_event.trim(),
      belief: abcdForm.belief.trim(),
      emotion: abcdForm.emotion,
      emotion_intensity: abcdForm.emotion_intensity,
      behavioural_consequence: toNullableText(abcdForm.behavioural_consequence),
      physical_consequence: toNullableText(abcdForm.physical_consequence),
      evidence_for: toNullableText(abcdForm.evidence_for),
      evidence_against: toNullableText(abcdForm.evidence_against),
      balanced_perspective: toNullableText(abcdForm.balanced_perspective),
    };

    const result = editingABCDId
      ? await supabase.from('abcd_entries').update(payload).eq('id', editingABCDId).eq('user_id', userId)
      : await supabase.from('abcd_entries').insert(payload);

    setSavingABCD(false);

    if (result.error) {
      setStatusNotice({ tone: 'error', text: result.error.message });
      return;
    }

    setEditingABCDId(null);
    setAbcdForm(createEmptyABCDForm());
    setStatusNotice({
      tone: 'success',
      text: editingABCDId ? 'ABCD Reflection updated.' : 'ABCD Reflection saved.',
    });
    await fetchAndStoreData(userId, selectedDate);
    setActiveTab('review');
  }

  async function deleteMoodRecord(id: string) {
    const userId = session?.user?.id;
    if (!supabase || !userId) return;
    if (!window.confirm('Delete this quick check-in?')) return;

    setDeletingMoodId(id);

    const { error } = await supabase.from('thought_records').delete().eq('id', id).eq('user_id', userId);

    setDeletingMoodId(null);

    if (error) {
      setStatusNotice({ tone: 'error', text: error.message });
      return;
    }

    if (editingMoodId === id) {
      setEditingMoodId(null);
      setForm(createEmptyMoodForm());
    }

    setStatusNotice({ tone: 'success', text: 'Quick Check-In deleted.' });
    await fetchAndStoreData(userId, selectedDate);
  }

  async function deleteABCDEntry(id: string) {
    const userId = session?.user?.id;
    if (!supabase || !userId) return;
    if (!window.confirm('Delete this ABCD reflection?')) return;

    setDeletingABCDId(id);

    const { error } = await supabase.from('abcd_entries').delete().eq('id', id).eq('user_id', userId);

    setDeletingABCDId(null);

    if (error) {
      setStatusNotice({ tone: 'error', text: error.message });
      return;
    }

    if (editingABCDId === id) {
      setEditingABCDId(null);
      setAbcdForm(createEmptyABCDForm());
    }

    setStatusNotice({ tone: 'success', text: 'ABCD Reflection deleted.' });
    await fetchAndStoreData(userId, selectedDate);
  }

  function editMoodRecord(record: ThoughtRecord) {
    setEditingMoodId(record.id);
    setForm({
      time: normalizeSortableTime(record.time),
      activity_behaviour: record.activity_behaviour ?? '',
      mood_emotion: record.mood_emotion,
      mood_intensity: record.mood_intensity,
      automatic_thoughts: record.automatic_thoughts ?? '',
      physical_reaction: record.physical_reaction ?? '',
    });
    setStatusNotice({ tone: 'info', text: 'Editing Quick Check-In. Save to apply your changes.' });
    setActiveTab('mood');
  }

  function editABCDRecord(entry: ABCDEntry) {
    setEditingABCDId(entry.id);
    setAbcdForm({
      activating_event: entry.activating_event,
      belief: entry.belief,
      emotion: entry.emotion,
      emotion_intensity: entry.emotion_intensity,
      behavioural_consequence: entry.behavioural_consequence ?? '',
      physical_consequence: entry.physical_consequence ?? '',
      evidence_for: entry.evidence_for ?? '',
      evidence_against: entry.evidence_against ?? '',
      balanced_perspective: entry.balanced_perspective ?? '',
    });
    setStatusNotice({ tone: 'info', text: 'Editing ABCD Reflection. Save to apply your changes.' });
    setActiveTab('abcd');
  }

  function cancelMoodEdit() {
    setEditingMoodId(null);
    setForm(createEmptyMoodForm());
  }

  function cancelABCDEdit() {
    setEditingABCDId(null);
    setAbcdForm(createEmptyABCDForm());
  }

  function exportCsv() {
    const header = ['Date', 'Time', 'Activity/Behaviour', 'Mood Emotion', 'Mood Intensity', 'Automatic Thoughts', 'Physical Reaction'];

    const rows = [...records]
      .sort((a, b) => normalizeSortableTime(a.time).localeCompare(normalizeSortableTime(b.time)))
      .map((record) => [
        record.date,
        record.time,
        record.activity_behaviour || '',
        record.mood_emotion,
        String(record.mood_intensity),
        record.automatic_thoughts || '',
        record.physical_reaction || '',
      ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thought-records-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const sortedRecords = [...records].sort((a, b) =>
    normalizeSortableTime(a.time).localeCompare(normalizeSortableTime(b.time)),
  );

  const averageIntensity =
    sortedRecords.length > 0
      ? sortedRecords.reduce((sum, record) => sum + record.mood_intensity, 0) / sortedRecords.length
      : 0;

  const highestRecord = sortedRecords.length
    ? [...sortedRecords].sort((a, b) => b.mood_intensity - a.mood_intensity)[0]
    : null;

  const emotionCounts = sortedRecords
    .reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.mood_emotion] = (accumulator[record.mood_emotion] || 0) + 1;
      return accumulator;
    }, {});

  const topEmotion =
    Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  const recentActivity = [...sortedRecords
    .map((record) => ({
      id: record.id,
      type: 'Quick Check-In',
      time: record.time,
      title: record.mood_emotion,
      detail: record.automatic_thoughts || record.activity_behaviour || 'No notes added.',
      sortValue: `${record.date} ${normalizeSortableTime(record.time)}`,
    }))
    .concat(
      abcdEntries.map((entry) => ({
        id: entry.id,
        type: 'ABCD Reflection',
        time: formatDateTime(entry.created_at),
        title: entry.emotion,
        detail: entry.belief || entry.activating_event,
        sortValue: entry.created_at,
      })),
    )]
    .sort((a, b) => b.sortValue.localeCompare(a.sortValue))
    .slice(0, 6);

  const trendDays = buildDateRange(selectedDate, 7).map((date) => {
    const moodForDay = trendMoodRecords.filter((record) => record.date === date);
    const abcdForDay = trendAbcdEntries.filter((entry) => entry.entry_date === date);
    const emotionTally = moodForDay.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.mood_emotion] = (accumulator[record.mood_emotion] || 0) + 1;
      return accumulator;
    }, {});

    const dominantEmotion = Object.entries(emotionTally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const averageForDay = moodForDay.length
      ? moodForDay.reduce((sum, record) => sum + record.mood_intensity, 0) / moodForDay.length
      : null;

    return {
      date,
      shortLabel: formatShortDate(date),
      checkIns: moodForDay.length,
      abcdReflections: abcdForDay.length,
      averageIntensity: averageForDay,
      dominantEmotion,
    };
  });

  const activeDays = trendDays.filter((day) => day.checkIns + day.abcdReflections > 0).length;

  if (!session) {
    return (
      <AuthPanel
        configured={supabaseConfigured}
        email={email}
        secretValue={passphrase}
        mode={authMode}
        loading={loadingAuth}
        notice={authNotice}
        onEmailChange={setEmail}
        onPasswordChange={setPassphrase}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthNotice(null);
        }}
        onSubmit={submitAuth}
      />
    );
  }

  return (
    <main className="appShell">
      <header className="topBar panelCard">
        <div>
          <p className="eyebrow">Private cloud journal</p>
          <h1>Mood & Thought Tracker</h1>
          <p className="subtleText">
            Signed in as {session.user.email}. Track daily check-ins, reflect with ABCD, and review weekly patterns.
          </p>
        </div>
        <button type="button" className="secondaryButton" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="dateRow panelCard">
        <div>
          <label htmlFor="selected-date">Selected day</label>
          <input
            id="selected-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
        <div className="dateActions">
          <button type="button" className="secondaryButton" onClick={() => setSelectedDate(todayLocalIso())}>
            Jump to today
          </button>
          <button type="button" className="secondaryButton" onClick={() => setSelectedDate(shiftIsoDate(selectedDate, -1))}>
            Previous day
          </button>
          <button type="button" className="secondaryButton" onClick={() => setSelectedDate(shiftIsoDate(selectedDate, 1))}>
            Next day
          </button>
        </div>
      </section>

      {statusNotice && <div className={`notice notice--${statusNotice.tone}`}>{statusNotice.text}</div>}

      <nav className="tabs" aria-label="Tracker sections">
        {[
          ['dashboard', 'Dashboard'],
          ['mood', editingMoodId ? 'Edit Check-In' : 'Quick Check-In'],
          ['abcd', editingABCDId ? 'Edit ABCD' : 'ABCD Reflection'],
          ['review', 'Review'],
          ['history', 'History'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key as typeof activeTab)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <section className="dashboardGrid">
          <div className="stackColumn">
            <DayAtAGlance
              loading={loadingRecords}
              quickCheckIns={sortedRecords.length}
              abcdReflections={abcdEntries.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
              activeDays={activeDays}
            />
            <div className="panelCard">
              <div className="cardHeader">
                <div>
                  <p className="eyebrow">Timeline</p>
                  <h2>Recent activity for {formatShortDate(selectedDate)}</h2>
                </div>
              </div>

              {!recentActivity.length ? (
                <p className="emptyState">
                  No activity yet for this day. Add a quick check-in or ABCD reflection to build your journal.
                </p>
              ) : (
                <div className="activityList">
                  {recentActivity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="activityRow">
                      <div>
                        <strong>
                          {item.type} · {item.title}
                        </strong>
                        <p>{item.detail}</p>
                      </div>
                      <span>{item.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <TrendSummary days={trendDays} loading={loadingInsights} />
        </section>
      )}

      {activeTab === 'mood' && (
        <section className="dashboardGrid">
          <div className="panelCard">
            <div className="cardHeader">
              <div>
                <p className="eyebrow">Guided entry</p>
                <h2>{editingMoodId ? 'Edit Quick Check-In' : 'Quick Check-In'}</h2>
              </div>
              {editingMoodId && (
                <button type="button" className="secondaryButton" onClick={cancelMoodEdit}>
                  Cancel edit
                </button>
              )}
            </div>

            <label htmlFor="mood-time">Time</label>
            <input
              id="mood-time"
              type="time"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
            />

            <label htmlFor="activity-behaviour">1) Activity / Behaviour</label>
            <textarea
              id="activity-behaviour"
              value={form.activity_behaviour}
              placeholder="What are you doing? Where are you? Who are you with?"
              onChange={(event) => setForm({ ...form, activity_behaviour: event.target.value })}
            />

            <div className="splitRow">
              <div>
                <label htmlFor="mood-emotion">2) Mood</label>
                <select
                  id="mood-emotion"
                  value={form.mood_emotion}
                  onChange={(event) => setForm({ ...form, mood_emotion: event.target.value })}
                >
                  {emotions.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="mood-intensity">Intensity: {form.mood_intensity}/10</label>
                <input
                  id="mood-intensity"
                  type="range"
                  min="0"
                  max="10"
                  value={form.mood_intensity}
                  onChange={(event) => setForm({ ...form, mood_intensity: Number(event.target.value) })}
                />
              </div>
            </div>

            <label htmlFor="automatic-thoughts">3) Automatic Thoughts</label>
            <textarea
              id="automatic-thoughts"
              value={form.automatic_thoughts}
              placeholder="What's on your mind? What are you thinking?"
              onChange={(event) => setForm({ ...form, automatic_thoughts: event.target.value })}
            />

            <label htmlFor="physical-reaction">4) Physical Reaction</label>
            <textarea
              id="physical-reaction"
              value={form.physical_reaction}
              placeholder="How is your body feeling?"
              onChange={(event) => setForm({ ...form, physical_reaction: event.target.value })}
            />

            <button
              type="button"
              className="primaryButton"
              onClick={saveMoodRecord}
              disabled={
                savingMood ||
                !form.time ||
                (!form.activity_behaviour.trim() && !form.automatic_thoughts.trim() && !form.physical_reaction.trim())
              }
            >
              {savingMood ? 'Saving...' : editingMoodId ? 'Update Quick Check-In' : 'Save Quick Check-In'}
            </button>
          </div>

          <div className="stackColumn">
            <DayAtAGlance
              loading={loadingRecords}
              quickCheckIns={sortedRecords.length}
              abcdReflections={abcdEntries.length}
              average={averageIntensity}
              topEmotion={topEmotion}
              highest={highestRecord}
              activeDays={activeDays}
            />
            <TrendSummary days={trendDays} loading={loadingInsights} />
          </div>
        </section>
      )}

      {activeTab === 'abcd' && (
        <section className="dashboardGrid">
          <div className="panelCard">
            <div className="cardHeader">
              <div>
                <p className="eyebrow">Reflect and reframe</p>
                <h2>{editingABCDId ? 'Edit ABCD Reflection' : 'ABCD Reflection'}</h2>
              </div>
              {editingABCDId && (
                <button type="button" className="secondaryButton" onClick={cancelABCDEdit}>
                  Cancel edit
                </button>
              )}
            </div>

            <label htmlFor="activating-event">A - Activating Event / Situation</label>
            <textarea
              id="activating-event"
              value={abcdForm.activating_event}
              placeholder="What happened? Who was involved? What triggered this?"
              onChange={(event) => setAbcdForm({ ...abcdForm, activating_event: event.target.value })}
            />

            <label htmlFor="belief">B - Belief / Thought</label>
            <textarea
              id="belief"
              value={abcdForm.belief}
              placeholder="What did you tell yourself? What meaning did you attach to the situation?"
              onChange={(event) => setAbcdForm({ ...abcdForm, belief: event.target.value })}
            />

            <div className="splitRow">
              <div>
                <label htmlFor="abcd-emotion">C - Emotion</label>
                <select
                  id="abcd-emotion"
                  value={abcdForm.emotion}
                  onChange={(event) => setAbcdForm({ ...abcdForm, emotion: event.target.value })}
                >
                  {abcdEmotions.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="abcd-intensity">Emotion Intensity: {abcdForm.emotion_intensity}/10</label>
                <input
                  id="abcd-intensity"
                  type="range"
                  min="0"
                  max="10"
                  value={abcdForm.emotion_intensity}
                  onChange={(event) => setAbcdForm({ ...abcdForm, emotion_intensity: Number(event.target.value) })}
                />
              </div>
            </div>

            <label htmlFor="behavioural-consequence">Behavioural Consequence</label>
            <textarea
              id="behavioural-consequence"
              value={abcdForm.behavioural_consequence}
              placeholder="What did you do next?"
              onChange={(event) => setAbcdForm({ ...abcdForm, behavioural_consequence: event.target.value })}
            />

            <label htmlFor="physical-consequence">Physical Consequence</label>
            <textarea
              id="physical-consequence"
              value={abcdForm.physical_consequence}
              placeholder="How did your body react?"
              onChange={(event) => setAbcdForm({ ...abcdForm, physical_consequence: event.target.value })}
            />

            <label htmlFor="evidence-for">D - Evidence For</label>
            <textarea
              id="evidence-for"
              value={abcdForm.evidence_for}
              placeholder="What evidence supports this belief?"
              onChange={(event) => setAbcdForm({ ...abcdForm, evidence_for: event.target.value })}
            />

            <label htmlFor="evidence-against">Evidence Against</label>
            <textarea
              id="evidence-against"
              value={abcdForm.evidence_against}
              placeholder="What evidence does not support this belief?"
              onChange={(event) => setAbcdForm({ ...abcdForm, evidence_against: event.target.value })}
            />

            <label htmlFor="balanced-perspective">Balanced Perspective</label>
            <textarea
              id="balanced-perspective"
              value={abcdForm.balanced_perspective}
              placeholder="What is a more balanced perspective?"
              onChange={(event) => setAbcdForm({ ...abcdForm, balanced_perspective: event.target.value })}
            />

            <button
              type="button"
              className="primaryButton"
              onClick={saveABCDEntry}
              disabled={savingABCD || !abcdForm.activating_event.trim() || !abcdForm.belief.trim()}
            >
              {savingABCD ? 'Saving...' : editingABCDId ? 'Update ABCD Reflection' : 'Save ABCD Reflection'}
            </button>
          </div>

          <div className="stackColumn">
            <TrendSummary days={trendDays} loading={loadingInsights} />
            <div className="panelCard helperCard">
              <p className="eyebrow">Reflection tip</p>
              <h2>Use your weekly patterns</h2>
              <p className="subtleText">
                Look for days where intensity rises, then use ABCD to compare the trigger, belief, and balanced perspective.
              </p>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'review' && (
        <section className="stackColumn">
          <div className="panelCard">
            <div className="cardHeader">
              <div>
                <p className="eyebrow">Reflection archive</p>
                <h2>ABCD reflections for {formatShortDate(selectedDate)}</h2>
              </div>
              <span className="pill">{abcdEntries.length} total</span>
            </div>

            {!abcdEntries.length ? (
              <p className="emptyState">No ABCD reflections for this day yet. Use the ABCD tab when you want to unpack a difficult moment.</p>
            ) : (
              <div className="entriesList">
                {abcdEntries.map((entry) => (
                  <article key={entry.id} className="entryCard">
                    <div className="entryTop">
                      <strong>{formatDateTime(entry.created_at)}</strong>
                      <span className={badgeClass(entry.emotion_intensity)}>
                        {entry.emotion} {entry.emotion_intensity}/10
                      </span>
                    </div>
                    <div className="entryGrid entryGrid--single">
                      <div>
                        <h4>A - Activating Event</h4>
                        <p>{entry.activating_event}</p>
                      </div>
                      <div>
                        <h4>B - Belief</h4>
                        <p>{entry.belief}</p>
                      </div>
                      <div>
                        <h4>C - Consequences</h4>
                        <p>{entry.behavioural_consequence || '-'}</p>
                        <p>{entry.physical_consequence || '-'}</p>
                      </div>
                      <div>
                        <h4>D - Disputation</h4>
                        <p>{entry.evidence_for || '-'}</p>
                        <p>{entry.evidence_against || '-'}</p>
                        <p>{entry.balanced_perspective || '-'}</p>
                      </div>
                    </div>
                    <div className="inlineActions">
                      <button type="button" className="secondaryButton" onClick={() => editABCDRecord(entry)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dangerButton"
                        onClick={() => deleteABCDEntry(entry.id)}
                        disabled={deletingABCDId === entry.id}
                      >
                        {deletingABCDId === entry.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="dashboardGrid">
            <div className="panelCard">
              <div className="cardHeader">
                <div>
                  <p className="eyebrow">Check-in summary</p>
                  <h2>Quick Check-In review</h2>
                </div>
                <button type="button" className="secondaryButton" onClick={exportCsv} disabled={!sortedRecords.length}>
                  Export CSV
                </button>
              </div>

              {!sortedRecords.length ? (
                <p className="emptyState">No quick check-ins for this day yet. Your summary will appear here once you add one.</p>
              ) : (
                <>
                  <p className="subtleText">
                    You recorded <strong>{sortedRecords.length}</strong> quick check-in entr
                    {sortedRecords.length === 1 ? 'y' : 'ies'}. Average mood intensity was{' '}
                    <strong>{averageIntensity.toFixed(1)}/10</strong>. The most common mood was{' '}
                    <strong>{topEmotion}</strong>.
                  </p>
                  {highestRecord && (
                    <div className="highlightBox">
                      Highest intensity entry: {highestRecord.time} · {highestRecord.mood_emotion} at {highestRecord.mood_intensity}/10.
                    </div>
                  )}
                </>
              )}
            </div>

            <TrendSummary days={trendDays} loading={loadingInsights} />
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="panelCard">
          <div className="cardHeader">
            <div>
              <p className="eyebrow">Entry archive</p>
              <h2>Quick Check-In history for {formatShortDate(selectedDate)}</h2>
            </div>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => {
                const userId = session.user.id;
                void fetchAndStoreData(userId, selectedDate);
              }}
            >
              Refresh
            </button>
          </div>

          {loadingRecords ? (
            <p className="emptyState">Loading check-ins...</p>
          ) : !sortedRecords.length ? (
            <p className="emptyState">No quick check-ins for this date yet. Try the Quick Check-In tab to capture how the day feels.</p>
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
                      <p>{record.activity_behaviour || '-'}</p>
                    </div>
                    <div>
                      <h4>Automatic Thoughts</h4>
                      <p>{record.automatic_thoughts || '-'}</p>
                    </div>
                    <div>
                      <h4>Physical Reaction</h4>
                      <p>{record.physical_reaction || '-'}</p>
                    </div>
                  </div>

                  <div className="inlineActions">
                    <button type="button" className="secondaryButton" onClick={() => editMoodRecord(record)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => deleteMoodRecord(record.id)}
                      disabled={deletingMoodId === record.id}
                    >
                      {deletingMoodId === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
