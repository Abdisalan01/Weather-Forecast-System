import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type WeatherForecast = {
  date: string
  temperatureC: number
  temperatureF: number
  summary: string
}

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(d)
}

const PAGE_SIZE = 10

export default function App() {
  const apiUrl = useMemo(
    () => import.meta.env.VITE_WEATHERFORECAST_URL ?? '/WeatherForecast',
    [],
  )

  const [forecasts, setForecasts] = useState<WeatherForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterSummary, setFilterSummary] = useState('')
  const [page, setPage] = useState(1)

  const loadForecasts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setForecasts((await res.json()) as WeatherForecast[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [apiUrl])

  useEffect(() => {
    loadForecasts()
  }, [loadForecasts])

  const uniqueSummaries = useMemo(() => {
    const s = new Set(forecasts.map((f) => f.summary))
    return Array.from(s).sort()
  }, [forecasts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return forecasts
      .filter((f) => {
        if (q && !f.date.includes(q) && !f.summary.toLowerCase().includes(q)) return false
        if (filterSummary && f.summary !== filterSummary) return false
        return true
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [forecasts, search, filterSummary])

  useEffect(() => {
    setPage(1)
  }, [search, filterSummary])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearFilters() {
    setSearch('')
    setFilterSummary('')
  }

  const hasFilters = search || filterSummary

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

  return (
    <div className="app">
      <main className="page">
        <header className="header">
          <div>
            <h1 className="title">Weather Forecast</h1>
            <p className="subtitle">{forecasts.length} records from API</p>
          </div>
          <div className="header__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => loadForecasts(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <div className="toolbar">
          <input
            className="input"
            type="text"
            placeholder="Search date or summary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="input"
            value={filterSummary}
            onChange={(e) => setFilterSummary(e.target.value)}
          >
            <option value="">All summaries</option>
            {uniqueSummaries.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button type="button" className="btn btn--ghost" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="message">Loading forecasts…</div>
        ) : error ? (
          <div className="message message--error">
            {error}
            <button type="button" className="btn btn--secondary" onClick={() => loadForecasts(true)}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="info-bar">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </span>
              <span>Page {page} / {totalPages}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="message">No forecasts found.</div>
            ) : (
              <section className="grid">
                {paginated.map((f) => (
                  <article key={f.date} className="card">
                    <p className="card__date">{formatDay(f.date)}</p>
                    <h3 className="card__summary">{f.summary}</h3>
                    <div className="card__temps">
                      <span>{f.temperatureC}°C</span>
                      <span>{f.temperatureF}°F</span>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {filtered.length > 0 && (
              <nav className="pagination" aria-label="Pagination">
                <button type="button" className="pg-btn" onClick={() => goTo(page - 1)} disabled={page === 1}>
                  Prev
                </button>
                {pageButtons().map((b, i) =>
                  b === '…' ? (
                    <span key={`el-${i}`} className="pg-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={b}
                      type="button"
                      className={`pg-btn${page === b ? ' pg-btn--active' : ''}`}
                      onClick={() => goTo(b as number)}
                    >
                      {b}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="pg-btn"
                  onClick={() => goTo(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  )
}
