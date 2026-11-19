'use client';

import { useEffect, useState } from 'react';
import { api, errorText, formatMinutes, Movie, RewatchPlanData } from '@/lib/api';

export default function RewatchPlan() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [target, setTarget] = useState('');
  const [plan, setPlan] = useState<RewatchPlanData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listMovies().then(setMovies).catch((e) => setError(errorText(e)));
  }, []);

  const loadPlan = (id: string) =>
    api.rewatchOrder(Number(id)).then((p) => { setPlan(p); setError(''); })
      .catch((e) => setError(errorText(e)));

  const pick = (id: string) => {
    setTarget(id);
    setPlan(null);
    if (id) loadPlan(id);
  };

  async function toggleWatched(m: Movie) {
    try {
      await api.updateMovie(m.id, { watched: !m.watched });
      await loadPlan(target);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const pct = plan && plan.totalCount ? Math.round((plan.watchedCount / plan.totalCount) * 100) : 100;

  return (
    <section>
      <h2>Rewatch Plan</h2>
      {error && <div className="error" role="alert">{error}</div>}
      <select value={target} onChange={(e) => pick(e.target.value)} aria-label="Target movie">
        <option value="">Pick a target movie…</option>
        {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>

      {plan && (
        <div className="card">
          <h3>Before {plan.target.title}</h3>
          {plan.totalCount === 0 ? (
            <p>Nothing to rewatch first — you are ready to go! 🎬</p>
          ) : (
            <>
              <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <p>
                <strong>{plan.watchedCount} of {plan.totalCount} watched</strong> ·{' '}
                {plan.remainingRuntimeMinutes
                  ? `${formatMinutes(plan.remainingRuntimeMinutes)} left to watch`
                  : 'All caught up!'}
              </p>
              <ol className="list">
                {plan.order.map((m) => (
                  <li key={m.id}>
                    <label className="watched">
                      <input type="checkbox" checked={m.watched} onChange={() => toggleWatched(m)} />
                      <span className={m.watched ? 'done' : ''}>{m.title}</span>
                    </label>
                    <span className="muted"> {formatMinutes(m.runtimeMinutes)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  );
}
