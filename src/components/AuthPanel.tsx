import type { AuthMode, Notice } from '../types';

type AuthPanelProps = {
  configured: boolean;
  email: string;
  password: string;
  mode: AuthMode;
  loading: boolean;
  notice: Notice | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: () => void;
};

const contentByMode: Record<AuthMode, { title: string; description: string; action: string }> = {
  signIn: {
    title: 'Welcome back',
    description: 'Sign in to review your private mood journal and keep tracking today.',
    action: 'Sign in',
  },
  signUp: {
    title: 'Create your journal',
    description: 'Create an account so your entries stay private and sync through Supabase.',
    action: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    description: 'We will send a password reset email if the address belongs to an account.',
    action: 'Send reset link',
  },
};

export function AuthPanel({
  configured,
  email,
  password,
  mode,
  loading,
  notice,
  onEmailChange,
  onPasswordChange,
  onModeChange,
  onSubmit,
}: AuthPanelProps) {
  const content = contentByMode[mode];

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="brandBadge">♥</div>
        <p className="eyebrow">Mood & Thought Tracker</p>
        <h1>{content.title}</h1>
        <p className="authCopy">{content.description}</p>

        <div className="modeSwitch" role="tablist" aria-label="Authentication options">
          <button
            type="button"
            className={mode === 'signIn' ? 'active' : ''}
            onClick={() => onModeChange('signIn')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signUp' ? 'active' : ''}
            onClick={() => onModeChange('signUp')}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === 'reset' ? 'active' : ''}
            onClick={() => onModeChange('reset')}
          >
            Reset password
          </button>
        </div>

        {!configured && (
          <div className="notice notice--error">
            Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> before signing in.
          </div>
        )}

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          placeholder="name@example.com"
          onChange={(event) => onEmailChange(event.target.value)}
        />

        {mode !== 'reset' && (
          <>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              placeholder={mode === 'signUp' ? 'Create a password' : 'Enter your password'}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </>
        )}

        <button
          type="button"
          className="primaryButton"
          onClick={onSubmit}
          disabled={!configured || loading || !email.trim() || (mode !== 'reset' && !password)}
        >
          {loading ? 'Working...' : content.action}
        </button>

        {notice && <div className={`notice notice--${notice.tone}`}>{notice.text}</div>}
      </section>
    </main>
  );
}
