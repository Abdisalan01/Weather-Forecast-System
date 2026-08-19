import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type WeatherForecast = {
  date: string
  temperatureC: number
  temperatureF: number
  summary: string
}

const SUMMARY_EMOJI: Record<string, string> = {
  freezing: '🥶',
  bracing: '🌬️',
  chilly: '🧥',
  cool: '☁️',
  mild: '🌤️',
  warm: '🌞',
  balmy: '🌈',
  hot: '🔥',
  sweltering: '🌡️',
  scorching: '☀️',
  rainy: '🌧️',
  stormy: '⛈️',
  snowy: '❄️',
  foggy: '🌫️',
  windy: '💨',
  sunny: '🌻',
  cloudy: '⛅',
  thundery: '⚡',
  icy: '🧊',
  humid: '💧',
}

function summaryEmoji(summary: string) {
  return SUMMARY_EMOJI[summary.toLowerCase()] ?? '🌍'
}

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'short', day: '2-digit', year: 'numeric',
  }).format(d)
}

function cToF(c: number) {
  return Math.round((c * 9) / 5 + 32)
}

const PAGE_SIZE = 10

const EMPTY_FORM: Omit<WeatherForecast, 'temperatureF'> = {
  date: new Date().toISOString().slice(0, 10),
  temperatureC: 20,
  summary: 'Warm',
}

type SortKey = 'date' | 'temperatureC' | 'summary'
type SortDir = 'asc' | 'desc'

