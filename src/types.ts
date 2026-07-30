export type ThoughtRecord = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  activity_behaviour: string | null;
  mood_emotion: string;
  mood_intensity: number;
  automatic_thoughts: string | null;
  physical_reaction: string | null;
  inserted_at?: string | null;
};

export type ABCDEntry = {
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

export type MoodFormState = {
  time: string;
  activity_behaviour: string;
  mood_emotion: string;
  mood_intensity: number;
  automatic_thoughts: string;
  physical_reaction: string;
};

export type ABCDFormState = {
  activating_event: string;
  belief: string;
  emotion: string;
  emotion_intensity: number;
  behavioural_consequence: string;
  physical_consequence: string;
  evidence_for: string;
  evidence_against: string;
  balanced_perspective: string;
};

export type AuthMode = 'signIn' | 'signUp' | 'reset';

export type Notice = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

export type TrendDay = {
  date: string;
  shortLabel: string;
  checkIns: number;
  abcdReflections: number;
  averageIntensity: number | null;
  dominantEmotion: string | null;
};
