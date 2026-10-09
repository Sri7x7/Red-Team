# Deployment Guide: Google Cloud Run with Secret Manager

This guide details the exact `gcloud` CLI commands required to build and deploy **Red Team My Life** to Google Cloud Run with `GEMINI_API_KEY` mounted securely from Google Cloud Secret Manager.

---

## 1. Prerequisites & Environment Setup

Ensure you have Google Cloud SDK installed and authenticated with your target project:

```bash
# 1. Set your GCP Project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
gcloud config set project "$PROJECT_ID"

# 2. Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 2. Store Gemini API Key in Secret Manager

Create the secret containing your Gemini API key so it is never exposed in plaintext environment variables or build artifacts:

```bash
# Create the secret from stdin or your environment variable
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic"
```

If the secret already exists and you wish to rotate it to a new version:

```bash
echo -n "YOUR_NEW_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key \
  --data-file=-
```

---

## 3. Grant Secret Access to Cloud Run Service Account

Cloud Run uses the default Compute Engine service account during execution. Grant it the `secretmanager.secretAccessor` role:

```bash
# Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# Bind secretAccessor permission to the Cloud Run service account
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Deploy to Cloud Run

Deploy directly from source using Google Cloud Buildpack / Dockerfile:

```bash
gcloud run deploy red-team-my-life \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="NODE_ENV=production,TRUST_PROXY=1" \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=10
```

### Deployment Configuration Rationale:
- `--set-secrets="GEMINI_API_KEY=gemini-api-key:latest"`: Injects the secret as an environment variable directly inside the container without persisting it in code or logs.
- `--set-env-vars="TRUST_PROXY=1"`: Ensures Express correctly trusts the single Google Cloud Load Balancer reverse proxy hop, accurately tracking client IPs for rate-limiting.
- `--port=8080`: Matches the default port exposed by the `Dockerfile` and configured in Cloud Run.
- `--memory=512Mi`: Minimal footprint necessary since the Node.js process is lightweight and uses in-memory LRU caching.
- `--concurrency=10`: Allows concurrent HTTP requests while the application-level concurrency guard manages active Gemini review pipelines safely.

---

## 5. Verify the Deployment

Once deployed, retrieve the service URL and verify the health and meta endpoints:

```bash
SERVICE_URL=$(gcloud run services describe red-team-my-life \
  --region "$REGION" \
  --format="value(status.url)")

# 1. Verify health and model pool status
curl -s "$SERVICE_URL/api/status" | jq .

# 2. Verify static frontend serves security headers
curl -I "$SERVICE_URL"
```

---

## 6. Vercel Deployment

**Red Team My Life** includes native Vercel serverless support through `api/index.js` and `vercel.json`.

### Dashboard Setup Steps:
1. **Import Project**: Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository (`Red-Team`).
2. **Framework Preset**: Select **Other** (Express app served via serverless function).
3. **Root Directory**: Leave as `./` (default).
4. **Build & Output Settings**: Leave empty (no build step is required; static files in `public/` and serverless functions in `api/` are routed directly).
5. **Environment Variables**: Add the following in the Vercel Dashboard project settings:
   - `GEMINI_API_KEY`: Your Google Gemini API Key from Google AI Studio.
   - `PERSONA_MODELS`: `gemini-3.5-flash-lite,gemini-3.1-flash-lite`
   - `JUDGE_MODELS`: `gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash`
   - `DEMO_MODE`: `false`
   - `GROUNDING_ENABLED`: `false`
   - `TRUST_PROXY`: `1` (automatically defaulted to `1` when `VERCEL` environment is detected)
6. **Deploy**: Click **Deploy**. Vercel will bundle the serverless runtime and provide a live production URL (e.g., `https://red-team-my-life.vercel.app`).

> [!NOTE]
> **Serverless Architectural Consideration**:
> In Vercel serverless environments, each incoming request is processed by a serverless function instance. In-memory LRU cache entries, sliding-window RPM counters, and rate-limiting maps are held in memory **per serverless instance**. For unified multi-region state persistence across ephemeral instances, a distributed store (e.g. Upstash Redis / Cloud Memorystore) can be wired into `src/services/cache.js` and `src/services/modelPool.js`.
