export interface Movie {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMinutes: number;
  watched: boolean;
  prerequisites: number[];
}

export interface RewatchPlanData {
  target: { id: number; title: string };
  order: Movie[];
  totalCount: number;
  watchedCount: number;
  remainingRuntimeMinutes: number;
}

export interface Cinema {
  id: number;
  name: string;
  bundleSizes: number[];
}

export interface BookingQuote {
  cinemaId: number;
  cinemaName: string;
  bundleSizes: number[];
  groupSize: number;
  possible: boolean;
  totalBundles: number | null;
  bundles: { size: number; count: number }[];
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? `Request failed (${res.status})`,
      data?.error?.code,
      data?.error?.details,
    );
  }
  return data as T;
}

export const api = {
  listMovies: () => request<Movie[]>('/movies'),
  createMovie: (body: {
    title: string;
    releaseYear: number;
    runtimeMinutes: number;
    prerequisites: number[];
  }) => request<Movie>('/movies', { method: 'POST', body: JSON.stringify(body) }),
  updateMovie: (id: number, body: Partial<Pick<Movie, 'title' | 'watched' | 'prerequisites'>>) =>
    request<Movie>(`/movies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  rewatchOrder: (id: number) => request<RewatchPlanData>(`/movies/${id}/rewatch-order`),
  listCinemas: () => request<Cinema[]>('/cinemas'),
  createCinema: (body: { name: string; bundleSizes: number[] }) =>
    request<Cinema>('/cinemas', { method: 'POST', body: JSON.stringify(body) }),
  booking: (id: number, groupSize: number) =>
    request<BookingQuote>(`/cinemas/${id}/booking?groupSize=${groupSize}`),
};

export const errorText = (e: unknown): string =>
  e instanceof ApiError
    ? (e.details?.[0] ? `${e.details[0].path}: ${e.details[0].message}` : e.message)
    : e instanceof Error
      ? e.message
      : 'Something went wrong';

export const formatMinutes = (m: number): string => {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};
