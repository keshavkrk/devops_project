# Resume Analyzer (Vanilla React)

A client-side ATS-style resume analyzer built with React + TypeScript + Vite.

## What it does

- Upload a resume PDF (text-based PDF)
- Extracts resume text in-browser using `pdfjs-dist`
- Compare resume content against a pasted job description
- Computes a score out of 100 with breakdown:
  - Keyword Match (60)
  - Section Coverage (20)
  - Readability (20)
- Shows matched/missing keywords
- Detects missing resume sections (summary, experience, projects, skills, education)
- Generates practical improvement recommendations

## Tech stack

- React 19
- TypeScript
- Vite 7
- react-dropzone
- pdfjs-dist

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Build and lint

```bash
npm run lint
npm run build
```

## DevOps Lab: GitHub + Jenkins Setup

### 1) Push project to GitHub (first time)

```bash
git init
git add .
git commit -m "Initial commit with Jenkins pipeline"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2) Install Jenkins (quick local setup)

- Install Jenkins and open `http://localhost:8080`
- Install suggested plugins
- Create first admin user
- In `Manage Jenkins > Tools`:
  - Add NodeJS tool (example name: `node-22`)
  - Keep auto-install enabled

### 3) Create Jenkins job for this repo

- Click `New Item`
- Name: `resume-analyzer-vanilla`
- Select `Pipeline`
- In job config:
  - `Build Triggers`: enable `GitHub hook trigger for GITScm polling`
  - `Pipeline`: choose `Pipeline script from SCM`
  - `SCM`: `Git`
  - `Repository URL`: your GitHub repo URL
  - `Branch`: `*/main`
  - `Script Path`: `Jenkinsfile`
- Save, then click `Build Now`

### 4) Connect GitHub webhook to Jenkins

- In GitHub repo: `Settings > Webhooks > Add webhook`
- Payload URL: `http://<your-jenkins-host>:8080/github-webhook/`
- Content type: `application/json`
- Events: `Just the push event`
- Save

Now every push to `main` can trigger Jenkins automatically.

### 5) What this pipeline does

The included `Jenkinsfile` runs:

1. Checkout code
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. Archive `dist/**` as Jenkins build artifacts

### 6) Demo flow for lab

1. Make a small code change
2. Commit and push to GitHub
3. Open Jenkins job and show the triggered build
4. Open `Artifacts` in Jenkins and show files from `dist/`

## Notes

- This app runs fully in the browser; no backend is required.
- For best results, use text-selectable PDF resumes (not scanned image PDFs).
- `pdfjs` adds a large worker bundle, so production bundle size warnings are expected for this MVP.

## Future improvements

- OCR fallback for scanned PDFs
- Better multi-word keyword extraction (n-grams)
- Save/export analysis report
- JD-specific skill taxonomy and weighting
- Optional AI rewrite suggestions for weak bullets
