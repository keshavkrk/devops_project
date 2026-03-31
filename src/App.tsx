import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'

type ScoreBreakdown = {
  keyword: number
  sections: number
  readability: number
  total: number
}

type AnalysisResult = {
  score: ScoreBreakdown
  matchedKeywords: string[]
  missingKeywords: string[]
  detectedSections: string[]
  missingSections: string[]
  recommendations: string[]
  wordCount: number
}

GlobalWorkerOptions.workerSrc = workerSrc

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'with',
  'will',
  'your',
  'you',
  'we',
  'our',
])

const REQUIRED_SECTIONS = [
  'summary',
  'experience',
  'projects',
  'skills',
  'education',
]

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\r/g, ' ')
    .replace(/[^a-z0-9+.#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

function uniqueKeywordsFromJobDescription(jd: string): string[] {
  const tokens = tokenize(jd)
  const tokenCounts = new Map<string, number>()

  for (const token of tokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
  }

  return [...tokenCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([token]) => token)
    .slice(0, 40)
}

function detectSections(resumeText: string): { detected: string[]; missing: string[] } {
  const normalized = normalizeText(resumeText)
  const detected = REQUIRED_SECTIONS.filter((section) =>
    new RegExp(`\\b${section}\\b`, 'i').test(normalized),
  )

  return {
    detected,
    missing: REQUIRED_SECTIONS.filter((section) => !detected.includes(section)),
  }
}

function buildRecommendations(result: Omit<AnalysisResult, 'recommendations'>): string[] {
  const recs: string[] = []

  if (result.missingKeywords.length > 0) {
    recs.push(
      `Add more job-specific keywords: ${result.missingKeywords
        .slice(0, 8)
        .join(', ')}.`,
    )
  }

  if (result.missingSections.length > 0) {
    recs.push(
      `Include missing sections: ${result.missingSections.join(', ')}.`,
    )
  }

  if (result.wordCount < 250) {
    recs.push('Your resume looks short. Add measurable impact bullets for each role.')
  }

  if (result.wordCount > 900) {
    recs.push('Your resume may be too long. Keep only high-impact, relevant details.')
  }

  if (result.score.keyword < 35) {
    recs.push('Improve keyword alignment with the job description to pass ATS filters.')
  }

  if (recs.length === 0) {
    recs.push('Strong match. Tailor 2-3 bullets with quantified outcomes for this role.')
  }

  return recs
}

function analyzeResume(resumeText: string, jobDescription: string): AnalysisResult {
  const normalizedResume = normalizeText(resumeText)
  const jdKeywords = uniqueKeywordsFromJobDescription(jobDescription)
  const matchedKeywords = jdKeywords.filter((keyword) =>
    normalizedResume.includes(` ${keyword} `),
  )
  const missingKeywords = jdKeywords.filter(
    (keyword) => !matchedKeywords.includes(keyword),
  )

  const keywordRatio = jdKeywords.length === 0 ? 0 : matchedKeywords.length / jdKeywords.length
  const keywordScore = Math.round(keywordRatio * 60)

  const { detected, missing } = detectSections(resumeText)
  const sectionScore = Math.round((detected.length / REQUIRED_SECTIONS.length) * 20)

  const words = tokenize(resumeText)
  const wordCount = words.length

  const hasGoodLength = wordCount >= 250 && wordCount <= 900
  const hasBullets = /(^|\n)\s*[-•*]/.test(resumeText)
  const readabilityScore = (hasGoodLength ? 12 : 6) + (hasBullets ? 8 : 3)

  const score: ScoreBreakdown = {
    keyword: keywordScore,
    sections: sectionScore,
    readability: readabilityScore,
    total: Math.min(100, keywordScore + sectionScore + readabilityScore),
  }

  const baseResult = {
    score,
    matchedKeywords,
    missingKeywords,
    detectedSections: detected,
    missingSections: missing,
    wordCount,
  }

  return {
    ...baseResult,
    recommendations: buildRecommendations(baseResult),
  }
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const doc = await getDocument({ data: buffer }).promise

  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? String((item as { str: string }).str) : ''))
      .join(' ')

    pages.push(pageText)
  }

  return pages.join('\n')
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong match'
  if (score >= 60) return 'Moderate match'
  return 'Needs work'
}

