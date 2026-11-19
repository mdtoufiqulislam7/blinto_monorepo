# How to run the project

## Requirements

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)

You do not need Node.js, PostgreSQL or Redis installed. Docker runs everything.

## Quick start

```bash
git clone <your-repo-url>
cd assignment_blinto
docker compose up --build
```

The first start takes a few minutes because Docker downloads images and builds the server and client. Later starts are fast.

## Open the app

| What | URL |
|---|---|
| Web app (client) | http://localhost:3001 |
| API | http://localhost:4000/api |
| Health check | http://localhost:4000/health |

Quick test:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/movies
```

On the first start the database is filled with sample movies and cinemas.

## Optional: settings

Defaults work out of the box. To change them (database password, seed data):

```bash
cp .env.example .env
```

Edit `.env`, then run `docker compose up --build` again.

## Useful commands

```bash
docker compose up -d --build     # run in the background
docker compose logs -f server    # watch server logs
docker compose ps                # see running containers
docker compose down              # stop everything (data is kept)
docker compose down -v           # stop and delete all data (fresh start)
```

## See the database tables

```bash
docker compose exec postgres psql -U postgres -d doomsday
```

Then inside psql: `\dt`, `SELECT * FROM movies;`, `\q` to quit.

See Redis keys:

```bash
docker compose exec redis redis-cli keys "*"
```

## Run without Docker for the apps (development)

Run only Postgres and Redis in Docker. Add `ports` (`"5432:5432"` and `"6379:6379"`) to those two services in `docker-compose.yml` first.

```bash
docker compose up -d postgres redis

# terminal 1: server
cd server
cp .env.example .env
npm install
npm run dev

# terminal 2: client
cd client
cp .env.example .env.local
npm install
npm run dev
```

## Troubleshooting

- **Port already in use:** stop the other program using port 3001, 4000 (or 5432), or change the port in `docker-compose.yml`.
- **"Cannot connect to the Docker daemon":** start Docker Desktop and wait until it says it is running.
- **Server keeps restarting:** run `docker compose logs server`. It waits for Postgres, so a short delay at startup is normal.
- **Want clean data:** `docker compose down -v`, then `docker compose up --build`.
- **Client shows API errors:** check http://localhost:4000/health. Both `db` and `redis` should say `up`.

More details: [README.md](README.md) and [server/README.md](server/README.md).