export default function App() {
  const apiUrl = useMemo(
    () => import.meta.env.VITE_WEATHERFORECAST_URL ?? '/WeatherForecast',
    [],
  )

  const [forecasts, setForecasts] = useState<WeatherForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & Filter
  const [search, setSearch] = useState('')
  const [filterSummary, setFilterSummary] = useState('') // dropdown
  const [minTemp, setMinTemp] = useState('')
  const [maxTemp, setMaxTemp] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Pagination
  const [page, setPage] = useState(1)

  // POST form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Inline edit
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<WeatherForecast | null>(null)
  const [updating, setUpdating] = useState(false)

  /* ── Fetch ── */
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(apiUrl, { signal: controller.signal })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        setForecasts((await res.json()) as WeatherForecast[])
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [apiUrl])

  /* ── Unique summaries for dropdown ── */
  const uniqueSummaries = useMemo(() => {
    const s = new Set(forecasts.map((f) => f.summary))
    return Array.from(s).sort()
  }, [forecasts])

  /* ── Search + Filter + Sort pipeline ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minC = minTemp !== '' ? Number(minTemp) : null
    const maxC = maxTemp !== '' ? Number(maxTemp) : null

    return forecasts
      .filter((f) => {
        // text search: date + summary
        if (q && !f.date.includes(q) && !f.summary.toLowerCase().includes(q)) return false
        // summary dropdown
        if (filterSummary && f.summary !== filterSummary) return false
        // temp range
        if (minC !== null && f.temperatureC < minC) return false
        if (maxC !== null && f.temperatureC > maxC) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
        else if (sortKey === 'temperatureC') cmp = a.temperatureC - b.temperatureC
        else if (sortKey === 'summary') cmp = a.summary.localeCompare(b.summary)
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [forecasts, search, filterSummary, minTemp, maxTemp, sortKey, sortDir])

  /* ── Reset page when filter changes ── */
  useEffect(() => { setPage(1) }, [search, filterSummary, minTemp, maxTemp, sortKey, sortDir])

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function clearFilters() {
    setSearch(''); setFilterSummary(''); setMinTemp(''); setMaxTemp('')
    setSortKey('date'); setSortDir('asc')
  }

  const hasFilters = search || filterSummary || minTemp || maxTemp

  /* ── POST ── */
  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    setPosting(true)
    setPostError(null)
    const payload: WeatherForecast = { ...form, temperatureF: cToF(form.temperatureC) }
    try {
      await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch { /* */ }
    setForecasts((prev) => [payload, ...prev])
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
    setPage(1)
    setPosting(false)
  }

  /* ── UPDATE ── */
  function startEdit(f: WeatherForecast) { setEditDate(f.date); setEditForm({ ...f }) }
  function cancelEdit() { setEditDate(null); setEditForm(null) }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setUpdating(true)
    const payload: WeatherForecast = { ...editForm, temperatureF: cToF(editForm.temperatureC) }
    try {
      await fetch(`${apiUrl}/${editForm.date}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch { /* */ }
    setForecasts((prev) => prev.map((f) => (f.date === editForm.date ? payload : f)))
    cancelEdit()
    setUpdating(false)
  }

  /* ── Extrema (from filtered) ── */
  const extrema = useMemo(() => {
    if (!filtered.length) return null
    const tc = filtered.map((f) => f.temperatureC)
    return { min: Math.min(...tc), max: Math.max(...tc) }
  }, [filtered])

  /* ── Page buttons ── */
  function pageButtons() {
    const btns: (number | '…')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) btns.push(i)
    } else {
      btns.push(1)
      if (page > 3) btns.push('…')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) btns.push(i)
      if (page < totalPages - 2) btns.push('…')
      btns.push(totalPages)
    }
    return btns
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  /* ── Render ── */
  return (
    <div className="app-bg">
      <main className="page">

        {/* ── Header ── */}
        <header className="header">
          <div className="header__left">
            <div className="header__icon">🌤️</div>
            <div>
              <h1 className="title">Weather Forecast</h1>
              <p className="subtitle">
                {forecasts.length} total · API: <code className="api-url">{apiUrl}</code>
              </p>
            </div>
          </div>
          <div className="header__right">
            {extrema && (
              <div className="badge">
                <span className="badge__item badge__item--cold">❄️ {extrema.min}°C</span>
                <span className="badge__item badge__item--hot">🔥 {extrema.max}°C</span>
              </div>
            )}
            <button className="btn btn--primary" onClick={() => { setShowForm((v) => !v); setPostError(null) }}>
              {showForm ? '✕ Close' : '＋ Add Forecast'}
            </button>
          </div>
        </header>

        {/* ── Search & Filter Bar ── */}
        <div className="filter-bar">
          {/* Search input */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Search by date or summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>
            )}
          </div>

          {/* Summary dropdown */}
          <select
            className="filter-select"
            value={filterSummary}
            onChange={(e) => setFilterSummary(e.target.value)}
          >
            <option value="">☁️ All summaries</option>
            {uniqueSummaries.map((s) => (
              <option key={s} value={s}>{summaryEmoji(s)} {s}</option>
            ))}
          </select>

          {/* Temp range */}
          <div className="temp-range">
            <input
              className="filter-input"
              type="number"
              placeholder="Min °C"
              value={minTemp}
              onChange={(e) => setMinTemp(e.target.value)}
            />
            <span className="temp-range__sep">–</span>
            <input
              className="filter-input"
              type="number"
              placeholder="Max °C"
              value={maxTemp}
              onChange={(e) => setMaxTemp(e.target.value)}
            />
          </div>

          {/* Sort buttons */}
          <div className="sort-group">
            <span className="sort-label">Sort:</span>
            {(['date', 'temperatureC', 'summary'] as SortKey[]).map((k) => (
              <button
                key={k}
                className={`sort-btn${sortKey === k ? ' sort-btn--active' : ''}`}
                onClick={() => toggleSort(k)}
              >
                {k === 'date' ? '📅 Date' : k === 'temperatureC' ? '🌡️ Temp' : '☁️ Summary'}
                {sortArrow(k)}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button className="btn btn--ghost btn--sm" onClick={clearFilters}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── POST Form ── */}
        {showForm && (
          <div className="form-panel">
            <h2 className="form-panel__title">📋 Add New Forecast</h2>
            <form ref={formRef} className="forecast-form" onSubmit={handlePost}>
              <div className="form-row">
                <label className="form-label">
                  📅 Date
                  <input className="form-input" type="date" value={form.date} required
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                </label>
                <label className="form-label">
                  🌡️ Temperature (°C)
                  <input className="form-input" type="number" value={form.temperatureC} required
                    onChange={(e) => setForm((p) => ({ ...p, temperatureC: Number(e.target.value) }))} />
                </label>
                <label className="form-label">
                  ☁️ Summary
                  <input className="form-input" type="text" value={form.summary} required
                    placeholder="e.g. Warm, Hot, Chilly…"
                    onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
                </label>
              </div>
              <div className="form-preview">
                Preview → <strong>{summaryEmoji(form.summary)} {form.summary}</strong>{' '}
                · {form.temperatureC}°C / {cToF(form.temperatureC)}°F
              </div>
              {postError && <p className="form-error">{postError}</p>}
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={posting}>
                  {posting ? 'Saving…' : '✔ Save Forecast'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Cards ── */}
        {loading ? (
          <div className="status-box"><span className="spinner" /> Loading forecasts…</div>
        ) : error ? (
          <div className="status-box status-box--error">⚠️ {error}</div>
        ) : (
          <>
            {/* Info bar */}
            <div className="info-bar">
              <span className="info-bar__count">
                Showing <strong>{filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong>
                {hasFilters && <span className="info-bar__filtered"> (filtered from {forecasts.length})</span>}
              </span>
              <span className="info-bar__page">Page {page} / {totalPages}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="no-results">
                <div className="no-results__icon">🔍</div>
                <p>No forecasts found. Try changing the filters.</p>
                <button className="btn btn--ghost" onClick={clearFilters}>Clear Filters</button>
              </div>
            ) : (
              <section className="grid" aria-label="Weather forecast list">
                {paginated.map((f) =>
                  editDate === f.date ? (
                    <article key={f.date} className="card card--editing">
                      <form onSubmit={handleUpdate} className="edit-form">
                        <div className="edit-form__title">✏️ Edit · {f.date}</div>
                        <label className="form-label">
                          🌡️ Temperature (°C)
                          <input className="form-input" type="number" value={editForm!.temperatureC} required
                            onChange={(e) => setEditForm((p) => p ? { ...p, temperatureC: Number(e.target.value) } : p)} />
                        </label>
                        <label className="form-label">
                          ☁️ Summary
                          <input className="form-input" type="text" value={editForm!.summary} required
                            onChange={(e) => setEditForm((p) => p ? { ...p, summary: e.target.value } : p)} />
                        </label>
                        <div className="form-actions">
                          <button type="button" className="btn btn--ghost" onClick={cancelEdit}>Cancel</button>
                          <button type="submit" className="btn btn--primary" disabled={updating}>
                            {updating ? 'Saving…' : '✔ Update'}
                          </button>
                        </div>
                      </form>
                    </article>
                  ) : (
                    <article key={f.date} className="card">
                      <div className="card__emoji">{summaryEmoji(f.summary)}</div>
                      <div className="card__date">{formatDay(f.date)}</div>
                      <div className="card__summary">{f.summary}</div>
                      <div className="temps">
                        <div className="temp temp--c">
                          <span className="temp__value">{f.temperatureC}</span>
                          <span className="temp__unit">°C</span>
                        </div>
                        <div className="temp-divider" />
                        <div className="temp temp--f">
                          <span className="temp__value">{f.temperatureF}</span>
                          <span className="temp__unit">°F</span>
                        </div>
                      </div>
                      <button className="btn btn--edit" onClick={() => startEdit(f)}>✏️ Edit</button>
                    </article>
                  ),
                )}
              </section>
            )}

            {/* ── Pagination ── */}
            {filtered.length > 0 && (
              <nav className="pagination" aria-label="Pagination">
                <button className="pg-btn pg-btn--arrow" onClick={() => goTo(1)} disabled={page === 1} aria-label="First">«</button>
                <button className="pg-btn pg-btn--arrow" onClick={() => goTo(page - 1)} disabled={page === 1} aria-label="Prev">‹</button>
                {pageButtons().map((b, i) =>
                  b === '…' ? (
                    <span key={`el-${i}`} className="pg-ellipsis">…</span>
                  ) : (
                    <button key={b} className={`pg-btn${page === b ? ' pg-btn--active' : ''}`}
                      onClick={() => goTo(b as number)} aria-current={page === b ? 'page' : undefined}>
                      {b}
                    </button>
                  ),
                )}
                <button className="pg-btn pg-btn--arrow" onClick={() => goTo(page + 1)} disabled={page === totalPages} aria-label="Next">›</button>
                <button className="pg-btn pg-btn--arrow" onClick={() => goTo(totalPages)} disabled={page === totalPages} aria-label="Last">»</button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  )
}
