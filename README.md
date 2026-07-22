# Fera

Simple football live scores website built with HTML, CSS, and JavaScript.

## Run locally

From `/home/runner/work/Fera/Fera`:

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/index.html`.

## Deploy to Google Cloud Run

From `/home/runner/work/Fera/Fera`:

```bash
gcloud run deploy fera \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

This uses the included `Dockerfile`, which serves the site on the Cloud Run `PORT` environment variable.
