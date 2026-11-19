'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, BookingQuote, Cinema, errorText } from '@/lib/api';

export default function Booking() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [cinemaId, setCinemaId] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [error, setError] = useState('');
  const [newCinema, setNewCinema] = useState({ name: '', sizes: '' });

  const load = useCallback(
    () => api.listCinemas().then(setCinemas).catch((e) => setError(errorText(e))),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function getQuote(e: FormEvent) {
    e.preventDefault();
    setError('');
    setQuote(null);
    try {
      setQuote(await api.booking(Number(cinemaId), Number(groupSize)));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function addCinema(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const bundleSizes = newCinema.sizes.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
      const c = await api.createCinema({ name: newCinema.name, bundleSizes });
      setNewCinema({ name: '', sizes: '' });
      await load();
      setCinemaId(String(c.id));
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section>
      <h2>Booking</h2>
      {error && <div className="error" role="alert">{error}</div>}

      <form className="card" onSubmit={getQuote}>
        <div className="row">
          <select required value={cinemaId} onChange={(e) => setCinemaId(e.target.value)} aria-label="Cinema">
            <option value="">Pick a cinema…</option>
            {cinemas.map((c) => (
              <option key={c.id} value={c.id}>{c.name} (bundles: {c.bundleSizes.join(', ')})</option>
            ))}
          </select>
          <input type="number" required min={1} max={10000} placeholder="Group size (1-10,000)"
            value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
          <button type="submit">Get quote</button>
        </div>
      </form>

      {quote && (
        <div className="card">
          {quote.possible ? (
            <>
              <h3>{quote.totalBundles} bundle{quote.totalBundles! > 1 ? 's' : ''} for {quote.groupSize} seats</h3>
              <ul className="list">
                {quote.bundles.map((b) => (
                  <li key={b.size}>{b.count} × bundle of {b.size} = {b.count * b.size} seats</li>
                ))}
              </ul>
            </>
          ) : (
            <h3 className="bad">Not possible — {quote.cinemaName} cannot fill exactly {quote.groupSize} seats.</h3>
          )}
        </div>
      )}

      <form className="card" onSubmit={addCinema}>
        <h3>Add a cinema</h3>
        <div className="row">
          <input required maxLength={100} placeholder="Name" value={newCinema.name}
            onChange={(e) => setNewCinema({ ...newCinema, name: e.target.value })} />
          <input required placeholder="Bundle sizes, e.g. 2, 5" value={newCinema.sizes}
            onChange={(e) => setNewCinema({ ...newCinema, sizes: e.target.value })} />
          <button type="submit">Add cinema</button>
        </div>
      </form>
    </section>
  );
}
