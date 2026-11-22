import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type DailyQuiz, type DailyToday } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../useApi';
import { pushState, turnOnPush } from '../push';

/**
 * "Today" at the top of Discover: a 10-second "Where in the world?" photo quiz, your Wander streak, and a
 * question of the day. Small on purpose: a reason to open Weyvo daily, not a feed to get lost in.
 */
export function TodayCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, retry } = useApi(() => api.daily(), [user?.id]);
  const [quiz, setQuiz] = useState<DailyQuiz | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  // Right after a guess the result shows for a few seconds, then the quiz folds away.
  const [justPlayed, setJustPlayed] = useState(false);
  useEffect(() => {
    if (!justPlayed) return;
    const t = setTimeout(() => setJustPlayed(false), 4500);
    return () => clearTimeout(t);
  }, [justPlayed]);
  if (!data) return null;

  const q = quiz ?? data.quiz;
  const played = !!q?.myAnswer;
  const showQuiz = !!q && (!played || justPlayed);
  // Quiz played and question answered: just a slim line until tomorrow.
  if (user && (!q || played) && data.question.myAnswer && !justPlayed && !open) {
    return (
      <p className="today-done-strip" role="status">
        <span>✓ Done for today</span>
        <span className={`today-streak ${data.streak.days >= 3 ? 'hot' : ''}`}><span aria-hidden="true">🔥</span> {data.streak.days} {data.streak.days === 1 ? 'day' : 'days'}</span>
        <span className="today-done-next">New quiz tomorrow</span>
      </p>
    );
  }
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  async function guess(option: string) {
    if (!user) return navigate('/signin?mode=join&next=/discover');
    if (played || busy) return;
    setBusy(true);
    setError('');
    try {
      setQuiz(await api.dailyGuess(option));
      setJustPlayed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="today" aria-labelledby="today-title">
      <header className="today-head">
        <div>
          <p className="today-kicker">{day}</p>
          <h2 id="today-title" className="display">Today</h2>
        </div>
        {user && (
          <span className={`today-streak ${data.streak.days >= 3 ? 'hot' : ''}`} title={`${data.streak.nextBonusAt - data.streak.days} days to your next bonus`}>
            <span aria-hidden="true">🔥</span> {data.streak.days} {data.streak.days === 1 ? 'day' : 'days'}
          </span>
        )}
      </header>

      {showQuiz && q && (
        <div className={`today-quiz ${played ? 'leaving' : ''}`}>
          <div className="today-photo">
            <img src={q.photoUrl} alt="Mystery place" loading="lazy" />
            <span className="today-photo-label">Where in the world?</span>
            {played && (
              <span className={`today-verdict ${q.correct ? 'yes' : 'no'}`}>
                {q.correct ? '🎉 You got it! +10 Wey points' : `It's ${q.answer}`}
              </span>
            )}
          </div>
          <div className="today-options">
            {q.options.map((o) => {
              const state = !played ? '' : o === q.answer ? 'right' : o === q.myAnswer ? 'wrong' : 'dim';
              return (
                <button key={o} type="button" className={`today-option ${state}`} disabled={played || busy} onClick={() => guess(o)}>{o}</button>
              );
            })}
          </div>
          <p className="today-foot">
            {played
              ? <>{q.percentCorrect}% got it today{q.tripSlug && <> · <Link to={`/trips/${q.tripSlug}`}>See the story →</Link></>}</>
              : user ? 'One guess a day. Right answers earn 10 Wey points.' : <><Link to="/signin?mode=join&next=/discover">Join free</Link> to play and build a streak.</>}
          </p>
          {error && <p role="alert" className="today-error">{error}</p>}
        </div>
      )}

      <button type="button" className="today-question-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="today-q-icon" aria-hidden="true">💬</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <small>Question of the day</small>
          <strong>{data.question.today}</strong>
        </span>
        <span aria-hidden="true" className={`today-chev ${open ? 'open' : ''}`}>›</span>
      </button>
      {played && !justPlayed && (
        <p className="today-played">{q?.correct ? '🎉' : '🌍'} Today's place was <b>{q?.answer}</b>{q?.tripSlug && <> · <Link to={`/trips/${q.tripSlug}`}>See the story</Link></>}</p>
      )}
      {open && <QuestionPanel data={data} signedIn={!!user} onAnswered={retry} />}

      {user && !data.reminder && <ReminderLink />}
    </section>
  );
}

function QuestionPanel({ data, signedIn, onAnswered }: { data: DailyToday; signedIn: boolean; onAnswered: () => void }) {
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.dailyAnswer(text, place);
      onAnswered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="today-panel">
      {data.question.myAnswer ? (
        <p className="today-done">✓ You said “{data.question.myAnswer}”. See everyone's answers tomorrow.</p>
      ) : signedIn ? (
        <form onSubmit={send} className="today-answer">
          <input className="input" value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
          <input className="input" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder="Where? (optional)" aria-label="Where" />
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Answer'}</button>
          {error && <p role="alert" className="today-error">{error}</p>}
        </form>
      ) : (
        <p className="today-done"><Link to="/signin?mode=join&next=/discover">Join free</Link> to answer.</p>
      )}
      {data.question.yesterdayAnswers.length > 0 && (
        <div className="today-yesterday">
          <small>Yesterday · {data.question.yesterday}</small>
          <ul>
            {data.question.yesterdayAnswers.map((a) => (
              <li key={a.username}><Link to={`/u/${a.username}`}>{a.username}</Link> {a.body}{a.place && <em> · {a.place}</em>}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** "Remind me at 9 am": turns on notifications if needed, then the daily nudge. */
function ReminderLink() {
  const [state, setState] = useState<'idle' | 'on' | 'error'>('idle');
  if (state === 'on') return <p className="today-reminder">🔔 We'll nudge you at 9 am.</p>;
  return (
    <button type="button" className="today-reminder" onClick={async () => {
      try {
        if ((await pushState()) !== 'on' && (await turnOnPush()) !== 'on') return setState('error');
        await api.dailyReminder(true);
        setState('on');
      } catch {
        setState('error');
      }
    }}>
      {state === 'error' ? 'Notifications are off for Weyvo on this device' : '🔔 Remind me at 9 am'}
    </button>
  );
}
