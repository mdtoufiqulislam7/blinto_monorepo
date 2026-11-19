'use client';

import { useState } from 'react';
import Movies from '@/components/Movies';
import RewatchPlan from '@/components/RewatchPlan';
import Booking from '@/components/Booking';

const TABS = [
  { key: 'movies', label: 'Movies', View: Movies },
  { key: 'plan', label: 'Rewatch Plan', View: RewatchPlan },
  { key: 'booking', label: 'Booking', View: Booking },
] as const;

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('movies');
  return (
    <div className="app">
      <header>
        <h1>Doomsday Ready</h1>
        <p>Plan your MCU rewatch and book the opening-night watch party.</p>
        <nav>
          {TABS.map(({ key, label }) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {/* Each view loads fresh data on mount, so switching tabs always shows current state. */}
        {TABS.map(({ key, View }) => (key === tab ? <View key={key} /> : null))}
      </main>
    </div>
  );
}