function App() {
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const resetSession = useCallback(() => {
    setResumeFileName('')
    setResumeText('')
    setJobDescription('')
    setError('')
    setLoading(false)
  }, [])

  const analysis = useMemo(() => {
    if (!resumeText || !jobDescription.trim()) return null
    return analyzeResume(resumeText, jobDescription)
  }, [resumeText, jobDescription])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) {
      return
    }

    setLoading(true)
    setError('')
    setResumeFileName(file.name)

    try {
      const text = await extractPdfText(file)
      if (!text.trim()) {
        throw new Error('No readable text found in the PDF.')
      }
      setResumeText(text)
    } catch {
      setError('Could not read this PDF. Try a text-based PDF export from your editor.')
      setResumeText('')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  })

  return (
    <main className="app">
      <div className="ambient ambient-one" aria-hidden="true"></div>
      <div className="ambient ambient-two" aria-hidden="true"></div>
      <section className="hero">
        <div>
          <p className="eyebrow">Resume Analyzer</p>
          <h1>ATS Fit Checker</h1>
          <p className="subtitle">
            Upload your resume and compare it with a job description to get a score,
            missing keywords, and section-level feedback.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-card-title">Session status</p>
          <p className={`status-line ${resumeFileName ? 'is-ready' : ''}`}>
            <span className="status-dot" aria-hidden="true"></span>
            {resumeFileName ? 'Resume loaded' : 'Upload your resume PDF'}
          </p>
          <p className={`status-line ${jobDescription.trim() ? 'is-ready' : ''}`}>
            <span className="status-dot" aria-hidden="true"></span>
            {jobDescription.trim() ? 'Job description added' : 'Paste job description'}
          </p>
          <p className={`status-line ${analysis ? 'is-ready' : ''}`}>
            <span className="status-dot" aria-hidden="true"></span>
            {analysis ? 'Analysis ready' : 'Waiting for inputs'}
          </p>
          <button type="button" className="primary-button" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </section>

      <section className="panel">
        <h2><span className="step">01</span>Upload Resume (PDF)</h2>
        <div
          {...getRootProps({
            className: `dropzone ${isDragActive ? 'active' : ''} ${loading ? 'loading' : ''}`,
            'aria-busy': loading,
          })}
        >
          <input {...getInputProps()} />
          <div className="dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 3.5a.75.75 0 0 1 .75.75v8.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V4.25A.75.75 0 0 1 12 3.5Z" />
              <path d="M4.75 15.5a.75.75 0 0 1 .75.75v1.5A1.5 1.5 0 0 0 7 19.25h10a1.5 1.5 0 0 0 1.5-1.5v-1.5a.75.75 0 1 1 1.5 0v1.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1.5a.75.75 0 0 1 .75-.75Z" />
            </svg>
          </div>
          <div className="dropzone-copy">
            <p className="dropzone-title">
              {loading
                ? 'Reading resume...'
                : isDragActive
                  ? 'Drop your PDF to upload'
                  : 'Drag and drop your resume'}
            </p>
            <p className="dropzone-subtitle">
              {isDragActive ? 'Release to start parsing the file.' : 'or click to browse your files'}
            </p>
          </div>
          <span className="ghost-button">{loading ? 'Processing' : 'Choose file'}</span>
          <small>
            {loading
              ? 'Extracting text from your PDF...'
              : resumeFileName
                ? `Loaded: ${resumeFileName}`
                : 'PDF format only - one file at a time'}
          </small>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <h2><span className="step">02</span>Paste Job Description</h2>
        <textarea
          className="job-textarea"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Paste the target role description here..."
          rows={10}
        />
      </section>

      <section className="panel">
        <h2><span className="step">03</span>Analysis</h2>
        {loading ? (
          <p className="hint shimmer-text">Extracting your resume and preparing analysis...</p>
        ) : !analysis ? (
          <p className="hint">
            Upload a resume and add a job description to generate your report.
          </p>
        ) : (
          <div className="results">
            <div className="score-card">
              <p className="score">{analysis.score.total}/100</p>
              <p className="label">{scoreLabel(analysis.score.total)}</p>
              <div className="meter">
                <span style={{ width: `${analysis.score.total}%` }}></span>
              </div>
              <div className="breakdown">
                <span>Keyword match: {analysis.score.keyword}/60</span>
                <span>Sections: {analysis.score.sections}/20</span>
                <span>Readability: {analysis.score.readability}/20</span>
              </div>
            </div>

            <div className="grid">
              <article>
                <h3>Matched Keywords</h3>
                <ul className="chip-list">
                  {analysis.matchedKeywords.length === 0 ? (
                    <li>None detected yet.</li>
                  ) : (
                    analysis.matchedKeywords.slice(0, 20).map((keyword) => (
                      <li key={keyword}>{keyword}</li>
                    ))
                  )}
                </ul>
              </article>

              <article>
                <h3>Missing Keywords</h3>
                <ul className="chip-list">
                  {analysis.missingKeywords.length === 0 ? (
                    <li>No major missing keywords found.</li>
                  ) : (
                    analysis.missingKeywords.slice(0, 20).map((keyword) => (
                      <li key={keyword}>{keyword}</li>
                    ))
                  )}
                </ul>
              </article>

              <article>
                <h3>Section Check</h3>
                <p className="meta-title">Detected</p>
                <ul className="chip-list">
                  {analysis.detectedSections.length === 0 ? (
                    <li>none</li>
                  ) : (
                    analysis.detectedSections.map((section) => (
                      <li key={section}>{section}</li>
                    ))
                  )}
                </ul>
                <p className="meta-title">Missing</p>
                <ul className="chip-list warning">
                  {analysis.missingSections.length === 0 ? (
                    <li>none</li>
                  ) : (
                    analysis.missingSections.map((section) => (
                      <li key={section}>{section}</li>
                    ))
                  )}
                </ul>
                <p>Word count: {analysis.wordCount}</p>
              </article>

              <article>
                <h3>Recommendations</h3>
                <ul className="recommendation-list">
                  {analysis.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App


