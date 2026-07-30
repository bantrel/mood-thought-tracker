# Mood & Thought Tracker

A private React + Supabase journal for capturing quick mood check-ins, writing ABCD reflections, and reviewing patterns across recent days.

## Features

- Email/password sign in, account creation, and password reset with Supabase Auth
- Quick Check-In flow for mood, intensity, context, thoughts, and physical reactions
- ABCD reflection workflow for reframing difficult situations
- Same-day review screens with edit, delete, refresh, and CSV export support
- 7-day trend summary showing activity volume and average mood intensity

## Tech stack

- React 19
- TypeScript
- Vite
- Supabase JS

## Prerequisites

- Node.js 20+
- A Supabase project with Auth enabled

## Environment variables

Create a `.env.local` file in `/home/runner/work/mood-thought-tracker/mood-thought-tracker` with:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

## Data model expectations

The app expects these Supabase tables:

### `thought_records`

- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users.id)
- `date` (date or yyyy-mm-dd text)
- `time` (HH:MM text)
- `activity_behaviour` (text, nullable)
- `mood_emotion` (text)
- `mood_intensity` (integer)
- `automatic_thoughts` (text, nullable)
- `physical_reaction` (text, nullable)
- `inserted_at` (timestamp, optional but supported)

### `abcd_entries`

- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users.id)
- `entry_date` (date or yyyy-mm-dd text)
- `created_at` (timestamp)
- `activating_event` (text)
- `belief` (text)
- `emotion` (text)
- `emotion_intensity` (integer)
- `behavioural_consequence` (text, nullable)
- `physical_consequence` (text, nullable)
- `evidence_for` (text, nullable)
- `evidence_against` (text, nullable)
- `balanced_perspective` (text, nullable)

Make sure row-level security policies restrict each table to the authenticated user’s own rows.

## Getting started

```bash
npm install
npm run dev
```

The app runs locally at the Vite default URL shown in the terminal.

## Available scripts

- `npm run dev` – start the Vite dev server
- `npm run build` – run TypeScript build checks and create a production bundle
- `npm run lint` – run ESLint across the project
- `npm run preview` – preview the production build locally

## Notes

- Dates are stored using local calendar dates to avoid UTC day drift in the UI.
- Mood entry times are normalized to 24-hour `HH:MM` values for easier sorting.
- There is currently no automated test suite in this repository.
