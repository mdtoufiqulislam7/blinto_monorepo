'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, errorText, formatMinutes, Movie } from '@/lib/api';

const emptyForm = { title: '', releaseYear: '', runtimeMinutes: '', prerequisites: [] as number[] };
const toggle = (list: number[], id: number) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<number[]>([]);

  const load = useCallback(
    () => api.listMovies().then(setMovies).catch((e) => setError(errorText(e))),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const byId = new Map(movies.map((m) => [m.id, m]));

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createMovie({
        title: form.title,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        prerequisites: form.prerequisites,
      });
      setForm(emptyForm);
    });
  };

  return (
    <section>
      <h2>Movies</h2>
      {error && <div className="error" role="alert">{error}</div>}

      <form className="card" onSubmit={add}>
        <h3>Add a movie</h3>
        <div className="row">
          <input placeholder="Title" required maxLength={200} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Year" type="number" required min={1888} max={2100} value={form.releaseYear}
            onChange={(e) => setForm({ ...form, releaseYear: e.target.value })} />
          <input placeholder="Runtime (1-300 min)" type="number" required min={1} max={300}
            value={form.runtimeMinutes}
            onChange={(e) => setForm({ ...form, runtimeMinutes: e.target.value })} />
        </div>
        {movies.length > 0 && (
          <fieldset>
            <legend>Watch these first (optional)</legend>
            {movies.map((m) => (
              <label key={m.id} className="chip">
                <input type="checkbox" checked={form.prerequisites.includes(m.id)}
                  onChange={() => setForm({ ...form, prerequisites: toggle(form.prerequisites, m.id) })} />
                {m.title}
              </label>
            ))}
          </fieldset>
        )}
        <button type="submit">Add movie</button>
      </form>

      <ul className="list">
        {movies.map((m) => (
          <li key={m.id} className="card">
            <label className="watched">
              <input type="checkbox" checked={m.watched}
                onChange={(e) => run(() => api.updateMovie(m.id, { watched: e.target.checked }))} />
              <strong className={m.watched ? 'done' : ''}>{m.title}</strong>
            </label>
            <span className="muted">{m.releaseYear} · {formatMinutes(m.runtimeMinutes)}</span>
            <div className="muted">
              Watch first:{' '}
              {m.prerequisites.length
                ? m.prerequisites.map((p) => byId.get(p)?.title).join(', ')
                : 'nothing'}
            </div>
            {editing === m.id ? (
              <fieldset>
                <legend>Edit prerequisites</legend>
                {movies.filter((o) => o.id !== m.id).map((o) => (
                  <label key={o.id} className="chip">
                    <input type="checkbox" checked={draft.includes(o.id)}
                      onChange={() => setDraft(toggle(draft, o.id))} />
                    {o.title}
                  </label>
                ))}
                <div className="row">
                  <button type="button" onClick={() => run(async () => {
                    await api.updateMovie(m.id, { prerequisites: draft });
                    setEditing(null);
                  })}>Save</button>
                  <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </fieldset>
            ) : (
              <button type="button" className="secondary"
                onClick={() => { setEditing(m.id); setDraft(m.prerequisites); }}>
                Edit prerequisites
              </button>
            )}
          </li>
        ))}
        {!movies.length && <li className="muted">No movies yet — add your first one above.</li>}
      </ul>
    </section>
  );
}
