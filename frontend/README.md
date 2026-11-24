# TaskQuest Frontend

## API configuration

The HTTP client reads `VITE_API_URL`. Copy `.env.example` to `.env.local` to override the local API URL. Without it, development uses `http://localhost:3000/api`.

Set `VITE_API_URL` in the production build environment to the deployed API URL. Vite embeds `VITE_` variables in the client bundle, so this value must be public and must never contain secrets.
