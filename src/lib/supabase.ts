import { createClient } from '@supabase/supabase-js';

export const thoughtRecordColumns = [
  'id',
  'user_id',
  'date',
  'time',
  'activity_behaviour',
  'mood_emotion',
  'mood_intensity',
  'automatic_thoughts',
  'physical_reaction',
  'inserted_at',
].join(', ');

export const abcdEntryColumns = [
  'id',
  'user_id',
  'entry_date',
  'created_at',
  'activating_event',
  'belief',
  'emotion',
  'emotion_intensity',
  'behavioural_consequence',
  'physical_consequence',
  'evidence_for',
  'evidence_against',
  'balanced_perspective',
].join(', ');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = supabaseConfigured ? createClient(supabaseUrl!, supabaseKey!) : null;
