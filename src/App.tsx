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

type UndoPayload =
  | { type: "quick"; record: ThoughtRecord }
  | { type: "abcd"; entry: ABCDEntry };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const emotionOptions = [
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

const OTHER_EMOTION_VALUE = "__other__";
const themeOrder = ["default", "ocean", "forest", "dark"] as const;
type ThemeName = (typeof themeOrder)[number];

function nextTheme(current: ThemeName): ThemeName {
  const index = themeOrder.indexOf(current);
  return themeOrder[(index + 1) % themeOrder.length];
}

function themeLabel(theme: ThemeName) {
  if (theme === "ocean") return "Ocean";
  if (theme === "forest") return "Forest";
  if (theme === "dark") return "Dark";
  return "Default";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function formatTimeOnly(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeClass(intensity: number) {
  if (intensity <= 3) return "badge green";
  if (intensity <= 6) return "badge yellow";
  return "badge red";
}

function cleanSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildBalancedReframe(options: {
  thought?: string;
  evidenceFor?: string;
  evidenceAgainst?: string;
  existingBalanced?: string;
}) {
  const thought = options.thought?.trim() || "";
  const evidenceFor = options.evidenceFor?.trim() || "";
  const evidenceAgainst = options.evidenceAgainst?.trim() || "";
  const existingBalanced = options.existingBalanced?.trim() || "";

  const evidenceStrength = (value: string) => {
    if (!value) return 0;

    const words = value.split(/\s+/).filter(Boolean);
    let score = 0;

    if (words.length >= 8) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (
      /\b(because|when|after|before|during|said|did|happened|noticed|observed|email|message|meeting|call)\b/i.test(
        value
      )
    ) {
      score += 1;
    }

    return score;
  };

  const forStrength = evidenceStrength(evidenceFor);
  const againstStrength = evidenceStrength(evidenceAgainst);
  const weakEvidence = forStrength < 2 || againstStrength < 2;

  const strongerBalancePrompt =
    "To make this stronger, add specific facts in both directions (who/what/when) before deciding how true the thought is.";

  const strongerBalanceExample = thought
    ? `A stronger balanced perspective could be: "I can see why I had the thought '${thought}', but my current evidence is mixed and incomplete, so I will treat this as uncertain and choose one constructive next step."`
    : "A stronger balanced perspective could be: \"My current evidence is mixed and incomplete, so I will treat this as uncertain and choose one constructive next step.\"";

  if (existingBalanced) {
    const base = cleanSentence(existingBalanced);
    return weakEvidence ? `${base} ${strongerBalancePrompt}` : base;
  }

  if (!thought && !evidenceFor && !evidenceAgainst) {
    return "A balanced view can hold both what feels difficult right now and what is still possible next.";
  }

  const thoughtPart = thought
    ? `My automatic thought is: "${thought}".`
    : "I notice a difficult thought is present.";

  const forPart = evidenceFor
    ? `Some evidence supports it: ${cleanSentence(evidenceFor)}`
    : "There may be some reasons this thought feels believable.";

  const againstPart = evidenceAgainst
    ? `Some evidence does not support it: ${cleanSentence(evidenceAgainst)}`
    : "There is likely evidence that does not fully support this thought.";

  const balanceTail =
    "A more balanced view is that this concern may contain part of the truth, but it is not the whole story, and I can choose a constructive next step.";

  const baseDraft = `${thoughtPart} ${forPart} ${againstPart} ${balanceTail}`;

  if (!weakEvidence) {
    return baseDraft;
  }

  return `${baseDraft} ${strongerBalancePrompt} ${strongerBalanceExample}`;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createAccountMode, setCreateAccountMode] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [historyDateFilter, setHistoryDateFilter] = useState("");

  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [abcdEntries, setAbcdEntries] = useState<ABCDEntry[]>([]);
  const [historyRecords, setHistoryRecords] = useState<ThoughtRecord[]>([]);
  const [historyAbcdEntries, setHistoryAbcdEntries] = useState<ABCDEntry[]>([]);

  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingMood, setSavingMood] = useState(false);
  const [savingABCD, setSavingABCD] = useState(false);
  const [historyView, setHistoryView] = useState<"both" | "quick" | "abcd">(
    "both"
  );
  const [counsellorDepth, setCounsellorDepth] = useState<
    "brief" | "standard" | "deep"
  >("standard");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [undoPayload, setUndoPayload] = useState<UndoPayload | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<number | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [expandedHistoryKey, setExpandedHistoryKey] = useState<string | null>(
    null
  );
  const [reframeSourceId, setReframeSourceId] = useState<string>("latest");

  const [form, setForm] = useState(emptyMoodForm);
  const [abcdForm, setAbcdForm] = useState(emptyABCDForm);
  const [editingQuickId, setEditingQuickId] = useState<string | null>(null);
  const [editingAbcdId, setEditingAbcdId] = useState<string | null>(null);
  const [editMoodForm, setEditMoodForm] = useState(emptyMoodForm);
  const [editAbcdForm, setEditAbcdForm] = useState(emptyABCDForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "mood" | "abcd" | "counsellor" | "history"
  >("dashboard");
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "default";
    const saved = window.localStorage.getItem("mtt-theme");
    if (
      saved === "default" ||
      saved === "ocean" ||
      saved === "forest" ||
      saved === "dark"
    ) {
      return saved;
    }
    return "default";
  });

  function clearUndoWindow() {
    setUndoPayload(null);
    setUndoExpiresAt(null);
    setUndoSecondsLeft(0);
  }

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

  useEffect(() => {
    if (!session?.user || !supabase) return;
    loadHistoryData();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    setActiveTab("dashboard");
  }, [session?.user?.id]);

  useEffect(() => {
    if (!statusMessage) return;

    const timeout = window.setTimeout(() => {
      setStatusMessage("");
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    document.body.setAttribute("data-theme", themeName);
    window.localStorage.setItem("mtt-theme", themeName);
  }, [themeName]);

  useEffect(() => {
    if (!undoExpiresAt) return;

    const updateCountdown = () => {
      const seconds = Math.max(
        0,
        Math.ceil((undoExpiresAt - Date.now()) / 1000)
      );
      setUndoSecondsLeft(seconds);
    };

    updateCountdown();

    const ticker = window.setInterval(updateCountdown, 250);
    const timeout = window.setTimeout(() => {
      clearUndoWindow();
    }, Math.max(0, undoExpiresAt - Date.now()));

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(timeout);
    };
  }, [undoExpiresAt]);

  useEffect(() => {
    if (
      reframeSourceId !== "latest" &&
      !historyAbcdEntries.some((entry) => entry.id === reframeSourceId)
    ) {
      setReframeSourceId("latest");
    }
  }, [historyAbcdEntries, reframeSourceId]);

  async function signIn() {
    if (!supabase) return;

    setCreateAccountMode(false);
    setConfirmPassword("");
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

  async function signUp() {
    if (!supabase) return;

    if (!createAccountMode) {
      setCreateAccountMode(true);
      setAuthMessage("Confirm your password to create a new account.");
      return;
    }

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setAuthMessage("Enter email, password, and confirm password.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage("Password and confirm password must match.");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Password should be at least 6 characters.");
      return;
    }

    setCreatingAccount(true);
    setAuthMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setCreatingAccount(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    if (data.user && !data.session) {
      setAuthMessage("Account created. Check your email to verify your account.");
      return;
    }

    setAuthMessage("Account created and signed in.");
  }

  async function sendPasswordReset() {
    if (!supabase) return;

    if (!email.trim()) {
      setAuthMessage("Enter your email first, then click reset password.");
      return;
    }

    setSendingReset(true);
    setAuthMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    setSendingReset(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("Password reset email sent. Check your inbox.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRecords([]);
    setAbcdEntries([]);
    setHistoryRecords([]);
    setHistoryAbcdEntries([]);
    clearUndoWindow();
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

  async function loadHistoryData() {
    if (!supabase || !session?.user) return;

    setLoadingHistory(true);

    const [moodResult, abcdResult] = await Promise.all([
      supabase
        .from("thought_records")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false }),
      supabase
        .from("abcd_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);

    setLoadingHistory(false);

    if (moodResult.error) {
      setStatusMessage(moodResult.error.message);
      return;
    }

    if (abcdResult.error) {
      setStatusMessage(abcdResult.error.message);
      return;
    }

    setHistoryRecords(moodResult.data ?? []);
    setHistoryAbcdEntries(abcdResult.data ?? []);
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
    await Promise.all([loadMoodRecords(), loadHistoryData()]);
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
    await Promise.all([loadABCDEntries(), loadHistoryData()]);
    setActiveTab("history");
  }

  async function deleteMoodRecord(record: ThoughtRecord) {
    if (!supabase || !session?.user) return;

    const confirmed = window.confirm(
      "Delete this Quick Check-In? You can undo for a few seconds afterward."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("thought_records")
      .delete()
      .eq("id", record.id)
      .eq("user_id", session.user.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setUndoPayload({ type: "quick", record });
    setUndoExpiresAt(Date.now() + 8000);
    setStatusMessage("Quick Check-In deleted.");

    await Promise.all([loadMoodRecords(), loadHistoryData()]);
  }

  async function deleteABCDEntry(entry: ABCDEntry) {
    if (!supabase || !session?.user) return;

    const confirmed = window.confirm(
      "Delete this ABCD reflection? You can undo for a few seconds afterward."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("abcd_entries")
      .delete()
      .eq("id", entry.id)
      .eq("user_id", session.user.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setUndoPayload({ type: "abcd", entry });
    setUndoExpiresAt(Date.now() + 8000);
    setStatusMessage("ABCD reflection deleted.");

    await Promise.all([loadABCDEntries(), loadHistoryData()]);
  }

  function beginQuickEdit(record: ThoughtRecord) {
    setEditingAbcdId(null);
    setEditingQuickId(record.id);
    setEditMoodForm({
      activity_behaviour: record.activity_behaviour || "",
      mood_emotion: record.mood_emotion,
      mood_intensity: record.mood_intensity,
      automatic_thoughts: record.automatic_thoughts || "",
      physical_reaction: record.physical_reaction || "",
    });
  }

  function beginAbcdEdit(entry: ABCDEntry) {
    setEditingQuickId(null);
    setEditingAbcdId(entry.id);
    setEditAbcdForm({
      activating_event: entry.activating_event || "",
      belief: entry.belief || "",
      emotion: entry.emotion || "",
      emotion_intensity: entry.emotion_intensity,
      behavioural_consequence: entry.behavioural_consequence || "",
      physical_consequence: entry.physical_consequence || "",
      evidence_for: entry.evidence_for || "",
      evidence_against: entry.evidence_against || "",
      balanced_perspective: entry.balanced_perspective || "",
    });
  }

  function cancelEntryEdit() {
    setEditingQuickId(null);
    setEditingAbcdId(null);
  }

  async function saveQuickEdit(recordId: string) {
    if (!supabase || !session?.user) return;

    setSavingEdit(true);

    const { error } = await supabase
      .from("thought_records")
      .update({
        activity_behaviour: editMoodForm.activity_behaviour,
        mood_emotion: editMoodForm.mood_emotion,
        mood_intensity: editMoodForm.mood_intensity,
        automatic_thoughts: editMoodForm.automatic_thoughts,
        physical_reaction: editMoodForm.physical_reaction,
      })
      .eq("id", recordId)
      .eq("user_id", session.user.id);

    setSavingEdit(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage("Quick Check-In updated.");
    setEditingQuickId(null);
    await Promise.all([loadMoodRecords(), loadHistoryData()]);
  }

  async function saveAbcdEdit(entryId: string) {
    if (!supabase || !session?.user) return;

    setSavingEdit(true);

    const { error } = await supabase
      .from("abcd_entries")
      .update({
        activating_event: editAbcdForm.activating_event,
        belief: editAbcdForm.belief,
        emotion: editAbcdForm.emotion,
        emotion_intensity: editAbcdForm.emotion_intensity,
        behavioural_consequence: editAbcdForm.behavioural_consequence,
        physical_consequence: editAbcdForm.physical_consequence,
        evidence_for: editAbcdForm.evidence_for,
        evidence_against: editAbcdForm.evidence_against,
        balanced_perspective: editAbcdForm.balanced_perspective,
      })
      .eq("id", entryId)
      .eq("user_id", session.user.id);

    setSavingEdit(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage("ABCD reflection updated.");
    setEditingAbcdId(null);
    await Promise.all([loadABCDEntries(), loadHistoryData()]);
  }

  async function undoDelete() {
    if (!supabase || !session?.user || !undoPayload) return;

    if (undoPayload.type === "quick") {
      const { record } = undoPayload;
      const { error } = await supabase.from("thought_records").insert({
        user_id: session.user.id,
        date: record.date,
        time: record.time,
        activity_behaviour: record.activity_behaviour || "",
        mood_emotion: record.mood_emotion,
        mood_intensity: record.mood_intensity,
        automatic_thoughts: record.automatic_thoughts || "",
        physical_reaction: record.physical_reaction || "",
      });

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      setStatusMessage("Quick Check-In restored.");
    } else {
      const { entry } = undoPayload;
      const { error } = await supabase.from("abcd_entries").insert({
        user_id: session.user.id,
        entry_date: entry.entry_date,
        activating_event: entry.activating_event,
        belief: entry.belief,
        emotion: entry.emotion,
        emotion_intensity: entry.emotion_intensity,
        behavioural_consequence: entry.behavioural_consequence || "",
        physical_consequence: entry.physical_consequence || "",
        evidence_for: entry.evidence_for || "",
        evidence_against: entry.evidence_against || "",
        balanced_perspective: entry.balanced_perspective || "",
      });

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      setStatusMessage("ABCD reflection restored.");
    }

    clearUndoWindow();
    await Promise.all([loadMoodRecords(), loadABCDEntries(), loadHistoryData()]);
  }

  function exportCsv() {
    const exportQuickRecords = historyDateFilter
      ? historyRecords.filter((record) => record.date === historyDateFilter)
      : historyRecords;

    const exportAbcdEntries = historyDateFilter
      ? historyAbcdEntries.filter((entry) => entry.entry_date === historyDateFilter)
      : historyAbcdEntries;

    const sortedExportQuickRecords = [...exportQuickRecords].sort((a, b) => {
      const left = `${a.date} ${sortTime(a.time)}`;
      const right = `${b.date} ${sortTime(b.time)}`;
      return left.localeCompare(right);
    });

    const includeQuick = historyView !== "abcd";
    const includeAbcd = historyView !== "quick";

    const fileDateLabel = historyDateFilter || "all-dates";
    const fileViewLabel =
      historyView === "both" ? "all-types" : historyView === "quick" ? "quick" : "abcd";
    const exportedAt = new Date();
    let csvRows: string[][];

    const quickHeader = [
      "Date",
      "Time",
      "Mood Emotion",
      "Mood Intensity",
      "Activity/Behaviour",
      "Automatic Thoughts",
      "Physical Reaction",
    ];

    const quickRows = sortedExportQuickRecords.map((record) => [
      record.date,
      record.time,
      record.mood_emotion,
      String(record.mood_intensity),
      record.activity_behaviour || "",
      record.automatic_thoughts || "",
      record.physical_reaction || "",
    ]);

    const abcdHeader = [
      "Date",
      "Time",
      "A - Activating Event",
      "B - Belief",
      "C - Emotion",
      "C - Emotion Intensity",
      "C - Behavioural Consequence",
      "C - Physical Consequence",
      "D - Evidence For",
      "D - Evidence Against",
      "D - Balanced Perspective",
    ];

    const abcdRows = exportAbcdEntries.map((entry) => [
      entry.entry_date,
      formatTimeOnly(entry.created_at),
      entry.activating_event || "",
      entry.belief || "",
      entry.emotion || "",
      String(entry.emotion_intensity),
      entry.behavioural_consequence || "",
      entry.physical_consequence || "",
      entry.evidence_for || "",
      entry.evidence_against || "",
      entry.balanced_perspective || "",
    ]);

    if (includeQuick && includeAbcd) {
      csvRows = [
        ["Quick Check-Ins"],
        quickHeader,
        ...quickRows,
        [],
        ["ABCD Reflections"],
        abcdHeader,
        ...abcdRows,
      ];
    } else if (includeQuick) {
      csvRows = [quickHeader, ...quickRows];
    } else {
      const header = [
        "Date",
        "Time",
        "A - Activating Event",
        "B - Belief",
        "C - Emotion",
        "C - Emotion Intensity",
        "C - Behavioural Consequence",
        "C - Physical Consequence",
        "D - Evidence For",
        "D - Evidence Against",
        "D - Balanced Perspective",
      ];

      csvRows = [header, ...abcdRows];
    }

    const metadataRows: string[][] = [
      ["Export generated at", exportedAt.toLocaleString()],
      ["History date filter", historyDateFilter || "All dates"],
      [
        "History type filter",
        historyView === "both"
          ? "All"
          : historyView === "quick"
          ? "Quick Check-Ins only"
          : "ABCD Reflections only",
      ],
      [],
    ];

    csvRows = [...metadataRows, ...csvRows];

    const csv = csvRows
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
    link.download = `thought-records-${fileViewLabel}-${fileDateLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      sortTime(a.time).localeCompare(sortTime(b.time))
    );
  }, [records]);

  const averageIntensity = useMemo(() => {
    const quickIntensities = sortedRecords.map((record) => record.mood_intensity);
    const abcdIntensities = abcdEntries.map((entry) => entry.emotion_intensity);
    const allIntensities = [...quickIntensities, ...abcdIntensities];

    if (!allIntensities.length) return 0;
    const total = allIntensities.reduce((sum, value) => sum + value, 0);
    return total / allIntensities.length;
  }, [sortedRecords, abcdEntries]);

  const highestRecord = useMemo(() => {
    if (!sortedRecords.length) return null;
    return [...sortedRecords].sort(
      (a, b) => b.mood_intensity - a.mood_intensity
    )[0];
  }, [sortedRecords]);

  const emotionCounts = useMemo(() => {
    const counts = [...sortedRecords, ...abcdEntries].reduce<Record<string, number>>(
      (acc, entry) => {
        const emotion = 'mood_emotion' in entry ? entry.mood_emotion : entry.emotion;
        acc[emotion] = (acc[emotion] || 0) + 1;
        return acc;
      },
      {}
    );

    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count);
  }, [sortedRecords, abcdEntries]);

  const topEmotion = emotionCounts[0]?.emotion || "-";

  const filteredHistoryQuickRecords = useMemo(() => {
    const matching = historyDateFilter
      ? historyRecords.filter((record) => record.date === historyDateFilter)
      : historyRecords;

    return [...matching].sort((a, b) => {
      const left = `${a.date} ${sortTime(a.time)}`;
      const right = `${b.date} ${sortTime(b.time)}`;
      return right.localeCompare(left);
    });
  }, [historyRecords, historyDateFilter]);

  const filteredHistoryAbcdEntries = useMemo(() => {
    const matching = historyDateFilter
      ? historyAbcdEntries.filter((entry) => entry.entry_date === historyDateFilter)
      : historyAbcdEntries;

    return [...matching].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [historyAbcdEntries, historyDateFilter]);

  const availableHistoryDates = useMemo(() => {
    const dateSet = new Set<string>();

    historyRecords.forEach((record) => dateSet.add(record.date));
    historyAbcdEntries.forEach((entry) => dateSet.add(entry.entry_date));

    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [historyRecords, historyAbcdEntries]);

  const reframeSourceEntries = useMemo(
    () => historyAbcdEntries.slice(0, 20),
    [historyAbcdEntries]
  );

  const weeklyTrend = useMemo(() => {
    const grouped = new Map<string, number[]>();

    historyRecords.forEach((record) => {
      if (!grouped.has(record.date)) grouped.set(record.date, []);
      grouped.get(record.date)?.push(record.mood_intensity);
    });

    historyAbcdEntries.forEach((entry) => {
      if (!grouped.has(entry.entry_date)) grouped.set(entry.entry_date, []);
      grouped.get(entry.entry_date)?.push(entry.emotion_intensity);
    });

    const dates = Array.from(grouped.keys()).sort().slice(-7);
    return dates.map((date) => {
      const values = grouped.get(date) || [];
      const average =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
      return { date, average: Number(average.toFixed(2)) };
    });
  }, [historyRecords, historyAbcdEntries]);

  const showQuickHistory = historyView !== "abcd";
  const showAbcdHistory = historyView !== "quick";
  const hasQuickHistory = filteredHistoryQuickRecords.length > 0;
  const hasAbcdHistory = filteredHistoryAbcdEntries.length > 0;
  const hasVisibleHistory =
    (showQuickHistory && hasQuickHistory) ||
    (showAbcdHistory && hasAbcdHistory);

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
      time: formatTimeOnly(entry.created_at),
      title: entry.emotion,
      detail: entry.belief || entry.activating_event || "",
      sortValue: entry.created_at,
    }));

    return [...moodItems, ...abcdItems]
      .sort((a, b) => b.sortValue.localeCompare(a.sortValue))
      .slice(0, 6);
  }, [sortedRecords, abcdEntries]);

  const counsellorAdvice = useMemo(() => {
    const moodCount = sortedRecords.length;
    const reflectionCount = abcdEntries.length;
    const latestMood = moodCount ? sortedRecords[moodCount - 1] : null;
    const latestReflection = reflectionCount ? abcdEntries[0] : null;
    const actions: string[] = [];
    const observations: string[] = [];
    const themes: string[] = [];
    const validations: string[] = [];
    const distortions: string[] = [];
    const socraticQuestions: string[] = [];
    const restructuringSteps: string[] = [];
    const experiments: string[] = [];
    const schemaThemes: string[] = [];
    const schemaHealingProcesses: string[] = [];

    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/[.,!?]/g, "");

    const stopWords = new Set([
      "about",
      "below",
      "could",
      "every",
      "first",
      "found",
      "great",
      "happy",
      "might",
      "those",
      "think",
      "their",
      "there",
      "these",
      "thing",
      "today",
      "would",
      "being",
      "feel",
      "feeling",
      "really",
      "because",
      "which",
      "where",
      "after",
      "before",
      "while",
      "while",
      "with",
      "that",
      "this",
      "your",
      "from",
      "then",
      "have",
      "like",
      "when",
      "would",
    ]);

    const wordCounts = (values: string[]) =>
      values
        .flatMap((value) => normalize(value).split(/\s+/))
        .filter((word) => word && word.length > 3 && !stopWords.has(word))
        .reduce<Record<string, number>>((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {});

    const isLikelyJunk = (value: string) => {
      const text = value.trim();
      if (!text) return true;

      const lettersOnly = text.toLowerCase().replace(/[^a-z]/g, "");
      const words = text.split(/\s+/).filter(Boolean);
      const uniqueChars = new Set(lettersOnly).size;
      const uniqueRatio = lettersOnly.length
        ? uniqueChars / lettersOnly.length
        : 0;

      if (lettersOnly.length < 6) return true;
      if (/(.)\1{3,}/i.test(text)) return true;
      if (/^(?:[a-z]{1,2}\s*)+$/i.test(text)) return true;
      if (words.length < 3 && lettersOnly.length < 14) return true;
      if (!/[aeiou]/i.test(lettersOnly) && lettersOnly.length >= 7) return true;
      if (uniqueRatio < 0.28 && lettersOnly.length > 9) return true;

      return false;
    };

    const narrativeSamples = [
      ...sortedRecords.map((record) => record.activity_behaviour),
      ...sortedRecords.map((record) => record.automatic_thoughts),
      ...sortedRecords.map((record) => record.physical_reaction),
      ...abcdEntries.map((entry) => entry.activating_event),
      ...abcdEntries.map((entry) => entry.belief),
      ...abcdEntries.map((entry) => entry.evidence_for),
      ...abcdEntries.map((entry) => entry.evidence_against),
      ...abcdEntries.map((entry) => entry.balanced_perspective),
    ]
      .filter(Boolean)
      .map((value) => String(value));

    const meaningfulSamples = narrativeSamples.filter(
      (sample) => !isLikelyJunk(sample)
    );

    const candidateThoughts = [
      latestMood?.automatic_thoughts,
      latestReflection?.belief,
    ].filter((thought) => thought && !isLikelyJunk(thought)) as string[];

    const allFreeText = [
      ...sortedRecords.map((record) => record.automatic_thoughts),
      ...sortedRecords.map((record) => record.activity_behaviour),
      ...sortedRecords.map((record) => record.physical_reaction),
      ...abcdEntries.map((entry) => entry.activating_event),
      ...abcdEntries.map((entry) => entry.belief),
      ...abcdEntries.map((entry) => entry.balanced_perspective),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const distortionRules = [
      {
        name: "All-or-nothing thinking",
        pattern: /\b(always|never|no one|everyone|nothing|completely|totally)\b/i,
        question:
          "Is this situation really 0% or 100%, or is there a middle ground?",
      },
      {
        name: "Overgeneralization",
        pattern: /\b(again and again|every time|nothing ever changes|this always happens)\b/i,
        question:
          "What happened this time specifically, and what evidence shows it is not always true?",
      },
      {
        name: "Catastrophizing",
        pattern: /\b(disaster|ruined|awful|terrible|worst|cannot handle|hopeless)\b/i,
        question:
          "What is the most likely outcome, and how could you cope if the hard outcome happened?",
      },
      {
        name: "Mind reading",
        pattern: /\b(they think|everyone thinks|they are judging|must think)\b/i,
        question:
          "What facts do you have about what others think, and what might be an alternative explanation?",
      },
      {
        name: "Fortune telling",
        pattern: /\b(will fail|going to fail|will go wrong|won't work|nothing will improve)\b/i,
        question:
          "What data supports this prediction, and what data challenges it?",
      },
      {
        name: "Should statements",
        pattern: /\b(should|must|have to|ought to)\b/i,
        question:
          "What would change if you replaced 'should' with 'I would prefer'?",
      },
      {
        name: "Personalization",
        pattern: /\b(my fault|because of me|i ruin everything|i am the problem)\b/i,
        question:
          "What other factors outside your control also contributed to this situation?",
      },
      {
        name: "Labeling",
        pattern: /\b(i am a failure|i am useless|i am worthless|i am stupid|i am broken)\b/i,
        question:
          "Are you describing a behavior in one moment, or labeling your whole identity?",
      },
    ] as const;

    const detectedDistortions = distortionRules
      .filter((rule) => candidateThoughts.some((thought) => rule.pattern.test(thought)))
      .slice(0, 4);

    detectedDistortions.forEach((rule) => {
      distortions.push(`Potential pattern: ${rule.name}.`);
      socraticQuestions.push(rule.question);
    });

    const highEmotion = Math.max(
      latestMood?.mood_intensity ?? 0,
      latestReflection?.emotion_intensity ?? 0
    );

    if (highEmotion >= 8) {
      distortions.push(
        "Potential pattern: Emotional reasoning. Strong feelings can be real and valid, but they are not always proof that a belief is fully true."
      );
      socraticQuestions.push(
        "If your emotion dropped from this intensity, how might you view this same situation differently?"
      );
    }

    socraticQuestions.push(
      "What is the strongest evidence for this thought, and what is the strongest evidence against it?",
      "If someone you care about had this exact thought, what balanced response would you offer them?",
      "What action in the next 24 hours would support your values, even if this thought remains present?"
    );

    const riskPattern =
      /\b(kill myself|suicide|self harm|hurt myself|end my life|don't want to live|want to die)\b/i;
    const safetyNote = riskPattern.test(allFreeText)
      ? "If you are at risk of harming yourself or someone else, contact emergency services now. You can also call or text 988 (US/Canada) for immediate crisis support."
      : "This tool provides CBT-style self-help coaching, not medical care. If distress is persistent or worsening, consider reaching out to a licensed mental health professional.";

    const schemaRules = [
      {
        name: "Abandonment / instability",
        pattern:
          /\b(left|leave me|abandon|rejected|ignored|ghosted|not there for me)\b/i,
        guidance:
          "When this schema is triggered, pause and reality-check: what evidence shows you are fully abandoned, and what evidence shows ongoing support or stability?",
      },
      {
        name: "Defectiveness / shame",
        pattern:
          /\b(i am broken|i am unlovable|i am not enough|something is wrong with me|i am bad)\b/i,
        guidance:
          "Practice compassionate reparenting language: speak to yourself as you would to someone you deeply care about who felt ashamed.",
      },
      {
        name: "Unrelenting standards",
        pattern:
          /\b(perfect|perfectly|not good enough|must do better|should have done more|never enough)\b/i,
        guidance:
          "Shift from perfection to sufficiency: define what 'good enough for today' looks like and complete that target first.",
      },
      {
        name: "Mistrust / abuse expectation",
        pattern:
          /\b(can't trust|they will hurt me|they will use me|people always betray)\b/i,
        guidance:
          "Differentiate past threat from present context: identify concrete present-day cues of safety vs. danger before acting.",
      },
      {
        name: "Failure / dependence",
        pattern:
          /\b(i can't do this|i will fail|i am incapable|i need someone to do this for me)\b/i,
        guidance:
          "Build mastery with one manageable step now. Small completed actions weaken failure/dependence schemas over time.",
      },
      {
        name: "Emotional deprivation",
        pattern:
          /\b(no one understands me|no one cares|my needs don't matter|i am alone in this)\b/i,
        guidance:
          "Name one emotional need clearly (comfort, understanding, reassurance) and choose one direct way to meet or request it.",
      },
    ] as const;

    const detectedSchemaThemes = schemaRules
      .filter((rule) => meaningfulSamples.some((sample) => rule.pattern.test(sample)))
      .slice(0, 3);

    detectedSchemaThemes.forEach((theme) => {
      schemaThemes.push(`Possible schema theme: ${theme.name}.`);
      schemaHealingProcesses.push(theme.guidance);
    });

    schemaHealingProcesses.push(
      "Schema healing process: identify the trigger, name the schema and coping style it activates, and pause before acting on autopilot.",
      "Healthy side builder: respond with a balanced 'healthy adult' statement that combines self-compassion with a practical next step.",
      "Coping style shift: when you notice surrender, avoidance, or overcompensation, choose one alternative behavior that supports your long-term values."
    );

    if (!moodCount && !reflectionCount) {
      return {
        title: "No entries yet",
        summary:
          "Add a quick check-in or ABCD reflection to unlock structured CBT guidance.",
        themes,
        observations,
        actions,
        validations,
        distortions,
        socraticQuestions,
        restructuringSteps,
        experiments,
        schemaThemes,
        schemaHealingProcesses,
        safetyNote,
      };
    }

    if (narrativeSamples.length && !meaningfulSamples.length) {
      return {
        title: "Need clearer entries",
        summary:
          "Most text looks too short or random, so I cannot provide reliable CBT guidance yet.",
        themes: [],
        observations: [
          "I found entries, but they currently look like placeholder or low-detail text.",
          "Try writing one clear sentence for what happened, what you thought, and how strongly you felt (0-10).",
        ],
        actions: [
          "Example A (event): 'Team meeting ended and my manager gave brief feedback.'",
          "Example B (belief): 'I thought this means I am underperforming.'",
          "Example C/D: Add evidence for and against, then a balanced thought.",
        ],
        validations: [
          "It is okay to start small. Clear details help the tool support you better.",
        ],
        distortions: [],
        socraticQuestions: [],
        restructuringSteps: [],
        experiments: [],
        schemaThemes: [],
        schemaHealingProcesses: [
          "Add one specific situation, one belief, and one coping response so schema-healing guidance can be tailored to you.",
        ],
        safetyNote,
      };
    }

    if (
      narrativeSamples.length >= 3 &&
      meaningfulSamples.length < Math.ceil(narrativeSamples.length * 0.4)
    ) {
      observations.push(
        "Some entries look unclear or placeholder-like, so parts of this guidance may be less accurate today."
      );
      actions.push(
        "For stronger guidance, add specific context (who/what/where), one key thought, and one concrete piece of evidence for and against that thought."
      );
    }

    if (moodCount) {
      validations.push(
        "It is okay to feel the way you do right now. Noticing your feelings is an important first step."
      );
      observations.push(
        `You have recorded ${moodCount} quick check-in${
          moodCount === 1 ? "" : "s"
        } today.`
      );
      observations.push(
        `Your most common mood is ${topEmotion} and your average intensity is ${averageIntensity.toFixed(
          1
        )}/10.`
      );
    }

    if (latestMood) {
      validations.push(
        `It makes sense to feel ${latestMood.mood_emotion.toLowerCase()} in response to what you described.`
      );
      observations.push(
        `Your latest entry shows ${latestMood.mood_emotion} with an intensity of ${latestMood.mood_intensity}/10.`
      );
      if (latestMood.automatic_thoughts) {
        actions.push(
          `Notice the automatic thought: "${latestMood.automatic_thoughts}". Ask whether it is helpful and whether evidence supports it.`
        );
      }
      if (latestMood.physical_reaction) {
        actions.push(
          `Check in with your body: ${latestMood.physical_reaction}. Use a brief grounding exercise if you feel tense.`
        );
      }
    }

    if (reflectionCount) {
      observations.push(
        `You have completed ${reflectionCount} ABCD reflection${
          reflectionCount === 1 ? "" : "s"
        }.`
      );
    }

    if (latestReflection) {
      validations.push(
        `Your feelings are valid, especially when you experienced "${latestReflection.activating_event || latestReflection.belief}".`
      );
      if (latestReflection.belief) {
        actions.push(
          `Review the belief: "${latestReflection.belief}". Consider whether the evidence for it is stronger than the evidence against it.`
        );
      }
      if (latestReflection.evidence_for || latestReflection.evidence_against) {
        actions.push(
          "Balance your belief by comparing evidence for and against it before choosing your next response."
        );
      }
      if (latestReflection.balanced_perspective) {
        observations.push(
          `You generated a balanced perspective: "${latestReflection.balanced_perspective}". Use it to guide your next action.`
        );
      }
      if (latestReflection.activating_event) {
        themes.push(
          `Situations with similar triggers may be connected to "${latestReflection.activating_event}".`
        );
      }
    }

    const activityTexts = sortedRecords
      .map((record) => record.activity_behaviour)
      .filter(Boolean) as string[];
    const thoughtTexts = [
      ...sortedRecords.map((record) => record.automatic_thoughts).filter(Boolean),
      ...abcdEntries.map((entry) => entry.belief).filter(Boolean),
    ] as string[];

    const frequentActivities = Object.entries(wordCounts(activityTexts))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
    const frequentThoughts = Object.entries(wordCounts(thoughtTexts))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    if (frequentActivities.length) {
      themes.push(
        `You are noticing repeated activity themes such as ${frequentActivities.join(", ")}.`
      );
    }
    if (frequentThoughts.length) {
      themes.push(
        `Your thinking patterns often involve ${frequentThoughts.join(", ")}.`
      );
    }

    if (!actions.length) {
      actions.push(
        "Try describing what happened and how it affected your mood, then compare the thoughts you had with the facts of the situation."
      );
    }

    const primaryTrigger =
      latestReflection?.activating_event ||
      latestMood?.activity_behaviour ||
      "Recent emotionally difficult moment";
    const primaryThought =
      latestReflection?.belief ||
      latestMood?.automatic_thoughts ||
      "I am struggling with this situation";
    const evidenceFor = latestReflection?.evidence_for || "No evidence recorded yet.";
    const evidenceAgainst =
      latestReflection?.evidence_against ||
      "Look for objective facts that do not fully support the thought.";
    const balancedThought =
      latestReflection?.balanced_perspective ||
      "A balanced thought could include both what is hard and what is still possible.";

    const generatedReframe = buildBalancedReframe({
      thought: primaryThought,
      evidenceFor,
      evidenceAgainst,
      existingBalanced: latestReflection?.balanced_perspective || "",
    });

    restructuringSteps.push(
      `1) Trigger: ${primaryTrigger}`,
      `2) Automatic thought: ${primaryThought}`,
      `3) Evidence review - for: ${evidenceFor}`,
      `4) Evidence review - against: ${evidenceAgainst}`,
      `5) Balanced thought: ${generatedReframe || balancedThought}`,
      "6) Next step: choose one small action that aligns with your values in the next 24 hours."
    );

    experiments.push(
      `Prediction test: Write your prediction for "${primaryThought}" and rate confidence (0-100). After the event, compare prediction vs. outcome.`,
      "Behavioral experiment: Take one opposite action for 10 minutes (for example, brief walk, message someone supportive, or complete one small task).",
      "Attention experiment: Spend 2 minutes listing facts only (no interpretations), then re-rate your emotion intensity."
    );

    const uniqueSocratic = Array.from(new Set(socraticQuestions)).slice(0, 6);
    const uniqueDistortions = Array.from(new Set(distortions)).slice(0, 5);
    const uniqueSchemaThemes = Array.from(new Set(schemaThemes)).slice(0, 4);
    const uniqueSchemaHealingProcesses = Array.from(
      new Set(schemaHealingProcesses)
    ).slice(0, 5);

    return {
      title: "CBT Support for Today",
      summary:
        "This section uses CBT-informed coaching: spotting thinking patterns, asking Socratic questions, and guiding structured thought reframing.",
      themes,
      observations,
      actions,
      validations,
      distortions: uniqueDistortions,
      socraticQuestions: uniqueSocratic,
      restructuringSteps,
      experiments,
      schemaThemes: uniqueSchemaThemes,
      schemaHealingProcesses: uniqueSchemaHealingProcesses,
      safetyNote,
    };
  }, [sortedRecords, abcdEntries, topEmotion, averageIntensity]);

  const counsellorFlow = useMemo(() => {
    const depthLimits = {
      brief: { perspective: 3, patterns: 3, questions: 2 },
      standard: { perspective: 6, patterns: 6, questions: 4 },
      deep: { perspective: 8, patterns: 8, questions: 6 },
    }[counsellorDepth];

    const perspectiveItems = [
      ...counsellorAdvice.validations,
      ...counsellorAdvice.observations,
      ...counsellorAdvice.schemaHealingProcesses,
    ].slice(0, depthLimits.perspective);

    const patternsToExplore = [
      ...counsellorAdvice.distortions,
      ...counsellorAdvice.schemaThemes,
      ...counsellorAdvice.themes,
    ].slice(0, depthLimits.patterns);

    const guidedQuestions = counsellorAdvice.socraticQuestions.slice(
      0,
      depthLimits.questions
    );

    const fallbackReframeDraft =
      counsellorAdvice.restructuringSteps
        .find((step) => step.startsWith("5) Balanced thought:"))
        ?.replace("5) Balanced thought:", "").trim() ||
      "A balanced view can hold both what feels difficult right now and what is still possible next.";

    const selectedReframeEntry =
      reframeSourceId === "latest"
        ? reframeSourceEntries[0] || null
        : reframeSourceEntries.find((entry) => entry.id === reframeSourceId) ||
          null;

    const reframeDraft = selectedReframeEntry
      ? buildBalancedReframe({
          thought: selectedReframeEntry.belief || "",
          evidenceFor: selectedReframeEntry.evidence_for || "",
          evidenceAgainst: selectedReframeEntry.evidence_against || "",
          existingBalanced: selectedReframeEntry.balanced_perspective || "",
        })
      : fallbackReframeDraft;

    const reframeSourceLabel = selectedReframeEntry
      ? `ABCD reflection on ${selectedReframeEntry.entry_date} at ${formatTimeOnly(
          selectedReframeEntry.created_at
        )}`
      : "Latest available entry context";

    const nextStep =
      counsellorAdvice.actions[0] ||
      counsellorAdvice.experiments[0] ||
      "Choose one small action in the next 24 hours that supports your values.";

    return {
      perspectiveItems,
      patternsToExplore,
      guidedQuestions,
      reframeDraft,
      reframeSourceLabel,
      nextStep,
    };
  }, [
    counsellorAdvice,
    counsellorDepth,
    reframeSourceEntries,
    reframeSourceId,
  ]);

  if (!session) {
    return (
      <>
        <Styles />
        <main className="loginPage">
          <section className="loginCard">
            <div className="logo">♥</div>
            <h1 className="appTitle">Mood & Thought Tracker</h1>
            <p>
              {createAccountMode
                ? "Create your account with email and password."
                : "Sign in with email and password. Each person gets a private cloud journal."}
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

            {createAccountMode && (
              <>
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </>
            )}

            {!createAccountMode && (
              <button
                className="primaryButton"
                onClick={signIn}
                disabled={!email || !password || loadingAuth || creatingAccount}
              >
                {loadingAuth ? "Signing in..." : "Sign In"}
              </button>
            )}

            <button
              className="secondaryButton"
              onClick={signUp}
              disabled={
                !email ||
                !password ||
                (createAccountMode && !confirmPassword) ||
                loadingAuth ||
                creatingAccount
              }
            >
              {creatingAccount ? "Creating account..." : "Create account"}
            </button>

            {createAccountMode ? (
              <button
                className="secondaryButton"
                onClick={() => {
                  setCreateAccountMode(false);
                  setConfirmPassword("");
                  setAuthMessage("");
                }}
                disabled={loadingAuth || creatingAccount}
              >
                Back to sign in
              </button>
            ) : (
              <button
                className="secondaryButton"
                onClick={sendPasswordReset}
                disabled={!email || loadingAuth || creatingAccount || sendingReset}
              >
                {sendingReset ? "Sending reset email..." : "Reset password"}
              </button>
            )}

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
            <h1 className="appTitle">Mood & Thought Tracker</h1>
            <p>Signed in as {session.user.email}</p>
          </div>

          <div className="topBarActions">
            <button
              className="secondaryButton"
              onClick={() => setThemeName((current) => nextTheme(current))}
            >
              Theme: {themeLabel(themeName)}
            </button>

            <button
              className="secondaryButton"
              onClick={() => setPrivacyMode((current) => !current)}
            >
              {privacyMode ? "Unlock Screen" : "Privacy Lock"}
            </button>

            <button className="secondaryButton" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <section className="dateRow">
          <label>Select day</label>
          <div className="dateControls">
            <button
              type="button"
              className="dateNavButton"
              onClick={() =>
                setSelectedDate((current) => shiftIsoDate(current, -1))
              }
            >
              Previous day
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            <button
              type="button"
              className="dateNavButton"
              onClick={() => setSelectedDate(todayIso())}
            >
              Today
            </button>

            <button
              type="button"
              className="dateNavButton"
              onClick={() =>
                setSelectedDate((current) => shiftIsoDate(current, 1))
              }
            >
              Next day
            </button>
          </div>
        </section>

        {statusMessage && <div className="statusBox">{statusMessage}</div>}

        {undoPayload && undoExpiresAt && undoSecondsLeft > 0 && (
          <div className="undoBox">
            <span>
              Entry deleted. Undo available for {undoSecondsLeft}s.
            </span>
            <button className="secondaryButton" onClick={undoDelete}>
              Undo delete ({undoSecondsLeft}s)
            </button>
          </div>
        )}

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
            className={activeTab === "counsellor" ? "active" : ""}
            onClick={() => setActiveTab("counsellor")}
          >
            AI Counsellor
          </button>

          <button
            className={activeTab === "history" ? "active" : ""}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </nav>

        {privacyMode && (
          <div className="privacyNotice">
            Privacy lock is enabled. Your entries are blurred until you unlock.
          </div>
        )}

        <div className={privacyMode ? "privacyShielded" : ""}>

        {activeTab === "dashboard" && (
          <section className="dashboardStack">
            <div className="dashboardGrid">
              <DayAtAGlance
                title="Today's Snapshot"
                subtitle="A quick overview of how your day is tracking so far."
                loading={loadingRecords}
                quickCheckIns={sortedRecords.length}
                abcdReflections={abcdEntries.length}
                average={averageIntensity}
                topEmotion={topEmotion}
                highest={highestRecord}
              />

              <div className="card recentCard">
                <h2>Recent Activity</h2>

                {!recentActivity.length ? (
                  <p className="empty">No activity for this date yet.</p>
                ) : (
                  <div className="activityList">
                    {recentActivity.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="activityRow">
                        <div className="activityType">{item.type}</div>
                        <div className="activityContent">
                          <p>{item.detail || "-"}</p>
                          <span>{item.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card trendCard">
              <h2>7-Day Mood Trend</h2>
              {!weeklyTrend.length ? (
                <p className="empty">No trend data yet. Log a few entries to see movement.</p>
              ) : (
                <MiniTrendChart points={weeklyTrend} />
              )}
            </div>
          </section>
        )}

        {activeTab === "mood" && (
          <section>
            <div className="card">
              <h2>Quick Check-In</h2>

              <div className="checkinGrid">
                <section className="checkinGroup checkinOne">
                  <h3>Activity / Behaviour</h3>
                  <textarea
                    value={form.activity_behaviour}
                    placeholder="What are you doing? Where are you? Who are you with?"
                    onChange={(event) =>
                      setForm({ ...form, activity_behaviour: event.target.value })
                    }
                  />
                </section>

                <section className="checkinGroup checkinTwo">
                  <h3>Mood</h3>
                  <div className="splitRow">
                    <div>
                      <label>Emotion</label>
                      <select
                        value={
                          emotionOptions.includes(form.mood_emotion)
                            ? form.mood_emotion
                            : OTHER_EMOTION_VALUE
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm({
                            ...form,
                            mood_emotion:
                              value === OTHER_EMOTION_VALUE ? "" : value,
                          });
                        }}
                      >
                        {emotionOptions.map((emotion) => (
                          <option key={emotion} value={emotion}>
                            {emotion}
                          </option>
                        ))}
                        <option value={OTHER_EMOTION_VALUE}>Other (type your own)</option>
                      </select>

                      {!emotionOptions.includes(form.mood_emotion) && (
                        <input
                          type="text"
                          value={form.mood_emotion}
                          onChange={(event) =>
                            setForm({ ...form, mood_emotion: event.target.value })
                          }
                          placeholder="Enter a custom emotion"
                        />
                      )}
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
                </section>

                <section className="checkinGroup checkinThree">
                  <h3>Automatic Thoughts</h3>
                  <textarea
                    value={form.automatic_thoughts}
                    placeholder="What's on your mind? What are you thinking?"
                    onChange={(event) =>
                      setForm({ ...form, automatic_thoughts: event.target.value })
                    }
                  />
                </section>

                <section className="checkinGroup checkinFour">
                  <h3>Physical Reaction</h3>
                  <textarea
                    value={form.physical_reaction}
                    placeholder="How is your body feeling?"
                    onChange={(event) =>
                      setForm({ ...form, physical_reaction: event.target.value })
                    }
                  />
                </section>
              </div>

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

          </section>
        )}

        {activeTab === "abcd" && (
          <section className="card">
            <h2>ABCD Reflection</h2>

            <div className="abcdGrid">
              <section className="abcdGroup abcdA">
                <h3>A - Activating Event / Situation</h3>
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
              </section>

              <section className="abcdGroup abcdB">
                <h3>B - Belief / Thought</h3>
                <textarea
                  value={abcdForm.belief}
                  placeholder="What did you tell yourself? What meaning did you attach to the situation?"
                  onChange={(e) =>
                    setAbcdForm({ ...abcdForm, belief: e.target.value })
                  }
                />
              </section>

              <section className="abcdGroup abcdC">
                <h3>C - Consequences</h3>
                <div className="splitRow">
                  <div>
                    <label>Emotion</label>
                    <select
                      value={
                        emotionOptions.includes(abcdForm.emotion)
                          ? abcdForm.emotion
                          : OTHER_EMOTION_VALUE
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setAbcdForm({
                          ...abcdForm,
                          emotion: value === OTHER_EMOTION_VALUE ? "" : value,
                        });
                      }}
                    >
                      {emotionOptions.map((emotion) => (
                        <option key={emotion} value={emotion}>
                          {emotion}
                        </option>
                      ))}
                      <option value={OTHER_EMOTION_VALUE}>Other (type your own)</option>
                    </select>

                    {!emotionOptions.includes(abcdForm.emotion) && (
                      <input
                        type="text"
                        value={abcdForm.emotion}
                        onChange={(e) =>
                          setAbcdForm({ ...abcdForm, emotion: e.target.value })
                        }
                        placeholder="Enter a custom emotion"
                      />
                    )}
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
              </section>

              <section className="abcdGroup abcdD">
                <h3>D - Disputation</h3>
                <textarea
                  value={abcdForm.evidence_for}
                  placeholder="What evidence supports this belief?"
                  onChange={(e) =>
                    setAbcdForm({ ...abcdForm, evidence_for: e.target.value })
                  }
                />

                <textarea
                  value={abcdForm.evidence_against}
                  placeholder="What evidence does not support this belief?"
                  onChange={(e) =>
                    setAbcdForm({ ...abcdForm, evidence_against: e.target.value })
                  }
                />

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
              </section>
            </div>

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

        {activeTab === "counsellor" && (
          <section className="reportStack">
            <div className="card">
              <div className="cardHeaderRow">
                <h2>{counsellorAdvice.title}</h2>
                <div className="counsellorControls">
                  <select
                    aria-label="Choose counsellor depth"
                    value={counsellorDepth}
                    onChange={(event) =>
                      setCounsellorDepth(
                        event.target.value as "brief" | "standard" | "deep"
                      )
                    }
                  >
                    <option value="brief">Brief</option>
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              </div>
              <p>{counsellorAdvice.summary}</p>
            </div>

            <div className="adviceGrid">
              {counsellorFlow.perspectiveItems.length ? (
                <div className="card adviceCard validationCard">
                  <h3 className="adviceTitle">Perspective</h3>
                  <div className="adviceItems">
                    {counsellorFlow.perspectiveItems.map((item, index) => (
                      <div key={`perspective-${index}`} className="adviceItem">
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {counsellorFlow.patternsToExplore.length ? (
                <div className="card adviceCard">
                  <h3 className="adviceTitle">Patterns to Explore</h3>
                  <div className="adviceItems">
                    {counsellorFlow.patternsToExplore.map((item, index) => (
                      <div key={`pattern-${index}`} className="adviceItem">
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {counsellorFlow.guidedQuestions.length ? (
                <div className="card adviceCard">
                  <h3 className="adviceTitle">Guided Reflection Questions</h3>
                  <div className="adviceItems">
                    {counsellorFlow.guidedQuestions.map((item, index) => (
                      <div key={`question-${index}`} className="adviceItem">
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="card adviceCard reframeTopCard">
                <h3 className="adviceTitle">Reframe Draft</h3>
                <div className="reframeControls">
                  <select
                    aria-label="Choose reframe source"
                    value={reframeSourceId}
                    onChange={(event) => setReframeSourceId(event.target.value)}
                  >
                    <option value="latest">Latest ABCD reflection</option>
                    {reframeSourceEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.entry_date} {formatTimeOnly(entry.created_at)} - {(
                          entry.belief ||
                          entry.activating_event ||
                          "ABCD entry"
                        ).slice(0, 42)}
                      </option>
                    ))}
                  </select>
                  <p className="reframeSourceNote">
                    Source: {counsellorFlow.reframeSourceLabel}
                  </p>
                </div>
                <div className="adviceItems">
                  <div className="adviceItem">
                    <p>{counsellorFlow.reframeDraft}</p>
                  </div>
                </div>
              </div>

              <div className="card adviceCard">
                <h3 className="adviceTitle">One Next Step</h3>
                <div className="adviceItems">
                  <div className="adviceItem">
                    <p>{counsellorFlow.nextStep}</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="card safetyCard">
              <h3>Safety and Boundaries</h3>
              <p>{counsellorAdvice.safetyNote}</p>
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="card">
            <div className="cardHeaderRow">
              <h2>
                History for{" "}
                <span className="historyDateLabel">
                  {historyDateFilter || "All dates"}
                </span>
              </h2>
              <div className="historyControls">
                <div className="historyDateField">
                  <span className="historyDateFieldLabel">History date</span>
                  <select
                    aria-label="Choose history date filter"
                    value={historyDateFilter}
                    onChange={(event) => setHistoryDateFilter(event.target.value)}
                  >
                    <option value="">All dates</option>
                    {availableHistoryDates.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                  <span className="historyDateHint">Filter entries by day</span>
                </div>

                <select
                  aria-label="Choose history view"
                  value={historyView}
                  onChange={(event) =>
                    setHistoryView(event.target.value as "both" | "quick" | "abcd")
                  }
                >
                  <option value="both">All</option>
                  <option value="quick">Quick Check-Ins only</option>
                  <option value="abcd">ABCD Reflections only</option>
                </select>

                <button
                  className="secondaryButton"
                  onClick={exportCsv}
                  disabled={
                    historyView === "quick"
                      ? !filteredHistoryQuickRecords.length
                      : historyView === "abcd"
                      ? !filteredHistoryAbcdEntries.length
                      : !filteredHistoryQuickRecords.length &&
                        !filteredHistoryAbcdEntries.length
                  }
                >
                  Export CSV
                </button>

                <button
                  className="secondaryButton"
                  onClick={async () => {
                    await Promise.all([
                      loadMoodRecords(),
                      loadABCDEntries(),
                      loadHistoryData(),
                    ]);
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {loadingRecords || loadingHistory ? (
              <p className="empty">Loading...</p>
            ) : !hasVisibleHistory ? (
              <p className="empty">
                {historyView === "quick"
                  ? `No quick check-ins for ${historyDateFilter || "all dates"} yet.`
                  : historyView === "abcd"
                  ? `No ABCD reflections for ${historyDateFilter || "all dates"} yet.`
                  : `No history entries for ${historyDateFilter || "all dates"} yet.`}
              </p>
            ) : (
              <div className="historyStack">
                {showQuickHistory && (
                  <div>
                    <h3 className="historyHeading">Quick Check-Ins</h3>
                    {!filteredHistoryQuickRecords.length ? (
                      <p className="empty">
                        No quick check-ins for {historyDateFilter || "all dates"} yet.
                      </p>
                    ) : (
                      <div className="entriesList">
                        {filteredHistoryQuickRecords.map((record) => (
                          <article key={record.id} className="entryCard">
                            <button
                              className="historyItemToggle"
                              onClick={() =>
                                setExpandedHistoryKey((current) =>
                                  current === `quick-${record.id}`
                                    ? null
                                    : `quick-${record.id}`
                                )
                              }
                              aria-expanded={expandedHistoryKey === `quick-${record.id}`}
                            >
                              <div className="historyItemMeta">
                                <strong>{record.time}</strong>
                                <p>
                                  {record.automatic_thoughts ||
                                    record.activity_behaviour ||
                                    "No additional notes"}
                                </p>
                              </div>
                              <div className="entryTopActions">
                                <span className={badgeClass(record.mood_intensity)}>
                                  {record.mood_emotion} {record.mood_intensity}/10
                                </span>
                                <span className="historyItemHint">
                                  {expandedHistoryKey === `quick-${record.id}`
                                    ? "Hide"
                                    : "Open"}
                                </span>
                              </div>
                            </button>

                            {expandedHistoryKey === `quick-${record.id}` && (
                              <div className="historyItemDetail">
                                <div className="reflectionHeader historyDetailHeader">
                                  <h4>Entry details</h4>
                                  <div className="reflectionHeaderActions">
                                    <button
                                      className="secondaryButton reflectionDeleteButton"
                                      onClick={() => beginQuickEdit(record)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="dangerButton reflectionDeleteButton"
                                      onClick={() => deleteMoodRecord(record)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                {editingQuickId === record.id ? (
                                  <div className="entryEditForm">
                                    <label>Mood Emotion</label>
                                    <input
                                      type="text"
                                      value={editMoodForm.mood_emotion}
                                      onChange={(event) =>
                                        setEditMoodForm({
                                          ...editMoodForm,
                                          mood_emotion: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Mood Intensity: {editMoodForm.mood_intensity}/10</label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="10"
                                      value={editMoodForm.mood_intensity}
                                      onChange={(event) =>
                                        setEditMoodForm({
                                          ...editMoodForm,
                                          mood_intensity: Number(event.target.value),
                                        })
                                      }
                                    />

                                    <label>Activity / Behaviour</label>
                                    <textarea
                                      value={editMoodForm.activity_behaviour}
                                      onChange={(event) =>
                                        setEditMoodForm({
                                          ...editMoodForm,
                                          activity_behaviour: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Automatic Thoughts</label>
                                    <textarea
                                      value={editMoodForm.automatic_thoughts}
                                      onChange={(event) =>
                                        setEditMoodForm({
                                          ...editMoodForm,
                                          automatic_thoughts: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Physical Reaction</label>
                                    <textarea
                                      value={editMoodForm.physical_reaction}
                                      onChange={(event) =>
                                        setEditMoodForm({
                                          ...editMoodForm,
                                          physical_reaction: event.target.value,
                                        })
                                      }
                                    />

                                    <div className="inlineActions">
                                      <button
                                        className="secondaryButton"
                                        onClick={() => saveQuickEdit(record.id)}
                                        disabled={!editMoodForm.mood_emotion || savingEdit}
                                      >
                                        {savingEdit ? "Saving..." : "Save changes"}
                                      </button>
                                      <button
                                        className="secondaryButton"
                                        onClick={cancelEntryEdit}
                                        disabled={savingEdit}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
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
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showAbcdHistory && (
                  <div>
                    <h3 className="historyHeading">ABCD Reflections</h3>
                    {!filteredHistoryAbcdEntries.length ? (
                      <p className="empty">
                        No ABCD reflections for {historyDateFilter || "all dates"} yet.
                      </p>
                    ) : (
                      <div className="entriesList">
                        {filteredHistoryAbcdEntries.map((entry) => (
                          <article key={`history-${entry.id}`} className="reflectionCard">
                            <button
                              className="historyItemToggle"
                              onClick={() =>
                                setExpandedHistoryKey((current) =>
                                  current === `abcd-${entry.id}`
                                    ? null
                                    : `abcd-${entry.id}`
                                )
                              }
                              aria-expanded={expandedHistoryKey === `abcd-${entry.id}`}
                            >
                              <div className="historyItemMeta">
                                <strong>{formatTimeOnly(entry.created_at)}</strong>
                                <p>
                                  {entry.belief ||
                                    entry.activating_event ||
                                    "No belief details"}
                                </p>
                              </div>
                              <div className="entryTopActions">
                                <span className={badgeClass(entry.emotion_intensity)}>
                                  {entry.emotion} {entry.emotion_intensity}/10
                                </span>
                                <span className="historyItemHint">
                                  {expandedHistoryKey === `abcd-${entry.id}`
                                    ? "Hide"
                                    : "Open"}
                                </span>
                              </div>
                            </button>

                            {expandedHistoryKey === `abcd-${entry.id}` && (
                              <div className="historyItemDetail">
                                <div className="reflectionHeader historyDetailHeader">
                                  <h4>Reflection details</h4>
                                  <div className="reflectionHeaderActions">
                                    <button
                                      className="secondaryButton reflectionDeleteButton"
                                      onClick={() => beginAbcdEdit(entry)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="dangerButton reflectionDeleteButton"
                                      onClick={() => deleteABCDEntry(entry)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                {editingAbcdId === entry.id ? (
                                  <div className="entryEditForm">
                                    <label>A - Activating Event</label>
                                    <textarea
                                      value={editAbcdForm.activating_event}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          activating_event: event.target.value,
                                        })
                                      }
                                    />

                                    <label>B - Belief</label>
                                    <textarea
                                      value={editAbcdForm.belief}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          belief: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Emotion</label>
                                    <input
                                      type="text"
                                      value={editAbcdForm.emotion}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          emotion: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Emotion Intensity: {editAbcdForm.emotion_intensity}/10</label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="10"
                                      value={editAbcdForm.emotion_intensity}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          emotion_intensity: Number(event.target.value),
                                        })
                                      }
                                    />

                                    <label>Behavioural Consequence</label>
                                    <textarea
                                      value={editAbcdForm.behavioural_consequence}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          behavioural_consequence: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Physical Consequence</label>
                                    <textarea
                                      value={editAbcdForm.physical_consequence}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          physical_consequence: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Evidence For</label>
                                    <textarea
                                      value={editAbcdForm.evidence_for}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          evidence_for: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Evidence Against</label>
                                    <textarea
                                      value={editAbcdForm.evidence_against}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          evidence_against: event.target.value,
                                        })
                                      }
                                    />

                                    <label>Balanced Perspective</label>
                                    <textarea
                                      value={editAbcdForm.balanced_perspective}
                                      onChange={(event) =>
                                        setEditAbcdForm({
                                          ...editAbcdForm,
                                          balanced_perspective: event.target.value,
                                        })
                                      }
                                    />

                                    <div className="inlineActions">
                                      <button
                                        className="secondaryButton"
                                        onClick={() => saveAbcdEdit(entry.id)}
                                        disabled={
                                          !editAbcdForm.activating_event ||
                                          !editAbcdForm.belief ||
                                          savingEdit
                                        }
                                      >
                                        {savingEdit ? "Saving..." : "Save changes"}
                                      </button>
                                      <button
                                        className="secondaryButton"
                                        onClick={cancelEntryEdit}
                                        disabled={savingEdit}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="reflectionSections">
                                    <section className="reflectionBlock reflectionA">
                                      <h4>A - Activating Event</h4>
                                      <p>{entry.activating_event}</p>
                                    </section>

                                    <section className="reflectionBlock reflectionB">
                                      <h4>B - Belief</h4>
                                      <p>{entry.belief}</p>
                                    </section>

                                    <section className="reflectionBlock reflectionC">
                                      <h4>C - Consequences</h4>
                                      <p>
                                        Emotion: {entry.emotion} ({entry.emotion_intensity}/10)
                                      </p>
                                      <p>Behaviour: {entry.behavioural_consequence || "-"}</p>
                                      <p>Physical: {entry.physical_consequence || "-"}</p>
                                    </section>

                                    <section className="reflectionBlock reflectionD">
                                      <h4>D - Disputation</h4>
                                      <p>Evidence for: {entry.evidence_for || "-"}</p>
                                      <p>Evidence against: {entry.evidence_against || "-"}</p>
                                      <p>Balanced view: {entry.balanced_perspective || "-"}</p>
                                    </section>
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        </div>
      </main>
    </>
  );
}

function DayAtAGlance({
  title = "Day at a Glance",
  subtitle,
  loading,
  quickCheckIns,
  abcdReflections,
  average,
  topEmotion,
  highest,
}: {
  title?: string;
  subtitle?: string;
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
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}

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

function MiniTrendChart({
  points,
}: {
  points: Array<{ date: string; average: number }>;
}) {
  if (!points.length) return null;

  const width = 420;
  const height = 120;
  const padX = 16;
  const padY = 12;
  const maxY = 10;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;

  const graphPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * usableWidth;
    const y = padY + ((maxY - point.average) / maxY) * usableHeight;
    return { ...point, x, y };
  });

  const polylinePoints = graphPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const latest = points[points.length - 1];
  const earliest = points[0];
  const delta = latest.average - earliest.average;

  return (
    <div className="miniTrend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="7-day mood trend">
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#dbe4f0" />
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="#dbe4f0"
        />
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints}
        />
        {graphPoints.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="#6366f1"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="miniTrendLabels">
        {points.map((point) => (
          <span key={`${point.date}-label`}>{point.date.slice(5)}</span>
        ))}
      </div>

      <p className="miniTrendSummary">
        {delta >= 0 ? "Up" : "Down"} {Math.abs(delta).toFixed(1)} points over the past
        {" "}{points.length} days.
      </p>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      :root {
        color-scheme: light dark;
        --page-glow-1: rgba(129, 140, 248, 0.18);
        --page-glow-2: rgba(244, 114, 182, 0.16);
        --page-grad-1: #f8fbff;
        --page-grad-2: #f5f7ff;
        --page-grad-3: #fdf2f8;
        --blob-1: #818cf8;
        --blob-2: #f472b6;
        --title-1: #0f172a;
        --title-2: #3730a3;
        --title-3: #be185d;
        --primary-1: #4f46e5;
        --primary-2: #6366f1;
        --primary-shadow: rgba(79, 70, 229, 0.2);
        --tab-active-1: #ffffff;
        --tab-active-2: #eef2ff;
        --tab-active-text: #312e81;
        --text-main: #0f172a;
        --text-muted: #475569;
        --label-color: #334155;
        --input-bg: rgba(255, 255, 255, 0.92);
        --input-border: #dbe4f0;
        --surface-1: rgba(255, 255, 255, 0.9);
        --surface-2: rgba(245, 247, 255, 0.92);
        --surface-border: rgba(226, 232, 240, 0.9);
        --tab-bg-1: rgba(226,232,240,0.7);
        --tab-bg-2: rgba(241,245,249,0.95);
        --secondary-bg-1: #f8fafc;
        --secondary-bg-2: #eef2ff;
        --secondary-text: #0f172a;
        --secondary-border: #dbe4f0;
      }

      body[data-theme="ocean"] {
        --page-glow-1: rgba(14, 116, 144, 0.2);
        --page-glow-2: rgba(56, 189, 248, 0.18);
        --page-grad-1: #f4fbff;
        --page-grad-2: #ecfeff;
        --page-grad-3: #eefaff;
        --blob-1: #0ea5e9;
        --blob-2: #22d3ee;
        --title-1: #0f172a;
        --title-2: #0e7490;
        --title-3: #0369a1;
        --primary-1: #0284c7;
        --primary-2: #0ea5e9;
        --primary-shadow: rgba(2, 132, 199, 0.25);
        --tab-active-1: #f0f9ff;
        --tab-active-2: #e0f2fe;
        --tab-active-text: #0c4a6e;
      }

      body[data-theme="forest"] {
        --page-glow-1: rgba(22, 163, 74, 0.2);
        --page-glow-2: rgba(132, 204, 22, 0.18);
        --page-grad-1: #f6fff8;
        --page-grad-2: #f0fdf4;
        --page-grad-3: #f7fee7;
        --blob-1: #22c55e;
        --blob-2: #84cc16;
        --title-1: #14532d;
        --title-2: #15803d;
        --title-3: #3f6212;
        --primary-1: #16a34a;
        --primary-2: #22c55e;
        --primary-shadow: rgba(22, 163, 74, 0.24);
        --tab-active-1: #f7fee7;
        --tab-active-2: #dcfce7;
        --tab-active-text: #14532d;
      }

      body[data-theme="dark"] {
        --page-glow-1: rgba(30, 41, 59, 0.7);
        --page-glow-2: rgba(67, 56, 202, 0.35);
        --page-grad-1: #0b1120;
        --page-grad-2: #111827;
        --page-grad-3: #1e1b4b;
        --blob-1: #1d4ed8;
        --blob-2: #7c3aed;
        --title-1: #e2e8f0;
        --title-2: #a5b4fc;
        --title-3: #67e8f9;
        --primary-1: #6366f1;
        --primary-2: #8b5cf6;
        --primary-shadow: rgba(99, 102, 241, 0.32);
        --tab-active-1: #1e293b;
        --tab-active-2: #334155;
        --tab-active-text: #e2e8f0;
        --text-main: #e2e8f0;
        --text-muted: #cbd5e1;
        --label-color: #cbd5e1;
        --input-bg: rgba(15, 23, 42, 0.85);
        --input-border: rgba(71, 85, 105, 0.9);
        --surface-1: rgba(15, 23, 42, 0.84);
        --surface-2: rgba(30, 41, 59, 0.8);
        --surface-border: rgba(71, 85, 105, 0.9);
        --tab-bg-1: rgba(30, 41, 59, 0.86);
        --tab-bg-2: rgba(15, 23, 42, 0.9);
        --secondary-bg-1: #1e293b;
        --secondary-bg-2: #334155;
        --secondary-text: #e2e8f0;
        --secondary-border: rgba(100, 116, 139, 0.95);
      }

      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, var(--page-glow-1), transparent 24%),
          radial-gradient(circle at bottom right, var(--page-glow-2), transparent 26%),
          linear-gradient(135deg, var(--page-grad-1) 0%, var(--page-grad-2) 45%, var(--page-grad-3) 100%);
        color: var(--text-main);
      }

      body::before,
      body::after {
        content: "";
        position: fixed;
        width: 320px;
        height: 320px;
        border-radius: 50%;
        filter: blur(70px);
        opacity: 0.35;
        pointer-events: none;
        z-index: -1;
      }

      body::before {
        top: -80px;
        left: -80px;
        background: var(--blob-1);
      }

      body::after {
        bottom: -80px;
        right: -80px;
        background: var(--blob-2);
      }

      button, input, textarea, select {
        font: inherit;
      }

      button {
        transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }

      button:hover {
        transform: translateY(-1px);
      }

      label {
        display: block;
        font-weight: 700;
        margin-bottom: 0.45rem;
        color: var(--label-color);
      }

      input, textarea, select {
        width: 100%;
        border: 1px solid var(--input-border);
        border-radius: 16px;
        padding: 0.85rem 0.95rem;
        background: var(--input-bg);
        color: var(--text-main);
        margin-bottom: 1rem;
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      input:focus, textarea:focus, select:focus {
        outline: none;
        border-color: #818cf8;
        box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.16);
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

      .appTitle {
        font-weight: 820;
        line-height: 1.24;
        letter-spacing: -0.02em;
        margin-bottom: 0.35rem;
        padding: 0.08em 0 0.14em;
        display: block;
        overflow: visible;
        background: linear-gradient(120deg, var(--title-1) 0%, var(--title-2) 45%, var(--title-3) 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        filter: drop-shadow(0 1px 0 rgba(15, 23, 42, 0.14))
          drop-shadow(0 4px 10px rgba(79, 70, 229, 0.14));
        text-wrap: balance;
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
        max-width: 520px;
        display: grid;
        gap: 1rem;
        background: color-mix(in srgb, var(--surface-1) 88%, transparent);
        backdrop-filter: blur(18px);
        border: 1px solid color-mix(in srgb, var(--surface-border) 70%, transparent);
        border-radius: 30px;
        padding: 2rem;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      }

      .loginCard .appTitle {
        line-height: 1.1;
        font-size: clamp(1.8rem, 5vw, 2.3rem);
        white-space: normal;
      }

      .loginCard p {
        margin-bottom: 0;
        color: var(--text-muted);
        line-height: 1.8;
      }

      .loginCard .secondaryButton {
        width: 100%;
        margin-top: 0;
      }

      .logo {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: linear-gradient(135deg, #ffe4e6 0%, #fdf2f8 100%);
        color: #e11d48;
        font-size: 1.9rem;
        margin-bottom: 1rem;
        box-shadow: 0 10px 24px rgba(225, 29, 72, 0.16);
      }

      .warning {
        background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 0.9rem;
        border-radius: 14px;
        margin: 1rem 0;
      }

      .message,
      .statusBox {
        color: var(--text-muted);
      }

      .statusBox {
        background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
        border: 1px solid #c7d2fe;
        border-radius: 16px;
        padding: 0.85rem 1rem;
        margin-bottom: 1rem;
      }

      .undoBox {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        background: linear-gradient(135deg, #fff9eb 0%, #fff4cf 100%);
        border: 1px solid #fde68a;
        border-radius: 16px;
        padding: 0.75rem 0.95rem;
        margin-bottom: 1rem;
      }

      .undoBox span {
        color: #78350f;
        font-size: 0.9rem;
      }

      .appShell {
        width: min(1240px, 100%);
        margin: 0 auto;
        padding: 1rem;
      }

      .topBar {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin: 1rem 0 1.25rem;
        padding: 1.25rem 1.4rem;
        border-radius: 28px;
        background: linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%);
        border: 1px solid var(--surface-border);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
      }

      .topBarActions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .topBar .appTitle {
        font-size: clamp(1.8rem, 3vw, 2.6rem);
      }

      .topBar p {
        color: var(--text-muted);
        line-height: 1.45;
        font-size: 0.74rem;
        margin-bottom: 0;
      }

      .dateRow {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 249, 0.92) 100%);
        border: 1px solid rgba(203, 213, 225, 0.9);
        border-radius: 999px;
        padding: 0.45rem 0.6rem 0.45rem 0.9rem;
        margin-bottom: 1rem;
        width: fit-content;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(8px);
      }

      .dateRow label {
        margin: 0;
        white-space: nowrap;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: #64748b;
      }

      .dateRow input[type="date"] {
        width: auto;
        min-width: 205px;
        margin: 0;
        border: 0;
        border-radius: 12px;
        padding: 0.62rem 0.78rem;
        font-weight: 650;
        color: #0f172a;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: inset 0 0 0 1px #d5deea, 0 1px 2px rgba(15, 23, 42, 0.05);
      }

      .dateRow input[type="date"]:focus {
        box-shadow: inset 0 0 0 1px #818cf8, 0 0 0 3px rgba(129, 140, 248, 0.14);
      }

      .dateRow input[type="date"]::-webkit-calendar-picker-indicator {
        border-radius: 8px;
        padding: 0.2rem;
        background-color: #eef2ff;
        cursor: pointer;
      }

      .dateControls {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .dateNavButton {
        border: 1px solid #dbe4f0;
        border-radius: 999px;
        padding: 0.5rem 0.75rem;
        background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
        color: #0f172a;
        font-weight: 700;
        font-size: 0.82rem;
        white-space: nowrap;
      }

      .tabs {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.35rem;
        background: linear-gradient(135deg, var(--tab-bg-1) 0%, var(--tab-bg-2) 100%);
        border-radius: 20px;
        padding: 0.35rem;
        margin-bottom: 1rem;
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
        overflow-x: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(99, 102, 241, 0.5) transparent;
      }

      .tabs::-webkit-scrollbar {
        height: 8px;
      }

      .tabs::-webkit-scrollbar-thumb {
        background: rgba(99, 102, 241, 0.35);
        border-radius: 999px;
      }

      .tabs button {
        flex: 1 1 auto;
        min-width: 140px;
        border: 0;
        border-radius: 14px;
        padding: 0.8rem 0.9rem;
        background: transparent;
        cursor: pointer;
        color: var(--text-muted);
        font-weight: 700;
        white-space: nowrap;
      }

      .tabs button.active {
        background: linear-gradient(135deg, var(--tab-active-1) 0%, var(--tab-active-2) 100%);
        color: var(--tab-active-text);
        box-shadow: 0 8px 16px rgba(99, 102, 241, 0.16);
      }

      .privacyNotice {
        border: 1px solid #dbeafe;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-radius: 16px;
        color: #1e3a8a;
        padding: 0.7rem 0.9rem;
        margin-bottom: 1rem;
      }

      .privacyShielded {
        filter: blur(8px);
        opacity: 0.82;
        pointer-events: none;
        user-select: none;
      }

      .dashboardGrid,
      .gridTwo {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
        gap: 1rem;
        align-items: start;
      }

      .dashboardStack {
        display: grid;
        gap: 1rem;
      }

      .trendCard {
        display: grid;
        gap: 0.65rem;
      }

      .miniTrend {
        width: 100%;
        display: grid;
        gap: 0.55rem;
      }

      .miniTrend svg {
        width: 100%;
        height: 120px;
      }

      .miniTrendLabels {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        color: #64748b;
        font-size: 0.78rem;
      }

      .miniTrendSummary {
        color: #334155;
        font-size: 0.9rem;
      }


      .counsellorSummaryGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
      }

      .counsellorSummaryStat {
        border: 1px solid #dbe4f0;
        border-radius: 16px;
        padding: 0.75rem 0.85rem;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      }

      .counsellorSummaryStat span {
        display: block;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin-bottom: 0.25rem;
      }

      .counsellorSummaryStat strong {
        color: #0f172a;
        font-size: 1.08rem;
      }

      .reportStack {
        display: grid;
        gap: 1rem;
      }

      .card {
        background: var(--surface-1);
        border: 1px solid var(--surface-border);
        border-radius: 24px;
        padding: 1.25rem;
        box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
        backdrop-filter: blur(10px);
      }

      .card h2 {
        margin-bottom: 1rem;
      }

      .adviceSection {
        margin-top: 1rem;
      }

      .adviceSection h3 {
        margin-bottom: 0.75rem;
        color: #334155;
      }

      .adviceGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        align-items: stretch;
      }

      .adviceCard {
        border: 1px solid rgba(165, 180, 252, 0.4);
        background: linear-gradient(180deg, rgba(248, 250, 255, 0.96) 0%, rgba(238, 242, 255, 0.92) 100%);
      }

      .adviceTitle {
        margin: 0 0 0.8rem;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #4338ca;
      }

      .validationCard {
        border-color: rgba(251, 191, 36, 0.35);
        background: linear-gradient(180deg, rgba(255, 251, 235, 0.92) 0%, rgba(255, 247, 219, 0.96) 100%);
      }

      .safetyCard {
        border: 1px solid rgba(251, 191, 36, 0.45);
        background: linear-gradient(135deg, #fff9eb 0%, #fff4cf 100%);
      }

      .safetyCard h3 {
        margin: 0 0 0.5rem;
        color: #92400e;
      }

      .safetyCard p {
        margin: 0;
        color: #78350f;
        line-height: 1.55;
      }

      .adviceItems {
        display: grid;
        gap: 0.75rem;
      }

      .adviceItem {
        padding: 1rem;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      }

      .adviceItem p {
        margin: 0;
        color: #334155;
        line-height: 1.6;
      }

      .reframeControls {
        margin-bottom: 0.8rem;
      }

      .reframeControls select {
        margin: 0 0 0.45rem;
      }

      .reframeSourceNote {
        margin: 0;
        color: #64748b;
        font-size: 0.82rem;
      }

      .cardHeaderRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .exportControls {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .historyControls {
        display: flex;
        align-items: center;
        flex-wrap: nowrap;
        gap: 0.5rem;
      }

      .historyDateField {
        display: grid;
        gap: 0.2rem;
      }

      .historyDateFieldLabel {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
      }

      .historyDateHint {
        font-size: 0.72rem;
        color: #64748b;
      }

      .exportControls select {
        margin: 0;
        min-width: 210px;
      }

      .historyControls select {
        margin: 0;
        width: auto;
        min-width: 175px;
        flex: 0 0 auto;
      }

      .historyControls input[type="date"] {
        margin: 0;
        width: auto;
        min-width: 148px;
        flex: 0 0 auto;
        border-radius: 999px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #0f172a;
        padding: 0.55rem 0.8rem;
        font-size: 0.9rem;
        font-family: inherit;
      }

      .historyControls input[type="date"]:focus {
        outline: none;
        border-color: #7c9cff;
        box-shadow: 0 0 0 3px rgba(124, 156, 255, 0.15);
      }

      .historyDateLabel {
        white-space: nowrap;
      }

      .counsellorControls select {
        margin: 0;
        width: auto;
        min-width: 130px;
      }
      }

      .splitRow {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .checkinGrid {
        display: grid;
        gap: 1rem;
      }

      .checkinGroup {
        border-radius: 20px;
        border: 1px solid;
        padding: 1rem;
      }

      .checkinGroup h3 {
        margin: 0 0 0.85rem;
        font-size: 1.02rem;
        letter-spacing: 0.01em;
      }

      .checkinGroup label {
        color: #334155;
      }

      .checkinGroup textarea,
      .checkinGroup select,
      .checkinGroup input {
        background: rgba(255, 255, 255, 0.94);
      }

      .checkinOne {
        border-color: #f5b342;
        background: linear-gradient(135deg, #fff8eb 0%, #fff2d5 100%);
      }

      .checkinOne h3 {
        color: #92400e;
      }

      .checkinTwo {
        border-color: #c4b5fd;
        background: linear-gradient(135deg, #f6f3ff 0%, #ede9fe 100%);
      }

      .checkinTwo h3 {
        color: #5b21b6;
      }

      .checkinThree {
        border-color: #7dd3fc;
        background: linear-gradient(135deg, #eff9ff 0%, #e0f2fe 100%);
      }

      .checkinThree h3 {
        color: #0c4a6e;
      }

      .checkinFour {
        border-color: #86efac;
        background: linear-gradient(135deg, #effdf4 0%, #dcfce7 100%);
      }

      .checkinFour h3 {
        color: #166534;
      }

      .abcdGrid {
        display: grid;
        gap: 1rem;
      }

      .abcdGroup {
        border-radius: 20px;
        border: 1px solid;
        padding: 1rem;
      }

      .abcdGroup h3 {
        margin: 0 0 0.85rem;
        font-size: 1.02rem;
        letter-spacing: 0.01em;
      }

      .abcdGroup label {
        color: #334155;
      }

      .abcdGroup textarea,
      .abcdGroup select,
      .abcdGroup input {
        background: rgba(255, 255, 255, 0.94);
      }

      .abcdA {
        border-color: #93c5fd;
        background: linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%);
      }

      .abcdA h3 {
        color: #1e40af;
      }

      .abcdB {
        border-color: #a5b4fc;
        background: linear-gradient(135deg, #f4f5ff 0%, #e0e7ff 100%);
      }

      .abcdB h3 {
        color: #4338ca;
      }

      .abcdC {
        border-color: #67e8f9;
        background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
      }

      .abcdC h3 {
        color: #155e75;
      }

      .abcdD {
        border-color: #6ee7b7;
        background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      }

      .abcdD h3 {
        color: #065f46;
      }

      .primaryButton,
      .secondaryButton,
      .dangerButton {
        display: inline-flex;
        align-items: center;
        border: 0;
        border-radius: 14px;
        padding: 0.85rem 1rem;
        cursor: pointer;
        font-weight: 800;
      }

      .primaryButton {
        width: 100%;
        background: linear-gradient(135deg, var(--primary-1) 0%, var(--primary-2) 100%);
        color: white;
        margin-top: 1rem;
        box-shadow: 0 12px 24px var(--primary-shadow);
      }

      .secondaryButton {
        background: linear-gradient(135deg, var(--secondary-bg-1) 0%, var(--secondary-bg-2) 100%);
        color: var(--secondary-text);
        border: 1px solid var(--secondary-border);
      }

      .dangerButton {
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
        color: #be123c;
        border: 1px solid #fecdd3;
        margin-top: 1rem;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
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
        background: linear-gradient(135deg, #f8fafc 0%, #f5f3ff 100%);
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
        font-size: 1.25rem;
        color: #111827;
      }

      .highlightBox {
        border: 1px solid #fecdd3;
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
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

      .historyStack {
        display: grid;
        gap: 1.25rem;
      }

      .historyHeading {
        margin: 0 0 0.75rem;
        font-size: 0.95rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #475569;
      }

      .historyItemToggle {
        width: 100%;
        border: 0;
        padding: 0;
        margin: 0;
        background: transparent;
        text-align: left;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .historyItemToggle:hover {
        transform: none;
      }

      .historyItemMeta {
        display: grid;
        gap: 0.3rem;
      }

      .historyItemMeta p {
        margin: 0;
        color: #64748b;
        line-height: 1.45;
      }

      .historyItemHint {
        font-size: 0.75rem;
        color: #475569;
        background: #f1f5f9;
        border: 1px solid #dbe4f0;
        border-radius: 999px;
        padding: 0.28rem 0.55rem;
        white-space: nowrap;
      }

      .historyItemDetail {
        margin-top: 0.9rem;
        padding-top: 0.9rem;
        border-top: 1px solid #e2e8f0;
      }

      .entryEditForm {
        display: grid;
        gap: 0.5rem;
      }

      .entryEditForm textarea,
      .entryEditForm input,
      .entryEditForm select {
        margin-bottom: 0.25rem;
      }

      .inlineActions {
        display: flex;
        gap: 0.55rem;
        margin-top: 0.35rem;
        flex-wrap: wrap;
      }

      .historyDetailHeader {
        margin-bottom: 0.85rem;
      }

      .historyDetailHeader h4 {
        margin: 0;
        font-size: 0.9rem;
        color: #334155;
      }

      .activityRow,
      .entryCard,
      .reflectionCard {
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 1rem;
        background: linear-gradient(135deg, #ffffff 0%, #fafafe 100%);
      }

      .activityRow {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.75rem;
        align-items: start;
      }

      .activityType {
        font-weight: 700;
        font-size: 0.74rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #4338ca;
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        border-radius: 999px;
        padding: 0.35rem 0.55rem;
        white-space: nowrap;
      }

      .activityContent {
        display: grid;
        gap: 0.45rem;
      }

      .activityContent span {
        color: #64748b;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .activityRow p,
      .entryGrid p,
      .reflectionCard p {
        color: #475569;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .reflectionCard {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
      }

      .reflectionHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .reflectionHeaderActions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .reflectionHeader h3 {
        margin: 0;
        font-size: 1rem;
        color: #0f172a;
      }

      .reflectionHeader span {
        color: #64748b;
        font-size: 0.8rem;
      }

      .reflectionDeleteButton {
        margin-top: 0;
        padding: 0.35rem 0.65rem;
        font-size: 0.78rem;
      }

      .reflectionSections {
        display: grid;
        gap: 0.65rem;
      }

      .reflectionBlock {
        border: 1px solid;
        border-radius: 14px;
        padding: 0.7rem 0.8rem;
      }

      .reflectionBlock h4 {
        margin: 0 0 0.45rem;
        font-size: 0.9rem;
      }

      .reflectionA {
        border-color: #93c5fd;
        background: #eef6ff;
      }

      .reflectionA h4 {
        color: #1e40af;
      }

      .reflectionB {
        border-color: #a5b4fc;
        background: #f4f5ff;
      }

      .reflectionB h4 {
        color: #4338ca;
      }

      .reflectionC {
        border-color: #67e8f9;
        background: #ecfeff;
      }

      .reflectionC h4 {
        color: #155e75;
      }

      .reflectionD {
        border-color: #6ee7b7;
        background: #ecfdf5;
      }

      .reflectionD h4 {
        color: #065f46;
      }

      .entryTop {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
      }

      .entryTopActions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
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
          width: fit-content;
          margin-left: auto;
          margin-right: auto;
          flex-direction: column;
          align-items: center;
        }

        .dateControls {
          flex-wrap: wrap;
          justify-content: center;
        }

        .dateRow input {
          width: auto;
          min-width: 210px;
          margin-bottom: 0;
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

        .adviceGrid {
          grid-template-columns: 1fr;
        }

        .reframeTopCard {
          order: -1;
        }

        .activityRow {
          flex-direction: column;
          align-items: stretch;
        }

        .exportControls {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
        }

        .historyControls {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
        }

        .exportControls select {
          min-width: 0;
          width: 100%;
        }

        .historyControls select {
          min-width: 0;
          width: 100%;
        }

        .historyControls input[type="date"] {
          min-width: 0;
          width: 100%;
        }

        .activityRow {
          grid-template-columns: 1fr;
        }

        .reflectionHeader {
          flex-direction: column;
          align-items: flex-start;
        }

        .reflectionHeaderActions {
          width: 100%;
          justify-content: space-between;
        }
      }
    `}</style>
  );
}