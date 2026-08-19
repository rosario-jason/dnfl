const CurrentMFLYear = 2026,
  MFLPastSeason = CurrentMFLYear !== year
let updatedMFLCacheFile = !0
;['skin', 'responsive'].forEach(e => {
  const t = document.getElementById(e)
  t && t.remove()
}),
  'undefined' == typeof MFL_DEBUG_API && (MFL_DEBUG_API = !1)
const _API_DEPS = {
  loadMyLeaguesJSON: ['mflLive'],
  reportInjuriesAPI: [
    'irReport',
    'contract',
    'moduleScoreboard',
    'replaceMFLScoring',
    'mflLive',
    'MondayNight',
    'overview',
    'miniBoxscore'
  ],
  reportTransactionsAPI: ['irReport', 'contract'],
  reportRostersAPI: ['irReport', 'contract'],
  reportProjectedScoresAPI: [
    'moduleScoreboard',
    'replaceMFLScoring',
    'mflLive',
    'MondayNight',
    'Marquee',
    'overview',
    'miniBoxscore'
  ],
  reportLeagueAPI: [
    'contract',
    'allPlay',
    'mflLive',
    'prizePayouts',
    'playoffs',
    'overview',
    'survivor'
  ],
  reportStandingsAPI: [
    'moduleScoreboard',
    'allPlay',
    'replaceMFLScoring',
    'MondayNight',
    'FantasyTicker',
    'Marquee',
    'prizePayouts',
    'playoffs',
    'overview',
    'miniBoxscore',
    'survivor'
  ],
  reportTopStartersAPI: ['overview'],
  reportWeeklyResultsAPI: [
    'moduleScoreboard',
    'allPlay',
    'replaceMFLScoring',
    'MondayNight',
    'FantasyTicker',
    'Marquee',
    'prizePayouts',
    'playoffs',
    'overview',
    'miniBoxscore',
    'survivor'
  ],
  getLiveScoringAPI: [
    'moduleScoreboard',
    'mflLive',
    'MondayNight',
    'FantasyTicker',
    'Marquee',
    'miniBoxscore'
  ]
}
function needsAPI (e) {
  const t = _API_DEPS[e]
  return (
    !t ||
    t.some(e => {
      const t = window['useCache_' + e]
      return void 0 === t || !0 === t
    })
  )
}
if (void 0 === load_mobileMenu_script) var load_mobileMenu_script = !0
if (void 0 === load_chat_enhanced) var load_chat_enhanced = !0
if (void 0 === load_popup) var load_popup = !0
if (void 0 === load_mini_boxscore) var load_mini_boxscore = !0
if (void 0 === load_marquee) var load_marquee = !1
if (void 0 === load_lineups_submit_scriptV3)
  var load_lineups_submit_scriptV3 = !0
if (void 0 === load_tabs_script) var load_tabs_script = !1
var NFLlastWk = 18,
  AllGamesCount = 22
'undefined' == typeof useOPR && (useOPR = !1),
  'undefined' == typeof completedWeek && (completedWeek = 0),
  'undefined' == typeof liveScoringWeek && (liveScoringWeek = 0),
  void 0 === precision && (precision = 0),
  'undefined' == typeof standingsEndWeek || '' === standingsEndWeek
    ? (standingsEndWeek = NFLlastWk)
    : (standingsEndWeek = parseInt(standingsEndWeek, 10)),
  ('undefined' != typeof startWeek && '' !== startWeek) || (startWeek = 1),
  ('undefined' != typeof endWeek && '' !== endWeek) || (endWeek = NFLlastWk)
var tickerEndWeek = endWeek
tickerEndWeek > NFLlastWk && (isPlayoffLeague = !0)
var isLeagueHeadToHead =
    'undefined' != typeof h2h_setting && 'YES' === h2h_setting,
  isAllPlay = !isLeagueHeadToHead,
  preventDBLClick = !0,
  real_ls_week = liveScoringWeek,
  backgroundTimersStarted = !1,
  liveScoringLiveWeek = null
let lsm_refreshMs = 36e5,
  lsm_pollTimerId = null,
  lsm_manualOverrideMs = null,
  lsm_scheduleStarted = !1,
  lsm_last_update_secs_first = 0
var lsm_stats = [],
  lsm_tstats = [],
  lsm_firstFetchDone = !1
const FIVE_MIN_MS = 3e5
function getIfPastSeason (e, t) {
  if (!MFLPastSeason) return Promise.resolve(!1)
  const a = MFLCache.getSync(e)
  if (a && a.data) {
    if ('function' == typeof t)
      try {
        t(a.data, 'cache')
      } catch (e) {}
    return Promise.resolve(!0)
  }
  return MFLCache.get(e).then(e => {
    if (e && e.data) {
      if ('function' == typeof t)
        try {
          t(e.data, 'cache')
        } catch (e) {}
      return !0
    }
    return !1
  })
}
function logApi (e, t) {
  window.MFL_DEBUG_API &&
    (console.groupCollapsed(`%c[MFL API] ${e}`, 'color:#0aa;font-weight:bold'),
    console.log(t),
    console.trace(),
    console.groupEnd())
}
function serveStaleAndRefresh (e, t, a, r) {
  const o = MFLCache.getSync(e)
  if (o && o.data) {
    try {
      r(o.data, 'cache')
    } catch (e) {}
    return (
      MFLCache.isExpiredEntry(o) &&
        setTimeout(async () => {
          try {
            const r = await t()
            r && (await MFLCache.set(e, r, a, { silent: !0 }))
          } catch (e) {}
        }, 0),
      Promise.resolve(!0)
    )
  }
  return MFLCache.get(e).then(o => {
    if (o && o.data) {
      try {
        r(o.data, 'cache')
      } catch (e) {}
      return (
        MFLCache.isExpiredEntry(o) &&
          setTimeout(async () => {
            try {
              const r = await t()
              r && (await MFLCache.set(e, r, a, { silent: !0 }))
            } catch (e) {}
          }, 0),
        !0
      )
    }
    return !1
  })
}
function safeLocalStorageSet (e, t) {
  try {
    return localStorage.setItem(e, t), !0
  } catch (a) {
    if (
      a instanceof DOMException &&
      (22 === a.code ||
        1014 === a.code ||
        'QuotaExceededError' === a.name ||
        'NS_ERROR_DOM_QUOTA_REACHED' === a.name)
    ) {
      console.warn(
        '[MFLCache] localStorage quota exceeded writing key:',
        e,
        'â€” attempting eviction'
      ),
        evictOldCacheEntries()
      try {
        return localStorage.setItem(e, t), !0
      } catch (t) {
        console.warn(
          '[MFLCache] localStorage still full after eviction, key not cached:',
          e
        )
      }
    } else console.warn('[MFLCache] localStorage.setItem failed for key:', e, a)
    return !1
  }
}
function evictLegacyIDB () {
  const e = 'mfl_legacy_idb_evicted'
  if (!localStorage.getItem(e))
    try {
      const t = indexedDB.deleteDatabase('mflscripts')
      ;(t.onsuccess = () => {
        localStorage.setItem(e, '1'),
          window.MFL_DEBUG_API &&
            console.log("[MFLCache] legacy IDB 'mflscripts' removed")
      }),
        (t.onerror = () => {
          localStorage.setItem(e, '1')
        }),
        (t.onblocked = () => {})
    } catch (t) {
      localStorage.setItem(e, '1')
    }
}
function evictOldCacheEntries () {
  const e = [],
    t = Date.now()
  for (const a of Object.keys(localStorage))
    if (a)
      if (a.startsWith('cache_') || a.startsWith('playerDB_')) e.push(a)
      else if (a.startsWith('mfl_c_'))
        try {
          const r = localStorage.getItem(a)
          if (!r) {
            e.push(a)
            continue
          }
          const o = JSON.parse(r)
          if (!o || !o.storedAt || !o.ttlMs) {
            e.push(a)
            continue
          }
          t - o.storedAt > o.ttlMs && e.push(a)
        } catch {
          e.push(a)
        }
      else if (a.startsWith('lock_') || a.startsWith('MFLLock_')) {
        let r = !1
        try {
          const e = localStorage.getItem(a)
          if (e) {
            const a = JSON.parse(e),
              o = Number(a && a.exp)
            ;(!Number.isFinite(o) || o <= 0 || o < t) && (r = !0)
          } else r = !0
        } catch {
          r = !0
        }
        r && e.push(a)
      } else;
  for (const t of e)
    try {
      localStorage.removeItem(t)
    } catch {}
  window.MFL_DEBUG_API &&
    console.log('[MFLCache] evicted', e.length, 'stale cache entries')
}
!(function (e) {
  'use strict'
  const t = 'MFLScripts',
    a = 1,
    r = 'cache',
    o = 'meta',
    n = 12096e5,
    i = 5e3,
    s = 3e3,
    l = 3,
    c = 300,
    d = 'MFLCache_BC'
  let p = null,
    u = !1,
    m = !1,
    f = !1
  const h = new Map(),
    y = new Map(),
    _ = new Map()
  let g = null
  const sleep = e => new Promise(t => setTimeout(t, e)),
    now = () => Date.now()
  function isExpiredEntry (e) {
    return !(e && e.storedAt && e.ttlMs) || now() - e.storedAt > e.ttlMs
  }
  function makeEntry (e, t) {
    return { data: e, storedAt: now(), ttlMs: 1e3 * (t || 300) }
  }
  function ensureBC () {
    if (g) return g
    if (!('BroadcastChannel' in e)) return null
    try {
      ;(g = new BroadcastChannel(d)),
        g.addEventListener('message', _onBCMessage)
    } catch (e) {
      g = null
    }
    return g
  }
  function _onBCMessage (t) {
    const a = t.data
    if (!a || 'MFLCache' !== a.type) return
    const { cacheKey: r, entry: o } = a
    if (!r || !o) return
    h.set(r, o)
    const n = _.get(r)
    n &&
      n.size &&
      n.forEach(e => {
        try {
          e(o)
        } catch (e) {}
      })
    try {
      e.dispatchEvent(
        new CustomEvent('MFLCacheBroadcast', {
          detail: { cacheKey: r, data: o.data }
        })
      )
    } catch (e) {}
  }
  function _broadcast (e, t) {
    const a = ensureBC()
    if (a)
      try {
        a.postMessage({ type: 'MFLCache', cacheKey: e, entry: t })
      } catch (e) {}
  }
  let b = null
  async function _openDB () {
    return (
      p ||
      (u
        ? null
        : b ||
          ((m = !0),
          (b = (async function _tryOpenWithRetry () {
            for (let t = 1; t <= l; t++)
              try {
                const e = await _tryOpenOnce()
                return (
                  (p = e),
                  (e.onclose = () => {
                    p = null
                  }),
                  (e.onversionchange = () => {
                    e.close(), (p = null)
                  }),
                  (e.onerror = () => {
                    p = null
                  }),
                  f || ((f = !0), _scheduleCleanup(e)),
                  preloadCacheToMemory().catch(() => {}),
                  e
                )
              } catch (a) {
                e.MFL_DEBUG_API &&
                  console.warn(
                    `[MFLCache IDB] open failed (attempt ${t}):`,
                    a.message
                  ),
                  (p = null),
                  t < l && (await sleep(c * t))
              }
            return (
              console.warn(
                '[MFLCache IDB] All open attempts failed â€” using memory/LS fallback'
              ),
              (u = !0),
              null
            )
          })().finally(() => {
            ;(b = null), (m = !1)
          })),
          b))
    )
  }
  function _tryOpenOnce () {
    return new Promise((e, n) => {
      const s = setTimeout(() => n(new Error('IDB open timed out')), i),
        l = indexedDB.open(t, a)
      ;(l.onupgradeneeded = e => {
        const t = e.target.result
        if (!t.objectStoreNames.contains(r)) {
          t.createObjectStore(r, { keyPath: 'cacheKey' }).createIndex(
            'storedAt',
            'storedAt',
            { unique: !1 }
          )
        }
        t.objectStoreNames.contains(o) ||
          t.createObjectStore(o, { keyPath: 'key' })
      }),
        (l.onsuccess = t => {
          clearTimeout(s), e(t.target.result)
        }),
        (l.onerror = e => {
          clearTimeout(s), n(e.target.error)
        }),
        (l.onblocked = () => {
          clearTimeout(s), n(new Error('IDB blocked'))
        })
    })
  }
  function _scheduleCleanup (t) {
    const run = () => _purgeOldEntries(t).catch(() => {})
    'requestIdleCallback' in e
      ? requestIdleCallback(run, { timeout: 1e4 })
      : setTimeout(run, 8e3)
  }
  async function _purgeOldEntries (t) {
    const a = now() - n
    await _txPromise(
      t,
      r,
      'readwrite',
      t =>
        new Promise((r, o) => {
          const n = t.index('storedAt').openCursor(IDBKeyRange.upperBound(a))
          let i = 0
          ;(n.onsuccess = t => {
            const a = t.target.result
            a
              ? (a.delete(), i++, a.continue())
              : (i &&
                  e.MFL_DEBUG_API &&
                  console.log(
                    `[MFLCache IDB] purged ${i} entries older than 14 days`
                  ),
                r(i))
          }),
            (n.onerror = () => o(n.error))
        })
    )
  }
  function _txPromise (e, t, a, r) {
    return new Promise((o, n) => {
      let i
      try {
        i = e.transaction(t, a)
      } catch (e) {
        return n(e)
      }
      const l = setTimeout(() => {
        try {
          i.abort()
        } catch (e) {}
        n(new Error('IDB transaction timeout'))
      }, s)
      ;(i.oncomplete = () => clearTimeout(l)),
        (i.onerror = () => {
          clearTimeout(l), n(i.error)
        }),
        (i.onabort = () => {
          clearTimeout(l), n(new Error('IDB tx aborted'))
        })
      try {
        o(r(i.objectStore(t)))
      } catch (e) {
        clearTimeout(l), n(e)
      }
    })
  }
  function _lsGet (e) {
    try {
      const t = localStorage.getItem('mfl_c_' + e)
      return t ? JSON.parse(t) : null
    } catch (e) {
      return null
    }
  }
  function _lsSet (e, t) {
    try {
      return localStorage.setItem('mfl_c_' + e, JSON.stringify(t)), !0
    } catch (e) {
      return !1
    }
  }
  function getSync (e) {
    return h.has(e) ? h.get(e) : null
  }
  async function get (t) {
    const a = getSync(t)
    if (a) return a
    const o = await (async function _idbGet (t) {
      const a = await _openDB()
      if (!a) return null
      try {
        return await _txPromise(
          a,
          r,
          'readonly',
          e =>
            new Promise((a, r) => {
              const o = e.get(t)
              ;(o.onsuccess = () => a(o.result || null)),
                (o.onerror = () => r(o.error))
            })
        )
      } catch (t) {
        return (
          e.MFL_DEBUG_API &&
            console.warn('[MFLCache IDB] get error:', t.message),
          null
        )
      }
    })(t)
    if (o) return h.set(t, o), o
    const n = _lsGet(t)
    return n ? (h.set(t, n), n) : null
  }
  const w = 200,
    k = 150
  function _memEvictIfNeeded () {
    if (h.size <= w) return
    for (const [e, t] of h)
      if ((isExpiredEntry(t) && h.delete(e), h.size <= k)) return
    const e = [...h.entries()].sort(
      (e, t) => (e[1].storedAt || 0) - (t[1].storedAt || 0)
    )
    for (const [t] of e) if ((h.delete(t), h.size <= k)) return
  }
  async function set (t, a, o, n) {
    const i = { cacheKey: t, ...makeEntry(a, o) }
    h.set(t, i), _memEvictIfNeeded()
    const s = await (async function _idbSet (t) {
      const a = await _openDB()
      if (!a) return !1
      try {
        return (
          await _txPromise(
            a,
            r,
            'readwrite',
            e =>
              new Promise((a, r) => {
                const o = e.put(t)
                ;(o.onsuccess = () => a(!0)), (o.onerror = () => r(o.error))
              })
          ),
          !0
        )
      } catch (t) {
        return (
          e.MFL_DEBUG_API &&
            console.warn('[MFLCache IDB] set error:', t.message),
          !1
        )
      }
    })(i)
    s || _lsSet(t, i), n?.silent || _broadcast(t, i)
  }
  async function clearByPrefix (e) {
    h.forEach((t, a) => {
      a.startsWith(e) && h.delete(a)
    })
    const t = await _openDB()
    if (t)
      try {
        await _txPromise(
          t,
          r,
          'readwrite',
          t =>
            new Promise((a, r) => {
              const o = IDBKeyRange.bound(e, e + ' '),
                n = t.openCursor(o)
              ;(n.onsuccess = e => {
                const t = e.target.result
                t ? (t.delete(), t.continue()) : a()
              }),
                (n.onerror = () => r(n.error))
            })
        )
      } catch (e) {}
    try {
      Object.keys(localStorage)
        .filter(t => t.startsWith('mfl_c_' + e))
        .forEach(e => {
          try {
            localStorage.removeItem(e)
          } catch (e) {}
        })
    } catch (e) {}
  }
  async function getOrFetch (t, a, r, o) {
    const n = 'function' == typeof (o = o || {}).applyFn ? o.applyFn : null,
      i = o.lockTtlMs || 2e4,
      s = o.waitMs || 2e4,
      l = !!o.skipCache
    if (y.has(t)) return y.get(t)
    const c = (async function _doGetOrFetch (t, a, r, o, n, i, s) {
      if (!s) {
        const a = getSync(t)
        if (a && !isExpiredEntry(a)) {
          if (o)
            try {
              o(a.data, 'cache')
            } catch (e) {}
          return (
            e.MFL_DEBUG_API && console.log(`[MFLCache] HIT(mem) ${t}`), a.data
          )
        }
        const r = await get(t)
        if (r && !isExpiredEntry(r)) {
          if (o)
            try {
              o(r.data, 'cache')
            } catch (e) {}
          return (
            e.MFL_DEBUG_API && console.log(`[MFLCache] HIT(idb) ${t}`), r.data
          )
        }
      }
      e.MFL_DEBUG_API && console.log(`[MFLCache] MISS ${t}`)
      const l = await (async function _acquireLock (t, a) {
        const r = 'MFLLock_' + t
        if (navigator.locks && navigator.locks.request)
          return new Promise(e => {
            navigator.locks.request(r, { ifAvailable: !0 }, t => {
              if (t)
                return (
                  L.add(r),
                  e(!0),
                  new Promise(e => {
                    P.set(r, e)
                  })
                )
              e(!1)
            })
          })
        return (function _casAcquire (t, a) {
          const r = e.MFL_TAB_ID || 'tab',
            o = (() => {
              try {
                const e = localStorage.getItem(t)
                return e ? JSON.parse(e) : null
              } catch (e) {
                return null
              }
            })(),
            n = Date.now()
          if (o && o.exp > n && o.tab !== r) return Promise.resolve(!1)
          const i =
              crypto?.randomUUID?.() ||
              Math.random().toString(36).slice(2) + '-' + n.toString(36),
            s = { tab: r, exp: n + a, token: i },
            l = JSON.stringify(s)
          try {
            localStorage.setItem(t, l)
          } catch (e) {}
          try {
            const e = localStorage.getItem(t),
              a = e ? JSON.parse(e) : null
            if (!a || a.token !== i) return Promise.resolve(!1)
          } catch (e) {
            return Promise.resolve(!1)
          }
          return Promise.resolve(!0)
        })(r, a)
      })(t, n)
      if (!l) {
        e.MFL_DEBUG_API && console.log(`[MFLCache] WAIT (follower) ${t}`)
        const a = await (function _waitForBC (e, t) {
          return new Promise(a => {
            const r = h.get(e)
            if (r && !isExpiredEntry(r)) return a(r)
            let o = !1
            const n = setTimeout(() => {
              cleanup(), a(null)
            }, t)
            function handler (e) {
              o || ((o = !0), cleanup(), a(e))
            }
            function cleanup () {
              clearTimeout(n)
              const t = _.get(e)
              t && (t.delete(handler), t.size || _.delete(e))
            }
            _.has(e) || _.set(e, new Set()), _.get(e).add(handler)
          })
        })(t, i)
        if (a && !isExpiredEntry(a)) {
          if (o)
            try {
              o(a.data, 'bc')
            } catch (e) {}
          return a.data
        }
        const r = getSync(t)
        if (r && !isExpiredEntry(r)) {
          if (o)
            try {
              o(r.data, 'cache')
            } catch (e) {}
          return r.data
        }
        const n = await get(t)
        if (n && !isExpiredEntry(n)) {
          if (o)
            try {
              o(n.data, 'cache')
            } catch (e) {}
          return n.data
        }
        return (
          console.warn(`[MFLCache] follower gave up waiting for ${t}`), null
        )
      }
      try {
        if (!s) {
          const e = getSync(t)
          if (e && !isExpiredEntry(e)) {
            if (o)
              try {
                o(e.data, 'cache')
              } catch (e) {}
            return e.data
          }
        }
        e.MFL_DEBUG_API && console.log(`[MFLCache] FETCH ${t}`)
        const i = await Promise.race([
          a(),
          new Promise((e, t) =>
            setTimeout(() => t(new Error('fetch timeout')), n)
          )
        ])
        if ((await set(t, i, r), o))
          try {
            o(i, 'api')
          } catch (e) {}
        return i
      } catch (e) {
        return console.error(`[MFLCache] fetch error for ${t}:`, e), null
      } finally {
        !(function _releaseLock (e) {
          const t = 'MFLLock_' + e
          L.delete(t)
          const a = P.get(t)
          if (a) return P.delete(t), void a()
          try {
            localStorage.removeItem(t)
          } catch (e) {}
        })(t)
      }
    })(t, a, r, n, i, s, l)
    return (
      y.set(t, c),
      c.finally(() => {
        y.get(t) === c && y.delete(t)
      })
    )
  }
  const L = new Set(),
    P = new Map()
  const S = new Map()
  let M = !1
  async function preloadCacheToMemory () {
    if (M) return
    M = !0
    const t = await _openDB()
    if (t)
      try {
        const a = await _txPromise(
          t,
          r,
          'readonly',
          e =>
            new Promise((t, a) => {
              const r = e.getAll()
              ;(r.onsuccess = () => t(r.result || [])),
                (r.onerror = () => a(r.error))
            })
        )
        a.forEach(e => {
          e && e.cacheKey && !isExpiredEntry(e) && h.set(e.cacheKey, e)
        }),
          e.MFL_DEBUG_API &&
            console.log(`[MFLCache] preloaded ${a.length} entries into memory`)
      } catch (t) {
        e.MFL_DEBUG_API && console.warn('[MFLCache] preload failed:', t)
      }
  }
  const F = {
    get: get,
    getSync: getSync,
    batchGet: async function batchGet (e) {
      const t = e.map(e => (e ? getSync(e) : null))
      if (t.every((t, a) => null === e[a] || null !== t)) return t
      const a = await _openDB()
      if (!a) return e.map((e, a) => t[a] || (e ? _lsGet(e) : null))
      try {
        const o = await _txPromise(a, r, 'readonly', t =>
          Promise.all(
            e.map(e =>
              null === e
                ? Promise.resolve(null)
                : new Promise((a, r) => {
                    const o = t.get(e)
                    ;(o.onsuccess = () => a(o.result || null)),
                      (o.onerror = () => r(o.error))
                  })
            )
          )
        )
        return (
          o.forEach((t, a) => {
            t && e[a] && h.set(e[a], t)
          }),
          _memEvictIfNeeded(),
          o.map((a, r) => a || t[r] || (e[r] ? _lsGet(e[r]) : null))
        )
      } catch (a) {
        return e.map((e, a) => t[a] || (e ? _lsGet(e) : null))
      }
    },
    set: set,
    batchSet: async function batchSet (t) {
      if (!t || !t.length) return
      const a = t.map(e => ({
        cacheKey: e.cacheKey,
        ...makeEntry(e.data, e.ttlSeconds)
      }))
      a.forEach(e => h.set(e.cacheKey, e)), _memEvictIfNeeded()
      ;(await (async function _idbBatchSet (t) {
        const a = await _openDB()
        if (!a) return !1
        try {
          return (
            await _txPromise(a, r, 'readwrite', e =>
              Promise.all(
                t.map(
                  t =>
                    new Promise((a, r) => {
                      const o = e.put(t)
                      ;(o.onsuccess = a), (o.onerror = () => r(o.error))
                    })
                )
              )
            ),
            !0
          )
        } catch (t) {
          return (
            e.MFL_DEBUG_API &&
              console.warn('[MFLCache IDB] batchSet error:', t.message),
            !1
          )
        }
      })(a)) || a.forEach(e => _lsSet(e.cacheKey, e)),
        a.forEach((e, a) => {
          t[a]?.silent || _broadcast(e.cacheKey, e)
        })
    },
    del: async function del (e) {
      h.delete(e),
        await (async function _idbDelete (e) {
          const t = await _openDB()
          if (t)
            try {
              await _txPromise(
                t,
                r,
                'readwrite',
                t =>
                  new Promise((a, r) => {
                    const o = t.delete(e)
                    ;(o.onsuccess = a), (o.onerror = () => r(o.error))
                  })
              )
            } catch (e) {}
        })(e)
      try {
        localStorage.removeItem('mfl_c_' + e)
      } catch (e) {}
    },
    clearByPrefix: clearByPrefix,
    clearStaleByPrefix: async function clearStaleByPrefix (e, t) {
      if (!Array.isArray(e) || !t) return
      const a = [],
        o = await _openDB()
      if (o)
        try {
          await _txPromise(
            o,
            r,
            'readwrite',
            r =>
              new Promise((o, n) => {
                const i = r.openCursor()
                ;(i.onsuccess = r => {
                  const n = r.target.result
                  if (n) {
                    const r = n.key
                    e.some(e => r.startsWith(e)) &&
                      !r.endsWith('_' + t) &&
                      (a.push(r), n.delete()),
                      n.continue()
                  } else o()
                }),
                  (i.onerror = () => n(i.error))
              })
          ),
            a.length &&
              window.MFL_DEBUG_API &&
              console.log(
                '[MFLCache] cleared ' + a.length + ' stale bucket keys:',
                a
              )
        } catch (e) {}
      ;(a.length ? a : []).forEach(e => h.delete(e)),
        o ||
          h.forEach((a, r) => {
            e.some(e => r.startsWith(e)) && !r.endsWith('_' + t) && h.delete(r)
          })
    },
    getOrFetch: getOrFetch,
    bucketFiveMin: function bucketFiveMin (e) {
      return Math.floor((e || Date.now()) / FIVE_MIN_MS) * FIVE_MIN_MS
    },
    bucketSixHour: function bucketSixHour (e) {
      const t = e || Math.floor(Date.now() / 1e3)
      return 21600 * Math.floor(t / 21600)
    },
    bucketDaily: function bucketDaily (e) {
      const t = e || Math.floor(Date.now() / 1e3)
      return 86400 * Math.floor((t + 54e3) / 86400)
    },
    KEY: {
      playerDB: e => `global_${e}_playerDB`,
      playerDBTs: e => `global_${e}_playerDB_updatedAt`,
      injuries: e => `global_${e}_injuries`,
      newsBreaker: () => 'global_newsBreaker',
      topStarters: (e, t) => `global_${e}_topStarters_w${t}`,
      nflSchedule: (e, t) => `global_${e}_nflSchedule_${t}`,
      myLeagues: e => `global_${e}_myLeagues`,
      weather: () => 'global_weather',
      rosters: (e, t) => `lid_${e}_${t}_rosters`,
      transactions: (e, t) => `lid_${e}_${t}_transactions`,
      league: (e, t) => `lid_${e}_${t}_league`,
      standings: (e, t) => `lid_${e}_${t}_standings`,
      weeklyResults: (e, t, a) => `lid_${e}_${t}_weeklyResults_w${a}`,
      projScores: (e, t, a) => `lid_${e}_${t}_projScores_w${a}`,
      customPlayer: (e, t) => `lid_${e}_${t}_customPlayer`,
      mflBoxMatchups: (e, t) => `lid_${e}_${t}_mflBoxMatchups`
    },
    TTL: {
      LIVE: 20,
      FIVE_MIN: 300,
      FIFTEEN_MIN: 900,
      SIX_HOUR: 21600,
      DAILY: 86400,
      WEEKLY: 604800,
      NEVER: 2592e3
    },
    metaGet: async function metaGet (e) {
      const t = await _openDB()
      if (!t)
        try {
          const t = localStorage.getItem('mfl_meta_' + e)
          return t ? JSON.parse(t) : null
        } catch (e) {
          return null
        }
      try {
        const a = await _txPromise(
          t,
          o,
          'readonly',
          t =>
            new Promise((a, r) => {
              const o = t.get(e)
              ;(o.onsuccess = () => a(o.result || null)),
                (o.onerror = () => r(o.error))
            })
        )
        return a ? a.value : null
      } catch (e) {
        return null
      }
    },
    metaSet: async function metaSet (e, t) {
      const a = await _openDB()
      if (a)
        try {
          await _txPromise(
            a,
            o,
            'readwrite',
            a =>
              new Promise((r, o) => {
                const n = a.put({ key: e, value: t })
                ;(n.onsuccess = r), (n.onerror = () => o(n.error))
              })
          )
        } catch (a) {
          try {
            localStorage.setItem('mfl_meta_' + e, JSON.stringify(t))
          } catch (e) {}
        }
      else
        try {
          localStorage.setItem('mfl_meta_' + e, JSON.stringify(t))
        } catch (e) {}
    },
    scheduleRefresh: function scheduleRefresh (e, t, a, r, o) {
      if (S.has(e)) return
      async function tick () {
        try {
          await getOrFetch(r, t, o, {
            skipCache: !0,
            lockTtlMs: Math.min(a, 3e4),
            waitMs: Math.min(a, 3e4)
          })
        } catch (t) {
          console.warn(`[MFLCache] refresh tick error (${e}):`, t)
        }
      }
      const n = setTimeout(tick, 2e3),
        i = setInterval(tick, a)
      S.set(e, { id: i, initTimer: n })
    },
    cancelRefresh: function cancelRefresh (e) {
      const t = S.get(e)
      t && (clearInterval(t.id), clearTimeout(t.initTimer), S.delete(e))
    },
    clearLeague: function clearLeague (e, t) {
      return clearByPrefix(`lid_${e}_${t}_`)
    },
    clearGlobal: function clearGlobal (e) {
      return clearByPrefix(`global_${e}_`)
    },
    clearYear: function clearYear (e) {
      return Promise.all([
        clearByPrefix(`lid_${e}_`),
        clearByPrefix(`global_${e}_`)
      ])
    },
    runManualCleanup: async function runManualCleanup () {
      const e = await _openDB()
      e && (await _purgeOldEntries(e))
    },
    isExpiredEntry: isExpiredEntry,
    isReady: () => null !== p || u,
    isOpening: () => m,
    memSize: () => h.size,
    reconnect: () => ((p = null), (u = !1), (m = !1), (b = null), _openDB()),
    preloadCacheToMemory: preloadCacheToMemory
  }
  ensureBC(), _openDB(), (e.MFLCache = F)
})(window)
let lsm_lastWeeklyResultsCheck = 0
const WEEKLY_RESULTS_RECHECK_MS = 12e4
;(window.MFL_TAB_ID = (() => {
  const e = 'MFL_TAB_ID'
  let t = sessionStorage.getItem(e)
  return (
    t ||
      ((t =
        'tab-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 10)),
      sessionStorage.setItem(e, t)),
    t
  )
})()),
  (window.__MFL_inflight = window.__MFL_inflight || new Map())
const FIVE_MIN_KEY = 'serverFiveMinMs'
function computeFiveMinBucketMs (e) {
  return Math.floor(e / FIVE_MIN_MS) * FIVE_MIN_MS
}
function getCacheFiveMinutes () {
  const e = parseInt(localStorage.getItem(FIVE_MIN_KEY), 10),
    t = Number.isFinite(e) ? computeFiveMinBucketMs(e) : NaN,
    a = computeFiveMinBucketMs(Date.now())
  if (Number.isFinite(t) && t > 0 && t >= a) return t
  try {
    safeLocalStorageSet(FIVE_MIN_KEY, String(a))
  } catch {}
  return a
}
function setCacheFiveMinutesNow () {
  const e = computeFiveMinBucketMs(Date.now())
  try {
    safeLocalStorageSet(FIVE_MIN_KEY, String(e))
  } catch {}
  return e
}
function resolveFiveMinBucket (e) {
  const t = Number(e)
  if (Number.isFinite(t) && t > 0) return t
  const a = Number(cacheFiveMinutes)
  return Number.isFinite(a) && a > 0 ? a : getCacheFiveMinutes()
}
var cacheFiveMinutes = getCacheFiveMinutes()
const SIX_HOURS_SEC = 21600
function computeSixHourBucket (e) {
  return Math.floor(e / SIX_HOURS_SEC) * SIX_HOURS_SEC
}
function getCacheSixHours (e) {
  const t = 'serverSixHours_' + year,
    a = computeSixHourBucket(
      Number.isFinite(Number(e)) ? Number(e) : Math.floor(Date.now() / 1e3)
    ),
    r = parseInt(localStorage.getItem(t), 10)
  if (!Number.isFinite(r) || r <= 0 || r !== a) {
    try {
      safeLocalStorageSet(t, String(a))
    } catch {}
    return a
  }
  return r
}
var cacheSixHours = getCacheSixHours(currentServerTime)
function normalizeServerTimeSeconds (e) {
  const t = Number(e)
  return Number.isFinite(t)
    ? t > 1e12
      ? Math.floor(t / 1e3)
      : Math.floor(t)
    : null
}
function computeDailyBucketFromServerTime (e) {
  return 86400 * Math.floor((e + 54e3) / 86400)
}
function getCacheDaily (e) {
  const t = 'serverDaily_' + year,
    a = computeDailyBucketFromServerTime(
      normalizeServerTimeSeconds(e) ?? Math.floor(Date.now() / 1e3)
    ),
    r = parseInt(localStorage.getItem(t), 10)
  if (!Number.isFinite(r) || r <= 0 || r !== a) {
    try {
      safeLocalStorageSet(t, String(a))
    } catch {}
    return a
  }
  return r
}
function setCacheDaily (e) {
  const t = 'serverDaily_' + year,
    a = computeDailyBucketFromServerTime(
      normalizeServerTimeSeconds(e) ?? Math.floor(Date.now() / 1e3)
    )
  try {
    safeLocalStorageSet(t, String(a))
  } catch {}
  return a
}
var cacheDaily = getCacheDaily(currentServerTime)
function stillOwnLock (e) {
  try {
    const t = localStorage.getItem(e)
    if (!t) return !1
    const a = JSON.parse(t),
      r = sessionStorage.getItem(e + '_token')
    return !!(
      a &&
      a.tab === window.MFL_TAB_ID &&
      a.token &&
      r &&
      a.token === r &&
      'number' == typeof a.exp &&
      a.exp > Date.now()
    )
  } catch {
    return !1
  }
}
function tryAcquireLock (e, t) {
  const a = Date.now(),
    r = window.MFL_TAB_ID,
    o = localStorage.getItem(e)
  let n = null
  if (o)
    try {
      n = JSON.parse(o)
    } catch {
      n = null
    }
  if (n && 'number' == typeof n.exp && n.exp > a && n.tab && n.tab !== r)
    return !1
  if (n && 'number' == typeof n.exp && n.exp > a && n.tab === r) return !0
  if (n && 'number' == typeof n.exp && n.exp <= a)
    try {
      localStorage.removeItem(e)
    } catch {}
  const i =
      crypto?.randomUUID?.() ||
      Math.random().toString(36).slice(2) + '-' + a.toString(36),
    s = { tab: r, exp: a + t, token: i },
    l = JSON.stringify(s)
  try {
    if (localStorage.getItem(e) !== o) return !1
    localStorage.setItem(e, l)
  } catch {
    return !1
  }
  if (localStorage.getItem(e) !== l) return !1
  try {
    sessionStorage.setItem(e + '_token', i),
      sessionStorage.setItem(e + '_value', l)
  } catch {}
  return !0
}
function releaseLock (e) {
  const t = localStorage.getItem(e)
  if (t)
    try {
      const a = JSON.parse(t),
        r = sessionStorage.getItem(e + '_token')
      a &&
        a.tab === window.MFL_TAB_ID &&
        a.token &&
        r &&
        a.token === r &&
        localStorage.removeItem(e)
    } catch {}
}
function withLock (e, t, a) {
  if (
    'undefined' != typeof navigator &&
    navigator.locks &&
    navigator.locks.request
  )
    return navigator.locks.request(
      e,
      { mode: 'exclusive', ifAvailable: !0 },
      async e => {
        if (!e) return null
        try {
          return await a()
        } finally {
        }
      }
    )
  return tryAcquireLock(e, t)
    ? Promise.resolve()
        .then(a)
        .finally(() => releaseLock(e))
    : Promise.resolve(null)
}
function waitForStorageValue (e, t) {
  return new Promise(a => {
    const r = localStorage.getItem(e)
    if (null != r) return a(r)
    let o = !1
    function finish (t) {
      if (o) return
      ;(o = !0), clearTimeout(n)
      const r = window.__MFL_storageWaiters.get(e)
      r && r.delete(finish), a(t)
    }
    const n = setTimeout(() => finish(null), t)
    window.__MFL_storageWaiters.has(e) ||
      window.__MFL_storageWaiters.set(e, new Set()),
      window.__MFL_storageWaiters.get(e).add(finish)
  })
}
function maybeSignalMFLGlobalCacheReady () {
  window.MFLGlobalCache &&
    !window.MFLGlobalCache._ready &&
    window.reportFiveMinuteFullyLoaded &&
    window.reportDailyFullyLoaded &&
    lsm_firstFetchDone &&
    window.MFLGlobalCache._fireReady()
}
function signalMFLCacheUpdate (e, t) {
  if (
    'undefined' != typeof window &&
    'undefined' != typeof CustomEvent &&
    'function' == typeof window.dispatchEvent
  )
    try {
      window.dispatchEvent(
        new CustomEvent('MFLCacheUpdate', {
          detail: Object.assign({ key: e }, t || {})
        })
      )
    } catch (e) {}
}
function allGamesFinalFromLiveFeed (e) {
  if (e < completedWeek) return !0
  const t = Number(e),
    a = reportWeeklyResults_ar?.['w_' + t]?.weeklyResults
  if (!a) return !1
  const toArray = e => (Array.isArray(e) ? e : e ? [e] : []),
    isReal = e => {
      const t = String(e ?? '')
      return t && 'BYE' !== t && 'AVG' !== t
    },
    r = Object.create(null)
  for (const e of toArray(a.franchise)) {
    const t = String(e?.id ?? '')
    isReal(t) && e && 'object' == typeof e && (r[t] = e)
  }
  for (const e of toArray(a.matchup))
    for (const t of toArray(e?.franchise)) {
      const e = String(t?.id ?? '')
      isReal(e) &&
        t &&
        'object' == typeof t &&
        ((r[e] && Object.prototype.hasOwnProperty.call(r[e], 'score')) ||
          (r[e] = t))
    }
  const o = Object.keys(r)
  if (!o.length) return !1
  for (const e of o) {
    const t = r[e]
    if (!Object.prototype.hasOwnProperty.call(t, 'score')) return !1
  }
  return !0
}
function bcNameLive (e, t) {
  return `MFL_LIVESCORING_${e}_${t}`
}
function ensureLiveScoringChannel (e, t) {
  if (!('BroadcastChannel' in window)) return null
  const a = bcNameLive(e, t)
  if (window.__LSM_bc && window.__LSM_bc.name === a) return window.__LSM_bc
  try {
    window.__LSM_bc && window.__LSM_bc.close()
  } catch {}
  const r = new BroadcastChannel(a)
  return (
    (window.__LSM_bc = r),
    r.addEventListener('message', a => {
      const r = a.data
      r &&
        'liveScoring' === r.type &&
        String(r.league_id) === String(t) &&
        String(r.year) === String(e) &&
        (window.liveScoringLiveWeek = r.payload)
    }),
    r
  )
}
async function getLiveScoringAPI () {
  if (!needsAPI('getLiveScoringAPI')) return
  if (!liveScoringWeek || !league_id) return null
  const e = `lock_liveScoring_${year}_${league_id}`,
    t = ensureLiveScoringChannel(year, league_id)
  if (!tryAcquireLock(e, 25e3)) {
    if (t) {
      const e = await new Promise(e => {
        const a = setTimeout(() => e(null), 6e3)
        t.addEventListener('message', function onMsg (r) {
          const o = r.data
          o &&
            'liveScoring' === o.type &&
            String(o.league_id) === String(league_id) &&
            String(o.year) === String(year) &&
            (clearTimeout(a),
            t.removeEventListener('message', onMsg),
            e(o.payload))
        })
      })
      if (e) return (window.liveScoringLiveWeek = e), e
    }
    return window.liveScoringLiveWeek || null
  }
  try {
    const e = Number(liveScoringWeek),
      a = `${baseURLDynamic}/${year}/export?TYPE=liveScoring&L=${league_id}&W=${e}&DETAILS=1&JSON=1`,
      r = await fetch(a, { cache: 'no-store' })
    if (!r.ok) throw new Error('liveScoring HTTP ' + r.status)
    const o = await r.json()
    if (((window.liveScoringLiveWeek = o), t))
      try {
        t.postMessage({
          type: 'liveScoring',
          year: year,
          league_id: league_id,
          ts: Date.now(),
          payload: o
        })
      } catch {}
    return o
  } catch (e) {
    return console.warn('[LS] getLiveScoringAPI failed:', e), null
  } finally {
    releaseLock(e)
  }
}
function lsmIsLiveFromRefreshMs (e) {
  return !(!Number.isFinite(e) || e <= 0) && e <= 3e5
}
function lsmParseXmlIntoStats (e) {
  const t = [],
    a = [],
    r = e.split('\n')
  for (let e = 0; e < r.length; e++) {
    const o = r[e]
    if (!o.trim()) continue
    const n = o.split('|'),
      i = n[0]
    if ('DATE' === i) {
      lsm_last_update_secs_first = n[1]
      continue
    }
    if ('REFRESH' === i) {
      const e = Number(n[1])
      Number.isFinite(e) &&
        e > 0 &&
        ((lsm_refreshMs = e),
        (window.lsm_is_live_now = lsmIsLiveFromRefreshMs(e)))
      continue
    }
    let s
    isNaN(i)
      ? (a[i] || (a[i] = {}), (s = a[i]))
      : (t[i] || (t[i] = {}), (s = t[i]))
    for (let e = 1; e < n.length; e++) {
      const t = n[e],
        a = t.indexOf(' ')
      a > 0 && (s[t.slice(0, a)] = t.slice(a + 1))
    }
  }
  ;(lsm_stats = t),
    (lsm_tstats = a),
    (lsm_firstFetchDone = !0),
    maybeSignalMFLGlobalCacheReady()
}
function lsmSetLiveRefreshOverride (e) {
  !Number.isFinite(e) || e <= 0
    ? (lsm_manualOverrideMs = null)
    : ((lsm_manualOverrideMs = e),
      window.lsm_is_live_now &&
        null !== lsm_pollTimerId &&
        (clearTimeout(lsm_pollTimerId),
        (lsm_pollTimerId = null),
        lsm_get_stats(!0)))
}
async function lsm_get_stats (e = !0) {
  null !== lsm_pollTimerId &&
    (clearTimeout(lsm_pollTimerId), (lsm_pollTimerId = null))
  let t = !1
  Date.now()
  let a = liveScoringWeek || 1,
    r = a < 10 ? '0' + a : String(a),
    o = xmlBaseURL + 'live_stats_idp_' + r + '.txt'
  try {
    const e = await fetch(o, { cache: 'no-store' })
    if (!e.ok) throw new Error('Network response was not ok: ' + e.status)
    if ((lsmParseXmlIntoStats(await e.text()), lsm_scheduleStarted)) {
      if (
        (await Promise.all([
          reportNflScheduleAPI(liveScoringWeek),
          getLiveScoringAPI()
        ]),
        liveScoringWeek === completedWeek &&
          ((t = allGamesFinalFromLiveFeed(liveScoringWeek)),
          !t || !MFLPastSeason))
      ) {
        const e = Date.now()
        e - lsm_lastWeeklyResultsCheck >= WEEKLY_RESULTS_RECHECK_MS &&
          ((lsm_lastWeeklyResultsCheck = e),
          reportWeeklyResultsAPI(liveScoringWeek, !0))
      }
      try {
        'function' == typeof window.LSMupdate &&
          document.getElementById('lsmShowHide') &&
          (await window.LSMupdate()),
          !0 === window.doMFLBox &&
            'function' == typeof window.doMFLBoxLiveUpdate &&
            (await window.doMFLBoxLiveUpdate()),
          !0 === window.doTicker &&
            'function' == typeof window.getTickerLiveStats &&
            (await window.getTickerLiveStats())
      } catch (e) {
        console.error('Delayed update chain failed:', e)
      }
      if (t || MFLPastSeason) return void lsmStopLiveStatsPolling()
    }
    lsm_scheduleStarted = !0
  } catch (e) {
    if (
      (console.warn('[LS] lsm_get_stats fetch/parse error:', e),
      (!Number.isFinite(lsm_refreshMs) || lsm_refreshMs <= 0) &&
        (lsm_refreshMs = 3e5),
      lsm_firstFetchDone ||
        ((lsm_firstFetchDone = !0), maybeSignalMFLGlobalCacheReady()),
      lsm_scheduleStarted &&
        (await reportNflScheduleAPI(liveScoringWeek),
        await getLiveScoringAPI(),
        allGamesFinalFromLiveFeed(liveScoringWeek)))
    )
      return void lsmStopLiveStatsPolling()
    lsm_scheduleStarted = !0
  }
  if (!e) return
  let n = lsm_refreshMs
  window.lsm_is_live_now &&
    Number.isFinite(lsm_manualOverrideMs) &&
    lsm_manualOverrideMs > 0 &&
    (n = lsm_manualOverrideMs)
  const i = 3e5
  !Number.isFinite(n) || n <= 0
    ? (n = 3e5)
    : (n < 15e3 && (n = 15e3), n > i && (n = i)),
    (lsm_pollTimerId = setTimeout(function () {
      lsm_get_stats(!0)
    }, n))
}
function lsmStopLiveStatsPolling () {
  null !== lsm_pollTimerId &&
    (clearTimeout(lsm_pollTimerId), (lsm_pollTimerId = null))
}
if (
  ((window.__MFL_storageWaiters = window.__MFL_storageWaiters || new Map()),
  (function installStorageDispatcher () {
    window.__MFL_storageDispatcherInstalled ||
      ((window.__MFL_storageDispatcherInstalled = !0),
      window.addEventListener('storage', e => {
        if (!e.key || null == e.newValue) return
        const t = window.__MFL_storageWaiters.get(e.key)
        if (!t || 0 === t.size) return
        const a = localStorage.getItem(e.key)
        if (null != a) {
          for (const e of t)
            try {
              e(a)
            } catch {}
          t.clear()
        }
      }))
  })(),
  window.addEventListener('storage', e => {
    if (e.key && null != e.newValue)
      if (e.key !== FIVE_MIN_KEY)
        if (e.key !== 'serverSixHours_' + year)
          if (e.key !== 'serverDaily_' + year);
          else {
            const t = parseInt(e.newValue, 10)
            Number.isFinite(t) && t > 0 && (cacheDaily = t)
          }
        else {
          const t = parseInt(e.newValue, 10)
          Number.isFinite(t) && t > 0 && (cacheSixHours = t)
        }
      else {
        const t = parseInt(e.newValue, 10)
        Number.isFinite(t) &&
          t > 0 &&
          (cacheFiveMinutes = computeFiveMinBucketMs(t))
      }
  }),
  window.addEventListener('MFLCacheBroadcast', function (e) {
    const { cacheKey: t, data: a } = e.detail || {}
    if (t && a)
      try {
        if (t === 'lid_' + year + '_' + league_id + '_rosters') {
          if (!needsAPI('reportRostersAPI')) return
          if (!a) return
          return (
            (reportRoster_ar = a),
            a?.rosters?.franchise && reportRosterResponse(reportRoster_ar),
            void signalMFLCacheUpdate('rosters', {
              source: 'bc',
              ttl: 'fiveMinute',
              league_id: league_id
            })
          )
        }
        if (t === 'global_' + year + '_injuries') {
          if (!needsAPI('reportInjuriesAPI')) return
          return (
            (reportInjuries_ar = a),
            a?.injuries?.injury && reportInjuriesResponse(a),
            void signalMFLCacheUpdate('injuries', {
              source: 'bc',
              ttl: 'fiveMinute'
            })
          )
        }
        if (t === 'lid_' + year + '_' + league_id + '_transactions') {
          if (!needsAPI('reportTransactionsAPI')) return
          return (
            (reportTransactions_ar = a),
            void signalMFLCacheUpdate('transactions', {
              source: 'bc',
              ttl: 'fiveMinute',
              league_id: league_id
            })
          )
        }
        if ('global_newsBreaker' === t)
          return (
            applyNewsBreakerFromJSON(a),
            void signalMFLCacheUpdate('newsBreaker', {
              source: 'bc',
              ttl: 'fiveMinute'
            })
          )
        if (t === 'global_' + year + '_myLeagues') {
          if (!needsAPI('loadMyLeaguesJSON')) return
          return (
            applyMyLeaguesFromJSON(a),
            void signalMFLCacheUpdate('myLeagues', {
              source: 'bc',
              ttl: 'sixHour'
            })
          )
        }
        if ('global_weather' === t) {
          if (a) {
            const e = normalizeWeather(a)
            ;(window.weather = e),
              (window.__MFL_weatherLast = e),
              (window.__MFL_weatherLastTs = Date.now())
          }
          return
        }
        if (t === 'global_' + year + '_playerDB')
          return void (
            a &&
            'object' == typeof a &&
            (window.playerDatabase = rebuildPlayerDatabase(a))
          )
        if (t === 'lid_' + year + '_' + league_id + '_league') {
          if (!needsAPI('reportLeagueAPI')) return
          if (!a) return
          return (
            (reportLeague_ar = a),
            reportLeagueResponse(a),
            void signalMFLCacheUpdate('league', {
              source: 'bc',
              ttl: 'daily',
              league_id: league_id
            })
          )
        }
        if (t === 'lid_' + year + '_' + league_id + '_standings') {
          if (!needsAPI('reportStandingsAPI')) return
          if (!a) return
          return (
            reportStandingsResponse(a),
            void signalMFLCacheUpdate('standings', {
              source: 'bc',
              ttl: 'daily',
              league_id: league_id
            })
          )
        }
        if (t.startsWith('global_' + year + '_topStarters_')) {
          if (!needsAPI('reportTopStartersAPI')) return
          if (!a) return
          reportTopStarters_ar = a
          const e = t.match(/_topStarters_w(\d+)$/)
          return void (
            e &&
            signalMFLCacheUpdate('topstarters', {
              source: 'bc',
              ttl: 'daily',
              week: Number(e[1])
            })
          )
        }
        if (t.startsWith('lid_' + year + '_' + league_id + '_projScores_')) {
          if (!needsAPI('reportProjectedScoresAPI')) return
          if (!a) return
          const e = t.match(/_projScores_w(\d+)$/)
          return void (
            e &&
            ((reportProjectedScores_ar['w_' + e[1]] = a),
            signalMFLCacheUpdate('projectedScores', {
              source: 'bc',
              ttl: 'daily',
              league_id: league_id,
              week: Number(e[1])
            }))
          )
        }
        if (t.startsWith('lid_' + year + '_' + league_id + '_weeklyResults_')) {
          if (!needsAPI('reportWeeklyResultsAPI')) return
          if (!a) return
          const e = t.match(/_weeklyResults_w(\d+)$/)
          if (e) {
            const t = Number(e[1])
            ;(reportWeeklyResults_ar['w_' + t] = a),
              reportWeeklyResultsResponse(a, t),
              signalMFLCacheUpdate('weeklyResults', {
                source: 'bc',
                ttl: 'daily',
                league_id: league_id,
                week: t
              })
          }
          return
        }
        if (t.startsWith('global_' + year + '_nflSchedule_')) {
          if (!a) return
          const e = t
              .replace('global_' + year + '_nflSchedule_', '')
              .split('_'),
            r = Number(e[0])
          return void (
            Number.isFinite(r) &&
            r > 0 &&
            ((reportNflSchedule_ar['w_' + r] = a),
            reportNflScheduleResponse(a, r),
            signalMFLCacheUpdate('nflSchedule', {
              source: 'bc',
              ttl: 'daily',
              week: r
            }))
          )
        }
        if (t === 'lid_' + year + '_' + league_id + '_customPlayer') {
          if (!needsAPI('reportRostersAPI')) return
          if (!a) return
          return (reportCustomPlayer_ar = a), void reportCustomPlayerResponse(a)
        }
      } catch (e) {
        window.MFL_DEBUG_API &&
          console.warn('[MFLCacheBroadcast] dispatch error for', t, e)
      }
  }),
  (window.MFLGlobalCache = window.MFLGlobalCache || {}),
  (function (e) {
    void 0 === e._ready && (e._ready = !1),
      e._callbacks || (e._callbacks = []),
      (e.isReady = function () {
        return !!e._ready
      }),
      (e.onReady = function (t) {
        if ('function' == typeof t)
          if (e._ready)
            try {
              t()
            } catch (e) {
              console.error(e)
            }
          else e._callbacks.push(t)
      }),
      (e._fireReady = function () {
        if (!e._ready) {
          e._ready = !0
          try {
            window.dispatchEvent(
              new CustomEvent('MFLGlobalCacheReady', {
                detail: {
                  fiveMinute: !!window.reportFiveMinuteFullyLoaded,
                  daily: !!window.reportDailyFullyLoaded
                }
              })
            )
          } catch (e) {}
          var t = e._callbacks.slice()
          e._callbacks.length = 0
          for (var a = 0; a < t.length; a++)
            try {
              t[a]()
            } catch (e) {
              console.error(e)
            }
        }
      })
  })(window.MFLGlobalCache),
  (function setupLsmLiveState () {
    let e = 'boolean' == typeof window.lsm_is_live_now && window.lsm_is_live_now
    Object.defineProperty(window, 'lsm_is_live_now', {
      configurable: !0,
      get: () => e,
      set (t) {
        const a = !!t
        if (a === e) return
        const r = e
        e = a
        try {
          window.dispatchEvent(
            new CustomEvent('lsmLiveChange', {
              detail: { oldValue: r, newValue: a }
            })
          )
        } catch (e) {
          console.warn('[LS] lsmLiveChange event dispatch failed', e)
        }
      }
    })
  })(),
  lsmSetLiveRefreshOverride(2e4),
  void 0 === reportRoster_ar)
)
  var reportRoster_ar = []
if (void 0 === mfl_rosters) var mfl_rosters = []
if (void 0 === reportCustomPlayer_ar) var reportCustomPlayer_ar = []
if (void 0 === customPlayerString) var customPlayerString = ''
if (void 0 === reportInjuries_ar) var reportInjuries_ar = []
if (void 0 === mfl_injuries) var mfl_injuries = []
if (void 0 === reportTransactions_ar) var reportTransactions_ar = []
if (void 0 === newsBreaker) var newsBreaker = void 0
if (void 0 === weather) var weather = void 0
if (void 0 === myLeagues) var myLeagues = void 0
if (void 0 === reportFiveMinuteApi_ran) var reportFiveMinuteApi_ran = !1
if (void 0 === reportFiveMinuteApiNoCache) var reportFiveMinuteApiNoCache = !1
if (void 0 === reportFiveMinuteFullyLoaded) var reportFiveMinuteFullyLoaded = !1
async function doFiveMinuteCache (e) {
  if (doFiveMinuteCache._running) return
  ;(doFiveMinuteCache._running = !0),
    (reportFiveMinuteApi_ran = !0),
    (reportFiveMinuteApiNoCache = !1)
  const t = resolveFiveMinBucket(e)
  loadMyLeaguesJSON().catch(() => {})
  try {
    const [e, ...a] = await Promise.allSettled([
        waitForPlayerDatabase(),
        reportInjuriesAPI(t),
        reportTransactionsAPI(t),
        loadNewsBreakerJSON(t)
      ]),
      r = await Promise.allSettled([reportRostersAPI(t)])
    if (window.MFL_DEBUG_API) {
      ;[
        ['playerDB', e],
        ['injuries', a[0]],
        ['transactions', a[1]],
        ['newsBreaker', a[2]],
        ['rosters', r[0]]
      ].forEach(([e, t]) => {
        'rejected' === t.status &&
          console.warn(`[doFiveMinuteCache] ${e} rejected:`, t.reason)
      })
    }
  } catch (e) {
    console.error('[doFiveMinuteCache]', e)
  } finally {
    ;(reportFiveMinuteFullyLoaded = !0),
      maybeSignalMFLGlobalCacheReady(),
      (window.__MFL_weatherPromise = loadWeatherJSONDelayed()),
      (doFiveMinuteCache._running = !1)
  }
}
function getLivePlayerDB () {
  return window.playerDatabase || null
}
function dbLooksPopulated (e) {
  return (
    !!e && ((Array.isArray(e) && e.length > 0) || Object.keys(e).length > 0)
  )
}
function rebuildPlayerDatabase (e) {
  if (!e || 'object' != typeof e) return new Array()
  const t = new Array()
  for (const a in e) {
    if (!Object.prototype.hasOwnProperty.call(e, a)) continue
    const r = e[a]
    r &&
      r.id &&
      (t[a] = new Player(
        r.id,
        r.name,
        r.position,
        r.team,
        r.times_available,
        r.bye_week,
        r.formatted_salary,
        r.ytd_points,
        r.adp_rank,
        r.my_draft_list_rank
      ))
  }
  return t
}
async function downloadAndCachePlayerDB (e) {
  'undefined' == typeof Player &&
    (console.warn('[MFLCache] Player constructor not yet defined, waiting...'),
    await new Promise(e => {
      const t = setTimeout(e, 5e3)
      if ('function' == typeof requestAnimationFrame)
        requestAnimationFrame(function rafCheck () {
          if ('undefined' != typeof Player) return clearTimeout(t), void e()
          requestAnimationFrame(rafCheck)
        })
      else {
        const a = setInterval(() => {
          'undefined' != typeof Player &&
            (clearInterval(a), clearTimeout(t), e())
        }, 100)
        setTimeout(() => clearInterval(a), 5e3)
      }
    }))
  const t = `${baseURLDynamic}/fflnet${e}/mfl_player_database.js`,
    a = await fetch(t, { cache: 'no-store' })
  if (!a.ok) throw new Error('playerDB HTTP ' + a.status)
  const r = await a.text()
  window.eval(r),
    dbLooksPopulated(window.playerDatabase) ||
      'undefined' == typeof playerDatabase ||
      (window.playerDatabase = playerDatabase)
  const o = {}
  for (const e in window.playerDatabase)
    Object.prototype.hasOwnProperty.call(window.playerDatabase, e) &&
      (o[e] = window.playerDatabase[e])
  const n = Object.keys(o).length
  if (n < 100)
    throw new Error(
      '[MFLCache] playerDB plainObj suspiciously small (' +
        n +
        ' players) â€” not caching'
    )
  return (
    window.MFL_DEBUG_API &&
      console.log('[MFLCache] playerDB snapshot ready:', n, 'players'),
    o
  )
}
async function ensurePlayerDB (e) {
  if (dbLooksPopulated(getLivePlayerDB())) return getLivePlayerDB()
  const t = MFLCache.KEY.playerDB(e)
  return (await getIfPastSeason(t, e => {
    e &&
      'object' == typeof e &&
      (window.playerDatabase = rebuildPlayerDatabase(e))
  })) ||
    (await serveStaleAndRefresh(
      t,
      async () => downloadAndCachePlayerDB(e),
      MFLCache.TTL.WEEKLY,
      e => {
        e &&
          'object' == typeof e &&
          (window.playerDatabase = rebuildPlayerDatabase(e))
      }
    ))
    ? getLivePlayerDB()
    : (await MFLCache.getOrFetch(
        t,
        async () => {
          logApi('API FETCH playerDB', { year: e, tab: window.MFL_TAB_ID })
          const t = await downloadAndCachePlayerDB(e)
          return (
            logApi('API RESP playerDB', { year: e, tab: window.MFL_TAB_ID }), t
          )
        },
        MFLCache.TTL.WEEKLY,
        {
          lockTtlMs: 6e4,
          waitMs: 6e4,
          applyFn: e => {
            e &&
              'object' == typeof e &&
              (window.playerDatabase = rebuildPlayerDatabase(e))
          }
        }
      ),
      dbLooksPopulated(getLivePlayerDB()) ? getLivePlayerDB() : null)
}
function waitForPlayerDatabase () {
  return ensurePlayerDB(year)
}
async function reportRostersAPI (e) {
  if (!needsAPI('reportRostersAPI')) return
  const t = resolveFiveMinBucket(e),
    a = MFLCache.KEY.rosters(year, league_id)
  return (await getIfPastSeason(a, e => {
    ;(reportRoster_ar = e),
      e?.rosters?.franchise && reportRosterResponse(reportRoster_ar)
  }))
    ? void 0
    : MFLCache.getOrFetch(
        a,
        () => (
          logApi('API FETCH rosters', {
            league_id: league_id,
            bucket: t,
            tab: window.MFL_TAB_ID
          }),
          (reportFiveMinuteApiNoCache = !0),
          fetch(
            `${baseURLDynamic}/${year}/export?TYPE=rosters&L=${league_id}&JSON=1`,
            { cache: 'no-store' }
          ).then(e => {
            if (
              (logApi('API RESP rosters', {
                league_id: league_id,
                bucket: t,
                status: e.status,
                tab: window.MFL_TAB_ID
              }),
              !e.ok)
            )
              throw new Error('rosters HTTP ' + e.status)
            return e.json()
          })
        ),
        MFLCache.TTL.FIVE_MIN,
        {
          applyFn: (e, t) => {
            e &&
              ((reportRoster_ar = e),
              e?.rosters?.franchise && reportRosterResponse(reportRoster_ar),
              'api' === t &&
                signalMFLCacheUpdate('rosters', {
                  source: 'api',
                  ttl: 'fiveMinute',
                  league_id: league_id
                }))
          }
        }
      )
}
function reportRosterResponse (e) {
  if (((customPlayerString = ''), !e || !e.rosters || !e.rosters.franchise))
    return
  const t = Array.isArray(e.rosters.franchise)
    ? e.rosters.franchise
    : [e.rosters.franchise]
  for (var a = 0; a < t.length; a++) {
    var r = t[a].id
    mfl_rosters['fid_' + r] = { id: r, player: [] }
    try {
      if (Array.isArray(t[a].player))
        for (var o = 0; o < t[a].player.length; o++)
          doMFL_rosters_player(r, t[a].player[o].id, t[a].player[o])
      else doMFL_rosters_player(r, t[a].player.id, t[a].player)
    } catch (e) {
      try {
        doMFL_rosters_player(r, t[a].player.id, t[a].player)
      } catch (e) {}
    }
  }
  if ('' !== customPlayerString) {
    for (var n = customPlayerString.split(','), i = 0; i < n.length - 1; i++) {
      var s = n[i]
      ;(playerDatabase['pid_' + s].name = 'Invalid Player'),
        (playerDatabase['pid_' + s].position = 'na'),
        (playerDatabase['pid_' + s].team = 'FA'),
        (playerDatabase['pid_' + s].status = 'na')
    }
    const e = MFLCache.KEY.customPlayer(year, league_id)
    MFLCache.get(e).then(t => {
      if (t && !MFLCache.isExpiredEntry(t))
        return (
          (reportCustomPlayer_ar = t.data),
          void reportCustomPlayerResponse(t.data)
        )
      fetch(
        `${baseURLDynamic}/${year}/export?TYPE=players&PLAYERS=${customPlayerString}&L=${league_id}&JSON=1`
      )
        .then(e =>
          e.ok ? e.json() : Promise.reject('customPlayer ' + e.status)
        )
        .then(t => {
          ;(reportCustomPlayer_ar = t),
            MFLCache.set(e, t, MFLCache.TTL.FIVE_MIN),
            reportCustomPlayerResponse(t)
        })
        .catch(e => console.error('Error fetching custom player data:', e))
    })
  }
}
function reportCustomPlayerResponse (e) {
  try {
    const o = Array.isArray(e.players.player)
      ? e.players.player
      : [e.players.player]
    for (var t = 0; t < o.length; t++) {
      var a = o[t],
        r = a.id
      ;(playerDatabase['pid_' + r].name = a.name),
        (playerDatabase['pid_' + r].position = a.position),
        (playerDatabase['pid_' + r].team = a.team),
        (playerDatabase['pid_' + r].status =
          void 0 === a.status ? '' : a.status)
    }
  } catch (e) {}
}
function doMFL_rosters_player (e, t, a) {
  ;(mfl_rosters['fid_' + e].player['pid_' + t] = { id: t, status: a.status }),
    null == playerDatabase['pid_' + t] &&
      ((playerDatabase['pid_' + t] = []), (customPlayerString += t + ',')),
    null == playerDatabase['pid_' + t].fid
      ? (playerDatabase['pid_' + t].fid = e + ',')
      : (playerDatabase['pid_' + t].fid += e + ','),
    null == playerDatabase['pid_' + t].rosterStatus
      ? (playerDatabase['pid_' + t].rosterStatus = a.status + ',')
      : (playerDatabase['pid_' + t].rosterStatus += a.status + ','),
    [
      'contractStatus',
      'contractYear',
      'contractInfo',
      'drafted',
      'salary'
    ].forEach(function (r) {
      var o = null != a[r] ? a[r] : ''
      ;(mfl_rosters['fid_' + e].player['pid_' + t][r] = o),
        (playerDatabase['pid_' + t][r] = o)
    })
}
window.playerDatabase = window.playerDatabase || []
const INJURY_CODE_MAP = {
  SUSPENDED: 'S',
  PROBABLE: 'P',
  QUESTIONABLE: 'Q',
  DOUBTFUL: 'D',
  OUT: 'O',
  IR: 'I',
  'IR-R': 'I',
  'IR-PUP': 'I',
  'IR-NFI': 'I',
  'COVID-IR': 'C',
  HOLDOUT: 'H'
}
async function reportInjuriesAPI (e) {
  if (!needsAPI('reportInjuriesAPI')) return
  const t = resolveFiveMinBucket(e),
    a = MFLCache.KEY.injuries(year),
    fetchInjuries = () =>
      fetch(
        `https://api.myfantasyleague.com/${year}/export?TYPE=injuries&JSON=1`,
        { cache: 'no-store' }
      ).then(e => {
        if (!e.ok) throw new Error('injuries HTTP ' + e.status)
        return e.json()
      })
  return (await getIfPastSeason(a, e => {
    ;(reportInjuries_ar = e), reportInjuriesResponse(e)
  })) ||
    (await serveStaleAndRefresh(a, fetchInjuries, MFLCache.TTL.FIVE_MIN, e => {
      ;(reportInjuries_ar = e), reportInjuriesResponse(e)
    }))
    ? void 0
    : MFLCache.getOrFetch(
        a,
        () => (
          logApi('API FETCH injuries', { bucket: t, tab: window.MFL_TAB_ID }),
          (reportFiveMinuteApiNoCache = !0),
          fetchInjuries().then(
            e => (logApi('API RESP injuries', { tab: window.MFL_TAB_ID }), e)
          )
        ),
        MFLCache.TTL.FIVE_MIN,
        {
          applyFn: (e, t) => {
            e &&
              ((reportInjuries_ar = e),
              reportInjuriesResponse(e),
              'api' === t &&
                signalMFLCacheUpdate('injuries', {
                  source: 'api',
                  ttl: 'fiveMinute'
                }))
          }
        }
      )
}
function reportInjuriesResponse (e) {
  if (!e || !e.injuries || !e.injuries.injury) return
  mfl_injuries = {
    week: e.injuries.week,
    timestamp: e.injuries.timestamp,
    player: []
  }
  const t = Array.isArray(e.injuries.injury)
    ? e.injuries.injury
    : [e.injuries.injury]
  for (var a = 0; a < t.length; a++) {
    var r = t[a],
      o = r.id,
      n = r.status || '',
      i = n.toUpperCase(),
      s = INJURY_CODE_MAP[i] || n.substr(0, 1)
    mfl_injuries.player['pid_' + o] = {
      id: o,
      status: r.status,
      details: r.details,
      code: s
    }
  }
}
async function reportTransactionsAPI (e) {
  if (!needsAPI('reportTransactionsAPI')) return
  const t = resolveFiveMinBucket(e),
    a = MFLCache.KEY.transactions(year, league_id),
    fetchTransactions = () =>
      fetch(
        `${baseURLDynamic}/${year}/export?TYPE=transactions&L=${league_id}&JSON=1`,
        { cache: 'no-store' }
      ).then(e => {
        if (!e.ok) throw new Error('transactions HTTP ' + e.status)
        return e.json()
      })
  return (await getIfPastSeason(a, e => {
    reportTransactions_ar = e
  })) ||
    (await serveStaleAndRefresh(
      a,
      fetchTransactions,
      MFLCache.TTL.FIVE_MIN,
      e => {
        reportTransactions_ar = e
      }
    ))
    ? void 0
    : MFLCache.getOrFetch(
        a,
        () => (
          logApi('API FETCH transactions', {
            league_id: league_id,
            bucket: t,
            tab: window.MFL_TAB_ID
          }),
          (reportFiveMinuteApiNoCache = !0),
          fetchTransactions().then(
            e => (
              logApi('API RESP transactions', {
                league_id: league_id,
                bucket: t,
                tab: window.MFL_TAB_ID
              }),
              e
            )
          )
        ),
        MFLCache.TTL.FIVE_MIN,
        {
          applyFn: (e, t) => {
            e &&
              ((reportTransactions_ar = e),
              'api' === t &&
                signalMFLCacheUpdate('transactions', {
                  source: 'api',
                  ttl: 'fiveMinute',
                  league_id: league_id
                }))
          }
        }
      )
}
function applyNewsBreakerFromJSON (e) {
  try {
    return (
      !(!e || 'object' != typeof e) &&
      (e.newsBreaker && 'object' == typeof e.newsBreaker
        ? ((window.newsBreaker = e.newsBreaker), !0)
        : ((window.newsBreaker = e), !0))
    )
  } catch (e) {
    return !1
  }
}
async function loadNewsBreakerJSON (e) {
  const t = resolveFiveMinBucket(e),
    a = MFLCache.KEY.newsBreaker(),
    fetchNewsBreaker = async () => {
      const e = `https://www.mflscripts.com/mfl-apps/popups/assets/newsBreaker.json?_=${Date.now()}`,
        t = await fetch(e, { cache: 'no-store' })
      if (!t.ok) throw new Error('newsBreaker JSON HTTP ' + t.status)
      return t.json()
    }
  return (
    (await getIfPastSeason(a, e => {
      applyNewsBreakerFromJSON(e)
    })) ||
      (await serveStaleAndRefresh(
        a,
        fetchNewsBreaker,
        MFLCache.TTL.FIVE_MIN,
        e => {
          applyNewsBreakerFromJSON(e)
        }
      )) ||
      (await MFLCache.getOrFetch(
        a,
        async () => (
          logApi('API FETCH newsBreaker', {
            bucket: t,
            tab: window.MFL_TAB_ID
          }),
          fetchNewsBreaker()
        ),
        MFLCache.TTL.FIVE_MIN,
        {
          applyFn: (e, t) => {
            applyNewsBreakerFromJSON(e),
              'api' === t &&
                signalMFLCacheUpdate('newsBreaker', {
                  source: 'api',
                  ttl: 'fiveMinute'
                })
          }
        }
      )),
    window.newsBreaker || null
  )
}
function applyMyLeaguesFromJSON (e) {
  try {
    const t = e?.leagues?.league
    return Array.isArray(t)
      ? ((window.myLeagues = t.slice()), !0)
      : !(!t || 'object' != typeof t) && ((window.myLeagues = [t]), !0)
  } catch (e) {
    return console.error('[myLeagues] apply error:', e), !1
  }
}
async function loadMyLeaguesJSON () {
  if (!needsAPI('loadMyLeaguesJSON')) return
  if ('undefined' == typeof franchise_id || !franchise_id) return
  const e = MFLCache.KEY.myLeagues(year),
    fetchMyLeagues = async () => {
      const e = new AbortController(),
        t = setTimeout(() => e.abort(), 8e3)
      try {
        const t = await fetch(
          `https://api.myfantasyleague.com/${year}/export?TYPE=myleagues&JSON=1`,
          { cache: 'no-store', credentials: 'include', signal: e.signal }
        )
        if (!t.ok) throw new Error('myleagues HTTP ' + t.status)
        const a = (await t.text())
          .replace(/<pre[^>]*>/i, '')
          .replace(/<\/pre>/i, '')
        if (!a) throw new Error('Empty response from myLeagues API')
        try {
          return JSON.parse(a)
        } catch (e) {
          throw (console.error('[myLeagues] JSON parse failed:', a), e)
        }
      } finally {
        clearTimeout(t)
      }
    }
  if (
    await getIfPastSeason(e, e => {
      applyMyLeaguesFromJSON(e)
    })
  )
    return Array.isArray(window.myLeagues) ? window.myLeagues : []
  if (
    await serveStaleAndRefresh(e, fetchMyLeagues, MFLCache.TTL.SIX_HOUR, e => {
      applyMyLeaguesFromJSON(e)
    })
  )
    return Array.isArray(window.myLeagues) ? window.myLeagues : []
  try {
    await MFLCache.getOrFetch(e, fetchMyLeagues, MFLCache.TTL.SIX_HOUR, {
      lockTtlMs: 1e4,
      waitMs: 1e4,
      applyFn: (e, t) => {
        try {
          applyMyLeaguesFromJSON(e)
        } catch (e) {
          console.error('[myLeagues] apply error:', e)
        }
        'api' === t &&
          signalMFLCacheUpdate('myLeagues', { source: 'api', ttl: 'sixHour' })
      }
    })
  } catch (e) {
    console.error('[myLeagues] MFLCache.getOrFetch error:', e)
  }
  return Array.isArray(window.myLeagues) ? window.myLeagues : []
}
async function loadMyLeaguesJSONOLDFUNCTION () {
  if (!needsAPI('loadMyLeaguesJSON')) return
  if ('undefined' == typeof franchise_id || !franchise_id) return
  const e = MFLCache.KEY.myLeagues(year),
    fetchMyLeagues = async () => {
      const e = new AbortController(),
        t = setTimeout(() => e.abort(), 8e3)
      try {
        const t = await fetch(
          `https://api.myfantasyleague.com/${year}/export?TYPE=myleagues&JSON=1`,
          { cache: 'no-store', credentials: 'include', signal: e.signal }
        )
        if (!t.ok) throw new Error('myleagues HTTP ' + t.status)
        return t.json()
      } finally {
        clearTimeout(t)
      }
    }
  if (
    await getIfPastSeason(e, e => {
      applyMyLeaguesFromJSON(e)
    })
  )
    return Array.isArray(window.myLeagues) ? window.myLeagues : []
  if (
    await serveStaleAndRefresh(e, fetchMyLeagues, MFLCache.TTL.SIX_HOUR, e => {
      applyMyLeaguesFromJSON(e)
    })
  )
    return Array.isArray(window.myLeagues) ? window.myLeagues : []
  try {
    await MFLCache.getOrFetch(e, fetchMyLeagues, MFLCache.TTL.SIX_HOUR, {
      lockTtlMs: 1e4,
      waitMs: 1e4,
      applyFn: (e, t) => {
        try {
          applyMyLeaguesFromJSON(e)
        } catch (e) {
          console.error('[myLeagues] apply error:', e)
        }
        'api' === t &&
          signalMFLCacheUpdate('myLeagues', { source: 'api', ttl: 'sixHour' })
      }
    })
  } catch (e) {
    console.error('[myLeagues] MFLCache.getOrFetch error:', e)
  }
  return Array.isArray(window.myLeagues) ? window.myLeagues : []
}
function bcNameWeather (e) {
  return 'MFL_WEATHER_' + e
}
function ensureWeatherChannel (e) {
  if (!('BroadcastChannel' in window)) return null
  const t = bcNameWeather(e)
  if (window.__MFL_weatherBC && window.__MFL_weatherBC.name === t)
    return window.__MFL_weatherBC
  try {
    window.__MFL_weatherBC && window.__MFL_weatherBC.close()
  } catch {}
  const a = new BroadcastChannel(t)
  return (
    (window.__MFL_weatherBC = a),
    a.addEventListener('message', t => {
      const r = t.data
      if (r && 'object' == typeof r && !r.type) {
        const e = normalizeWeather(r)
        return (
          (window.weather = e),
          (window.__MFL_weatherLast = e),
          void (window.__MFL_weatherLastTs = Date.now())
        )
      }
      if (r && 'weather' === r.type && String(r.year) === String(e)) {
        if ('push' === r.action && r.payload) {
          const e = normalizeWeather(r.payload)
          return (
            (window.weather = e),
            (window.__MFL_weatherLast = e),
            void (window.__MFL_weatherLastTs = Number(r.ts) || Date.now())
          )
        }
        if ('request' === r.action) {
          const t = window.__MFL_weatherLast
          if (t)
            try {
              a.postMessage({
                type: 'weather',
                action: 'push',
                year: e,
                ts: window.__MFL_weatherLastTs || Date.now(),
                payload: t
              })
            } catch {}
        }
      }
    }),
    a
  )
}
function waitForWeatherPush (e, t, a) {
  return new Promise(r => {
    const o = setTimeout(() => {
      e.removeEventListener('message', onMsg), r(null)
    }, a)
    function onMsg (a) {
      const n = a.data
      if (n && 'object' == typeof n && !n.type)
        return (
          clearTimeout(o), e.removeEventListener('message', onMsg), void r(n)
        )
      n &&
        'weather' === n.type &&
        'push' === n.action &&
        String(n.year) === String(t) &&
        n.payload &&
        (clearTimeout(o), e.removeEventListener('message', onMsg), r(n.payload))
    }
    e.addEventListener('message', onMsg)
  })
}
async function requestWeatherFromTabs (e, t = 2500) {
  const a = ensureWeatherChannel(e)
  if (!a) return null
  if (
    window.weather &&
    'object' == typeof window.weather &&
    Object.keys(window.weather).length
  )
    return window.weather
  try {
    a.postMessage({
      type: 'weather',
      action: 'request',
      year: e,
      ts: Date.now()
    })
  } catch {}
  const r = await waitForWeatherPush(a, e, t)
  if (r) {
    const e = normalizeWeather(r)
    return (
      (window.weather = e),
      (window.__MFL_weatherLast = e),
      (window.__MFL_weatherLastTs = Date.now()),
      e
    )
  }
  return null
}
async function loadWeatherJSONDelayed () {
  if (window.__weatherRequested) return
  if (window.__MFL_weatherLast)
    return (
      (window.__weatherRequested = !0),
      (window.weather = window.__MFL_weatherLast),
      window.weather
    )
  const e = MFLCache.KEY.weather(),
    fetchWeather = async () => {
      const e = `https://www.mflscripts.com/mfl-apps/weather/weather.json?_=${Date.now()}`,
        t = await fetch(e, { cache: 'no-store' })
      if (!t.ok) throw new Error('weather HTTP ' + t.status)
      return t.json()
    },
    applyWeather = e => {
      if (!e) return
      const t = normalizeWeather(e)
      ;(window.weather = t),
        (window.__MFL_weatherLast = t),
        (window.__MFL_weatherLastTs = Date.now())
    }
  if (await getIfPastSeason(e, applyWeather))
    return (window.__weatherRequested = !0), window.weather
  if (
    await serveStaleAndRefresh(
      e,
      fetchWeather,
      MFLCache.TTL.FIFTEEN_MIN,
      applyWeather
    )
  )
    return (window.__weatherRequested = !0), window.weather
  const t = await MFLCache.getOrFetch(
    e,
    fetchWeather,
    MFLCache.TTL.FIFTEEN_MIN,
    { lockTtlMs: 2e4, waitMs: 2e4, applyFn: applyWeather }
  )
  return window.weather && (window.__weatherRequested = !0), t
}
function normalizeWeather (e) {
  return e && 'object' == typeof e && e.weather && 'object' == typeof e.weather
    ? e.weather
    : e
}
if (void 0 === countPtsScoredOncePerWeek) var countPtsScoredOncePerWeek = !0
if (void 0 === reportDailyApi_ran) var reportDailyApi_ran = !1
if (void 0 === reportDailyApiNoCache) var reportDailyApiNoCache = !1
if (void 0 === reportDailyFullyLoaded) var reportDailyFullyLoaded = !1
if (void 0 === reportLeague_ar) var reportLeague_ar = []
if (void 0 === reportConferences_ar) var reportConferences_ar = []
if (void 0 === reportDivisions_ar) var reportDivisions_ar = []
if (void 0 === reportDivisionConference_ar) var reportDivisionConference_ar = []
if (void 0 === reportStandings_ar) var reportStandings_ar = []
if (void 0 === reportStandingsFid_ar) var reportStandingsFid_ar = []
if (void 0 === reportScoresFid_ar) var reportScoresFid_ar = []
if (void 0 === reportScoresAdjFid_ar) var reportScoresAdjFid_ar = []
if (void 0 === reportScoresFidBench_ar) var reportScoresFidBench_ar = []
if (void 0 === reportScoresFidTiebreakPlayer_ar)
  var reportScoresFidTiebreakPlayer_ar = []
if (void 0 === reportScoresFidTiebreakPlayerTracker_ar)
  var reportScoresFidTiebreakPlayerTracker_ar = []
if (void 0 === reportScoresWeek_ar) var reportScoresWeek_ar = []
if (void 0 === reportScoresWeekAdj_ar) var reportScoresWeekAdj_ar = []
if (void 0 === reportWeeklyResults_ar) var reportWeeklyResults_ar = []
if (void 0 === reportMatchupFid_ar) var reportMatchupFid_ar = []
if (void 0 === reportHTH_ar) var reportHTH_ar = []
if (void 0 === reportSOS_ar) var reportSOS_ar = []
if (void 0 === reportSOV_ar) var reportSOV_ar = []
if (void 0 === playerScoresWeek_ar) var playerScoresWeek_ar = []
if (
  ('undefined' == typeof leagueAverage && (leagueAverage = !1),
  'undefined' == typeof leagueAverageCreated && (leagueAverageCreated = !1),
  void 0 === reportNflSchedule_ar)
)
  var reportNflSchedule_ar = []
if (void 0 === reportNflScheduleFid_ar) var reportNflScheduleFid_ar = []
if (void 0 === reportNflScheduleWeek_ar) var reportNflScheduleWeek_ar = []
if (void 0 === reportNflByeWeeks_ar) var reportNflByeWeeks_ar = []
if (void 0 === reportTopStarters_ar) var reportTopStarters_ar = []
if (void 0 === reportProjectedScores_ar) var reportProjectedScores_ar = []
async function doDailyCache () {
  if (!reportDailyApi_ran) {
    reportDailyApi_ran = !0
    try {
      const e = getCacheDaily(currentServerTime),
        t = new Set()
      completedWeek >= 1 &&
        completedWeek <= AllGamesCount &&
        t.add(completedWeek),
        completedWeek + 1 >= 1 &&
          completedWeek + 1 <= AllGamesCount &&
          t.add(completedWeek + 1),
        endWeek >= 1 && endWeek <= AllGamesCount && t.add(endWeek),
        Array.from(t).forEach(e => reportProjectedScoresAPI(e)),
        await Promise.allSettled([
          reportLeagueAPI(e),
          reportStandingsAPI(e),
          reportTopStartersAPI(completedWeek + 1, e)
        ]),
        continueWithApiRun()
    } catch (e) {
      console.error(e)
    }
  }
}
async function reportProjectedScoresAPI (e) {
  if (!needsAPI('reportProjectedScoresAPI')) return
  const t = MFLCache.KEY.projScores(year, league_id, e),
    a = 'number' == typeof completedWeek && e < completedWeek,
    r = a ? MFLCache.TTL.NEVER : MFLCache.TTL.DAILY
  if (MFLPastSeason || a) {
    const a = MFLCache.getSync(t)
    if (a && a.data)
      return (reportProjectedScores_ar['w_' + e] = a.data), a.data
    const r = await MFLCache.get(t)
    if (r && r.data)
      return (reportProjectedScores_ar['w_' + e] = r.data), r.data
  }
  return MFLCache.getOrFetch(
    t,
    async () => {
      const t = await fetch(
        `${baseURLDynamic}/${year}/export?TYPE=projectedScores&L=${league_id}&W=${e}&JSON=1`
      )
      if (!t.ok) throw new Error('projectedScores HTTP ' + t.status)
      return t.json()
    },
    r,
    {
      applyFn: (a, r) => {
        if (a)
          (reportProjectedScores_ar['w_' + e] = a),
            'api' === r &&
              signalMFLCacheUpdate('projectedScores', {
                source: 'api',
                ttl: 'daily',
                league_id: league_id,
                week: e
              })
        else {
          const a = MFLCache.getSync(t)
          a && a.data && (reportProjectedScores_ar['w_' + e] = a.data)
        }
      }
    }
  )
}
async function backfillProjectedScoresInBackground () {
  if (!needsAPI('reportProjectedScoresAPI')) return
  const e = []
  for (let t = 1; t <= AllGamesCount; t++) {
    if (reportProjectedScores_ar['w_' + t]) continue
    const a = MFLCache.getSync(MFLCache.KEY.projScores(year, league_id, t))
    a && a.data ? (reportProjectedScores_ar['w_' + t] = a.data) : e.push(t)
  }
  if (!e.length) return
  const t = MFLPastSeason ? 6 : 2
  for (let a = 0; a < e.length; a += t) {
    const r = e.slice(a, a + t)
    await Promise.allSettled(
      r.map(e =>
        reportProjectedScoresAPI(e).catch(t =>
          console.warn('ProjectedScores backfill error for week', e, t)
        )
      )
    ),
      a + t < e.length && (await new Promise(e => setTimeout(e, 300)))
  }
}
async function reportLeagueAPI (e) {
  if (!needsAPI('reportLeagueAPI')) return
  const t = null != e ? e : getCacheDaily(currentServerTime),
    a = MFLCache.KEY.league(year, league_id)
  return (await getIfPastSeason(a, e => {
    ;(reportLeague_ar = e), reportLeagueResponse(e)
  })) ||
    (await serveStaleAndRefresh(
      a,
      () =>
        fetch(
          `${baseURLDynamic}/${year}/export?TYPE=league&L=${league_id}&JSON=1`,
          { cache: 'no-store' }
        ).then(e => {
          if (!e.ok) throw new Error('league HTTP ' + e.status)
          return e.json()
        }),
      MFLCache.TTL.DAILY,
      e => {
        ;(reportLeague_ar = e), reportLeagueResponse(e)
      }
    ))
    ? void 0
    : MFLCache.getOrFetch(
        a,
        () => (
          (reportDailyApiNoCache = !0),
          logApi('API FETCH league', {
            league_id: league_id,
            dailyBucket: t,
            tab: window.MFL_TAB_ID
          }),
          fetch(
            `${baseURLDynamic}/${year}/export?TYPE=league&L=${league_id}&JSON=1`,
            { cache: 'no-store' }
          ).then(e => {
            if (
              (logApi('API RESP league', {
                league_id: league_id,
                dailyBucket: t,
                status: e.status,
                tab: window.MFL_TAB_ID
              }),
              !e.ok)
            )
              throw new Error('league HTTP ' + e.status)
            return e.json()
          })
        ),
        MFLCache.TTL.DAILY,
        {
          applyFn: (e, t) => {
            e &&
              (reportLeagueResponse((reportLeague_ar = e)),
              'api' === t &&
                signalMFLCacheUpdate('league', {
                  source: 'api',
                  ttl: 'daily',
                  league_id: league_id
                }))
          }
        }
      )
}
function reportLeagueResponse (e) {
  ;(reportConferences_ar = []),
    (reportDivisions_ar = []),
    (reportDivisionConference_ar = Object.create(null))
  const t = e.league.conferences?.conference
  if (t) {
    const e = Array.isArray(t) ? t : [t]
    for (var a = 0; a < e.length; a++)
      reportConferences_ar.push({ id: e[a].id, name: e[a].name })
  }
  const r = e.league.divisions?.division
  if (r) {
    const e = Array.isArray(r) ? r : [r]
    for (a = 0; a < e.length; a++)
      reportDivisions_ar.push({
        id: e[a].id,
        name: e[a].name,
        conference: '00'
      }),
        e[a].hasOwnProperty('conference') &&
          ((reportDivisions_ar[a].conference = e[a].conference),
          (reportDivisionConference_ar[e[a].id] = e[a].conference))
  }
  if (reportConferences_ar.length > 0)
    for (var o in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(o) &&
        'fid_0000' !== o &&
        franchiseDatabase[o].hasOwnProperty('division') &&
        (franchiseDatabase[o].conference =
          reportDivisionConference_ar[franchiseDatabase[o].division])
}
async function reportStandingsAPI (e) {
  if (!needsAPI('reportStandingsAPI')) return
  const t = null != e ? e : getCacheDaily(currentServerTime),
    a = MFLCache.KEY.standings(year, league_id),
    fetchStandings = () =>
      fetch(
        `${baseURLDynamic}/${year}/export?TYPE=leagueStandings&L=${league_id}&JSON=1`,
        { cache: 'no-store' }
      ).then(e => {
        if (!e.ok) throw new Error('leagueStandings HTTP ' + e.status)
        return e.json()
      })
  return (await getIfPastSeason(a, e => reportStandingsResponse(e))) ||
    (await serveStaleAndRefresh(a, fetchStandings, MFLCache.TTL.DAILY, e =>
      reportStandingsResponse(e)
    ))
    ? void 0
    : MFLCache.getOrFetch(
        a,
        () => (
          (reportDailyApiNoCache = !0),
          logApi('API FETCH standings', {
            league_id: league_id,
            dailyBucket: t,
            tab: window.MFL_TAB_ID
          }),
          fetchStandings().then(
            e => (
              logApi('API RESP standings', {
                league_id: league_id,
                dailyBucket: t,
                tab: window.MFL_TAB_ID
              }),
              e
            )
          )
        ),
        MFLCache.TTL.DAILY,
        {
          applyFn: (e, t) => {
            e &&
              (reportStandingsResponse(e),
              'api' === t &&
                signalMFLCacheUpdate('standings', {
                  source: 'api',
                  ttl: 'daily',
                  league_id: league_id
                }))
          }
        }
      )
}
function reportStandingsResponse (e) {
  ;(reportStandings_ar = []), (reportStandingsFid_ar = [])
  var t = 0
  function safeFloat (e) {
    try {
      var t = parseFloat(e)
      return isNaN(t) ? 0 : t
    } catch (e) {
      return 0
    }
  }
  function safeInt (e) {
    try {
      var t = parseInt(e, 10)
      return isNaN(t) ? 0 : t
    } catch (e) {
      return 0
    }
  }
  const a = Array.isArray(e.leagueStandings.franchise)
    ? e.leagueStandings.franchise
    : [e.leagueStandings.franchise]
  for (var r = 0; r < a.length; r++) {
    var o = a[r].id,
      n = !0
    try {
      var [i, s, l] = a[r].h2hwlt.split('-')
      ;(n = !1),
        (i = parseInt(i, 10)),
        (s = parseInt(s, 10)),
        (l = parseInt(l, 10))
    } catch (e) {
      ;(i = 0), (s = 0), (l = 0), (n = !0)
    }
    n &&
      ((i = safeInt(a[r].h2hw)),
      (s = safeInt(a[r].h2hl)),
      (l = safeInt(a[r].h2ht))),
      (reportStandingsFid_ar[o] = { win: i, loss: s, tie: l })
    var c,
      d,
      p,
      u = parseInt(o, 10),
      m = safeFloat(a[r].pf),
      f = safeFloat(a[r].pa),
      h = safeFloat(a[r].op),
      y = safeFloat(a[r].dp),
      _ = !0
    try {
      var g = a[r].divwlt.split('-')
      ;(c = parseInt(g[0], 10)),
        (d = parseInt(g[1], 10)),
        (p = parseInt(g[2], 10)),
        (_ = !1)
    } catch (e) {
      ;(c = 0), (d = 0), (p = 0)
    }
    _ &&
      ((c = safeInt(a[r].divw)),
      (d = safeInt(a[r].divl)),
      (p = safeInt(a[r].divt)))
    var b,
      w,
      k,
      L = safeFloat(a[r].divpf),
      P = safeFloat(a[r].divpa),
      S = i - c,
      M = s - d,
      F = l - p,
      x = m - L,
      T = f - P,
      C = !0
    try {
      var B = a[r].confwlt.split('-')
      ;(b = parseInt(B[0], 10)),
        (w = parseInt(B[1], 10)),
        (k = parseInt(B[2], 10)),
        (C = !1)
    } catch (e) {
      ;(b = 0), (w = 0), (k = 0)
    }
    C &&
      ((b = safeInt(a[r].confw)),
      (w = safeInt(a[r].confl)),
      (k = safeInt(a[r].conft)))
    var A = safeFloat(a[r].confpf),
      D = safeFloat(a[r].confpa),
      E = i - b,
      N = s - w,
      I = l - k,
      R = m - A,
      O = f - D,
      W = safeFloat(a[r].pwr),
      j = safeFloat(a[r].vp),
      H = safeFloat(a[r].pp),
      U = 0,
      q = 0,
      G = 0
    try {
      var z = a[r].all_play_wlt.split('-')
      ;(U = parseInt(z[0], 10) || 0),
        (q = parseInt(z[1], 10) || 0),
        (G = parseInt(z[2], 10) || 0)
    } catch (e) {}
    let e = null
    const de = a[r]?.all_play_pct
    if (null != de && '' !== de) {
      const t = parseFloat(de)
      isNaN(t) || (e = t)
    }
    if (null == e) {
      const t = U + q + G
      e = t ? Math.round(((U + 0.5 * G) / t) * 1e3) / 1e3 : 0
    }
    if (i + s + l !== 0)
      var Y = parseInt((1e3 * (i + 0.5 * l)) / (i + s + l)) / 1e3
    else Y = 0
    var Q = i + '-' + s + '-' + l,
      V = 0
    if (a[r].divpct) {
      var K = parseFloat(a[r].divpct)
      isNaN(K) || (V = K)
    } else
      V =
        c + d + p !== 0
          ? parseInt((1e3 * (c + 0.5 * p)) / (c + d + p)) / 1e3
          : 0
    var J = 0
    if (a[r].confpct) {
      var Z = parseFloat(a[r].confpct)
      isNaN(Z) || (J = Z)
    } else
      J =
        b + w + k !== 0
          ? parseInt((1e3 * (b + 0.5 * k)) / (b + w + k)) / 1e3
          : 0
    var X = c + '-' + d + '-' + p
    if (S + M + F !== 0)
      var ee = parseInt((1e3 * (S + 0.5 * F)) / (S + M + F)) / 1e3
    else ee = 0
    var te = S + '-' + M + '-' + F,
      ae = b + '-' + w + '-' + k
    if (E + N + I !== 0)
      var re = parseInt((1e3 * (E + 0.5 * I)) / (E + N + I)) / 1e3
    else re = 0
    var oe = E + '-' + N + '-' + I,
      ne = U + '-' + q + '-' + G
    try {
      if (custom1.hasOwnProperty(o)) var ie = custom1[o]
      else ie = 0
    } catch (e) {
      ie = 0
    }
    try {
      if (custom2.hasOwnProperty(o)) var se = custom2[o]
      else se = 0
    } catch (e) {
      se = 0
    }
    try {
      if (custom3.hasOwnProperty(o)) var le = custom3[o]
      else le = 0
    } catch (e) {
      le = 0
    }
    if (useOPR) {
      var ce =
        (6 * (parseFloat(a[r].avgpf) || 0) +
          ((parseFloat(a[r].maxpf) || 0) + (parseFloat(a[r].minpf) || 0)) +
          200 * Y * 2) /
        10
      ;(t += ce = parseFloat(ce) || 0),
        (reportStandingsFid_ar[o] = {
          teamOPR: ce,
          win: i,
          loss: s,
          tie: l,
          w: i,
          l: s,
          t: l,
          record: Q,
          pct: Y,
          pf: m,
          pa: f,
          dw: c,
          dl: d,
          dt: p,
          drecord: X,
          dpct: V,
          dpf: L,
          dpa: P,
          pwr: W,
          vp: j,
          apw: U,
          apl: q,
          apt: G,
          apr: ne,
          all_play_pct: e,
          ndw: S,
          ndl: M,
          ndt: F,
          ndr: te,
          ndpct: ee,
          ndpf: x,
          ndpa: T,
          cw: b,
          cl: w,
          ct: k,
          cpf: A,
          cpa: D,
          cr: ae,
          cpct: J,
          ncw: E,
          ncl: N,
          nct: I,
          ncpct: re,
          ncpf: R,
          ncpa: O,
          ncr: oe,
          hthpct: 0,
          sosr: '',
          sospct: 0,
          sovr: '',
          sovpct: 0,
          pp: H,
          op: h,
          dp: y,
          custom1: ie,
          custom2: se,
          custom3: le
        })
    } else
      reportStandingsFid_ar[o] = {
        win: i,
        loss: s,
        tie: l,
        w: i,
        l: s,
        t: l,
        record: Q,
        pct: Y,
        pf: m,
        pa: f,
        dw: c,
        dl: d,
        dt: p,
        drecord: X,
        dpct: V,
        dpf: L,
        dpa: P,
        pwr: W,
        vp: j,
        apw: U,
        apl: q,
        apt: G,
        apr: ne,
        all_play_pct: e,
        ndw: S,
        ndl: M,
        ndt: F,
        ndr: te,
        ndpct: ee,
        ndpf: x,
        ndpa: T,
        cw: b,
        cl: w,
        ct: k,
        cpf: A,
        cpa: D,
        cr: ae,
        cpct: J,
        ncw: E,
        ncl: N,
        nct: I,
        ncpct: re,
        ncpf: R,
        ncpa: O,
        ncr: oe,
        hthpct: 0,
        sosr: '',
        sospct: 0,
        sovr: '',
        sovpct: 0,
        pp: H,
        op: h,
        dp: y,
        custom1: ie,
        custom2: se,
        custom3: le
      }
    reportStandings_ar.push({
      index: u,
      fid: o,
      name: franchiseDatabase['fid_' + o].name,
      w: i,
      l: s,
      t: l,
      record: Q,
      pct: Y,
      pf: m,
      pa: f,
      dw: c,
      dl: d,
      dt: p,
      drecord: X,
      dpct: V,
      dpf: L,
      dpa: P,
      pwr: W,
      vp: j,
      apw: U,
      apl: q,
      apt: G,
      apr: ne,
      all_play_pct: e,
      ndw: S,
      ndl: M,
      ndt: F,
      ndr: te,
      ndpct: ee,
      ndpf: x,
      ndpa: T,
      cw: b,
      cl: w,
      ct: k,
      cpf: A,
      cpa: D,
      cr: ae,
      cpct: J,
      ncw: E,
      ncl: N,
      nct: I,
      ncpct: re,
      ncpf: R,
      ncpa: O,
      ncr: oe,
      hthpct: 0,
      sosr: '',
      sospct: 0,
      sovr: '',
      sovpct: 0,
      pp: H,
      op: h,
      dp: y,
      custom1: ie,
      custom2: se,
      custom3: le
    })
  }
  if (useOPR) {
    var de = [],
      pe = t / leagueAttributes.Franchises
    for (var o in reportStandingsFid_ar)
      if (reportStandingsFid_ar.hasOwnProperty(o)) {
        var ue = ((ce = reportStandingsFid_ar[o].teamOPR) / pe).toFixed(3)
        ;(isNaN(ue) || void 0 === ue) && (ue = '0.00'),
          (reportStandingsFid_ar[o].teamOPR = ue),
          de.push({ fid: o, adjustedOPR: parseFloat(ue) })
      }
    de.sort(function (e, t) {
      return t.adjustedOPR - e.adjustedOPR
    })
    for (var me = 0; me < de.length; me++) {
      var fe = de[me]
      reportStandingsFid_ar[fe.fid].teamRank = 0 === t ? 0 : me + 1
    }
  }
}
async function reportTopStartersAPI (e, t) {
  if (!needsAPI('reportTopStartersAPI')) return
  const a = Number(e)
  if (!Number.isFinite(a) || a <= 0) return null
  const r = Number.isFinite(Number(t))
      ? Number(t)
      : getCacheDaily(currentServerTime),
    o = MFLCache.KEY.topStarters(year, a),
    fetchTopStarters = () =>
      fetch(
        `https://api.myfantasyleague.com/${year}/export?TYPE=topStarters&COUNT=1000&W=${a}&JSON=1`,
        { cache: 'no-store' }
      ).then(e => {
        if (!e.ok) throw new Error('topStarters HTTP ' + e.status)
        return e.json()
      })
  return (await getIfPastSeason(o, e => {
    reportTopStarters_ar = e
  })) ||
    (await serveStaleAndRefresh(o, fetchTopStarters, MFLCache.TTL.DAILY, e => {
      reportTopStarters_ar = e
    }))
    ? void 0
    : MFLCache.getOrFetch(
        o,
        () => (
          logApi('API FETCH topStarters', {
            week: a,
            dailyBucket: r,
            tab: window.MFL_TAB_ID
          }),
          (reportDailyApiNoCache = !0),
          fetchTopStarters().then(
            e => (
              logApi('API RESP topStarters', {
                week: a,
                tab: window.MFL_TAB_ID
              }),
              e
            )
          )
        ),
        MFLCache.TTL.DAILY,
        {
          lockTtlMs: 6e4,
          waitMs: 6e4,
          applyFn: (e, t) => {
            e &&
              ((reportTopStarters_ar = e),
              'api' === t &&
                signalMFLCacheUpdate('topstarters', {
                  source: 'api',
                  ttl: 'daily',
                  week: a
                }))
          }
        }
      )
}
async function continueWithApiRun () {
  doScoreAdjustments(),
    await Promise.allSettled([
      reportWeeklyResultsAPI('YTD'),
      reportNflScheduleAPI('ALL')
    ]),
    liveScoringWeek > 0 &&
      (MFLPastSeason
        ? await Promise.allSettled([
            reportNflScheduleAPI(liveScoringWeek),
            getLiveScoringAPI()
          ])
        : await Promise.allSettled([
            reportWeeklyResultsAPI(liveScoringWeek, !0),
            reportNflScheduleAPI(liveScoringWeek),
            getLiveScoringAPI()
          ])),
    (reportDailyFullyLoaded = !0),
    maybeSignalMFLGlobalCacheReady()
  const runH2HAndAllPlay = () => {
    reportHeadToHeadResults(), reportAllPlayResults()
  }
  'function' == typeof requestIdleCallback
    ? requestIdleCallback(runH2HAndAllPlay, { timeout: 5e3 })
    : setTimeout(runH2HAndAllPlay, 0),
    setTimeout(() => backfillProjectedScoresInBackground(), 2e3),
    startBackgroundTimersOnce()
}
function doScoreAdjustments () {
  try {
    for (var e = 0; e < global_scoreAdjustment.length; e++) {
      var t = global_scoreAdjustment[e][0],
        a = global_scoreAdjustment[e][1],
        r = global_scoreAdjustment[e][2]
      reportScoreAdjustment_ar.hasOwnProperty('w_' + a) ||
        (reportScoreAdjustment_ar['w_' + a] = []),
        (reportScoreAdjustment_ar['w_' + a][t] = r)
    }
  } catch (e) {}
}
async function reportWeeklyResultsAPI (e, t) {
  if (!needsAPI('reportWeeklyResultsAPI')) return
  let a = 'YTD' === e ? completedWeek : e,
    r = !!t
  if (
    (0 === a && ((a = startWeek), 'YTD' === e && (r = !1)),
    a > endWeek && (a = endWeek),
    a < startWeek && (a = startWeek),
    !r)
  )
    if (1 === a && 0 === completedWeek);
    else if (a > completedWeek) return !0
  const o = 'YTD' === e
  if (MFLPastSeason && !r)
    if (o) {
      const e = []
      for (let t = startWeek; t <= endWeek; t++)
        e.push(MFLCache.KEY.weeklyResults(year, league_id, t))
      let t = e.map(e => MFLCache.getSync(e)),
        a = t.every(e => e && e.data)
      if (
        (a ||
          ((t = await MFLCache.batchGet(e)), (a = t.every(e => e && e.data))),
        a)
      )
        return (
          t.forEach((e, t) => {
            const a = startWeek + t
            ;(reportWeeklyResults_ar['w_' + a] = e.data),
              reportWeeklyResultsResponse(e.data, a)
          }),
          !0
        )
    } else {
      const e = MFLCache.KEY.weeklyResults(year, league_id, a),
        t = MFLCache.getSync(e)
      if (t && t.data)
        return (
          (reportWeeklyResults_ar['w_' + a] = t.data),
          reportWeeklyResultsResponse(t.data, a)
        )
      const r = await MFLCache.get(e)
      if (r && r.data)
        return (
          (reportWeeklyResults_ar['w_' + a] = r.data),
          reportWeeklyResultsResponse(r.data, a)
        )
    }
  if (!r && !MFLPastSeason && o) {
    const e = []
    for (let t = startWeek; t <= endWeek; t++)
      e.push(MFLCache.KEY.weeklyResults(year, league_id, t))
    let t = e.map(e => MFLCache.getSync(e)),
      a = t.every(e => e && !MFLCache.isExpiredEntry(e))
    if (
      (a ||
        ((t = await MFLCache.batchGet(e)),
        (a = t.every(e => e && !MFLCache.isExpiredEntry(e)))),
      a)
    )
      return (
        t.forEach((e, t) => {
          const a = startWeek + t
          ;(reportWeeklyResults_ar['w_' + a] = e.data),
            reportWeeklyResultsResponse(e.data, a)
        }),
        !0
      )
  }
  reportDailyApiNoCache = !0
  const n = r
      ? null
      : 'MFLLock_weeklyResults_' +
        year +
        '_' +
        league_id +
        '_' +
        (o ? 'YTD' : a),
    doWeeklyFetch = async () => {
      const t = await fetch(
        `${baseURLDynamic}/${year}/export?TYPE=weeklyResults&L=${league_id}&W=${e}&JSON=1`
      )
      if (!t.ok) throw new Error('weeklyResults HTTP ' + t.status)
      const r = await t.json()
      if ((!o || r?.allWeeklyResults?.weeklyResults) && (o || r?.weeklyResults))
        try {
          if (!o) {
            reportWeeklyResults_ar['w_' + a] = r
            const e = MFLCache.KEY.weeklyResults(year, league_id, a)
            MFLCache.set(e, r, MFLCache.TTL.DAILY)
            try {
              localStorage.setItem(
                'MFLDone_weeklyResults_' + year + '_' + league_id + '_' + a,
                String(Date.now())
              )
            } catch (e) {}
            return (
              signalMFLCacheUpdate('weeklyResults', {
                source: 'api',
                ttl: 'daily',
                league_id: league_id,
                week: a
              }),
              reportWeeklyResultsResponse(r, a)
            )
          }
          {
            const e = []
            for (let t = startWeek; t <= endWeek; t++) {
              const a = (r.allWeeklyResults?.weeklyResults || []).find(
                e => parseInt(e.week, 10) === t
              )
              if (!a) continue
              const o = {
                version: '1.0',
                encoding: 'utf-8',
                weeklyResults: { week: String(t) }
              }
              a.matchup && (o.weeklyResults.matchup = a.matchup),
                a.franchise && (o.weeklyResults.franchise = a.franchise),
                (reportWeeklyResults_ar['w_' + t] = o),
                e.push({
                  cacheKey: MFLCache.KEY.weeklyResults(year, league_id, t),
                  data: o,
                  ttlSeconds: MFLCache.TTL.DAILY,
                  silent: !0
                }),
                reportWeeklyResultsResponse(o, t)
            }
            e.length && (await MFLCache.batchSet(e))
            try {
              localStorage.setItem(
                'MFLDone_weeklyResults_' + year + '_' + league_id + '_YTD',
                String(Date.now())
              )
            } catch (e) {}
            signalMFLCacheUpdate('weeklyResults', {
              source: 'api',
              ttl: 'daily',
              league_id: league_id,
              week: 'YTD'
            })
          }
        } catch (e) {
          window.MFL_DEBUG_API &&
            console.log('Weekly Results - Cache.js - Error Json Not Found')
        }
    }
  if (!n) return doWeeklyFetch()
  if (
    null ===
    (await withLock(n, 3e4, async () => {
      if (o) {
        const e = []
        for (let t = startWeek; t <= endWeek; t++)
          e.push(MFLCache.KEY.weeklyResults(year, league_id, t))
        let t = e.map(e => MFLCache.getSync(e)),
          a = MFLPastSeason
            ? t.every(e => e && e.data)
            : t.every(e => e && !MFLCache.isExpiredEntry(e))
        if (
          (a ||
            ((t = await MFLCache.batchGet(e)),
            (a = MFLPastSeason
              ? t.every(e => e && e.data)
              : t.every(e => e && !MFLCache.isExpiredEntry(e)))),
          a)
        )
          return (
            t.forEach((e, t) => {
              ;(reportWeeklyResults_ar['w_' + (startWeek + t)] = e.data),
                reportWeeklyResultsResponse(e.data, startWeek + t)
            }),
            'cached'
          )
      } else if (MFLPastSeason) {
        const e = MFLCache.KEY.weeklyResults(year, league_id, a),
          t = MFLCache.getSync(e) || (await MFLCache.get(e))
        if (t && t.data)
          return (
            (reportWeeklyResults_ar['w_' + a] = t.data),
            reportWeeklyResultsResponse(t.data, a),
            'cached'
          )
      }
      return doWeeklyFetch()
    }))
  ) {
    const e = o
      ? 'MFLDone_weeklyResults_' + year + '_' + league_id + '_YTD'
      : 'MFLDone_weeklyResults_' + year + '_' + league_id + '_' + a
    if ((await waitForStorageValue(e, 8e3), o)) {
      const e = []
      for (let t = startWeek; t <= endWeek; t++)
        e.push(MFLCache.KEY.weeklyResults(year, league_id, t))
      e.map(e => MFLCache.getSync(e)).forEach((e, t) => {
        e &&
          (MFLPastSeason ? e.data : !MFLCache.isExpiredEntry(e)) &&
          ((reportWeeklyResults_ar['w_' + (startWeek + t)] = e.data),
          reportWeeklyResultsResponse(e.data, startWeek + t))
      })
    } else if (MFLPastSeason) {
      const e = MFLCache.KEY.weeklyResults(year, league_id, a),
        t = MFLCache.getSync(e) || (await MFLCache.get(e))
      t &&
        t.data &&
        ((reportWeeklyResults_ar['w_' + a] = t.data),
        reportWeeklyResultsResponse(t.data, a))
    }
  }
}
function reportWeeklyResultsResponse (e, t) {
  var a = []
  if (
    (playerScoresWeek_ar.hasOwnProperty('w_' + t) ||
      (playerScoresWeek_ar['w_' + t] = {
        playerScores: { playerScore: [] },
        _pidSet: new Set()
      }),
    e.weeklyResults.hasOwnProperty('matchup'))
  ) {
    var r = []
    e.weeklyResults.matchup.hasOwnProperty('franchise')
      ? (r[0] = e.weeklyResults.matchup)
      : (r = e.weeklyResults.matchup)
    for (var o = 0; o < r.length; o++) {
      var n = r[o].franchise[0].id,
        i = r[o].franchise[1].id,
        s = !0,
        l = !0
      if ('BYE' !== n) {
        var c = parseFloat(r[o].franchise[0].score, 10),
          d = c
        try {
          reportScoreAdjustment_ar.hasOwnProperty('w_' + t) &&
            reportScoreAdjustment_ar['w_' + t].hasOwnProperty(n) &&
            (d += reportScoreAdjustment_ar['w_' + t][n])
        } catch (e) {}
        reportScoresFid_ar.hasOwnProperty(n) || (reportScoresFid_ar[n] = []),
          reportScoresAdjFid_ar.hasOwnProperty(n) ||
            (reportScoresAdjFid_ar[n] = []),
          a.hasOwnProperty(n)
            ? countPtsScoredOncePerWeek
              ? (s = !1)
              : ((reportScoresFid_ar[n]['w_' + t] += c),
                (reportScoresAdjFid_ar[n]['w_' + t] += d))
            : ((reportScoresFid_ar[n]['w_' + t] = c),
              (reportScoresAdjFid_ar[n]['w_' + t] = d),
              (a[n] = 1)),
          reportScoresWeek_ar.hasOwnProperty('w_' + t) ||
            (reportScoresWeek_ar['w_' + t] = []),
          reportScoresWeekAdj_ar.hasOwnProperty('w_' + t) ||
            (reportScoresWeekAdj_ar['w_' + t] = []),
          (reportScoresWeek_ar['w_' + t][n] = c),
          (reportScoresWeekAdj_ar['w_' + t][n] = d)
        var p = []
        if (r[o].franchise[0].hasOwnProperty('tiebreaker'))
          for (
            var u = r[o].franchise[0].tiebreaker.split(','), m = 0;
            m < u.length - 1;
            m++
          )
            '' !== u[m] && (p[u[m]] = 1)
        if (r[o].franchise[0].hasOwnProperty('player'))
          for (m = 0; m < r[o].franchise[0].player.length; m++) {
            if (r[o].franchise[0].player[m].hasOwnProperty('score'))
              var f = parseFloat(r[o].franchise[0].player[m].score, 10)
            else f = 0
            reportScoresFidTiebreakPlayer_ar.hasOwnProperty(n) ||
              (reportScoresFidTiebreakPlayer_ar[n] = []),
              reportScoresFidTiebreakPlayer_ar[n].hasOwnProperty('w_' + t) ||
                (reportScoresFidTiebreakPlayer_ar[n]['w_' + t] = 0),
              p.hasOwnProperty(r[o].franchise[0].player[m].id) &&
                (reportScoresFidTiebreakPlayer_ar[n]['w_' + t] += f),
              reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(n) ||
                (reportScoresFidTiebreakPlayerTracker_ar[n] = []),
              reportScoresFidTiebreakPlayerTracker_ar[n].hasOwnProperty(
                'w_' + t
              ) || (reportScoresFidTiebreakPlayerTracker_ar[n]['w_' + t] = []),
              p.hasOwnProperty(r[o].franchise[0].player[m].id) &&
                reportScoresFidTiebreakPlayerTracker_ar[n]['w_' + t].push({
                  pid: r[o].franchise[0].player[m].id,
                  score: f
                }),
              'nonstarter' === r[o].franchise[0].player[m].status &&
                (reportScoresFidBench_ar.hasOwnProperty(n) ||
                  (reportScoresFidBench_ar[n] = []),
                reportScoresFidBench_ar[n].hasOwnProperty('w_' + t) ||
                  (reportScoresFidBench_ar[n]['w_' + t] = 0),
                (reportScoresFidBench_ar[n]['w_' + t] = parseFloat(
                  (reportScoresFidBench_ar[n]['w_' + t] + f).toFixed(precision)
                )))
            var h = r[o].franchise[0].player[m].id
            playerScoresWeek_ar['w_' + t]._pidSet.has(h) ||
              (playerScoresWeek_ar['w_' + t]._pidSet.add(h),
              playerScoresWeek_ar['w_' + t].playerScores.playerScore.push({
                id: h,
                score: r[o].franchise[0].player[m].hasOwnProperty('score')
                  ? r[o].franchise[0].player[m].score
                  : '0'
              }))
          }
        else
          reportScoresFidTiebreakPlayer_ar.hasOwnProperty(n) ||
            (reportScoresFidTiebreakPlayer_ar[n] = []),
            reportScoresFidTiebreakPlayer_ar[n].hasOwnProperty('w_' + t) ||
              (reportScoresFidTiebreakPlayer_ar[n]['w_' + t] = 0),
            reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(n) ||
              (reportScoresFidTiebreakPlayerTracker_ar[n] = []),
            reportScoresFidTiebreakPlayerTracker_ar[n].hasOwnProperty(
              'w_' + t
            ) || (reportScoresFidTiebreakPlayerTracker_ar[n]['w_' + t] = [])
      }
      if ('BYE' !== i) {
        var y = parseFloat(r[o].franchise[1].score, 10),
          _ = y
        try {
          reportScoreAdjustment_ar.hasOwnProperty('w_' + t) &&
            reportScoreAdjustment_ar['w_' + t].hasOwnProperty(i) &&
            (_ += reportScoreAdjustment_ar['w_' + t][i])
        } catch (e) {}
        reportScoresFid_ar.hasOwnProperty(i) || (reportScoresFid_ar[i] = []),
          reportScoresAdjFid_ar.hasOwnProperty(i) ||
            (reportScoresAdjFid_ar[i] = []),
          a.hasOwnProperty(i)
            ? countPtsScoredOncePerWeek
              ? (l = !1)
              : ((reportScoresFid_ar[i]['w_' + t] += y),
                (reportScoresAdjFid_ar[i]['w_' + t] += _))
            : ((reportScoresFid_ar[i]['w_' + t] = y),
              (reportScoresAdjFid_ar[i]['w_' + t] = _),
              (a[i] = 1)),
          reportScoresWeek_ar.hasOwnProperty('w_' + t) ||
            (reportScoresWeek_ar['w_' + t] = []),
          reportScoresWeekAdj_ar.hasOwnProperty('w_' + t) ||
            (reportScoresWeekAdj_ar['w_' + t] = []),
          (reportScoresWeek_ar['w_' + t][i] = y),
          (reportScoresWeekAdj_ar['w_' + t][i] = _)
        p = []
        if (r[o].franchise[1].hasOwnProperty('tiebreaker'))
          for (
            u = r[o].franchise[1].tiebreaker.split(','), m = 0;
            m < u.length - 1;
            m++
          )
            '' !== u[m] && (p[u[m]] = 1)
        if (r[o].franchise[1].hasOwnProperty('player'))
          for (m = 0; m < r[o].franchise[1].player.length; m++) {
            if (r[o].franchise[1].player[m].hasOwnProperty('score'))
              f = parseFloat(r[o].franchise[1].player[m].score, 10)
            else f = 0
            reportScoresFidTiebreakPlayer_ar.hasOwnProperty(i) ||
              (reportScoresFidTiebreakPlayer_ar[i] = []),
              reportScoresFidTiebreakPlayer_ar[i].hasOwnProperty('w_' + t) ||
                (reportScoresFidTiebreakPlayer_ar[i]['w_' + t] = 0),
              p.hasOwnProperty(r[o].franchise[1].player[m].id) &&
                (reportScoresFidTiebreakPlayer_ar[i]['w_' + t] += f),
              reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(i) ||
                (reportScoresFidTiebreakPlayerTracker_ar[i] = []),
              reportScoresFidTiebreakPlayerTracker_ar[i].hasOwnProperty(
                'w_' + t
              ) || (reportScoresFidTiebreakPlayerTracker_ar[i]['w_' + t] = []),
              p.hasOwnProperty(r[o].franchise[1].player[m].id) &&
                reportScoresFidTiebreakPlayerTracker_ar[i]['w_' + t].push({
                  pid: r[o].franchise[1].player[m].id,
                  score: f
                }),
              'nonstarter' === r[o].franchise[1].player[m].status &&
                (reportScoresFidBench_ar.hasOwnProperty(i) ||
                  (reportScoresFidBench_ar[i] = []),
                reportScoresFidBench_ar[i].hasOwnProperty('w_' + t) ||
                  (reportScoresFidBench_ar[i]['w_' + t] = 0),
                (reportScoresFidBench_ar[i]['w_' + t] = parseFloat(
                  (reportScoresFidBench_ar[i]['w_' + t] + f).toFixed(precision)
                )))
            h = r[o].franchise[1].player[m].id
            playerScoresWeek_ar['w_' + t]._pidSet.has(h) ||
              (playerScoresWeek_ar['w_' + t]._pidSet.add(h),
              playerScoresWeek_ar['w_' + t].playerScores.playerScore.push({
                id: h,
                score: r[o].franchise[1].player[m].hasOwnProperty('score')
                  ? r[o].franchise[1].player[m].score
                  : '0'
              }))
          }
        else
          reportScoresFidTiebreakPlayer_ar.hasOwnProperty(i) ||
            (reportScoresFidTiebreakPlayer_ar[i] = []),
            reportScoresFidTiebreakPlayer_ar[i].hasOwnProperty('w_' + t) ||
              (reportScoresFidTiebreakPlayer_ar[i]['w_' + t] = 0),
            reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(i) ||
              (reportScoresFidTiebreakPlayerTracker_ar[i] = []),
            reportScoresFidTiebreakPlayerTracker_ar[i].hasOwnProperty(
              'w_' + t
            ) || (reportScoresFidTiebreakPlayerTracker_ar[i]['w_' + t] = [])
      }
      if ('BYE' !== n && 'BYE' !== i) {
        reportMatchupFid_ar.hasOwnProperty(n) || (reportMatchupFid_ar[n] = []),
          reportMatchupFid_ar[n].hasOwnProperty('total') ||
            (reportMatchupFid_ar[n].total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0,
              pf: 0,
              pa: 0,
              wadj: 0,
              ladj: 0,
              tadj: 0,
              pfadj: 0,
              paadj: 0,
              hgp: 0,
              hw: 0,
              hl: 0,
              ht: 0,
              hpf: 0,
              hpa: 0,
              hwadj: 0,
              hladj: 0,
              htadj: 0,
              hpfadj: 0,
              hpaadj: 0,
              rgp: 0,
              rw: 0,
              rl: 0,
              rt: 0,
              rpf: 0,
              rpa: 0,
              rwadj: 0,
              rladj: 0,
              rtadj: 0,
              rpfadj: 0,
              rpaadj: 0,
              dgp: 0,
              dw: 0,
              dl: 0,
              dt: 0,
              dpf: 0,
              dpa: 0,
              cgp: 0,
              cw: 0,
              cl: 0,
              ct: 0,
              cpf: 0,
              cpa: 0
            }),
          reportMatchupFid_ar[n].hasOwnProperty('w_' + t) ||
            (reportMatchupFid_ar[n]['w_' + t] = []),
          reportMatchupFid_ar[n].hasOwnProperty('opp_' + i) ||
            (reportMatchupFid_ar[n]['opp_' + i] = [])
        var g = 0,
          b = 0,
          w = 0,
          k = 0,
          L = 0,
          P = 0
        c > y ? (g = 1) : c < y ? (b = 1) : (w = 1),
          d > _ ? (k = 1) : d < _ ? (L = 1) : (P = 1),
          reportMatchupFid_ar[n]['w_' + t].push({
            opp: i,
            isHome: !1,
            gp: 1,
            w: g,
            l: b,
            t: w,
            pf: c,
            pa: y,
            wadj: k,
            ladj: L,
            tadj: P,
            pfadj: d,
            paadj: _,
            hgp: 0,
            hw: 0,
            hl: 0,
            ht: 0,
            hpf: 0,
            hpa: 0,
            hwadj: 0,
            hladj: 0,
            htadj: 0,
            hpfadj: 0,
            hpaadj: 0,
            rgp: 1,
            rw: g,
            rl: b,
            rt: w,
            rpf: c,
            rpa: y,
            rwadj: k,
            rladj: L,
            rtadj: P,
            rpfadj: d,
            rpaadj: _,
            dgp: 0,
            dw: 0,
            dl: 0,
            dt: 0,
            dpf: 0,
            dpa: 0,
            cgp: 0,
            cw: 0,
            cl: 0,
            ct: 0,
            cpf: 0,
            cpa: 0
          }),
          reportMatchupFid_ar[n]['opp_' + i].push({
            week: t,
            isHome: !1,
            gp: 1,
            w: g,
            l: b,
            t: w,
            pf: c,
            pa: y,
            wadj: k,
            ladj: L,
            tadj: P,
            pfadj: d,
            paadj: _,
            hgp: 0,
            hw: 0,
            hl: 0,
            ht: 0,
            hpf: 0,
            hpa: 0,
            hwadj: 0,
            hladj: 0,
            htadj: 0,
            hpfadj: 0,
            hpaadj: 0,
            rgp: 1,
            rw: g,
            rl: b,
            rt: w,
            rpf: c,
            rpa: y,
            rwadj: k,
            rladj: L,
            rtadj: P,
            rpfadj: d,
            rpaadj: _,
            dgp: 0,
            dw: 0,
            dl: 0,
            dt: 0,
            dpf: 0,
            dpa: 0,
            cgp: 0,
            cw: 0,
            cl: 0,
            ct: 0,
            cpf: 0,
            cpa: 0
          }),
          reportMatchupFid_ar[n].total.gp++,
          (reportMatchupFid_ar[n].total.w += g),
          (reportMatchupFid_ar[n].total.l += b),
          (reportMatchupFid_ar[n].total.t += w),
          s && (reportMatchupFid_ar[n].total.pf += c),
          (reportMatchupFid_ar[n].total.pa += y),
          (reportMatchupFid_ar[n].total.wadj += k),
          (reportMatchupFid_ar[n].total.ladj += L),
          (reportMatchupFid_ar[n].total.tadj += P),
          s && (reportMatchupFid_ar[n].total.pfadj += d),
          (reportMatchupFid_ar[n].total.paadj += _),
          reportMatchupFid_ar[n].total.rgp++,
          (reportMatchupFid_ar[n].total.rw += g),
          (reportMatchupFid_ar[n].total.rl += b),
          (reportMatchupFid_ar[n].total.rt += w),
          s && (reportMatchupFid_ar[n].total.rpf += c),
          (reportMatchupFid_ar[n].total.rpa += y),
          (reportMatchupFid_ar[n].total.rwadj += k),
          (reportMatchupFid_ar[n].total.rladj += L),
          (reportMatchupFid_ar[n].total.rtadj += P),
          s && (reportMatchupFid_ar[n].total.rpfadj += d),
          (reportMatchupFid_ar[n].total.rpaadj += _),
          reportMatchupFid_ar.hasOwnProperty(i) ||
            (reportMatchupFid_ar[i] = []),
          reportMatchupFid_ar[i].hasOwnProperty('total') ||
            (reportMatchupFid_ar[i].total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0,
              pf: 0,
              pa: 0,
              wadj: 0,
              ladj: 0,
              tadj: 0,
              pfadj: 0,
              paadj: 0,
              hgp: 0,
              hw: 0,
              hl: 0,
              ht: 0,
              hpf: 0,
              hpa: 0,
              hwadj: 0,
              hladj: 0,
              htadj: 0,
              hpfadj: 0,
              hpaadj: 0,
              rgp: 0,
              rw: 0,
              rl: 0,
              rt: 0,
              rpf: 0,
              rpa: 0,
              rwadj: 0,
              rladj: 0,
              rtadj: 0,
              rpfadj: 0,
              rpaadj: 0,
              dgp: 0,
              dw: 0,
              dl: 0,
              dt: 0,
              dpf: 0,
              dpa: 0,
              cgp: 0,
              cw: 0,
              cl: 0,
              ct: 0,
              cpf: 0,
              cpa: 0
            }),
          reportMatchupFid_ar[i].hasOwnProperty('w_' + t) ||
            (reportMatchupFid_ar[i]['w_' + t] = []),
          reportMatchupFid_ar[i].hasOwnProperty('opp_' + n) ||
            (reportMatchupFid_ar[i]['opp_' + n] = [])
        ;(g = 0), (b = 0), (w = 0), (k = 0), (L = 0), (P = 0)
        y > c ? (g = 1) : y < c ? (b = 1) : (w = 1),
          _ > d ? (k = 1) : _ < d ? (L = 1) : (P = 1),
          reportMatchupFid_ar[i]['w_' + t].push({
            opp: n,
            isHome: !0,
            gp: 1,
            w: g,
            l: b,
            t: w,
            pf: y,
            pa: c,
            wadj: k,
            ladj: L,
            tadj: P,
            pfadj: _,
            paadj: d,
            hgp: 1,
            hw: g,
            hl: b,
            ht: w,
            hpf: y,
            hpa: c,
            hwadj: k,
            hladj: L,
            htadj: P,
            hpfadj: _,
            hpaadj: d,
            rgp: 0,
            rw: 0,
            rl: 0,
            rt: 0,
            rpf: 0,
            rpa: 0,
            rwadj: 0,
            rladj: 0,
            rtadj: 0,
            rpfadj: 0,
            rpaadj: 0,
            dgp: 0,
            dw: 0,
            dl: 0,
            dt: 0,
            dpf: 0,
            dpa: 0,
            cgp: 0,
            cw: 0,
            cl: 0,
            ct: 0,
            cpf: 0,
            cpa: 0
          }),
          reportMatchupFid_ar[i]['opp_' + n].push({
            week: t,
            isHome: !0,
            gp: 1,
            w: g,
            l: b,
            t: w,
            pf: y,
            pa: c,
            wadj: k,
            ladj: L,
            tadj: P,
            pfadj: _,
            paadj: d,
            hgp: 1,
            hw: g,
            hl: b,
            ht: w,
            hpf: y,
            hpa: c,
            hwadj: k,
            hladj: L,
            htadj: P,
            hpfadj: _,
            hpaadj: d,
            rgp: 0,
            rw: 0,
            rl: 0,
            rt: 0,
            rpf: 0,
            rpa: 0,
            rwadj: 0,
            rladj: 0,
            rtadj: 0,
            rpfadj: 0,
            rpaadj: 0,
            dgp: 0,
            dw: 0,
            dl: 0,
            dt: 0,
            dpf: 0,
            dpa: 0,
            cgp: 0,
            cw: 0,
            cl: 0,
            ct: 0,
            cpf: 0,
            cpa: 0
          }),
          reportMatchupFid_ar[i].total.gp++,
          (reportMatchupFid_ar[i].total.w += g),
          (reportMatchupFid_ar[i].total.l += b),
          (reportMatchupFid_ar[i].total.t += w),
          l && (reportMatchupFid_ar[i].total.pf += y),
          (reportMatchupFid_ar[i].total.pa += c),
          (reportMatchupFid_ar[i].total.wadj += k),
          (reportMatchupFid_ar[i].total.ladj += L),
          (reportMatchupFid_ar[i].total.tadj += P),
          l && (reportMatchupFid_ar[i].total.pfadj += _),
          (reportMatchupFid_ar[i].total.paadj += d),
          reportMatchupFid_ar[i].total.hgp++,
          (reportMatchupFid_ar[i].total.hw += g),
          (reportMatchupFid_ar[i].total.hl += b),
          (reportMatchupFid_ar[i].total.ht += w),
          l && (reportMatchupFid_ar[i].total.hpf += y),
          (reportMatchupFid_ar[i].total.hpa += c),
          (reportMatchupFid_ar[i].total.hwadj += k),
          (reportMatchupFid_ar[i].total.hladj += L),
          (reportMatchupFid_ar[i].total.htadj += P),
          l && (reportMatchupFid_ar[i].total.hpfadj += _),
          (reportMatchupFid_ar[i].total.hpaadj += d)
      }
    }
  }
  if (e.weeklyResults.hasOwnProperty('franchise')) {
    var S = []
    e.weeklyResults.franchise.hasOwnProperty('score')
      ? S.push(e.weeklyResults.franchise)
      : (S = e.weeklyResults.franchise)
    for (o = 0; o < S.length; o++) {
      var M = S[o].id,
        F = parseFloat(S[o].score, 10),
        x = F
      try {
        reportScoreAdjustment_ar.hasOwnProperty('w_' + t) &&
          reportScoreAdjustment_ar['w_' + t].hasOwnProperty(M) &&
          (x += reportScoreAdjustment_ar['w_' + t][M])
      } catch (e) {}
      reportScoresFid_ar.hasOwnProperty(M) || (reportScoresFid_ar[M] = []),
        reportScoresAdjFid_ar.hasOwnProperty(M) ||
          (reportScoresAdjFid_ar[M] = []),
        a.hasOwnProperty(M)
          ? countPtsScoredOncePerWeek ||
            ((reportScoresFid_ar[M]['w_' + t] += F),
            (reportScoresAdjFid_ar[M]['w_' + t] += x))
          : ((reportScoresFid_ar[M]['w_' + t] = F),
            (reportScoresAdjFid_ar[M]['w_' + t] = x),
            (a[M] = 1)),
        reportScoresWeek_ar.hasOwnProperty('w_' + t) ||
          (reportScoresWeek_ar['w_' + t] = []),
        reportScoresWeekAdj_ar.hasOwnProperty('w_' + t) ||
          (reportScoresWeekAdj_ar['w_' + t] = []),
        (reportScoresWeek_ar['w_' + t][M] = F),
        (reportScoresWeekAdj_ar['w_' + t][M] = x)
      p = []
      if (S[o].hasOwnProperty('tiebreaker'))
        for (u = S[o].tiebreaker.split(','), m = 0; m < u.length - 1; m++)
          '' !== u[m] && (p[u[m]] = 1)
      if (S[o].hasOwnProperty('player'))
        for (m = 0; m < S[o].player.length; m++) {
          if (S[o].player[m].hasOwnProperty('score'))
            f = parseFloat(S[o].player[m].score, 10)
          else f = 0
          reportScoresFidTiebreakPlayer_ar.hasOwnProperty(M) ||
            (reportScoresFidTiebreakPlayer_ar[M] = []),
            reportScoresFidTiebreakPlayer_ar[M].hasOwnProperty('w_' + t) ||
              (reportScoresFidTiebreakPlayer_ar[M]['w_' + t] = 0),
            p.hasOwnProperty(S[o].player[m].id) &&
              (reportScoresFidTiebreakPlayer_ar[M]['w_' + t] += f),
            reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(M) ||
              (reportScoresFidTiebreakPlayerTracker_ar[M] = []),
            reportScoresFidTiebreakPlayerTracker_ar[M].hasOwnProperty(
              'w_' + t
            ) || (reportScoresFidTiebreakPlayerTracker_ar[M]['w_' + t] = []),
            p.hasOwnProperty(S[o].player[m].id) &&
              reportScoresFidTiebreakPlayerTracker_ar[M]['w_' + t].push({
                pid: S[o].player[m].id,
                score: f
              }),
            'nonstarter' === S[o].player[m].status &&
              (reportScoresFidBench_ar.hasOwnProperty(M) ||
                (reportScoresFidBench_ar[M] = []),
              reportScoresFidBench_ar[M].hasOwnProperty('w_' + t) ||
                (reportScoresFidBench_ar[M]['w_' + t] = 0),
              (reportScoresFidBench_ar[M]['w_' + t] = parseFloat(
                (reportScoresFidBench_ar[M]['w_' + t] + f).toFixed(precision)
              )))
          h = S[o].player[m].id
          playerScoresWeek_ar['w_' + t]._pidSet.has(h) ||
            (playerScoresWeek_ar['w_' + t]._pidSet.add(h),
            playerScoresWeek_ar['w_' + t].playerScores.playerScore.push({
              id: h,
              score: S[o].player[m].hasOwnProperty('score')
                ? S[o].player[m].score
                : '0'
            }))
        }
      else
        reportScoresFidTiebreakPlayer_ar.hasOwnProperty(M) ||
          (reportScoresFidTiebreakPlayer_ar[M] = []),
          reportScoresFidTiebreakPlayer_ar[M].hasOwnProperty('w_' + t) ||
            (reportScoresFidTiebreakPlayer_ar[M]['w_' + t] = 0),
          reportScoresFidTiebreakPlayerTracker_ar.hasOwnProperty(M) ||
            (reportScoresFidTiebreakPlayerTracker_ar[M] = []),
          reportScoresFidTiebreakPlayerTracker_ar[M].hasOwnProperty('w_' + t) ||
            (reportScoresFidTiebreakPlayerTracker_ar[M]['w_' + t] = [])
      reportMatchupFid_ar.hasOwnProperty(M) ||
        ((reportMatchupFid_ar[M] = []),
        (reportMatchupFid_ar[M].total = {
          gp: 0,
          w: 0,
          l: 0,
          t: 0,
          pf: 0,
          pa: 0,
          wadj: 0,
          ladj: 0,
          tadj: 0,
          pfadj: 0,
          paadj: 0,
          hgp: 0,
          hw: 0,
          hl: 0,
          ht: 0,
          hpf: 0,
          hpa: 0,
          hwadj: 0,
          hladj: 0,
          htadj: 0,
          hpfadj: 0,
          hpaadj: 0,
          rgp: 0,
          rw: 0,
          rl: 0,
          rt: 0,
          rpf: 0,
          rpa: 0,
          rwadj: 0,
          rladj: 0,
          rtadj: 0,
          rpfadj: 0,
          rpaadj: 0,
          dgp: 0,
          dw: 0,
          dl: 0,
          dt: 0,
          dpf: 0,
          dpa: 0,
          cgp: 0,
          cw: 0,
          cl: 0,
          ct: 0,
          cpf: 0,
          cpa: 0
        })),
        reportMatchupFid_ar[M].hasOwnProperty('w_' + t) ||
          (reportMatchupFid_ar[M]['w_' + t] = []),
        reportMatchupFid_ar[M]['w_' + t].push({
          opp: '',
          isHome: !1,
          gp: 0,
          w: 0,
          l: 0,
          t: 0,
          pf: F,
          pa: 0,
          wadj: 0,
          ladj: 0,
          tadj: 0,
          pfadj: x,
          paadj: 0,
          hgp: 0,
          hw: 0,
          hl: 0,
          ht: 0,
          hpf: 0,
          hpa: 0,
          hwadj: 0,
          hladj: 0,
          htadj: 0,
          hpfadj: 0,
          hpaadj: 0,
          rgp: 0,
          rw: 0,
          rl: 0,
          rt: 0,
          rpf: 0,
          rpa: 0,
          rwadj: 0,
          rladj: 0,
          rtadj: 0,
          rpfadj: 0,
          rpaadj: 0,
          dgp: 0,
          dw: 0,
          dl: 0,
          dt: 0,
          dpf: 0,
          dpa: 0,
          cgp: 0,
          cw: 0,
          cl: 0,
          ct: 0,
          cpf: 0,
          cpa: 0
        })
    }
  }
}
async function reportNflScheduleAPI (e) {
  let t = e
  'ALL' === e
    ? (t = completedWeek)
    : 0 === e
    ? (t = e = 1)
    : e > AllGamesCount && (t = e = AllGamesCount)
  const a = t === liveScoringWeek && liveScoringWeek > completedWeek
  if (MFLPastSeason && 'ALL' === e) {
    const e = []
    for (let t = 1; t <= AllGamesCount; t++)
      e.push(MFLCache.KEY.nflSchedule(year, t))
    let t = e.map(e => MFLCache.getSync(e)),
      a = t.every(e => e && e.data)
    if (
      (a || ((t = await MFLCache.batchGet(e)), (a = t.every(e => e && e.data))),
      a)
    )
      return (
        t.forEach((e, t) => {
          const a = t + 1
          e &&
            ((reportNflSchedule_ar['w_' + a] = e.data),
            reportNflScheduleResponse(e.data, a, !0))
        }),
        buildRunningRecordsForAllTeams(reportNflScheduleFid_ar, AllGamesCount),
        buildNflByeWeeks(),
        !0
      )
  }
  if (!MFLPastSeason && 'ALL' === e) {
    const e = []
    for (let t = 1; t <= AllGamesCount; t++)
      t !== liveScoringWeek
        ? e.push(MFLCache.KEY.nflSchedule(year, t))
        : e.push(null)
    let t = e.map(e => (e ? MFLCache.getSync(e) : null)),
      a = t.every((t, a) => null === e[a] || (t && !MFLCache.isExpiredEntry(t)))
    if (
      (a ||
        ((t = await MFLCache.batchGet(e)),
        (a = t.every(
          (t, a) => null === e[a] || (t && !MFLCache.isExpiredEntry(t))
        ))),
      a)
    )
      return (
        t.forEach((e, t) => {
          const a = t + 1
          e &&
            ((reportNflSchedule_ar['w_' + a] = e.data),
            reportNflScheduleResponse(e.data, a, !0))
        }),
        buildRunningRecordsForAllTeams(reportNflScheduleFid_ar, AllGamesCount),
        buildNflByeWeeks(),
        !0
      )
  }
  if ('ALL' !== e && !a && MFLPastSeason) {
    const e = MFLCache.KEY.nflSchedule(year, t),
      a = MFLCache.getSync(e)
    if (a && a.data)
      return (
        (reportNflSchedule_ar['w_' + t] = a.data),
        reportNflScheduleResponse(a.data, t)
      )
    const r = await MFLCache.get(e)
    if (r && r.data)
      return (
        (reportNflSchedule_ar['w_' + t] = r.data),
        reportNflScheduleResponse(r.data, t)
      )
  }
  let r
  r =
    e <= NFLlastWk || completedWeek >= e
      ? 'ALL' === e
        ? `${baseURLDynamic}/fflnetdynamic${year}/nfl_sched.json`
        : `${baseURLDynamic}/fflnetdynamic${year}/nfl_sched_${e}.json`
      : 'ALL' === e
      ? `${baseURLDynamic}/fflnetdynamic${year}/nfl_sched.json`
      : `https://api.myfantasyleague.com/${year}/export?TYPE=nflSchedule&W=${e}&JSON=1`
  const o = 'MFLLock_nflSchedule_' + year + '_' + e
  if (
    null ===
    (await withLock(o, 3e4, async () => {
      if ('ALL' === e) {
        const e = []
        for (let t = 1; t <= AllGamesCount; t++)
          t !== liveScoringWeek
            ? e.push(MFLCache.KEY.nflSchedule(year, t))
            : e.push(null)
        let t = e.map(e => (e ? MFLCache.getSync(e) : null)),
          a = t.every(
            (t, a) =>
              null === e[a] ||
              (MFLPastSeason ? t && t.data : t && !MFLCache.isExpiredEntry(t))
          )
        if (
          (a ||
            ((t = await MFLCache.batchGet(e)),
            (a = t.every(
              (t, a) =>
                null === e[a] ||
                (MFLPastSeason ? t && t.data : t && !MFLCache.isExpiredEntry(t))
            ))),
          a)
        )
          return (
            t.forEach((e, t) => {
              e &&
                ((reportNflSchedule_ar['w_' + (t + 1)] = e.data),
                reportNflScheduleResponse(e.data, t + 1, !0))
            }),
            buildRunningRecordsForAllTeams(
              reportNflScheduleFid_ar,
              AllGamesCount
            ),
            buildNflByeWeeks(),
            'cached'
          )
      } else if (MFLPastSeason) {
        const e = MFLCache.KEY.nflSchedule(year, t),
          a = MFLCache.getSync(e) || (await MFLCache.get(e))
        if (a && a.data)
          return (
            (reportNflSchedule_ar['w_' + t] = a.data),
            reportNflScheduleResponse(a.data, t),
            'cached'
          )
      }
      return (async () => {
        try {
          const a = await fetch(r)
          if (!a.ok) throw new Error('Invalid response from server')
          const o = await a.json()
          if ('ALL' === e) {
            const e = o.fullNflSchedule.nflSchedule.length,
              t = []
            for (let a = 1; a <= e; a++) {
              const e = o.fullNflSchedule.nflSchedule.find(
                e => parseInt(e.week, 10) === a
              )
              if (!e) continue
              const r = {
                version: '1.0',
                encoding: 'utf-8',
                nflSchedule: { week: String(a) }
              }
              e.matchup && (r.nflSchedule.matchup = e.matchup),
                (reportNflSchedule_ar['w_' + a] = r),
                t.push({
                  cacheKey: MFLCache.KEY.nflSchedule(year, a),
                  data: r,
                  ttlSeconds: MFLCache.TTL.DAILY,
                  silent: !0
                }),
                reportNflScheduleResponse(r, a, !0)
            }
            t.length && (await MFLCache.batchSet(t))
            try {
              localStorage.setItem(
                'MFLDone_nflSched_' + year + '_ALL',
                String(Date.now())
              )
            } catch (e) {}
            buildRunningRecordsForAllTeams(
              reportNflScheduleFid_ar,
              AllGamesCount
            ),
              buildNflByeWeeks(),
              signalMFLCacheUpdate('nflSchedule', {
                source: 'api',
                ttl: 'daily',
                week: 'ALL'
              })
          } else {
            ;(reportNflSchedule_ar['w_' + t] = o),
              MFLCache.set(
                MFLCache.KEY.nflSchedule(year, t),
                o,
                MFLCache.TTL.DAILY
              )
            try {
              localStorage.setItem(
                'MFLDone_nflSched_' + year + '_' + e,
                String(Date.now())
              )
            } catch (e) {}
            reportNflScheduleResponse(o, t),
              signalMFLCacheUpdate('nflSchedule', {
                source: 'api',
                ttl: 'daily',
                week: t
              })
          }
        } catch (e) {
          window.MFL_DEBUG_API && console.log(e.message)
        }
      })()
    }))
  ) {
    const a = 'MFLDone_nflSched_' + year + '_' + e
    if ((await waitForStorageValue(a, 8e3), 'ALL' === e)) {
      for (let e = 1; e <= AllGamesCount; e++) {
        if (e === liveScoringWeek) continue
        const t = MFLCache.KEY.nflSchedule(year, e),
          a = MFLCache.getSync(t) || (await MFLCache.get(t))
        a &&
          (MFLPastSeason ? a.data : !MFLCache.isExpiredEntry(a)) &&
          ((reportNflSchedule_ar['w_' + e] = a.data),
          reportNflScheduleResponse(a.data, e, !0))
      }
      buildRunningRecordsForAllTeams(reportNflScheduleFid_ar, AllGamesCount),
        buildNflByeWeeks()
    } else if (MFLPastSeason) {
      const e = MFLCache.KEY.nflSchedule(year, t),
        a = MFLCache.getSync(e) || (await MFLCache.get(e))
      a &&
        a.data &&
        ((reportNflSchedule_ar['w_' + t] = a.data),
        reportNflScheduleResponse(a.data, t))
    }
  }
}
function reportNflScheduleResponse (e, t, a = !1) {
  void 0 === reportNflScheduleWeek_ar[t] && (reportNflScheduleWeek_ar[t] = [])
  const r = e.nflSchedule.matchup
  if (!r) return
  const o = Array.isArray(r) ? r : [r]
  for (var n = 0; n < o.length; n++)
    reportNflScheduleResponse_matchup(t, o[n]),
      (reportNflScheduleWeek_ar[t][n] = o[n])
  a ||
    (buildRunningRecordsForAllTeams(reportNflScheduleFid_ar, AllGamesCount),
    buildNflByeWeeks())
}
function buildNflByeWeeks () {
  const e = []
  for (const t in reportNflScheduleFid_ar) {
    const a = reportNflScheduleFid_ar[t]
    for (let r = 1; r <= NFLlastWk; r++)
      if (!a[r]) {
        e.push({ id: t, bye_week: String(r) })
        break
      }
  }
  e.sort((e, t) => e.id.localeCompare(t.id)),
    (reportNflByeWeeks_ar = { nflByeWeeks: { team: e } })
}
function buildRunningRecordsForAllTeams (e, t) {
  for (const a in e) {
    const r = e[a]
    if (!r) continue
    let o = 0,
      n = 0,
      i = 0
    for (let e = 1; e <= t; e++) {
      const t = r[e]
      if (!t) continue
      ;('WIN' === t.result || 'LOSS' === t.result || 'TIED' === t.result) &&
        ((o += t.win ? 1 : 0), (n += t.loss ? 1 : 0), (i += t.tie ? 1 : 0)),
        (t.runW = o),
        (t.runL = n),
        (t.runT = i),
        (t.runRec = `${o}-${n}-${i}`)
    }
  }
}
function reportNflScheduleResponse_matchup (e, t) {
  const a = t.team[0],
    r = t.team[1]
  reportNflScheduleFid_ar[a.id] || (reportNflScheduleFid_ar[a.id] = []),
    reportNflScheduleFid_ar[r.id] || (reportNflScheduleFid_ar[r.id] = []),
    reportNflScheduleFid_ar[a.id][e] ||
      (reportNflScheduleFid_ar[a.id][e] = {
        kickoff: t.kickoff,
        gameSecondsRemaining: t.gameSecondsRemaining,
        isHome: !1,
        opponent: r.id,
        score: a.score,
        opponentScore: r.score,
        rushDefenseRank: a.rushDefenseRank,
        passDefenseRank: a.passDefenseRank,
        rushOffenseRank: a.rushOffenseRank,
        passOffenseRank: a.passOffenseRank,
        hasPossession: a.hasPossession,
        inRedZone: a.inRedZone,
        spread: a.spread,
        win: 0,
        loss: 0,
        tie: 0,
        pf: 0,
        pa: 0,
        result: ''
      }),
    reportNflScheduleFid_ar[r.id][e] ||
      (reportNflScheduleFid_ar[r.id][e] = {
        kickoff: t.kickoff,
        gameSecondsRemaining: t.gameSecondsRemaining,
        isHome: !0,
        opponent: a.id,
        score: r.score,
        opponentScore: a.score,
        rushDefenseRank: r.rushDefenseRank,
        passDefenseRank: r.passDefenseRank,
        rushOffenseRank: r.rushOffenseRank,
        passOffenseRank: r.passOffenseRank,
        hasPossession: r.hasPossession,
        inRedZone: r.inRedZone,
        spread: r.spread,
        win: 0,
        loss: 0,
        tie: 0,
        pf: 0,
        pa: 0,
        result: ''
      })
  if (
    ('string' == typeof t.status && 'FINAL' === t.status.toUpperCase()) ||
    e <= completedWeek
  ) {
    const t = parseInt(a.score, 10) || 0,
      o = parseInt(r.score, 10) || 0,
      n = reportNflScheduleFid_ar[a.id][e],
      i = reportNflScheduleFid_ar[r.id][e]
    ;(n.pf = t),
      (n.pa = o),
      (i.pf = o),
      (i.pa = t),
      (n.win = n.loss = n.tie = 0),
      (i.win = i.loss = i.tie = 0),
      t > o
        ? ((n.win = 1), (i.loss = 1), (n.result = 'WIN'), (i.result = 'LOSS'))
        : t < o
        ? ((n.loss = 1), (i.win = 1), (n.result = 'LOSS'), (i.result = 'WIN'))
        : ((n.tie = 1), (i.tie = 1), (n.result = 'TIED'), (i.result = 'TIED'))
  }
}
function reportHeadToHeadResults () {
  if (needsAPI('reportWeeklyResultsAPI')) {
    for (var e in reportMatchupFid_ar)
      if (reportMatchupFid_ar.hasOwnProperty(e))
        for (var t in reportMatchupFid_ar[e])
          if (t.startsWith('opp_')) {
            reportMatchupFid_ar[e][t].hasOwnProperty('hth') ||
              (reportMatchupFid_ar[e][t].hth = {
                gp: 0,
                w: 0,
                l: 0,
                t: 0,
                pf: 0,
                pa: 0
              })
            for (var a = reportMatchupFid_ar[e][t], r = 0; r < a.length; r++) {
              var o = a[r]
              ;(reportMatchupFid_ar[e][t].hth.gp += o.gp),
                (reportMatchupFid_ar[e][t].hth.w += o.w),
                (reportMatchupFid_ar[e][t].hth.l += o.l),
                (reportMatchupFid_ar[e][t].hth.t += o.t),
                (reportMatchupFid_ar[e][t].hth.pf += o.pf),
                (reportMatchupFid_ar[e][t].hth.pa += o.pa)
            }
          }
    doHeadToHeadArray()
  }
}
function doHeadToHeadArray () {
  for (var e in franchiseDatabase)
    if (franchiseDatabase.hasOwnProperty(e) && 'fid_0000' !== e)
      for (var t in (reportHTH_ar.push([]),
      reportSOS_ar.push({ oppw: 0, oppl: 0, oppt: 0 }),
      reportSOV_ar.push({ oppw: 0, oppl: 0, oppt: 0 }),
      franchiseDatabase))
        franchiseDatabase.hasOwnProperty(t) &&
          'fid_0000' !== t &&
          reportHTH_ar[reportHTH_ar.length - 1].push({
            r: '*',
            count: 0,
            gp: 0,
            title: '',
            w: 0,
            l: '',
            t: 0,
            pf: 0,
            tooltip: ''
          })
  reportHTH_ar.push([]),
    reportHTH_ar[reportHTH_ar.length - 1].push({
      r: '*',
      count: 0,
      gp: 0,
      title: 0,
      w: 0,
      l: '',
      t: 0,
      pf: 0,
      tooltip: ''
    }),
    reportSOS_ar.push({ oppw: 0, oppl: 0, oppt: 0 }),
    reportSOV_ar.push({ oppw: 0, oppl: 0, oppt: 0 }),
    createHeadToHeadArray()
}
function createHeadToHeadArray () {
  if (completedWeek <= standingsEndWeek) var e = completedWeek
  else e = standingsEndWeek
  reportStandings_ar.sort(function (e, t) {
    return e.index < t.index ? -1 : e.index > t.index ? 1 : 0
  })
  for (var t = startWeek; t <= e; t++)
    reportWeeklyResults_ar.hasOwnProperty('w_' + t) &&
      (fillHeadToHeadArray(reportWeeklyResults_ar['w_' + t], t),
      fillSOSArray(reportWeeklyResults_ar['w_' + t], t),
      fillSOVArray(reportWeeklyResults_ar['w_' + t], t))
  if (leagueAverageCreated) var a = reportStandings_ar.length - 1
  else a = reportStandings_ar.length
  for (var r = 0; r < a; r++) {
    if (reportSOS_ar[r].oppw + reportSOS_ar[r].oppl + reportSOS_ar[r].oppt > 0)
      var o =
        parseInt(
          ((reportSOS_ar[r].oppw + 0.5 * reportSOS_ar[r].oppt) /
            (reportSOS_ar[r].oppw +
              reportSOS_ar[r].oppl +
              reportSOS_ar[r].oppt)) *
            1e3
        ) / 1e3
    else o = 0
    if (
      ((reportStandings_ar[r].sospct = o),
      reportSOV_ar[r].oppw + reportSOV_ar[r].oppl + reportSOV_ar[r].oppt > 0)
    )
      var n =
        parseInt(
          ((reportSOV_ar[r].oppw + 0.5 * reportSOV_ar[r].oppt) /
            (reportSOV_ar[r].oppw +
              reportSOV_ar[r].oppl +
              reportSOV_ar[r].oppt)) *
            1e3
        ) / 1e3
    else n = 0
    reportStandings_ar[r].sovpct = n
  }
}
function fillSOSArray (e, t) {
  if (!e.weeklyResults.hasOwnProperty('matchup')) return !1
  var a = []
  e.weeklyResults.matchup.hasOwnProperty('franchise')
    ? ((a.matchup = []), a.matchup.push(e.weeklyResults.matchup))
    : (a = e.weeklyResults)
  for (var r = 0; r < a.matchup.length; r++) {
    var o = a.matchup[r].franchise[0].id,
      n = a.matchup[r].franchise[1].id,
      i = parseInt(o, 10) - 1,
      s = parseInt(n, 10) - 1
    i < 0 ||
      s < 0 ||
      ('BYE' !== o &&
        'BYE' !== n &&
        'AVG' !== o &&
        'AVG' !== n &&
        ((reportSOS_ar[i].oppw += reportStandings_ar[s].w),
        (reportSOS_ar[i].oppl += reportStandings_ar[s].l),
        (reportSOS_ar[i].oppt += reportStandings_ar[s].t),
        (reportSOS_ar[s].oppw += reportStandings_ar[i].w),
        (reportSOS_ar[s].oppl += reportStandings_ar[i].l),
        (reportSOS_ar[s].oppt += reportStandings_ar[i].t)))
  }
}
function fillSOVArray (e, t) {
  if (!e.weeklyResults.hasOwnProperty('matchup')) return !1
  var a = []
  e.weeklyResults.matchup.hasOwnProperty('franchise')
    ? ((a.matchup = []), a.matchup.push(e.weeklyResults.matchup))
    : (a = e.weeklyResults)
  for (var r = 0; r < a.matchup.length; r++) {
    var o = a.matchup[r].franchise[0].id,
      n = a.matchup[r].franchise[1].id,
      i = parseInt(o, 10) - 1,
      s = parseInt(n, 10) - 1
    if (!(i < 0 || s < 0)) {
      var l = a.matchup[r].franchise[0].result,
        c = a.matchup[r].franchise[1].result
      'BYE' !== o &&
        'BYE' !== n &&
        'AVG' !== o &&
        'AVG' !== n &&
        ('W' === l &&
          ((reportSOV_ar[i].oppw += reportStandings_ar[s].w),
          (reportSOV_ar[i].oppl += reportStandings_ar[s].l),
          (reportSOV_ar[i].oppt += reportStandings_ar[s].t)),
        'W' === c &&
          ((reportSOV_ar[s].oppw += reportStandings_ar[i].w),
          (reportSOV_ar[s].oppl += reportStandings_ar[i].l),
          (reportSOV_ar[s].oppt += reportStandings_ar[i].t)))
    }
  }
}
function fillHeadToHeadArray (e, t) {
  var a = !1
  if (!e.weeklyResults.hasOwnProperty('matchup')) return !1
  var r = []
  e.weeklyResults.matchup.hasOwnProperty('franchise')
    ? ((r.matchup = []), r.matchup.push(e.weeklyResults.matchup))
    : (r = e.weeklyResults)
  for (var o = 0; o < r.matchup.length; o++) {
    var n = r.matchup[o].franchise[0].id,
      i = r.matchup[o].franchise[1].id,
      s = parseInt(n, 10) - 1,
      l = parseInt(i, 10) - 1
    if (!(s < 0 || l < 0)) {
      if (
        ('AVG' === n &&
          ((s = leagueAttributes.Franchises), (leagueAverage = !0)),
        'AVG' === i &&
          ((l = leagueAttributes.Franchises), (leagueAverage = !0)),
        leagueAverage &&
          !leagueAverageCreated &&
          (reportStandings_ar.push({ w: 0, l: 0, t: 0, pf: 0 }),
          (leagueAverageCreated = !0)),
        ('BYE' !== n && 'BYE' !== i) || (a = !0),
        !a)
      ) {
        var c = parseFloat(r.matchup[o].franchise[0].score),
          d = parseFloat(r.matchup[o].franchise[1].score),
          p = r.matchup[o].franchise[0].result,
          u = r.matchup[o].franchise[1].result
        if (c > d || 'W' === p) {
          if (c === d)
            var m = '*',
              f = 'won tiebreaker'
          else (m = ''), (f = '')
          var h = 1,
            y = -1
          if ('AVG' === n)
            var _ =
              'Week #' +
              t +
              ': Average ' +
              c +
              m +
              ' defeated ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              '   ' +
              m +
              f
          else if ('AVG' === i)
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              m +
              ' defeated Average ' +
              d +
              '   ' +
              m +
              f
          else
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              m +
              ' defeated ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              '   ' +
              m +
              f
          if ('AVG' === i)
            var g =
              'Week #' +
              t +
              ': Average ' +
              d +
              ' lost to ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              m +
              '   ' +
              m +
              f
          else if ('AVG' === n)
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              ' lost to Average ' +
              c +
              m +
              '   ' +
              m +
              f
          else
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              ' lost to ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              m +
              '   ' +
              m +
              f
          var b = 1,
            w = 0,
            k = 0,
            L = 1,
            P = 0,
            S = 0
        } else if (c < d || 'L' === p) {
          if (c === d) (m = '*'), (f = 'won tiebreaker')
          else (m = ''), (f = '')
          ;(h = -1), (y = 1)
          if ('AVG' === n)
            _ =
              'Week #' +
              t +
              ': Average ' +
              c +
              ' lost to ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              m +
              '   ' +
              m +
              f
          else if ('AVG' === i)
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              ' lost to Average ' +
              d +
              m +
              '   ' +
              m +
              f
          else
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              ' lost to ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              m +
              '   ' +
              m +
              f
          if ('AVG' === i)
            g =
              'Week #' +
              t +
              ': Average ' +
              d +
              m +
              ' defeated ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              '   ' +
              m +
              f
          else if ('AVG' === n)
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              m +
              ' defeated Average ' +
              c +
              '   ' +
              m +
              f
          else
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              m +
              ' defeated ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              '   ' +
              m +
              f
          ;(b = 0), (w = 1), (k = 1), (L = 0), (P = 0), (S = 0)
        } else {
          ;(h = 0), (y = 0)
          if ('AVG' === n)
            _ =
              'Week #' +
              t +
              ': Average ' +
              c +
              ' tied ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d
          else if ('AVG' === i)
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              ' tied Average ' +
              d
          else
            _ =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c +
              ' tied ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d
          if ('AVG' === i)
            g =
              'Week #' +
              t +
              ': Average ' +
              d +
              ' tied ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c
          else if ('AVG' === n)
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              ' tied Average ' +
              c
          else
            g =
              'Week #' +
              t +
              ': ' +
              franchiseDatabase['fid_' + i].name +
              ' ' +
              d +
              ' tied ' +
              franchiseDatabase['fid_' + n].name +
              ' ' +
              c
          ;(b = 0), (w = 0), (k = 0), (L = 0), (P = 1), (S = 1)
        }
        'AVG' !== n &&
          'AVG' !== i &&
          ('*' === reportHTH_ar[l][s].r
            ? ((reportHTH_ar[l][s].r = u),
              (reportHTH_ar[l][s].count = y),
              (reportHTH_ar[l][s].gp = 1),
              (reportHTH_ar[l][s].title = g),
              (reportHTH_ar[l][s].w = w),
              (reportHTH_ar[l][s].l = L),
              (reportHTH_ar[l][s].t = S),
              (reportHTH_ar[l][s].pf = d),
              (reportHTH_ar[l][s].tooltip = ' ' + g + ' '),
              (reportHTH_ar[s][l].r = p),
              (reportHTH_ar[s][l].count = h),
              (reportHTH_ar[s][l].gp = 1),
              (reportHTH_ar[s][l].title = _),
              (reportHTH_ar[s][l].w = b),
              (reportHTH_ar[s][l].l = k),
              (reportHTH_ar[s][l].t = P),
              (reportHTH_ar[s][l].pf = c),
              (reportHTH_ar[s][l].tooltip = ' ' + _ + ' '))
            : ((reportHTH_ar[l][s].r += ',' + u),
              (reportHTH_ar[l][s].count += y),
              (reportHTH_ar[l][s].gp += 1),
              (reportHTH_ar[l][s].title += '\n' + g),
              (reportHTH_ar[l][s].w += w),
              (reportHTH_ar[l][s].l += L),
              (reportHTH_ar[l][s].t += S),
              (reportHTH_ar[l][s].pf += d),
              (reportHTH_ar[l][s].tooltip += '<br /> ' + g + ' '),
              (reportHTH_ar[s][l].r += ',' + p),
              (reportHTH_ar[s][l].count += h),
              (reportHTH_ar[s][l].gp += 1),
              (reportHTH_ar[s][l].title += '\n' + _),
              (reportHTH_ar[s][l].w += b),
              (reportHTH_ar[s][l].l += k),
              (reportHTH_ar[s][l].t += P),
              (reportHTH_ar[s][l].pf += c),
              (reportHTH_ar[s][l].tooltip += '<br /> ' + _ + ' ')))
      }
      a = !1
    }
  }
}
function reportAllPlayResults () {
  if (needsAPI('reportWeeklyResultsAPI'))
    for (var e in franchiseDatabase)
      if (franchiseDatabase.hasOwnProperty(e) && 'fid_0000' !== e) {
        var t = franchiseDatabase[e].id
        if (reportMatchupFid_ar.hasOwnProperty(t)) {
          reportMatchupFid_ar[t].hasOwnProperty('all_play') ||
            (reportMatchupFid_ar[t].all_play = []),
            reportMatchupFid_ar[t].hasOwnProperty('all_play_adj') ||
              (reportMatchupFid_ar[t].all_play_adj = []),
            (reportMatchupFid_ar[t].all_play.total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0
            }),
            (reportMatchupFid_ar[t].all_play_adj.total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0
            })
          for (var a = startWeek; a <= completedWeek; a++)
            for (var r in franchiseDatabase) {
              if (franchiseDatabase.hasOwnProperty(r) && 'fid_0000' !== r)
                t !== (o = franchiseDatabase[r].id) &&
                  (reportMatchupFid_ar[t].all_play.hasOwnProperty('w_' + a) ||
                    (reportMatchupFid_ar[t].all_play['w_' + a] = {
                      gp: 0,
                      w: 0,
                      l: 0,
                      t: 0
                    }),
                  reportMatchupFid_ar[t].all_play.total.gp++,
                  reportMatchupFid_ar[t].all_play['w_' + a].gp++,
                  reportScoresFid_ar[t]['w_' + a] >
                  reportScoresFid_ar[o]['w_' + a]
                    ? (reportMatchupFid_ar[t].all_play.total.w++,
                      reportMatchupFid_ar[t].all_play['w_' + a].w++)
                    : reportScoresFid_ar[t]['w_' + a] <
                      reportScoresFid_ar[o]['w_' + a]
                    ? (reportMatchupFid_ar[t].all_play.total.l++,
                      reportMatchupFid_ar[t].all_play['w_' + a].l++)
                    : (reportMatchupFid_ar[t].all_play.total.t++,
                      reportMatchupFid_ar[t].all_play['w_' + a].t++),
                  reportMatchupFid_ar[t].all_play_adj.hasOwnProperty(
                    'w_' + a
                  ) ||
                    (reportMatchupFid_ar[t].all_play_adj['w_' + a] = {
                      gp: 0,
                      w: 0,
                      l: 0,
                      t: 0
                    }),
                  reportMatchupFid_ar[t].all_play_adj.total.gp++,
                  reportMatchupFid_ar[t].all_play_adj['w_' + a].gp++,
                  reportScoresAdjFid_ar[t]['w_' + a] >
                  reportScoresAdjFid_ar[o]['w_' + a]
                    ? (reportMatchupFid_ar[t].all_play_adj.total.w++,
                      reportMatchupFid_ar[t].all_play_adj['w_' + a].w++)
                    : reportScoresAdjFid_ar[t]['w_' + a] <
                      reportScoresAdjFid_ar[o]['w_' + a]
                    ? (reportMatchupFid_ar[t].all_play_adj.total.l++,
                      reportMatchupFid_ar[t].all_play_adj['w_' + a].l++)
                    : (reportMatchupFid_ar[t].all_play_adj.total.t++,
                      reportMatchupFid_ar[t].all_play_adj['w_' + a].t++))
            }
        } else {
          ;(reportMatchupFid_ar[t] = []),
            (reportMatchupFid_ar[t].all_play = []),
            (reportMatchupFid_ar[t].all_play_adj = []),
            (reportMatchupFid_ar[t].all_play.total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0
            }),
            (reportMatchupFid_ar[t].all_play_adj.total = {
              gp: 0,
              w: 0,
              l: 0,
              t: 0
            })
          for (a = startWeek; a <= completedWeek; a++)
            for (var r in franchiseDatabase) {
              var o
              if (franchiseDatabase.hasOwnProperty(r) && 'fid_0000' !== r)
                t !== (o = franchiseDatabase[r].id) &&
                  (reportMatchupFid_ar[t].all_play['w_' + a] = {
                    gp: 0,
                    w: 0,
                    l: 0,
                    t: 0
                  })
            }
        }
      }
}
function checkFiveMinuteBucketAndRun () {
  const e = getCacheFiveMinutes(),
    t = Number(sessionStorage.getItem('lastFiveMinRunBucket') || 0)
  if (!Number.isFinite(t) || t !== e) {
    sessionStorage.setItem('lastFiveMinRunBucket', String(e)),
      (cacheFiveMinutes = e)
    try {
      doFiveMinuteCache(e)
    } catch (e) {
      console.warn('doFiveMinuteCache() failed:', e)
    }
  }
}
function startBackgroundTimersOnce () {
  backgroundTimersStarted ||
    MFLPastSeason ||
    (liveScoringWeek !== AllGamesCount &&
      ((backgroundTimersStarted = !0),
      checkFiveMinuteBucketAndRun(),
      setInterval(checkFiveMinuteBucketAndRun, 12e4)))
}
MFLCache.preloadCacheToMemory().then(() => {
  if (
    (lsm_get_stats(!MFLPastSeason),
    reportDailyApi_ran || doDailyCache(),
    !reportFiveMinuteApi_ran)
  ) {
    const e = getCacheFiveMinutes()
    sessionStorage.setItem('lastFiveMinRunBucket', String(e)),
      (cacheFiveMinutes = e),
      doFiveMinuteCache(e)
  }
  evictOldCacheEntries(), evictLegacyIDB()
})
const parentUl_1 = document.querySelector('.mm-help ul:first-of-type')
let clearLocalCacheAppended = !1
if (!clearLocalCacheAppended && parentUl_1) {
  clearLocalCacheAppended = !0
  const e =
    '<li id="cache-addon" class="has-sub sub-default"><a>Manage Cache</a><b aria-haspopup="true" aria-controls="p101"></b><input id="sub101" type="checkbox"><label for="sub101"><span></span></label><ul id="p201"><li><a class="no-sub" onclick="deleteCurrentLeagueAndReload()">Clear This League Only</a></li><li><a class="no-sub" onclick="deleteOtherLeaguesAndReload()">Clear All Other Legues</a></li><li><a class="no-sub" onclick="deleteAllGlobalAndReload()">Clear Global Files</a></li><li><a class="no-sub" onclick="deleteMFLDatabaseAndReload()">Delete Entire Storage</a></li></ul></li>'
  parentUl_1.innerHTML = e + parentUl_1.innerHTML
}
function toEpochSeconds (e) {
  if (e instanceof Date) {
    const t = e.getTime()
    return Number.isFinite(t) ? Math.floor(t / 1e3) : null
  }
  if ('number' == typeof e)
    return e > 1e12 ? Math.floor(e / 1e3) : Math.floor(e)
  if ('string' == typeof e && e.trim()) {
    const t = Number(e)
    if (Number.isFinite(t))
      return t > 1e12 ? Math.floor(t / 1e3) : Math.floor(t)
  }
  return null
}
const toEpochSecondsLocal = (e, t, a) =>
  Math.floor(new Date(e, t - 1, a).getTime() / 1e3)
function parseUserDate (e) {
  const t = toEpochSeconds(e)
  if (Number.isFinite(t)) return t
  if (!e || 'string' != typeof e) return null
  const a = e.trim()
  let r = a.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (r) {
    const [, e, t, a] = r
    return toEpochSecondsLocal(+e, +t, +a)
  }
  if (((r = a.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)), r)) {
    const [, e, t, a] = r
    return toEpochSecondsLocal(+a, +e, +t)
  }
  const o = new Date(a).getTime()
  return Number.isFinite(o) ? Math.floor(o / 1e3) : null
}
var setCustomDates = void 0 !== setCustomDates && !!setCustomDates,
  nflStartWk = void 0 !== nflStartWk ? nflStartWk : void 0,
  nflEndWk = void 0 !== nflEndWk ? nflEndWk : void 0,
  currentServerTimeSec = (function (e) {
    if (void 0 === e) return Math.floor(Date.now() / 1e3)
    const t = toEpochSeconds(e)
    return Number.isFinite(t) ? t : Math.floor(Date.now() / 1e3)
  })('undefined' != typeof currentServerTime ? currentServerTime : void 0)
let seasonStartSec = null,
  seasonEndSec = null
if (
  (setCustomDates &&
    ((seasonStartSec = parseUserDate(nflStartWk)),
    (seasonEndSec = parseUserDate(nflEndWk))),
  !Number.isFinite(seasonStartSec) || !Number.isFinite(seasonEndSec))
) {
  const t = {
    2021: ['2021-08-04', '2022-02-14'],
    2022: ['2022-08-03', '2023-02-13'],
    2023: ['2023-08-02', '2024-02-12'],
    2024: ['2024-08-07', '2025-02-10'],
    2025: ['2025-07-30', '2026-02-09'],
    2026: ['2026-08-12', '2027-02-15']
  }
  if ('undefined' != typeof year && t[year]) {
    const [a, r] = t[year]
    ;(seasonStartSec = parseUserDate(a)), (seasonEndSec = parseUserDate(r))
  }
}
if (void 0 === is_offseason) var is_offseason = !0
Number.isFinite(seasonStartSec) &&
  Number.isFinite(seasonEndSec) &&
  (seasonStartSec > seasonEndSec &&
    ([seasonStartSec, seasonEndSec] = [seasonEndSec, seasonStartSec]),
  currentServerTimeSec >= seasonStartSec &&
    currentServerTimeSec <= seasonEndSec &&
    (is_offseason = !1))
const hide_extra_val = 'undefined' != typeof hide_extra ? hide_extra : ''
if (
  (is_offseason &&
    hide_extra_val &&
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll(hide_extra_val).forEach(e => {
        e.style.display = 'none'
        const t = e.closest('.mobile-wrap')
        t && (t.style.display = 'none')
      })
    }),
  void 0 === useREM)
)
  var useREM = !1
function calcREM (e) {
  if (!isNaN(e)) {
    var t = parseFloat($('html').css('font-size'))
    return (parseFloat(e) / t).toString() + 'rem'
  }
}
function calcREM2 (e) {
  if (!isNaN(e)) {
    var t = parseFloat($('html').css('font-size'))
    return (parseFloat(e) / t).toString()
  }
}
var historicalLinkFormData,
  createHistoricalLink,
  ajaxRan = !1,
  historicalLinkDate = new Date(),
  historicalLinkYear = historicalLinkDate.getFullYear(),
  historicalLinkLastSeason = $(
    `li.mm-myacct li a[href*="home/${league_id}"]`
  ).attr('href')
$(document).on('submit', 'form[action*="copy_league"]', function () {
  if (ajaxRan) return !0
  var e =
    baseURLDynamic +
    '/' +
    year +
    '/csetup?L=' +
    league_id +
    '&C=HMPGMSG&SEQNO=3000&PRINTER=1'
  return (
    $.ajax({
      url: e,
      type: 'GET',
      dataType: 'html',
      xhrFields: { withCredentials: !0 },
      success: function (e) {
        var t = $(e).find('#MSG').val()
        if (t.length > 0) {
          var a = t,
            r =
              baseURLDynamic +
              '/' +
              (year + 1) +
              '/options?' +
              a +
              '&SAVE=Save+Linked+Franchises'
          localStorage.setItem('historicalLink_' + league_id, r),
            (ajaxRan = !0),
            $('form[action*="copy_league"]').submit()
        } else
          $.ajax({
            type: 'GET',
            url:
              baseURLDynamic +
              '/' +
              year +
              '/options?L=' +
              league_id +
              '&O=170&PRINTER=1',
            xhrFields: { withCredentials: !0 },
            success: function (e) {
              ;(thisFormExists = $(e).find('form[action=options]').html()),
                $.trim(thisFormExists)
                  ? ((a = $(e).find('form[action=options]').serialize()),
                    (r =
                      baseURLDynamic +
                      '/' +
                      historicalLinkYear +
                      '/options?' +
                      a +
                      '&SAVE=Save+Linked+Franchises'),
                    localStorage.setItem('historicalLink_' + league_id, r),
                    (ajaxRan = !0),
                    $('form[action*="copy_league"]').submit())
                  : $.ajax({
                      type: 'GET',
                      url: historicalLinkLastSeason + '&PRINTER=1',
                      xhrFields: { withCredentials: !0 },
                      success: function (e) {
                        ;(thisFormExists = $(e)
                          .find('form[action=options]')
                          .html()),
                          $.trim(thisFormExists)
                            ? ((a = $(e)
                                .find('form[action=options]')
                                .serialize()),
                              (r =
                                baseURLDynamic +
                                '/' +
                                historicalLinkYear +
                                '/options?' +
                                a +
                                '&SAVE=Save+Linked+Franchises'),
                              localStorage.setItem(
                                'historicalLink_' + league_id,
                                r
                              ),
                              (ajaxRan = !0),
                              $('form[action*="copy_league"]').submit())
                            : ((ajaxRan = !0),
                              $('form[action*="copy_league"]').submit())
                      },
                      error: function (e) {
                        ;(ajaxRan = !0),
                          $('form[action*="copy_league"]').submit()
                      }
                    })
            },
            error: function (e) {
              ;(ajaxRan = !0), $('form[action*="copy_league"]').submit()
            }
          })
      },
      error: function (e) {
        ;(ajaxRan = !0), $('form[action*="copy_league"]').submit()
      }
    }),
    !!ajaxRan && void 0
  )
}),
  $(document).on(
    'submit',
    '#body_options_170 form[action="options"]',
    function () {
      if (ajaxRan) return !0
      var e =
          $('#body_options_170 form[action=options]').serialize() +
          '&SAVE=Save+Linked+Franchises',
        t =
          baseURLDynamic +
          '/' +
          year +
          '/message?LEAGUE_ID=' +
          league_id +
          '&NAME=message3000'
      return (
        $.ajax({
          url: t,
          xhrFields: { withCredentials: !0 },
          data: { MSG: e, LABEL: '#3000 Historical Link Form' },
          cache: !1,
          type: 'POST',
          success: function (e) {
            ;(ajaxRan = !0),
              $('#body_options_170 form[action="options"] input').trigger(
                'click'
              )
          },
          error: function (e) {
            ;(ajaxRan = !0),
              $('#body_options_170 form[action="options"] input').trigger(
                'click'
              )
          }
        }),
        !!ajaxRan && void 0
      )
    }
  ),
  localStorage.hasOwnProperty('historicalLink_' + league_id) &&
    ((url = localStorage.getItem('historicalLink_' + league_id)),
    $.ajax({
      type: 'POST',
      url: url,
      xhrFields: { withCredentials: !0 },
      success: function (e) {
        localStorage.removeItem('historicalLink_' + league_id)
      },
      error: function (e) {
        localStorage.removeItem('historicalLink_' + league_id)
      }
    }))
const currentHistoryTime = 1e3 * currentServerTime
async function runHistoryUpdateHPM () {
  try {
    const e = `${baseURLDynamic}/${year}/message?LEAGUE_ID=${league_id}&NAME=message801&MSG=${encodeURIComponent(
      historyUpdateMSG
    )}&LABEL=${encodeURIComponent('#801')}+History+Update&IN_HEADER=Yes`
    await fetch(e, { method: 'POST' })
  } catch (e) {
    console.error('Error occurred during the requests:', e)
  }
}
function isSwipeEnabled () {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  )
}
function doReportCustomCollapse () {
  try {
    document.getElementById('body_home') &&
      -1 === location.href.indexOf('MODULE=MESSAGE') &&
      -1 === location.href.indexOf('/message') &&
      -1 === location.href.indexOf('SEQNO=') &&
      doCustomCollapseHPM()
  } catch (e) {}
}
function formatMFLDate (e, t, a) {
  function ii (e, t) {
    var a = e + ''
    for (t = t || 2; a.length < t; ) a = '0' + a
    return a
  }
  var r = a ? e.getUTCFullYear() : e.getFullYear(),
    o = (a ? e.getUTCMonth() : e.getMonth()) + 1,
    n = a ? e.getUTCDate() : e.getDate(),
    i = a ? e.getUTCHours() : e.getHours(),
    s = a ? e.getUTCMinutes() : e.getMinutes(),
    l = a ? e.getUTCSeconds() : e.getSeconds(),
    c = a ? e.getUTCMilliseconds() : e.getMilliseconds(),
    d = (a ? e.getUTCDay() : e.getDay()) + 1,
    p = i > 12 ? i - 12 : 0 === i ? 12 : i,
    u = i < 12 ? 'AM' : 'PM',
    m = u.toLowerCase(),
    f = -e.getTimezoneOffset(),
    h = a || !f ? 'Z' : f > 0 ? '+' : '-'
  if (!a) {
    var y = Math.abs(f)
    h += ii(Math.floor(y / 60)) + ':' + ii(y % 60)
  }
  var _ = {
      yyyy: r,
      yy: r.toString().substr(2, 2),
      y: r,
      MMMM: [
        '',
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
      ][o],
      MMM: [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][o],
      MM: ii(o),
      M: o,
      dddd: [
        '',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ][d],
      ddd: ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
      dd: ii(n),
      d: n,
      HH: ii(i),
      H: i,
      hh: ii(p),
      h: p,
      mm: ii(s),
      m: s,
      ss: ii(l),
      s: l,
      fff: ii(c, 3),
      ff: ii(Math.round(c / 10)),
      f: Math.round(c / 100),
      TT: u,
      T: u.charAt(0),
      tt: m,
      t: m.charAt(0),
      K: h
    },
    g = new RegExp(
      '\\\\(.)|(yyyy|yy|y|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|fff|ff|f|TT|T|tt|t|K)',
      'g'
    )
  return t.replace(g, function (e, t, a) {
    return void 0 !== t ? t : void 0 !== _[a] ? _[a] : e
  })
}
function getReportsNameIcon (e, t) {
  switch (t) {
    case 0:
    default:
      return franchiseDatabase['fid_' + e].name
    case 1:
      return '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
            franchiseDatabase['fid_' + e].icon +
            '" class="franchise-icon" alt="' +
            franchiseDatabase['fid_' + e].name +
            '" />'
        : '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
          franchiseDatabase['fid_' + e].logo +
          '" class="franchise-icon" alt="' +
          franchiseDatabase['fid_' + e].name +
          '" />'
        : franchiseDatabase['fid_' + e].name
    case 2:
      return '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
            franchiseDatabase['fid_' + e].logo +
            '" class="franchise-icon" alt="' +
            franchiseDatabase['fid_' + e].name +
            '" />'
        : '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
          franchiseDatabase['fid_' + e].icon +
          '" class="franchise-icon" alt="' +
          franchiseDatabase['fid_' + e].name +
          '" />'
        : franchiseDatabase['fid_' + e].name
    case 3:
      return '' !== franchiseDatabase['fid_' + e].abbrev
        ? franchiseDatabase['fid_' + e].abbrev
        : franchiseDatabase['fid_' + e].name
    case 4:
      return '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
            franchiseDatabase['fid_' + e].icon +
            '" class="franchise-icon" alt="' +
            franchiseDatabase['fid_' + e].name +
            '" /> ' +
            franchiseDatabase['fid_' + e].name
        : '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
          franchiseDatabase['fid_' + e].logo +
          '" class="franchise-icon" alt="' +
          franchiseDatabase['fid_' + e].name +
          '" /> ' +
          franchiseDatabase['fid_' + e].name
        : franchiseDatabase['fid_' + e].name
    case 5:
      return '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
            franchiseDatabase['fid_' + e].logo +
            '" class="franchise-icon" alt="' +
            franchiseDatabase['fid_' + e].name +
            '" /> ' +
            franchiseDatabase['fid_' + e].name
        : '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
          franchiseDatabase['fid_' + e].icon +
          '" class="franchise-icon" alt="' +
          franchiseDatabase['fid_' + e].name +
          '" /> ' +
          franchiseDatabase['fid_' + e].name
        : franchiseDatabase['fid_' + e].name
  }
}
function scoreAdjustmentHtml (e) {
  try {
    if (!enableScoreAdjustment_ar.hasOwnProperty(e)) return ''
    for (
      var t = 0, a = -1, r = '', o = 0;
      o < global_scoreAdjustment.length;
      o++
    )
      -1 !== a &&
        a !== global_scoreAdjustment[o][1] &&
        (r = r.substring(0, r.length - 2) + '</td></tr>'),
        a !== global_scoreAdjustment[o][1] &&
          ((a = global_scoreAdjustment[o][1]),
          (r +=
            t % 2
              ? '<tr class="eventablerow"><td style="text-align:center">' +
                a +
                '</td><td>'
              : '<tr class="oddtablerow"><td style="text-align:center">' +
                a +
                '</td><td>'),
          t++),
        (r +=
          franchiseDatabase['fid_' + global_scoreAdjustment[o][0]].name +
          ' (' +
          global_scoreAdjustment[o][2] +
          '), '),
        o === global_scoreAdjustment.length - 1 &&
          (r = r.substring(0, r.length - 2) + '</td></tr>')
    return '' !== r
      ? '<div class="mobile-wrap" style="display:inline-block"><table align="center" cellspacing="1" class="homepagemodule report" id="scoreadjustment-table"><caption><span>Franchise Score Adjustments</span></caption><tbody><tr><th>Week #</th><th>* Adjustment(s)</th></tr>' +
          r +
          '</tbody></table></div>'
      : ''
  } catch (e) {
    return ''
  }
}
function _clearLSByPrefixes (e) {
  try {
    Object.keys(localStorage).forEach(t => {
      if (e.some(e => t.startsWith(e)))
        try {
          localStorage.removeItem(t)
        } catch (e) {}
    })
  } catch (e) {}
}
function _idbGetAllKeysPublic () {
  return new Promise(e => {
    try {
      const t = indexedDB.open('MFLScripts', 1)
      ;(t.onsuccess = t => {
        const a = t.target.result
        try {
          const t = a
            .transaction('cache', 'readonly')
            .objectStore('cache')
            .getAllKeys()
          ;(t.onsuccess = () => {
            a.close(), e(t.result || [])
          }),
            (t.onerror = () => {
              a.close(), e([])
            })
        } catch (t) {
          a.close(), e([])
        }
      }),
        (t.onerror = () => e([]))
    } catch (t) {
      e([])
    }
  })
}
function _uniqueLeaguePrefixes (e) {
  const t = new Set()
  return (
    e.forEach(e => {
      const a = e.split('_')
      a.length >= 3 && t.add(`lid_${a[1]}_${a[2]}_`)
    }),
    [...t]
  )
}
function showConfirmModal ({
  title: e,
  body: t,
  confirmLabel: a = 'Confirm',
  danger: r = !0
}) {
  return new Promise(o => {
    const n = document.createElement('div')
    ;(n.id = 'mfl-cache-overlay'),
      (n.style.cssText =
        '\n      position: fixed; inset: 0; background: rgba(0,0,0,0.6);\n      display: flex; align-items: center; justify-content: center;\n      z-index: 99999999; font-family: sans-serif;\n    '),
      (n.innerHTML = `\n      <div id="mfl-cache-inner" style="\n        background: #1e1e2e; color: #e0e0e0; border-radius: 10px;\n        padding: 28px 32px; max-width: 420px; width: 90%;\n        box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid #3a3a5c;\n      ">\n        <h3 style="margin: 0 0 12px; color: ${
        r ? '#ff6b6b' : '#f9a825'
      }; font-size: 1.1rem;">\n          ${
        r ? 'âš ï¸' : 'â„¹ï¸'
      } ${e}\n        </h3>\n        ${t}\n        <p style="margin: 0 0 22px; font-size: 0.88rem; color: #ff9999;">\n          Click <strong>${a}</strong> to proceed â€” the page will reload automatically.\n        </p>\n        <div style="display: flex; gap: 12px; justify-content: flex-end;">\n          <button id="modal-cancel" style="\n            padding: 8px 20px; border-radius: 6px; border: 1px solid #555;\n            background: transparent; color: #ccc; cursor: pointer; font-size: 0.9rem;\n          ">Cancel</button>\n          <button id="modal-confirm" style="\n            padding: 8px 20px; border-radius: 6px; border: none;\n            background: ${
        r ? '#e53935' : '#f9a825'
      }; color: #fff;\n            cursor: pointer; font-size: 0.9rem; font-weight: bold;\n          ">${a}</button>\n        </div>\n      </div>\n    `),
      document.body.appendChild(n)
    const close = e => {
      document.body.removeChild(n), o(e)
    }
    n.addEventListener('click', () => close(!1)),
      n
        .querySelector('#mfl-cache-inner')
        .addEventListener('click', e => e.stopPropagation()),
      (n.querySelector('#modal-confirm').onclick = () => close(!0)),
      (n.querySelector('#modal-cancel').onclick = () => close(!1))
  })
}
async function deleteMFLDatabaseAndReload () {
  if (
    !(await showConfirmModal({
      title: 'Delete Entire MFL Database?',
      body: '\n      <p style="margin: 0 0 14px; line-height: 1.5; font-size: 0.95rem;">\n        This will completely wipe the <code style="color:#f9a825">MFLScripts</code> IndexedDB\n        and all related storage entries:\n      </p>\n      <ul style="margin: 0 0 18px; padding-left: 20px; font-size: 0.9rem; color: #aaa; line-height: 1.8;">\n        <li><strong>IndexedDB:</strong> <code style="color:#f9a825">MFLScripts</code> database</li>\n        <li><strong>localStorage:</strong> <code style="color:#f9a825">mfl_c_</code>, <code style="color:#f9a825">mfl_meta_</code>, <code style="color:#f9a825">lock_</code> keys</li>\n        <li><strong>localStorage:</strong> <code style="color:#f9a825">serverFiveMinMs</code>, <code style="color:#f9a825">serverSixHours_</code>, <code style="color:#f9a825">serverDaily_</code></li>\n        <li><strong>localStorage:</strong> <code style="color:#f9a825">mfl_legacy_idb_evicted</code></li>\n        <li><strong>sessionStorage:</strong> <code style="color:#f9a825">lastFiveMinRunBucket</code></li>\n      </ul>\n    ',
      confirmLabel: 'Delete Database'
    }))
  )
    return
  try {
    window.MFLCache &&
      'function' == typeof MFLCache.reconnect &&
      MFLCache.reconnect()
  } catch (e) {}
  const e = indexedDB.deleteDatabase('MFLScripts')
  function _afterFullWipe () {
    _clearLSByPrefixes([
      'mfl_c_',
      'mfl_meta_',
      'lock_',
      'serverFiveMinMs',
      'serverSixHours_',
      'serverDaily_',
      'mfl_legacy_idb_evicted'
    ])
    try {
      sessionStorage.removeItem('lastFiveMinRunBucket'),
        localStorage.removeItem(`mfl_tabs_${league_id}_${year}`)
    } catch (e) {}
    location.reload()
  }
  ;(e.onblocked = () => {
    console.warn('[MFLUtils] IDB delete blocked â€” reloading anyway'),
      _afterFullWipe()
  }),
    (e.onsuccess = () => {
      console.log('[MFLUtils] MFLScripts IDB deleted successfully'),
        _afterFullWipe()
    }),
    (e.onerror = e => {
      console.warn('[MFLUtils] IDB delete error:', e.target.error),
        _afterFullWipe()
    })
}
async function deleteCurrentLeagueAndReload () {
  if (
    await showConfirmModal({
      title: 'Delete Current League Cache?',
      body: `\n      <p style="margin: 0 0 14px; line-height: 1.5; font-size: 0.95rem;">\n        This will clear all cached data for your current league:\n      </p>\n      <ul style="margin: 0 0 18px; padding-left: 20px; font-size: 0.9rem; color: #aaa; line-height: 1.8;">\n        <li>League ID: <code style="color:#f9a825">${league_id}</code></li>\n        <li>Season year: <code style="color:#f9a825">${year}</code></li>\n        <li>All <code style="color:#f9a825">lid_${year}_${league_id}_</code> cache keys</li>\n      </ul>\n      <p style="margin: 0 0 14px; font-size: 0.88rem; color: #aaa;">\n        Bucket and timing keys are <strong>not</strong> affected.\n      </p>\n    `,
      confirmLabel: 'Delete League Cache'
    })
  ) {
    try {
      await MFLCache.clearLeague(year, league_id),
        localStorage.removeItem(`mfl_tabs_${league_id}_${year}`),
        console.log(`[MFLUtils] Cleared league ${league_id} (${year})`)
    } catch (e) {
      console.warn('[MFLUtils] clearLeague error:', e)
    }
    location.reload()
  }
}
async function deleteOtherLeaguesAndReload () {
  if (
    !(await showConfirmModal({
      title: 'Delete All Other League Caches?',
      body: `\n      <p style="margin: 0 0 14px; line-height: 1.5; font-size: 0.95rem;">\n        This will remove cached data for every league <strong>except</strong> your current one:\n      </p>\n      <ul style="margin: 0 0 18px; padding-left: 20px; font-size: 0.9rem; color: #aaa; line-height: 1.8;">\n        <li>All <code style="color:#f9a825">lid_</code> keys <em>not</em> matching <code style="color:#f9a825">lid_${year}_${league_id}_</code></li>\n        <li>Matching <code style="color:#f9a825">mfl_c_lid_</code> localStorage fallback keys</li>\n        <li>Current league <code style="color:#f9a825">${league_id}</code> (${year}) is <strong style="color:#69db7c">preserved</strong></li>\n      </ul>\n    `,
      confirmLabel: 'Delete Other Leagues',
      danger: !1
    }))
  )
    return
  const e = `lid_${year}_${league_id}_`
  try {
    await MFLCache.reconnect()
    const t = (await _idbGetAllKeysPublic()).filter(
      t => t.startsWith('lid_') && !t.startsWith(e)
    )
    if (t.length) {
      const e = _uniqueLeaguePrefixes(t)
      for (const t of e) await MFLCache.clearByPrefix(t)
      console.log(`[MFLUtils] Deleted ${t.length} keys from other leagues`)
    } else console.log('[MFLUtils] No other-league keys found')
  } catch (e) {
    console.warn('[MFLUtils] Other-leagues IDB delete error:', e)
  }
  try {
    Object.keys(localStorage).forEach(t => {
      if (t.startsWith('mfl_c_lid_') && !t.startsWith('mfl_c_' + e))
        try {
          localStorage.removeItem(t)
        } catch (e) {}
    })
  } catch (e) {}
  location.reload()
}
async function deleteAllGlobalAndReload () {
  if (
    await showConfirmModal({
      title: 'Delete All Global Files?',
      body: '\n      <p style="margin: 0 0 14px; line-height: 1.5; font-size: 0.95rem;">\n        This will permanently clear the following global cache entries:\n      </p>\n      <ul style="margin: 0 0 18px; padding-left: 20px; font-size: 0.9rem; color: #aaa; line-height: 1.8;">\n        <li>Year-scoped globals <em>(playerDB, injuries, etc.)</em></li>\n        <li><code style="color:#f9a825">global_newsBreaker</code></li>\n        <li><code style="color:#f9a825">global_weather</code></li>\n        <li>All <code style="color:#f9a825">mfl_c_global_</code> localStorage keys</li>\n      </ul>\n    ',
      confirmLabel: 'Confirm Delete'
    })
  ) {
    try {
      await MFLCache.clearGlobal(year),
        await MFLCache.del('global_newsBreaker'),
        await MFLCache.del('global_weather'),
        _clearLSByPrefixes(['mfl_c_global_']),
        console.log(`[MFLUtils] All global cache entries cleared (${year})`)
    } catch (e) {
      console.warn('[MFLUtils] clearGlobal error:', e)
    }
    location.reload()
  }
}
;(historyUpdateMSG =
  "<script>\nlet historyHPMupdateNotloadedV2 = false;\nlet updateHistoryTime;\nconst HScurrentDate = new Date();\nconst HScurrentMonth = HScurrentDate.getMonth();\nif ([0, 1, 7, 8, 9, 10, 11].includes(HScurrentMonth)) {\n\tfetch('https://mflscripts.com/mfl-apps/history/integrated/' + year + '/leagues/' + league_id + '/hsTime.json')\n\t\t.then(response => response.json())\n\t\t.then(data => {\nif (typeof currentHistoryTime === \"undefined\") {\n    var currentHistoryTime =\n        (typeof currentServerTime !== \"undefined\" && currentServerTime != null)\n            ? Number(currentServerTime) * 1000\n            : Date.now();\n}\n\t\t\tupdateHistoryTime = data.updateHistoryTime;\n\t\t\tconst historyTimeDiff = (currentHistoryTime - updateHistoryTime) / (1000 * 60);\n\t\t\t//console.log(\"History Update Time Countdown to 1440 minutes: \" + historyTimeDiff + \" min. have passed\");\n\t\t\tif (historyTimeDiff >= 1440) {\n\t\t\t\tconst HSiframe = document.createElement(\"iframe\");\n\t\t\t\tHSiframe.src = 'https://mflscripts.com/mfl-apps/history/integrated/createPlayerHistory.php?year=' + year + '&league_id=' + league_id + '&full_history=false';\n\t\t\t\tHSiframe.style.display = \"none\";\n\t\t\t\tdocument.body.appendChild(HSiframe);\n\t\t\t\tconst HSiframe2 = document.createElement(\"iframe\");\n\t\t\t\tHSiframe2.src = 'https://mflscripts.com/mfl-apps/history/integrated/createHistory.php?year=' + year + '&league_id=' + league_id + '&full_history=false';\n\t\t\t\tHSiframe2.style.display = \"none\";\n\t\t\t\tdocument.body.appendChild(HSiframe2);\n\t\t\t\tif (typeof hsSetTimestamp === 'function') {\n\t\t\t\t\thsSetTimestamp();\n\t\t\t\t} else {\n\t\t\t\t\twindow.addEventListener(\"load\", () => {\n\t\t\t\t\t\tif (typeof hsSetTimestamp === 'function') hsSetTimestamp();\n\t\t\t\t\t});\n\t\t\t\t}\n\t\t\t}\n\t\t})\n\t\t.catch(error => {\n\t\t\tif (window.MFL_DEBUG_API) console.log(\"Error retrieving updateHistoryTime:\", error);\n\t\t\tif (typeof hsSetTimestamp === 'function') {\n\t\t\t\thsSetTimestamp();\n\t\t\t} else {\n\t\t\t\twindow.addEventListener(\"load\", () => {\n\t\t\t\t\tif (typeof hsSetTimestamp === 'function') hsSetTimestamp();\n\t\t\t\t});\n\t\t\t}\n\t\t});\n}\n</script>"),
  (function () {
    const e = []
    Object.defineProperty(e, 'push', { value: () => 0, writable: !1 }),
      (window.freestar = window.freestar || {}),
      (freestar.queue = []),
      (freestar.config = freestar.config || {}),
      (freestar.config.enabled_slots = e),
      (freestar.initCallbackCalled = !0),
      (freestar.initCallback = function () {}),
      (freestar.newAdSlots = function () {}),
      (freestar.refresh = function () {})
    const t = [
      'a.pub.network',
      'pub.network',
      'freestar',
      'btloader',
      'confiant',
      'amazon-adsystem',
      'googlesyndication',
      'doubleclick.net',
      'googleadservices',
      'adnxs',
      'criteo',
      'taboola',
      'outbrain'
    ]
    function isAdScript (e) {
      const a = (e.src || '').toLowerCase()
      return t.some(e => a.includes(e))
    }
    function removeAdsNow (e) {
      const a = e && e.querySelectorAll ? e : document
      a
        .querySelectorAll(
          '[data-freestar-ad], [id*="freestar"], [class*="freestar"], .fs-sticky-footer, #myfantasyleague_leaderboard_atf_desktop'
        )
        .forEach(e => e.remove()),
        a.querySelectorAll('iframe').forEach(e => {
          ;(function isAdIframe (e) {
            const a = (e.getAttribute('src') || '').toLowerCase(),
              r = (e.id || '').toLowerCase(),
              o = (e.className || '').toLowerCase()
            if (t.some(e => a.includes(e))) return !0
            if (r.includes('google_ads') || o.includes('google_ads')) return !0
            if (r.includes('freestar') || o.includes('freestar')) return !0
            const n = e.closest?.(
              '[data-freestar-ad], [id*="freestar"], [class*="freestar"], .fs-sticky-footer, [id*="pubnetwork"], [class*="pubnetwork"], [id*="leaderboard"], [class*="leaderboard"]'
            )
            return !!n
          })(e) && e.remove()
        }),
        a.querySelectorAll('script').forEach(e => {
          isAdScript(e) && e.remove()
        }),
        a.querySelectorAll('link[href]').forEach(e => {
          const a = (e.getAttribute('href') || '').toLowerCase()
          t.some(e => a.includes(e)) && e.remove()
        })
    }
    removeAdsNow(document)
    new MutationObserver(e => {
      for (const t of e)
        for (const e of t.addedNodes)
          e &&
            1 === e.nodeType &&
            ('SCRIPT' === e.tagName && isAdScript(e)
              ? e.remove()
              : removeAdsNow(e))
    }).observe(document.documentElement, { childList: !0, subtree: !0 })
  })(),
  window.MFL_DEBUG_API &&
    window.MFLGlobalCache.onReady(() => {
      console.log(
        '%cðŸ“Š MFL CACHED ARRAYS',
        'background:#222; color:#bada55; font-size:14px; padding:4px 8px; border-radius:4px;'
      ),
        console.groupCollapsed('ðŸ“Š rosters api'),
        console.log('reportRoster_ar', reportRoster_ar),
        console.log('mfl_rosters', mfl_rosters),
        console.log('reportCustomPlayer_ar', reportCustomPlayer_ar),
        console.groupEnd(),
        console.groupCollapsed('ðŸ“Š injuries api'),
        console.log('reportInjuries_ar', reportInjuries_ar),
        console.log('mfl_injuries', mfl_injuries),
        console.groupEnd(),
        console.groupCollapsed('ðŸ“Š transactions api'),
        console.log('reportTransactions_ar', reportTransactions_ar),
        console.groupEnd(),
        console.groupCollapsed(
          'ðŸ“° news & weather api (MFL Scripts Hosted Files)'
        ),
        console.log('newsBreaker', newsBreaker),
        console.log('weather', weather),
        console.groupEnd(),
        console.groupCollapsed('ðŸˆ myleagues api'),
        console.log('myLeagues', myLeagues),
        console.groupEnd(),
        console.groupCollapsed('â±ï¸ liveScoring api'),
        console.log('liveScoringLiveWeek', liveScoringLiveWeek),
        console.groupEnd(),
        console.groupCollapsed('â±ï¸ live stats xml'),
        console.log('lsm_stats', lsm_stats),
        console.log('lsm_tstats', lsm_tstats),
        console.groupEnd(),
        console.groupCollapsed('ðŸ‘¤ playerDatabase js file'),
        console.log('playerDatabase', playerDatabase),
        console.groupEnd(),
        console.groupCollapsed('â­ projectedScores api'),
        console.log('reportProjectedScores_ar', reportProjectedScores_ar),
        console.groupEnd(),
        console.groupCollapsed('â­ topStarters api'),
        console.log('reportTopStarters_ar', reportTopStarters_ar),
        console.groupEnd(),
        console.groupCollapsed('ðŸˆ league api'),
        console.log('reportLeague_ar', reportLeague_ar),
        console.log('reportConferences_ar', reportConferences_ar),
        console.log('reportDivisions_ar', reportDivisions_ar),
        console.log('reportDivisionConference_ar', reportDivisionConference_ar),
        console.groupEnd(),
        console.groupCollapsed('ðŸ“ˆ leagueStandings api'),
        console.log('reportStandings_ar', reportStandings_ar),
        console.log('reportStandingsFid_ar', reportStandingsFid_ar),
        console.groupEnd(),
        console.groupCollapsed('ðŸ—“ï¸ nfl_sched.json'),
        console.log('reportNflSchedule_ar', reportNflSchedule_ar),
        console.log('reportNflScheduleFid_ar', reportNflScheduleFid_ar),
        console.log('reportNflScheduleWeek_ar', reportNflScheduleWeek_ar),
        console.log('reportNflByeWeeks_ar', reportNflByeWeeks_ar),
        console.groupEnd(),
        console.groupCollapsed('ðŸ“Š weeklyResults api'),
        console.log('reportWeeklyResults_ar', reportWeeklyResults_ar),
        console.log('reportScoresFid_ar', reportScoresFid_ar),
        console.log('reportScoresAdjFid_ar', reportScoresAdjFid_ar),
        console.log('reportScoresFidBench_ar', reportScoresFidBench_ar),
        console.log(
          'reportScoresFidTiebreakPlayer_ar',
          reportScoresFidTiebreakPlayer_ar
        ),
        console.log(
          'reportScoresFidTiebreakPlayerTracker_ar',
          reportScoresFidTiebreakPlayerTracker_ar
        ),
        console.log('reportScoresWeek_ar', reportScoresWeek_ar),
        console.log('reportScoresWeekAdj_ar', reportScoresWeekAdj_ar),
        console.log('reportMatchupFid_ar', reportMatchupFid_ar),
        console.log('reportHTH_ar', reportHTH_ar),
        console.log('reportSOS_ar', reportSOS_ar),
        console.log('reportSOV_ar', reportSOV_ar),
        console.log('playerScoresWeek_ar', playerScoresWeek_ar),
        console.groupEnd()
    }),
  MFL_DEBUG_API &&
    ((async () => {
      const e = 'cache',
        t = await new Promise((e, t) => {
          const a = indexedDB.open('MFLScripts')
          ;(a.onsuccess = t => e(t.target.result)),
            (a.onerror = e => t(e.target.error))
        }),
        a = await new Promise((a, r) => {
          const o = t.transaction(e, 'readonly').objectStore(e).getAll()
          ;(o.onsuccess = () => a(o.result)), (o.onerror = () => r(o.error))
        })
      let r = 0
      const o = a
        .map(e => {
          const t = new Blob([JSON.stringify(e)]).size
          return (r += t), { key: e.cacheKey, kb: (t / 1024).toFixed(2) }
        })
        .sort((e, t) => t.kb - e.kb)
      console.log(
        `IDB total: ${(r / 1024).toFixed(2)} KB across ${a.length} entries`
      ),
        console.table(o)
    })(),
    (() => {
      let e = 0
      const t = Object.entries(localStorage)
        .map(([t, a]) => {
          const r = new Blob([t + a]).size
          return (e += r), { key: t, kb: (r / 1024).toFixed(2) }
        })
        .sort((e, t) => t.kb - e.kb)
      console.log(
        `localStorage total: ${(e / 1024).toFixed(2)} KB across ${
          t.length
        } keys`
      ),
        console.table(t)
    })()),
  (function (e, t) {
    'use strict'
    if (
      !t.createElementNS ||
      !t.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect
    )
      return
    const a = 'localStorage' in e && null !== e.localStorage
    let r
    const insertSVG = () => t.body.insertAdjacentHTML('afterbegin', r),
      insert = () => {
        t.body ? insertSVG() : t.addEventListener('DOMContentLoaded', insertSVG)
      }
    a &&
    localStorage.getItem('inlineSVGrev') === String(10) &&
    ((r = localStorage.getItem('inlineSVGdata')), r)
      ? insert()
      : fetch('https://www.mflscripts.com/mfl-svg/images/sprites.svg')
          .then(e => {
            if (!e.ok) throw new Error('Network response was not ok.')
            return e.text()
          })
          .then(e => {
            ;(r = e),
              insert(),
              a &&
                (localStorage.setItem('inlineSVGdata', r),
                localStorage.setItem('inlineSVGrev', String(10)))
          })
          .catch(() => {})
  })(window, document)
const loginNotLoaded = !1
function createLoginMenuTemplate (e, t, a) {
  const r = document.querySelector('.myfantasyleague_menu > ul')
  r &&
    r.insertAdjacentHTML(
      'beforeend',
      `\n    <li class="has-sub sub-default" id="slide-menu-login">\n      <a>Login</a>\n      <b aria-haspopup="true" aria-controls="p50"></b>\n      <input id="sub50" type="checkbox">\n      <label for="sub50"><span></span></label>\n      <ul id="p50">\n        <li class="user-login">\n          <a class="no-sub" href="${e}/${t}/login?L=${a}">Login to league</a>\n        </li>\n      </ul>\n    </li>`
    )
}
function populateWelcomeLinksTemplate (e, t, a) {
  fetch(`${e}/${t}/home/${a}?MODULE=WELCOME`)
    .then(e => e.text())
    .then(e => {
      const t = new DOMParser()
          .parseFromString(e, 'text/html')
          .querySelectorAll('#welcome td a'),
        a = document.querySelectorAll('#slide-menu-login ul')
      t.forEach(e => {
        const t = `<li><a class="no-sub" href="${e.href}">${e.textContent}</a></li>`
        a.forEach(e => {
          e.querySelector('.user-login')?.remove(),
            e.insertAdjacentHTML('beforeend', t)
        })
      })
    })
    .catch(e => console.error('populateWelcomeLinksTemplate error:', e))
}
function addLogintoMenu () {
  createLoginMenuTemplate(baseURLDynamic, year, league_id),
    populateWelcomeLinksTemplate(baseURLDynamic, year, league_id)
}
function changeFont (e) {
  const t = document.documentElement,
    a = e.classList.contains('increaseFont'),
    r = parseFloat(getComputedStyle(t).fontSize)
  ;(t.style.fontSize = `${r + (a ? 1 : -1)}px`),
    localStorage.setItem(
      `fontSize_${year}_${league_id}`,
      t.getAttribute('style')
    )
}
function resetFont () {
  ;(document.documentElement.style.fontSize = ''),
    localStorage.setItem(
      `fontSize_${year}_${league_id}`,
      document.documentElement.getAttribute('style') || ''
    )
}
if (
  (addLogintoMenu(),
  void 0 === window.increaseFont && (window.increaseFont = !1),
  increaseFont)
) {
  const o = document.querySelector('.mm-help ul:first-of-type')
  o &&
    o.insertAdjacentHTML(
      'beforeend',
      '\n      <li class="mm_sizing_head"><a>Customize Page Size</a></li>\n      <li title="Click to Zoom Page In">\n        <a class="increaseFont fontChange" onclick="changeFont(this)">Enlarge +</a>\n      </li>\n      <li title="Click to Zoom Page Out">\n        <a class="decreaseFont fontChange" onclick="changeFont(this)">Shrink -</a>\n      </li>\n      <li title="Click to Reset Zoom">\n        <a onclick="resetFont()">Reset</a>\n      </li>'
    )
}
function setTheme (e) {
  localStorage.setItem(`theme_${year}_${league_id}`, e),
    (document.documentElement.className = e)
}
document
  .querySelectorAll(
    '.pageheader, .myfantasyleague_menu li a:empty, div.myfantasyleague_menu ul li:empty'
  )
  .forEach(e => e.remove()),
  (() => {
    const e = localStorage.getItem(`theme_${year}_${league_id}`)
    e && setTheme(e)
  })(),
  document
    .getElementById('logo_svg_inserticon')
    ?.classList.add('nfl-icon-onload')
const skinSelectionEl = () => document.getElementById('myMFLSkinSelection'),
  themeOverlayEl = () => document.querySelector('.ThemeSwith_overlay'),
  menuTriggerEl = () => document.getElementById('menu-trigger')
function openSkinSelector () {
  const e = skinSelectionEl(),
    t = themeOverlayEl(),
    a = menuTriggerEl()
  if (e) {
    ;(e.style.display = 'block'),
      (e.scrollTop = 0),
      (t.style.display = 'block'),
      (a.style.opacity = '0.3'),
      (a.style.pointerEvents = 'none')
    try {
      bodyScrollLock.disableBodyScroll(e)
    } catch {}
  }
}
function closeSkinSelector () {
  const e = skinSelectionEl(),
    t = themeOverlayEl(),
    a = menuTriggerEl()
  if (e) {
    ;(e.style.display = 'none'),
      (t.style.display = 'none'),
      (a.style.opacity = ''),
      (a.style.pointerEvents = '')
    try {
      bodyScrollLock.enableBodyScroll(e)
    } catch {}
  }
}
if (
  (document
    .querySelectorAll('.MFLSkinSelectionbtn')
    .forEach(e => e.addEventListener('click', openSkinSelector)),
  document
    .querySelectorAll('#myMFLSkinSelection a')
    .forEach(e => e.addEventListener('click', closeSkinSelector)),
  document
    .querySelectorAll('.ThemeSwith_overlay, #myMFLSkinSelection .as_close_btn')
    .forEach(e => e.addEventListener('click', closeSkinSelector)),
  void 0 === window.add_abilities_link && (window.add_abilities_link = !1),
  void 0 === window.add_seedings_link && (window.add_seedings_link = !1),
  add_abilities_link)
) {
  const n = document.querySelector(
    '.myfantasyleague_menu li.mm-league a[href*="commissioner_setup"]'
  )
  if (n) {
    const i = document.createElement('li'),
      s = document.createElement('a')
    s.classList.add('no-sub'),
      (s.href = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=MESSAGE${SetHPMability}`),
      (s.textContent = 'Custom Abilities'),
      i.appendChild(s),
      n.parentElement.insertAdjacentElement('afterend', i)
  }
}
function footerAlign () {
  const e = document.querySelector('footer'),
    t = document.querySelector('#vsubmenu.vsub_shift')
  if (!e) return
  e.style.cssText = 'display:block;height:auto'
  const a = e.offsetHeight
  ;(document.body.style.paddingBottom = `${a}px`),
    (e.style.height = `${a}px`),
    t && (t.style.marginBottom = `${a + 10}px`)
}
add_seedings_link &&
  document.addEventListener('DOMContentLoaded', () => {
    const e = [...document.querySelectorAll('a')].find(
      e =>
        e.textContent.includes('Projected') &&
        e.textContent.includes('Playoff') &&
        e.textContent.includes('Seedings')
    )
    e &&
      (e.href = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=MESSAGE${SetHPMseeding}`)
  }),
  document.addEventListener('DOMContentLoaded', () => {
    if (!('undefined' != typeof franchise_id)) return
    const e = document.URL
    if (
      !(e.endsWith('O=01') || e.endsWith('O=07') || e.includes('O=07&DISPLAY'))
    )
      return
    const t = document.querySelectorAll(
      'table.report:not(#welcome,#player_search,.toggle_module_login table.report,.toggle_module_search table.report,.mm-module .report)'
    )
    for (let e = 0; e < t.length; e++) {
      const a = t[e].innerHTML
      if (
        a.includes(`FID=${franchise_id}`) ||
        a.includes(`franchise_${franchise_id}`)
      ) {
        const r = t[0].innerHTML
        ;(t[0].innerHTML = a), (t[e].innerHTML = r)
        break
      }
    }
  }),
  document.addEventListener('DOMContentLoaded', footerAlign),
  window.addEventListener('resize', footerAlign),
  document.addEventListener('DOMContentLoaded', () => {
    ;['body_adp', 'body_aav'].forEach(e => {
      const t = document.querySelector(`#${e} #container-wrap`)
      t &&
        (t.querySelectorAll('.report').forEach(e => {
          const t = document.createElement('div')
          ;(t.className = 'mobile-wrap'),
            e.parentNode.insertBefore(t, e),
            t.appendChild(e)
        }),
        t.querySelectorAll('form').forEach(e => e.classList.add('reportform')),
        t.querySelectorAll('h2, h3').forEach(e => e.classList.add('h3-menu')),
        t.querySelectorAll('.reportnavigation, blockquote').forEach(e => {
          e.textContent.includes('Hint:') &&
            (e.className = 'alert alert-info-body')
        }))
    })
  })
const apiStyle = document.createElement('style')
let mflUpdateYear, mflUpdateID, mflUpdateServer
if (
  ((apiStyle.textContent = '#body_api_info #container-wrap { display: none }'),
  document.head.appendChild(apiStyle),
  setTimeout(() => {
    const e = document.querySelector('#body_api_info #container-wrap')
    if (!e) return
    const t = e.querySelector('.pagebody')
    if (t && !t.querySelector('.mobile-wrap')) {
      const e = document.createElement('div')
      for (e.className = 'mobile-wrap'; t.firstChild; )
        e.appendChild(t.firstChild)
      t.appendChild(e)
    }
    const a = e.querySelector('form[action="api_info"]')
    a && (a.style.textAlign = 'center'),
      t?.classList.remove('mobile-wrap'),
      (e.style.display = 'block')
  }, 700),
  $(document).on(
    'click',
    'form[action*="copy_league"] input[type="submit"]',
    function () {
      ;(MFL_updatedSerID = baseURLStatic.substr(
        baseURLStatic.indexOf('www') + 3,
        2
      )),
        localStorage.setItem('MFL_updatedYear', year),
        localStorage.setItem('MFL_updatedID', league_id),
        localStorage.setItem('MFL_updatedSERVER', MFL_updatedSerID)
    }
  ),
  null !== localStorage.getItem('MFL_updatedYear'))
) {
  const l = 100,
    c = 3e3,
    d = setInterval(() => {
      document.querySelector('#MFLPlayerPopupContainer') &&
        (MFLPlayerPopupClose(), clearInterval(d))
    }, l)
  setTimeout(() => {
    clearInterval(d)
  }, c),
    $('body').css('pointer-events', 'none'),
    $('body').append(
      '<div class="mflUpdateWrap" style="display:block;z-index:9999999999!important"></div><div style="display:block;z-index:9999999999!important" id="mflUpdateWrapContent"><table><caption><span>MFL Scripts: Template Update</span></caption><tbody><tr class="oddtablerow"><td>Do not leave page until MFL Scripts updates all Homepage Messages from your previous season to the new season.</td></tr><tr class="eventablerow"><td>Approximate wait time is 10 seconds</td></tr><tr class="oddtablerow"><td>This page will refresh when completed</td></tr></tbody></table></div>'
    ),
    (mflUpdateYear = localStorage.getItem('MFL_updatedYear')),
    (mflUpdateID = localStorage.getItem('MFL_updatedID')),
    (mflUpdateServer = localStorage.getItem('MFL_updatedSERVER')),
    localStorage.removeItem('MFL_updatedYear'),
    localStorage.removeItem('MFL_updatedID'),
    localStorage.removeItem('MFL_updatedSERVER'),
    mflUpdateTransferHPMs()
}
function mflUpdateTransferHPMs () {
  ajaTransfer = !0
  var e = 0,
    t = setInterval(function () {
      ajaTransfer &&
        ((ajaTransfer = !1),
        e <= 30
          ? ((urlGET =
              1 === e
                ? 'https://www' +
                  mflUpdateServer +
                  '.myfantasyleague.com/' +
                  mflUpdateYear +
                  '/csetup?L=' +
                  mflUpdateID +
                  '&C=HMPGMSG&PRINTER=1'
                : 'https://www' +
                  mflUpdateServer +
                  '.myfantasyleague.com/' +
                  mflUpdateYear +
                  '/csetup?L=' +
                  mflUpdateID +
                  '&C=HMPGMSG&SEQNO=' +
                  e +
                  '&PRINTER=1'),
            $.ajax({
              url: urlGET,
              type: 'GET',
              dataType: 'html',
              xhrFields: { withCredentials: !0 },
              success: function (t) {
                ;(hpm_txt = $(t).find('#MSG').val()),
                  (hpm_name = $(t)
                    .find('form table.report input[name="LABEL"]')
                    .val()),
                  (isFooter = $(t).find('#IN_FOOTER_Yes[checked="checked"]')),
                  (isHeader = $(t).find('#IN_HEADER_Yes[checked="checked"]')),
                  isFooter.length > 0
                    ? (urlPOST =
                        1 === e
                          ? baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message&IN_FOOTER=Yes'
                          : baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message' +
                            e +
                            '&IN_FOOTER=Yes')
                    : isHeader.length > 0
                    ? (urlPOST =
                        1 === e
                          ? baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message&IN_HEADER=Yes'
                          : baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message' +
                            e +
                            '&IN_HEADER=Yes')
                    : (urlPOST =
                        1 === e
                          ? baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message'
                          : baseURLDynamic +
                            '/' +
                            year +
                            '/message?LEAGUE_ID=' +
                            league_id +
                            '&NAME=message' +
                            e),
                  $.ajax({
                    url: urlPOST,
                    xhrFields: { withCredentials: !0 },
                    data: { MSG: hpm_txt, LABEL: hpm_name },
                    cache: !1,
                    type: 'POST',
                    success: function (t) {
                      ;(ajaTransfer = !0),
                        (hpm_txt = void 0),
                        (hpm_name = void 0),
                        (isFooter = void 0),
                        (isHeader = void 0),
                        (urlPOST = void 0),
                        e++
                    },
                    error: function (t) {
                      e++
                    }
                  })
              },
              error: function (t) {
                e++
              }
            }))
          : (clearInterval(t),
            (ajaTransfer = void 0),
            $('body').css('pointer-events', ''),
            setTimeout(() => {
              location.reload()
            }, 100)))
    }, 400)
}
if (load_tabs_script) {
  let p, u
  void 0 === window.showTabsAllPages && (window.showTabsAllPages = !0),
    void 0 === window.changeMainTabName && (window.changeMainTabName = 'Home'),
    void 0 === window.swipeHPM && (window.swipeHPM = !1),
    void 0 === window.swipePosition && (window.swipePosition = 'content')
  const m = 0,
    f = 50
  let h,
    y,
    _ = !1
  const qs = (e, t = document) => t.querySelector(e),
    qsa = (e, t = document) => Array.from(t.querySelectorAll(e)),
    isHomePage = () =>
      !!qs('#body_home') &&
      qs('#body_home') &&
      !location.href.includes('MODULE=MESSAGE')
  if (showTabsAllPages || isHomePage()) {
    const g = document.createElement('style')
    ;(g.textContent = [
      'div.myfantasyleague_tabmenu.main_tabmenu { display: none }',
      '.myfantasyleague_tabmenu.all_page #homepagetabs li a { text-decoration: none }',
      '.myfantasyleague_tabmenu.all_page li a { display: flex; flex-grow: 1; flex-shrink: 1; justify-content: center }'
    ].join('')),
      document.head.appendChild(g)
    const b = `\n      <div id="tabmenu-wrap" style="padding: 0 0.188rem">\n        <div class="myfantasyleague_tabmenu all_page" style="display: block">\n          <span id="tab_title"></span>\n          <input id="sub100" type="checkbox">\n          <label for="sub100"><span></span></label>\n          <ul id="homepagetabs" class="customhomepagetabs" style="font-size:0">\n            <li id="tab0" onclick="show_tab('0');" class="">\n              <a class="tab_link" href="${baseURLDynamic}/${year}/home/${league_id}#0">\n                Home\n                <input id="sub100" type="checkbox">\n                <label for="sub100"></label>\n              </a>\n            </li>\n          </ul>\n        </div>\n      </div>`
    document.currentScript.insertAdjacentHTML('beforebegin', b)
    const w = `mfl_tabs_${league_id}_${year}`,
      k = 216e5
    function getTabsCache () {
      try {
        const e = localStorage.getItem(w)
        if (!e) return null
        const { ts: t, tabNames: a } = JSON.parse(e)
        return Date.now() - t > k ? (localStorage.removeItem(w), null) : a
      } catch {
        return null
      }
    }
    function setTabsCache (e) {
      try {
        localStorage.setItem(w, JSON.stringify({ ts: Date.now(), tabNames: e }))
      } catch (e) {
        console.warn('Tab cache write failed:', e)
      }
    }
    function extractTabNames (e) {
      return [
        ...new DOMParser()
          .parseFromString(e, 'text/html')
          .querySelectorAll(
            '.myfantasyleague_tabmenu.main_tabmenu ul#homepagetabs li'
          )
      ].map(e => e.querySelector('a').firstChild.textContent.trim())
    }
    const L = getTabsCache(),
      P = L
        ? Promise.resolve(L)
        : fetch(`${baseURLDynamic}/${year}/home/${league_id}?PRINTER=1`)
            .then(e => {
              if (!e.ok) throw new Error(`HTTP ${e.status}`)
              return e.text()
            })
            .then(e => {
              const t = extractTabNames(e)
              return setTabsCache(t), t
            })
    P.then(e => {
      '' !== changeMainTabName && (e[0] = changeMainTabName)
      let t = e
          .map(
            (e, t) =>
              `\n                <li id="tab${t}" onclick="show_tab('${t}');" class="">\n                  <a class="tab_link" href="${baseURLDynamic}/${year}/home/${league_id}#${t}">\n                    ${e}\n                    <input id="sub100" type="checkbox">\n                    <label for="sub100"></label>\n                  </a>\n                </li>`
          )
          .join(''),
        a = e.length
      for (const [e, { href: r, target: o }] of Object.entries(
        MFL_customTabs_FakeTabs
      ))
        (t += `\n                <li id="tab${a}" class="disable_sort">\n                  <a href="${r}#${a}" target="${o}">${e}</a>\n                </li>`),
          a++
      const r = qs('.customhomepagetabs')
      r && (r.innerHTML = t),
        qsa(
          '.myfantasyleague_tabmenu.all_page ul#homepagetabs li label'
        ).forEach(e => (e.style.display = 'none'))
      const o = qs(`#tab${location.hash.slice(1)}`)
      o && o.classList.add('currenttab'),
        location.href.includes('MODULE=') ||
          (qsa(
            '#body_home .myfantasyleague_tabmenu.all_page li a.tab_link'
          ).forEach(e => e.removeAttribute('href')),
          qsa(
            '#body_home .myfantasyleague_tabmenu.all_page ul#homepagetabs li label'
          ).forEach(e => (e.style.display = 'block'))),
        setTabTitle()
      try {
        doAppendIcon()
      } catch (e) {}
    }).catch(e => console.error('Tabs fetch error:', e))
  }
  function setTabTitle () {
    const e = qs('#tab_title'),
      t = qs(`#tab${location.hash.slice(1)}`)
    if (t) return void (e.textContent = t?.textContent?.trim() ?? '')
    e.textContent =
      {
        options_07: 'Rosters',
        lineup: 'Lineup',
        standings: 'Standings',
        options_06: 'Lineup',
        options_79: 'Playoff',
        select_franchise: 'Select Franchise',
        commissioner_setup: 'Settings',
        options_22: 'Scoring'
      }[thisProgram] ?? 'Home'
  }
  function initTopLevelTabs (e = document) {
    qsa('#myfantasyleague_tabs', e)
      .filter(
        e =>
          e.querySelector('.myfantasyleague_tabmenu .tabName') &&
          !e.classList.contains('initialized') &&
          !e.querySelector('#homepagetabs > li[onclick]')
      )
      .forEach(e => {
        e.classList.add('initialized')
        const t = qs('.myfantasyleague_tabmenu', e),
          a = qsa('#homepagetabs > li', t),
          r = qsa('.tabs_scroll > .homepagetabcontent', e),
          o = qs('.tabName', t)
        qs('.tabLabel', t)?.addEventListener('click', () => {
          if (e.classList.contains('nested-tabs')) return
          const a = qs('input[type="checkbox"]', t)
          a && (a.checked = !a.checked)
        }),
          r.forEach(e => (e.style.display = 'none'))
        const n = qs('.currenttab', t)
        if (n) {
          const e = a.indexOf(n)
          e > -1 && r[e] && (r[e].style.display = 'block'),
            o && (o.textContent = n.textContent.trim())
        }
        r.forEach(e => initNestedTabs(e)),
          a.forEach((t, n) => {
            t.addEventListener('click', () => {
              e.classList.contains('nested-tabs') ||
                (a.forEach(e => e.classList.remove('currenttab')),
                t.classList.add('currenttab'),
                r.forEach(e => (e.style.display = 'none')),
                r[n] && ((r[n].style.display = 'block'), initNestedTabs(r[n])),
                o && (o.textContent = t.textContent.trim()),
                closeDropdown(t))
            })
          })
      })
  }
  function initNestedTabs (e) {
    qsa('#myfantasyleague_tabs', e)
      .filter(
        e =>
          !e.classList.contains('initialized') &&
          !e.querySelector('#homepagetabs > li[onclick]')
      )
      .forEach(e => {
        e.classList.add('initialized', 'nested-tabs')
        const t = qs('.myfantasyleague_tabmenu', e),
          a = qsa('#homepagetabs > li', t),
          r = qsa('.homepagetabcontent', e),
          o = qs('.tabName', t)
        qs('.tabLabel', t)?.addEventListener('click', e => {
          e.stopPropagation()
          const a = qs('input[type="checkbox"]', t)
          a && (a.checked = !a.checked)
        }),
          r.forEach(e => (e.style.display = 'none'))
        const n = qs('.currenttab', t)
        if (n) {
          const e = a.indexOf(n)
          e > -1 && r[e] && (r[e].style.display = 'block')
        }
        a.forEach((e, t) => {
          e.addEventListener('click', n => {
            n.stopPropagation(),
              a.forEach(e => e.classList.remove('currenttab')),
              e.classList.add('currenttab'),
              r.forEach(e => (e.style.display = 'none')),
              r[t] && (r[t].style.display = 'block'),
              o && (o.textContent = e.textContent.trim()),
              closeDropdown(e)
          })
        })
      })
  }
  function closeDropdown (e) {
    const t = e.closest('.toggle_tabs')?.querySelector('input[type="checkbox"]')
    t && (t.checked = !1)
  }
  function fixReportTableWrappers () {
    qs('#myfantasyleague_tabs > table.report')?.parentElement?.classList.add(
      'mobile-wrap'
    ),
      qsa('div.mobile-wrap #myfantasyleague_tabs > table.report').forEach(e =>
        e.parentElement?.classList.remove('mobile-wrap')
      )
    const e = [
      '#custom_draftroom #myfantasyleague_tabs .mobile-wrap table',
      '#overview_wrapper.mobile-wrap table',
      '#league-history-wrapper.mobile-wrap table'
    ].join(', ')
    qsa('#myfantasyleague_tabs .mobile-wrap table')
      .filter(t => !t.matches(e))
      .forEach(e => e.parentElement?.replaceWith(e))
  }
  function initSwipe () {
    const e = qs('#home .myfantasyleague_tabmenu')
    if (!e || !swipeHPM || location.href.includes('MODULE=')) return
    qsa(
      '#home .homepagetabcontent:not(#home .homepagetabcontent .homepagetabcontent)'
    ).forEach(e => e.classList.add('swipeContent')),
      e.classList.add('swipeTabs')
    const t = qsa('#home .swipeTabs li:not(.disable_sort)'),
      a = qs('#home .swipeTabs li.currenttab:not(.disable_sort)')
    if (a) {
      p = parseInt(a.id.replace('tab', ''), 10)
      const e = t.at(-1)
      e && (u = parseInt(e.id.replace('tab', ''), 10))
    }
    if (
      (t.forEach(e => {
        e.addEventListener('click', () => {
          p = parseInt(e.id.replace('tab', ''), 10)
          const a = t.at(-1)
          a && (u = parseInt(a.id.replace('tab', ''), 10))
        })
      }),
      'content' === swipePosition)
    ) {
      const e = document.createElement('style')
      ;(e.textContent = '.swipeContent { min-height: 200px }'),
        document.head.appendChild(e),
        document.addEventListener('touchstart', e => {
          e.target.closest('.swipeContent') &&
            ((h = e.changedTouches[0].pageX), (_ = !1))
        }),
        document.addEventListener('touchmove', e => {
          const t = e.target.closest('.swipeContent')
          t &&
            t.scrollLeft > 0 &&
            t.scrollLeft < t.scrollWidth - t.clientWidth &&
            (_ = !0)
        }),
        document.addEventListener('touchend', e => {
          !_ &&
            e.target.closest('.swipeContent') &&
            ((y = e.changedTouches[0].pageX - h),
            Math.abs(y) >= f &&
              ((p = y > 0 ? (0 === p ? u : p - 1) : p === u ? m : p + 1),
              show_tab(p)))
        })
    }
    if ('tabs' === swipePosition) {
      const e = qsa(
        '#home .myfantasyleague_tabmenu.swipeTabs li:not(.disable_sort)'
      ).map(e => parseInt(e.id.replace('tab', ''), 10))
      document.addEventListener('touchstart', e => {
        e.target.closest('#home .myfantasyleague_tabmenu.swipeTabs') &&
          (h = e.changedTouches[0].pageX)
      }),
        document.addEventListener('touchend', t => {
          if (
            t.target.closest('#home .myfantasyleague_tabmenu.swipeTabs') &&
            ((y = t.changedTouches[0].pageX - h), Math.abs(y) >= f)
          ) {
            let t = e.indexOf(p)
            ;(t =
              y > 0
                ? 0 === t
                  ? e.length - 1
                  : t - 1
                : t === e.length - 1
                ? 0
                : t + 1),
              (p = e[t]),
              show_tab(p)
          }
        })
    }
  }
  function show_custom_tab (e) {
    const t = parseInt(e),
      a = Math.pow(10, t.toString().length - 1),
      r = Math.floor(t / a) * a,
      o = 100 * Math.floor((t - r) / 100)
    let n = o + r
    for (;;) {
      const e = document.getElementById(`tabcontent${n}`),
        a = document.getElementById(`tab${n}`)
      if (!e || !a) break
      const i = n === t
      if (
        ((e.style.display = i ? '' : 'none'),
        (a.className = i ? 'currenttab' : ''),
        i)
      ) {
        const e = document.getElementById(`tab_title_${o + r}`)
        e && (e.innerHTML = a.firstChild?.text ?? '')
      }
      n++
    }
  }
  function show_tab (e) {
    let t = 0
    for (;;) {
      const a = document.getElementById(`tabcontent${t}`),
        r = document.getElementById(`tab${t}`)
      if (!a) break
      const o = t == e
      if (
        ((a.style.display = o ? '' : 'none'),
        r && (r.className = o ? 'currenttab' : ''),
        o)
      ) {
        const t = document.getElementById('tab_title')
        if (t) {
          const a =
            document
              .getElementById(`tab${e}`)
              ?.querySelector('a')
              ?.textContent?.trim() ?? ''
          ;(t.textContent = a), (t.className = ''), t.classList.add(`tab${e}`)
        }
      }
      t++
    }
    location.hash = e
  }
  document.addEventListener('DOMContentLoaded', () => {
    qs('div.myfantasyleague_tabmenu.main_tabmenu')?.remove()
    try {
      doAppendIcon()
    } catch (e) {}
    initTopLevelTabs(), fixReportTableWrappers(), setTimeout(initSwipe, 1e3)
  })
}
if (load_mobileMenu_script) {
  void 0 === window.menuPositionY && (window.menuPositionY = 10),
    void 0 === window.menuPositionIsLeft && (window.menuPositionIsLeft = !0),
    void 0 === window.showMenuIcons && (window.showMenuIcons = !0),
    void 0 === window.usePopupLogin && (window.usePopupLogin = !1),
    void 0 === window.loginNotLoaded && (window.loginNotLoaded = !0),
    void 0 === window.MFLPopupNotifyFontAwesome &&
      (window.MFLPopupNotifyFontAwesome =
        '<i class="fa-regular fa-circle-exclamation MFLPopupFontAwesome MFLPopupFontAwesomeMenu MFLPopupNotify" aria-hidden="true"></i>')
  const S = 250
  if (loginNotLoaded) {
    function createLoginMenu (e, t, a) {
      const r = document.querySelector('.myfantasyleague_menu > ul')
      r &&
        r.insertAdjacentHTML(
          'beforeend',
          `\n        <li class="has-sub sub-default" id="slide-menu-login">\n          <a>Login</a>\n          <b aria-haspopup="true" aria-controls="p50"></b>\n          <input id="sub50" type="checkbox">\n          <label for="sub50"><span></span></label>\n          <ul id="p50">\n            <li class="user-login">\n              <a class="no-sub" href="${e}/${t}/login?L=${a}">Login to league</a>\n            </li>\n          </ul>\n        </li>`
        )
    }
    function populateWelcomeLinks (e, t, a) {
      fetch(`${e}/${t}/home/${a}?MODULE=WELCOME`)
        .then(e => e.text())
        .then(e => {
          const t = new DOMParser()
              .parseFromString(e, 'text/html')
              .querySelectorAll('#welcome td a'),
            a = document.querySelectorAll('#slide-menu-login ul')
          t.forEach(e => {
            const t = `<li><a class="no-sub" href="${e.href}">${e.textContent}</a></li>`
            a.forEach(e => {
              e.querySelector('.user-login')?.remove(),
                e.insertAdjacentHTML('beforeend', t)
            })
          })
        })
        .catch(e => console.error('populateWelcomeLinks error:', e))
    }
    createLoginMenu(baseURLDynamic, year, league_id),
      populateWelcomeLinks(baseURLDynamic, year, league_id)
  }
  document.body.insertAdjacentHTML(
    'afterbegin',
    '\n    <div id="menu-trigger" style="display:none">\n      <div class="hamburger hamburger--spin js-hamburger">\n        <div class="hamburger-box">\n          <div class="hamburger-inner"></div>\n        </div>\n      </div>\n    </div>\n    <div id="menu-overlay" class="menu-overlayclass" style="display:none"></div>\n    <div id="click-blocker" style="display:none"></div>'
  )
  const M = document.querySelector('.myfantasyleague_menu')
  if (M) {
    const O = document.createElement('div')
    ;(O.className = 'myfantasyleague_menuMobile'),
      M.parentNode.insertBefore(O, M),
      (O.innerHTML = M.innerHTML),
      O.querySelectorAll('.has-sub.sub-default > a').forEach(e => {
        const t = document.createElement('span')
        ;(t.className = 'menu_arrow'), e.appendChild(t)
      })
    const W = O.querySelector('ul')
    W &&
      W.insertAdjacentHTML(
        'beforeend',
        '\n        <li class="has-sub sub-default" style="visibility:hidden"><a>Blank</a><ul></ul></li>\n        <li class="has-sub sub-default" style="visibility:hidden"><a>Blank</a><ul></ul></li>'
      ),
      O.querySelectorAll('.has-sub.sub-default ul').forEach(
        e => (e.style.display = 'none')
      ),
      O.querySelectorAll('a').forEach(e => {
        if (
          !e.textContent.includes('League') ||
          !e.textContent.includes('Chat')
        )
          return
        const t = document.createElement('a')
        ;(t.href = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=LEAGUE_CHAT`),
          (t.textContent = 'League Chat'),
          (t.target = '_blank'),
          t.addEventListener('click', function () {
            return openChatWindow(this), !1
          }),
          e.replaceWith(t)
      }),
      O.querySelectorAll('ul li').forEach(e => {
        e.textContent.includes('My Leagues') &&
          e.querySelector('a')?.textContent.includes('$75,000') &&
          e.remove()
      })
    const j = O.querySelectorAll('ul > li a.no-sub')
    j[1]?.parentElement.classList.add('mm-home')
    const H = document.createElement('div')
    ;(H.id = 'icon-wrapper-mobile'),
      (H.style.cssText = 'float:left;display:none'),
      (H.innerHTML = `\n      <li class="notification-icon-popup" title="Notifications" style="display:none">\n        <span onclick="MFLPlayerPopupPopulateOnload(true)">${MFLPopupNotifyFontAwesome}</span>\n      </li>\n      <li style="display:none" onclick="location.href='${baseURLDynamic}/${year}/mb/message_list.pl?bid=${year}${league_id}'"\n          class="notification-icon-new-mb-private-message addon-icons-mobile" title="New Private Message!">\n        <i class="fa-regular fa-inbox fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>\n      <li style="display:none" onclick="location.href='${baseURLDynamic}/${year}/options?L=${league_id}&O=28'"\n          class="notification-icon-new-mb-message addon-icons-mobile" title="New Message Board Post!">\n        <i class="fa-regular fa-comments fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>\n      <li style="display:none" onclick="location.href='${baseURLDynamic}/${year}/options?L=${league_id}&O=69'"\n          class="notification-icon-new-poll addon-icons-mobile" title="Vote Required!">\n        <i class="fa-regular fa-check-to-slot fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>\n      <li style="display:none" onclick="location.href='${baseURLDynamic}/${year}/csetup?L=${league_id}&C=REVTRAD'"\n          class="notification-pending-trade addon-icons-mobile" title="Pending Trade to Approve!">\n        <i class="fa-regular fa-triangle-exclamation fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>\n      <li style="display:none" onclick="alert('You have ${leagueAttributes.PendingTradesAwaitingCommishApproval} trade(s) awaiting Commissioner Approval!')"\n          class="notification-awaiting-approval addon-icons-mobile" title="Trade(s) Awaiting Commissioner Approval!">\n        <i class="fa-regular fa-hourglass-half fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>\n      <li style="display:none" onclick="location.href='${baseURLDynamic}/${year}/options?L=${league_id}&O=05'"\n          class="notification-outstandings-offers-received addon-icons-mobile" title="You have been offered a trade!">\n        <i class="fa-regular fa-handshake fa-beat MFLPopupFontAwesomeMenu"></i>\n      </li>`),
      O.appendChild(H)
  }
  function slideUp (e, t = 500) {
    ;(e.style.height = `${e.offsetHeight}px`),
      e.offsetHeight,
      (e.style.transition = `height ${t}ms ease`),
      (e.style.overflow = 'hidden'),
      (e.style.height = '0'),
      setTimeout(() => {
        ;(e.style.display = 'none'),
          e.style.removeProperty('height'),
          e.style.removeProperty('overflow'),
          e.style.removeProperty('transition')
      }, t)
  }
  function slideDown (e, t = 500) {
    if ('none' !== window.getComputedStyle(e).display) return
    e.style.display = 'block'
    const a = e.scrollHeight
    ;(e.style.height = '0'),
      (e.style.overflow = 'hidden'),
      (e.style.transition = `height ${t}ms ease`),
      e.offsetHeight,
      (e.style.height = `${a}px`),
      setTimeout(() => {
        e.style.removeProperty('height'),
          e.style.removeProperty('overflow'),
          e.style.removeProperty('transition')
      }, t)
  }
  function syncArrowClasses () {
    document.querySelectorAll('.myfantasyleague_menuMobile ul').forEach(e => {
      e.parentElement.classList.remove('arrow-down', 'sub-arrow-down')
    }),
      document
        .querySelectorAll('.myfantasyleague_menuMobile ul.thisExpanded')
        .forEach(e => {
          e.parentElement.classList.add(
            e.closest('.myfantasyleague_menuMobile > ul > li > ul')
              ? 'sub-arrow-down'
              : 'arrow-down'
          )
        })
  }
  document
    .querySelectorAll(
      '.myfantasyleague_menuMobile > ul > li.has-sub.sub-default > a'
    )
    .forEach(e => {
      e.addEventListener('click', () => {
        const t = document.querySelectorAll(
            '.myfantasyleague_menuMobile > ul > li.has-sub.sub-default > ul'
          ),
          a = document.querySelectorAll(
            '.myfantasyleague_menuMobile > ul > li.has-sub.sub-default > ul > li > ul'
          ),
          r = e.parentElement.querySelector('ul'),
          o = document.querySelectorAll('.myfantasyleague_menuMobile > ul > li')
        o.forEach(e => (e.style.pointerEvents = 'none')),
          t.forEach(e => {
            e !== r &&
              (slideUp(e), e.classList.remove('thisExpanded', 'lastClicked'))
          }),
          a.forEach(e => {
            slideUp(e), e.classList.remove('thisExpanded', 'lastClicked')
          }),
          r.classList.contains('thisExpanded')
            ? (slideUp(r), r.classList.remove('thisExpanded'))
            : (slideDown(r), r.classList.add('thisExpanded')),
          r.classList.add('lastClicked'),
          syncArrowClasses(),
          setTimeout(
            () => o.forEach(e => e.style.removeProperty('pointer-events')),
            500
          )
      })
    }),
    document
      .querySelectorAll(
        '.myfantasyleague_menuMobile > ul > li.has-sub.sub-default > ul > li > a'
      )
      .forEach(e => {
        e.addEventListener('click', t => {
          t.stopPropagation()
          const a = document.querySelectorAll(
              '.myfantasyleague_menuMobile > ul > li.has-sub.sub-default > ul > li > ul'
            ),
            r = e.parentElement.querySelector('ul')
          a.forEach(e => {
            e !== r &&
              (slideUp(e), e.classList.remove('thisExpanded', 'lastClicked'))
          }),
            r?.classList.contains('thisExpanded')
              ? (slideUp(r), r.classList.remove('thisExpanded'))
              : r && (slideDown(r), r.classList.add('thisExpanded')),
            a.forEach(e => e.classList.remove('lastClicked')),
            r?.classList.add('lastClicked'),
            syncArrowClasses()
        })
      })
  const F = document.querySelector('#menu-trigger'),
    x = document.querySelector('.myfantasyleague_menuMobile'),
    T = document.querySelector('#menu-overlay'),
    C = document.querySelector('#click-blocker'),
    B = document.querySelector('.hamburger'),
    A = 400,
    D = menuPositionIsLeft ? 'marginLeft' : 'marginRight',
    E = menuPositionIsLeft ? 'margin-left' : 'margin-right',
    N = document.createElement('style')
  function isMenuOpen () {
    return (parseFloat(getComputedStyle(F)[D]) || 0) >= S - 1
  }
  function resetMenuItems () {
    document
      .querySelectorAll('.myfantasyleague_menuMobile ul li')
      .forEach(e => e.classList.remove('arrow-down', 'sub-arrow-down')),
      document
        .querySelectorAll(
          '.myfantasyleague_menuMobile ul li.has-sub.sub-default ul'
        )
        .forEach(e => {
          e.classList.remove('thisExpanded'), (e.style.display = 'none')
        }),
      document
        .querySelector('.skinSelectorContainer')
        ?.style.setProperty('display', 'none')
  }
  function openMenu () {
    ;(F.style[D] = `${S}px`),
      (x.style[D] = '0px'),
      (T.style.display = 'block'),
      document.documentElement.classList.add('mobile-menu-open'),
      document.body.classList.add('mobile-menu-open'),
      B.classList.add('is-active')
  }
  function closeMenu () {
    ;(F.style[D] = '0px'),
      (x.style[D] = `-${S}px`),
      (T.style.display = 'none'),
      document.documentElement.classList.remove('mobile-menu-open'),
      document.body.classList.remove('mobile-menu-open'),
      B.classList.remove('is-active'),
      resetMenuItems()
  }
  ;(N.textContent = `\n  #menu-trigger, .myfantasyleague_menuMobile {\n    transition: ${E} ${A}ms ease;\n  }`),
    document.head.appendChild(N),
    F.addEventListener('click', () => {
      isMenuOpen() ? closeMenu() : openMenu()
    }),
    T.addEventListener('click', () => {
      ;(C.style.display = 'block'),
        closeMenu(),
        setTimeout(() => (C.style.display = 'none'), A)
    })
  const I = document.createElement('style')
  ;(I.textContent = `\n    .myfantasyleague_menuMobile li a{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}\n    .myfantasyleague_menuMobile{display:none;position:fixed;z-index:99999999;width:15.625rem;overflow-y:auto;-webkit-overflow-scrolling:touch;height:100%}\n    #menu-trigger{position:fixed;top:${menuPositionY}${
    useREM ? 'rem' : 'px'
  };padding:0.313rem;z-index:9999999;cursor:pointer;font-size:2.25rem;line-height:2.5rem;height:3rem;width:2.625rem;text-align:center}\n    .myfantasyleague_menuMobile #icon-wrapper-mobile{position:absolute;left:auto;display:block;z-index:1;font-size:1.5rem;top:0;right:0.438rem}\n    .myfantasyleague_menuMobile #icon-wrapper-mobile i{line-height:2.563rem;padding-top:0}\n    .myfantasyleague_menuMobile #skinSelectorContainer{margin:0;position:fixed;top:2.5rem}\n    .myfantasyleague_menuMobile li.notification-icon-search,.myfantasyleague_menuMobile .toggle_module_search{display:none!important}\n    .myfantasyleague_menuMobile #icon-wrapper-mobile img{margin:0!important}\n    .myfantasyleague_menuMobile li{list-style:none;cursor:pointer}\n    .myfantasyleague_menuMobile li,.myfantasyleague_menuMobile ul{margin:0;padding:0}\n    .myfantasyleague_menuMobile a{text-overflow:ellipsis;text-decoration:none;padding-right:0.625rem;display:block;transition:background-color 300ms linear}\n    #menu-overlay{height:100%;width:100%;position:fixed;left:0;top:0;background:rgba(0,0,0,.6);z-index:999999}\n    .myfantasyleague_menuMobile > ul > li > a,\n    .myfantasyleague_menuMobile > ul > li > a:active,\n    .myfantasyleague_menuMobile > ul > li > a:visited,\n    .myfantasyleague_menuMobile > ul > li > a:hover{text-indent:0.313rem;font-size:1.25rem;line-height:2.5rem}\n    .myfantasyleague_menuMobile > ul > li > ul > li > a,\n    .myfantasyleague_menuMobile > ul > li > ul > li > a:active,\n    .myfantasyleague_menuMobile > ul > li > ul > li > a:visited,\n    .myfantasyleague_menuMobile > ul > li > ul > li > a:hover{font-size:1rem;line-height:2.125rem;padding-left:0.625rem}\n    .myfantasyleague_menuMobile > ul > li > ul > li > ul > li > a,\n    .myfantasyleague_menuMobile > ul > li > ul > li > ul > li > a:active,\n    .myfantasyleague_menuMobile > ul > li > ul > li > ul > li > a:visited,\n    .myfantasyleague_menuMobile > ul > li > ul > li > ul > li > a:hover{padding-left:0.938rem;font-size:0.875rem;line-height:1.75rem}\n    .myfantasyleague_menuMobile > ul > li.has-sub > a{position:relative}\n    .myfantasyleague_menuMobile #icon-wrapper-mobile span{display:inline-block}\n    .myfantasyleague_menuMobile #skinSelectorOptions span,\n    .myfantasyleague_menuMobile #skinSelectorContainer input{vertical-align:top}\n    .myfantasyleague_menuMobile .mfl-icon,\n    .myfantasyleague_menuMobile span,\n    .myfantasyleague_menuMobile input[type="checkbox"],\n    .myfantasyleague_menuMobile label{display:none}\n    @media only screen and (max-width:48em){.mobile-menu-open{position:fixed;overflow:hidden;height:100%;width:100%}}\n    #click-blocker{position:fixed;top:0;bottom:0;left:0;right:0;z-index:100000}\n    @media only screen and (min-width:48.1em){#menu-overlay{display:none!important}}\n    .hamburger-inner,.hamburger-inner::before,.hamburger-inner::after{background:var(--accent,#B82601)}\n    .hamburger.is-active .hamburger-inner,\n    .hamburger.is-active .hamburger-inner::before,\n    .hamburger.is-active .hamburger-inner::after{background:var(--accent,#B82601)}\n    .hamburger{cursor:pointer;transition-property:opacity,filter;transition-duration:.15s;transition-timing-function:linear;font:inherit;color:inherit;text-transform:none;background-color:transparent;border:0;margin:0;overflow:visible}\n    .hamburger-box{width:2.5rem;height:1.5rem}\n    .hamburger-inner{top:0;bottom:0;left:0;right:0;margin:auto}\n    .hamburger-inner,.hamburger-inner::before,.hamburger-inner::after{width:1.563rem;height:0.25rem;border-radius:0;position:absolute;transition-property:transform;transition-duration:.15s;transition-timing-function:ease}\n    .hamburger-inner::before,.hamburger-inner::after{content:"";display:block}\n    .hamburger-inner::before{top:-0.625rem}\n    .hamburger-inner::after{bottom:-0.625rem}\n    .hamburger--spin .hamburger-inner{transition-duration:.22s;transition-timing-function:cubic-bezier(0.55,0.055,0.675,0.19)}\n    .hamburger--spin .hamburger-inner::before{transition:top .1s .25s ease-in,opacity .1s ease-in}\n    .hamburger--spin .hamburger-inner::after{transition:bottom .1s .25s ease-in,transform .22s cubic-bezier(0.55,0.055,0.675,0.19)}\n    .hamburger--spin.is-active .hamburger-inner{transform:rotate(225deg);transition-delay:.12s;transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)}\n    .hamburger--spin.is-active .hamburger-inner::before{top:0;opacity:0;transition:top .1s ease-out,opacity .1s .12s ease-out}\n    .hamburger--spin.is-active .hamburger-inner::after{bottom:0;transform:rotate(-90deg);transition:bottom .1s ease-out,transform .22s .12s cubic-bezier(0.215,0.61,0.355,1)}\n  `),
    document.head.appendChild(I)
  const R = document.createElement('style')
  if (
    ((R.textContent = menuPositionIsLeft
      ? '.myfantasyleague_menuMobile{border:0;border-right-width:0.125rem;border-style:solid;left:0;margin-left:-15.625rem}\n       #menu-trigger{left:0;border-left:0;border-top-right-radius:0.188rem;border-bottom-right-radius:0.188rem}\n       .myfantasyleague_menuMobile #skinSelectorContainer{left:0.938rem}'
      : '.myfantasyleague_menuMobile{border:0;border-left-width:0.125rem;border-style:solid;right:0;margin-right:-15.625rem}\n       #menu-trigger{right:0;border-right:0;border-top-left-radius:0.188rem;border-bottom-left-radius:0.188rem}\n       .myfantasyleague_menuMobile #skinSelectorContainer{right:1.875rem}'),
    document.head.appendChild(R),
    showMenuIcons)
  ) {
    const U = document.createElement('style')
    ;(U.textContent =
      '\n      .myfantasyleague_menuMobile > ul > li > a::before{font-family:"Font Awesome 6 Pro";width:1.375rem;display:inline-block;text-indent:0;text-align:center;margin-right:0.625rem}\n      .myfantasyleague_menuMobile > ul > li.mm-home > a::before          { content:"\\f015" }\n      .myfantasyleague_menuMobile > ul > li.mm-myleagues > a::before     { content:"\\f0cb" }\n      .myfantasyleague_menuMobile > ul > li.mm-reports > a::before       { content:"\\f080" }\n      .myfantasyleague_menuMobile > ul > li.mm-forowners > a::before     { content:"\\f0c0" }\n      .myfantasyleague_menuMobile > ul > li.mm-forcommissioners > a::before { content:"\\f085" }\n      .myfantasyleague_menuMobile > ul > li.mm-communications > a::before{ content:"\\f0e6" }\n      .myfantasyleague_menuMobile > ul > li.mm-links > a::before         { content:"\\f0c1" }\n      .myfantasyleague_menuMobile > ul > li.mm-help > a::before          { content:"\\f29c" }\n      .myfantasyleague_menuMobile > ul > li#slide-menu-login > a::before,\n      .myfantasyleague_menuMobile > ul > li.mm-login > a::before         { content:"\\f30d" }\n      .myfantasyleague_menuMobile > ul > li.mm-thispage > a::before      { content:"\\f0f6" }\n      .myfantasyleague_menuMobile > ul > li.mm-player > a::before        { content:"\\f0c0" }\n      .myfantasyleague_menuMobile > ul > li.mm-social > a::before        { content:"\\f0e6" }\n      .myfantasyleague_menuMobile > ul > li.mm-trans > a::before         { content:"\\f2b5" }\n      .myfantasyleague_menuMobile > ul > li.mm-myacct > a::before        { content:"\\f007" }\n      .myfantasyleague_menuMobile > ul > li.mm-draft > a::before         { content:"\\f0a1" }\n      .myfantasyleague_menuMobile > ul > li.mm-league > a::before        { content:"\\f085" }\n      .myfantasyleague_menuMobile > ul > li.mm-scores > a::before        { content:"\\e005";font-family:"Font Awesome 6 Pro" }\n      .myfantasyleague_menuMobile > ul > li.mm-franchise > a::before     { content:"\\f234" }\n    '),
      document.head.appendChild(U)
  }
  if (usePopupLogin) {
    const q = document.createElement('style')
    ;(q.textContent =
      '.myfantasyleague_menu #slide-menu-login { display: none !important }'),
      document.head.appendChild(q)
  }
} else {
  const G = document.createElement('style')
  ;(G.textContent =
    '\n    @media only screen and (max-width: 48em) {\n      body .myfantasyleague_menu,\n      body #icon-wrapper,\n      body .myfantasyleague_menu .notification-icon-search { display: block }\n      body .banner-container { border-top: none }\n      body .myfantasyleague_menu > ul { padding: 0 }\n      body .myfantasyleague_menu ul li a { line-height: 2.813rem }\n      body .myfantasyleague_menu li.mfl-icon + li a.no-sub[href*="home"]::after { display: none }\n      body .myfantasyleague_menu li.mfl-icon + li a.no-sub[href*="home"] {\n        visibility: visible;\n        position: relative;\n        font-size: 0.875rem;\n        width: 100%\n      }\n    }'),
    document.head.appendChild(G)
}
if (load_chat_enhanced) {
  if (
    window.location.href.includes('MODULE=LEAGUE_CHAT') &&
    !window.location.href.includes('MODULE=LEAGUE_CHAT&NAME')
  ) {
    document.body.classList.add('chat_popup')
    const V = document.createElement('style')
    ;(V.textContent =
      'body.chat_popup{background:#fff}body.chat_popup .mobile-wrap{position:absolute;top:0.313rem;width:98%;left:0;right:0;margin:0 auto}body.chat_popup .mobile-wrap .report caption span a{display:none}body.chat_popup .pagebody,body.chat_popup{height:0;min-height:0}'),
      document.head.appendChild(V),
      document
        .querySelectorAll(
          'body.chat_popup .pagefooter, body.chat_popup .homepagemessage, body.chat_popup .myfantasyleague_menu, body.chat_popup .pageheader'
        )
        .forEach(e => e.remove())
  }
  void 0 === window.chatAddonInsertImage && (window.chatAddonInsertImage = !0),
    void 0 === window.chatAddonInsertLink && (window.chatAddonInsertLink = !0),
    void 0 === window.chatAddonCustomEmoji &&
      (window.chatAddonCustomEmoji = !0),
    void 0 === window.chatHideVideoLink && (window.chatHideVideoLink = !0),
    void 0 === window.chatBottomUp && (window.chatBottomUp = !0),
    void 0 === window.chatShowLapsedTime && (window.chatShowLapsedTime = !0),
    void 0 === window.chatShowMore && (window.chatShowMore = !0),
    void 0 === window.chatDefaultDisplayMessages &&
      (window.chatDefaultDisplayMessages = 8),
    void 0 === window.chatUseFranchiseIcons &&
      (window.chatUseFranchiseIcons = !0),
    void 0 === window.chatFranchiseIconHeight &&
      (window.chatFranchiseIconHeight = 20),
    void 0 === window.chatImageMaxHeight && (window.chatImageMaxHeight = 50),
    void 0 === window.chatImageMaxWidth && (window.chatImageMaxWidth = 200),
    void 0 === window.chatElapsedTimeColor &&
      (window.chatElapsedTimeColor = '#888'),
    void 0 === window.chatPopupWidth && (window.chatPopupWidth = 425),
    void 0 === window.chatPopupHeight && (window.chatPopupHeight = 450),
    void 0 === window.chatImagePath &&
      (window.chatImagePath =
        'https://www.mflscripts.com/ImageDirectory/script-images/chat-icons/'),
    void 0 === window.chatEmojiPath &&
      (window.chatEmojiPath =
        'https://www.mflscripts.com/ImageDirectory/script-images/chat-icons/'),
    void 0 === window.chatEmojiList &&
      (window.chatEmojiList = {
        bowtie: 'bowtie.png',
        smile: 'smile.png',
        laughing: 'laughing.png',
        blush: 'blush.png',
        smiley: 'smiley.png',
        relaxed: 'relaxed.png',
        smirk: 'smirk.png',
        heart_eyes: 'heart_eyes.png',
        kissing_heart: 'kissing_heart.png',
        kissing_closed_eyes: 'kissing_closed_eyes.png',
        flushed: 'flushed.png',
        relieved: 'relieved.png',
        satisfied: 'satisfied.png',
        grin: 'grin.png',
        wink: 'wink.png',
        stuck_out_tongue_winking_eye: 'stuck_out_tongue_winking_eye.png',
        stuck_out_tongue_closed_eyes: 'stuck_out_tongue_closed_eyes.png',
        grinning: 'grinning.png',
        kissing: 'kissing.png',
        kissing_smiling_eyes: 'kissing_smiling_eyes.png',
        stuck_out_tongue: 'stuck_out_tongue.png',
        sleeping: 'sleeping.png',
        worried: 'worried.png',
        frowning: 'frowning.png',
        anguished: 'anguished.png',
        _open_mouth: 'open_mouth.png',
        grimacing: 'grimacing.png',
        confused: 'confused.png',
        hushed: 'hushed.png',
        expressionless: 'expressionless.png',
        unamused: 'unamused.png',
        sweat_smile: 'sweat_smile.png',
        sweat: 'sweat.png',
        weary: 'weary.png',
        _pensive: 'pensive.png',
        disappointed: 'disappointed.png',
        confounded: 'confounded.png',
        fearful: 'fearful.png',
        cold_sweat: 'cold_sweat.png',
        _persevere: 'persevere.png',
        joy: 'joy.png',
        astonished: 'astonished.png',
        scream: 'scream.png',
        neckbeard: 'neckbeard.png',
        tired_face: 'tired_face.png',
        angry: 'angry.png',
        rage: 'rage.png',
        triumph: 'triumph.png',
        sleepy: 'sleepy.png',
        yum: 'yum.png',
        mask: 'mask.png',
        sunglasses: 'sunglasses.png',
        dizzy_face: 'dizzy_face.png',
        imp: 'imp.png',
        smiling_imp: 'smiling_imp.png',
        neutral_face: 'neutral_face.png',
        no_mouth: 'no_mouth.png',
        innocent: 'innocent.png',
        alien: 'alien.png',
        ari: 'ari.png',
        atl: 'atl.png',
        bal: 'bal.png',
        buf: 'buf.png',
        car: 'car.png',
        chi: 'chi.png',
        cin: 'cin.png',
        cle: 'cle.png',
        dal: 'dal.png',
        den: 'den.png',
        det: 'det.png',
        gbp: 'gbp.png',
        hou: 'hou.png',
        ind: 'ind.png',
        jac: 'jac.png',
        kcc: 'kcc.png',
        lac: 'lac.png',
        mia: 'mia.png',
        min: 'min.png',
        nep: 'nep.png',
        nos: 'nos.png',
        nyg: 'nyg.png',
        nyj: 'nyj.png',
        _oak: 'oak.png',
        _phi: 'phi.png',
        _pit: 'pit.png',
        lar: 'lar.png',
        sea: 'sea.png',
        sfo: 'sfo.png',
        tbb: 'tbb.png',
        ten: 'ten.png',
        was: 'was.png',
        broken_heart: 'broken_heart.png',
        boom: 'boom.png',
        exclamation: 'exclamation.png',
        question: 'question.png',
        zzz: 'zzz.png',
        fire: 'fire.png',
        shit: 'shit.png',
        thumbsup: 'thumbsup.png',
        thumbsdown: 'thumbsdown.png',
        _ok_hand: 'ok_hand.png',
        facepunch: 'facepunch.png',
        fist: 'fist.png',
        v: 'v.png',
        _pray: 'pray.png',
        eyes: 'eyes.png',
        speech_balloon: 'speech_balloon.png',
        thought_balloon: 'thought_balloon.png',
        sunny: 'sunny.png',
        umbrella: 'umbrella.png',
        cloud: 'cloud.png',
        snowflake: 'snowflake.png',
        snowman: 'snowman.png',
        zap: 'zap.png',
        four_leaf_clover: 'four_leaf_clover.png',
        maple_leaf: 'maple_leaf.png',
        jack_o_lantern: 'jack_o_lantern.png',
        ghost: 'ghost.png',
        santa: 'santa.png',
        christmas_tree: 'christmas_tree.png',
        bell: 'bell.png',
        loudspeaker: 'loudspeaker.png',
        hourglass: 'hourglass.png',
        toilet: 'toilet.png',
        hammer: 'hammer.png',
        moneybag: 'moneybag.png',
        football: 'football.png',
        basketball: 'basketball.png',
        soccer: 'soccer.png',
        baseball: 'baseball.png',
        tennis: 'tennis.png',
        '8ball': '8ball.png',
        rugby_football: 'rugby_football.png',
        bowling: 'bowling.png',
        golf: 'golf.png',
        trophy: 'trophy.png'
      })
  var chatServerTime = currentServerTime,
    chatRowAdjustment = 'undefined' != typeof franchise_id ? 1 : 0,
    chatAddMoreRows = !1,
    chatRowsToAdd = !1,
    chatReversingDirection = !1
  parseInt(chatDefaultDisplayMessages) < 2 && (chatDefaultDisplayMessages = 8)
  const z = `emojiChat_bottomUp_${year}_${league_id}`
  'no' === localStorage.getItem(z) && (chatBottomUp = !1),
    'yes' === localStorage.getItem(z) && (chatBottomUp = !0)
  const Y = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ],
    Q = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
  function openChatWindow (e) {
    const t = screen.width / 2 - chatPopupWidth / 2,
      a = screen.height / 2 - chatPopupHeight / 2
    window.open(
      e.href,
      'popchaturl',
      `height=${chatPopupHeight},width=${chatPopupWidth},left=${t},top=${a}`
    )
  }
  function parseChatXML (e) {
    let t,
      a = e.getElementsByTagName('message')
    if (((chatRowsToAdd = !1), chatAddMoreRows || chatReversingDirection)) {
      const e = document.getElementById('league_chat'),
        t = e.getElementsByTagName('TR')
      for (let a = t.length - 1; a >= 0; a--)
        parseInt(t[a].getAttribute('id')) > 0 && e.deleteRow(a)
      ;(chatAddMoreRows = !1), (chatReversingDirection = !1)
    }
    try {
      t = parseInt(a[0].getAttribute('id'))
    } catch {
      t = chatServerTime
    }
    if (
      ((chatServerTime += checkEverySeconds) < t && (chatServerTime = t),
      chatBottomUp)
    ) {
      let e = 0
      const t = []
      for (let r = 0; r < a.length; r++) {
        if (e > displayMessages) {
          chatRowsToAdd = !0
          break
        }
        const o = a[r].getAttribute('id'),
          n = a[r].getAttribute('to'),
          i = a[r].getAttribute('franchise_id')
        if (!document.getElementById(o) && null !== n) {
          if ('undefined' == typeof franchise_id) continue
          if (n !== franchise_id && i !== franchise_id) continue
        }
        t.unshift(a[r]), e++
      }
      a = t
    }
    const r = document.getElementById('league_chat'),
      o = r
        ? r.getElementsByTagName('TBODY')
        : document.getElementsByTagName('TBODY'),
      n =
        'clear' ===
        e.getElementsByTagName('messages')[0].getAttribute('action'),
      i = o[0].getElementsByTagName('TR'),
      s = i[1]
    let l = 0
    if (n)
      for (; o[0].getElementsByTagName('TR').length > 2; ) o[0].deleteRow(1)
    else {
      let e = 0
      for (let t = 0; t < a.length; t++) {
        if (e > displayMessages) {
          chatRowsToAdd = !0
          break
        }
        const r = a[t].getAttribute('id'),
          n = a[t].getAttribute('franchise_id'),
          c = a[t].getAttribute('to')
        if (!document.getElementById(r)) {
          if (
            ('undefined' != typeof franchise_id &&
              n === franchise_id &&
              (chatServerTime -= checkEverySeconds),
            null !== c)
          ) {
            if ('undefined' == typeof franchise_id) continue
            if (c !== franchise_id && n !== franchise_id) continue
          }
          let e = a[t].getAttribute('message'),
            d = e.replace('::', ': :'),
            p = 0
          for (; d.includes(':') && p < 100; ) {
            d = d.substring(d.indexOf(':') + 1)
            const t = d.substring(0, d.indexOf(':'))
            void 0 !== chatEmojiList[t] &&
              (e = e.replace(
                `:${t}:`,
                `<img src='${chatEmojiPath}${chatEmojiList[t]}' title='~:~${t}~:~' class='chatEmoji' />`
              )),
              p++
          }
          e = e.replace(/~:~/g, ':')
          const u = a[t].getAttribute('posted'),
            m = null !== c,
            f = document.createElement('TR')
          f.setAttribute('id', r), f.setAttribute('title', `Posted: ${u}`)
          const h = document.createElement('TD')
          if (chatUseFranchiseIcons) {
            const e = franchiseDatabase[`fid_${n}`]
            h.innerHTML =
              `<img src='${e.icon}' alt='${e.name}' title='${e.name}' class='chatTeamIcon' />` +
              (m
                ? `<img src='${franchiseDatabase[`fid_${c}`].icon}' alt='to ${
                    franchiseDatabase[`fid_${c}`].name
                  }' title='to ${
                    franchiseDatabase[`fid_${c}`].name
                  }' class='chatTeamIcon' />`
                : '')
          } else {
            const e = franchiseDatabase[`fid_${n}`].name
            h.innerHTML = m ? `<b>${e}</b>` : e
          }
          f.appendChild(h)
          const y = document.createElement('TD')
          if (
            ((y.innerHTML =
              (m ? '<b>' : '') +
              e +
              (m ? '</b>' : '') +
              (chatShowLapsedTime
                ? `<br/><span class='chatLapsedTime' id='chatid_${r}'></span>`
                : '')),
            f.appendChild(y),
            chatBottomUp)
          ) {
            const e = i[t + (i.length - t) - chatRowAdjustment]
            o[0].insertBefore(f, e)
          } else o[0].insertBefore(f, s)
          'undefined' != typeof franchise_id && n !== franchise_id && l++
        }
        chatShowLapsedTime && updateChatPostTime(r), e++
      }
      let t = o[0].getElementsByTagName('TR')
      for (let e = t.length; e > displayMessages + 1; e--)
        t[e]?.getAttribute('id') &&
          (chatBottomUp ? o[0].deleteRow(1) : o[0].deleteRow(e))
      t = o[0].getElementsByTagName('TR')
      for (let e = 1; e < t.length; e++)
        'loadingchatdata' === t[e]?.getAttribute('id') && o[0].deleteRow(e)
    }
    const c = o[0].getElementsByTagName('TR')
    for (let e = 1; e < c.length; e++) {
      const t = e % 2 == 1 ? 'oddtablerow' : 'eventablerow'
      c[e].setAttribute('class', t)
    }
    ;(a = null),
      1 === l &&
        (play_audio_clip('ohoh', 'chat_audio_clip'),
        document.getElementById('body_home') ||
          setTimeout(() => document.chat?.chat?.focus(), 100)),
      (document.getElementById('chatMore').style.display =
        chatRowsToAdd && chatShowMore ? 'inline' : 'none')
  }
  function addMoreBottomUpToChat () {
    const e = document.getElementById('league_chat').getElementsByTagName('TH'),
      t = chatBottomUp
        ? `<img src='${chatImagePath}bottom-up-chat.png' style='cursor:pointer;vertical-align:bottom' alt='Click for Top-Down Chat!' title='Click for Top-Down Chat!' onclick='doBottomUpChat(false)' />`
        : `<img src='${chatImagePath}top-down-chat.png' style='cursor:pointer;vertical-align:bottom' alt='Click for Bottom-Up Chat!' title='Click for Bottom Chat!' onclick='doBottomUpChat(true)' />`
    e[1].innerHTML = `Message <span id='chatMore' style='display:none'>(<span style='cursor:pointer' onclick='addMoreChat()'>more</span>)</span> <span id='bottom-up-chat'>${t}</span>`
  }
  function doBottomUpChat (e) {
    ;(chatBottomUp = e), localStorage.setItem(z, e ? 'yes' : 'no')
    const t = e
      ? `<img src='${chatImagePath}bottom-up-chat.png' style='cursor:pointer;vertical-align:bottom' alt='Click for Top-Down Chat!' title='Click for Top-Down Chat!' onclick='doBottomUpChat(false)' />`
      : `<img src='${chatImagePath}top-down-chat.png' style='cursor:pointer;vertical-align:bottom' alt='Click for Bottom-Up Chat!' title='Click for Bottom-up Chat!' onclick='doBottomUpChat(true)' />`
    document.getElementById('bottom-up-chat').innerHTML = t
    const a = document.querySelector('#league_chat tbody'),
      r = [...a.querySelectorAll('tr')].filter(
        e => parseInt(e.getAttribute('id')) > 1e6
      )
    r.forEach(e => a.removeChild(e)),
      r.sort((t, a) =>
        e
          ? parseInt(t.getAttribute('id')) - parseInt(a.getAttribute('id'))
          : parseInt(a.getAttribute('id')) - parseInt(t.getAttribute('id'))
      )
    const o = 1 === chatRowAdjustment ? a.lastElementChild : null
    r.forEach(e => (o ? a.insertBefore(e, o) : a.appendChild(e))),
      [...a.querySelectorAll('tr')].forEach((e, t) => {
        t > 0 && (e.className = t % 2 == 1 ? 'oddtablerow' : 'eventablerow')
      })
  }
  function addMoreChat () {
    ;(displayMessages += 5), (chatAddMoreRows = !0), readMessages(!1)
  }
  function addEmoji (e) {
    MFLChatPopupClose()
    const t = document.getElementById('chat_text_field')
    t && ((t.value += ` :${e}:`), t.focus())
  }
  function updateChatPostTime (e) {
    const t = 1e3 * parseInt(e),
      a = 1e3 * chatServerTime
    let r = Math.max(0, parseInt((a - t) / 1e3))
    const o = new Date(t),
      n = `${Y[o.getMonth()]} ${o.getDate()}`,
      i = Q[o.getDay()],
      s = o.getHours(),
      l = s < 12 ? 'am' : 'pm'
    const c = `${s % 12 || 12}:${String(o.getMinutes()).padStart(2, '0')} ${l}`
    let d
    d =
      1 === r
        ? '1 second ago'
        : r < 60
        ? `${r} seconds ago`
        : r < 120
        ? '1 minute ago'
        : r < 3600
        ? `${Math.floor(r / 60)} minutes ago`
        : r < 7200
        ? '1 hour ago'
        : r < 86400
        ? `${Math.floor(r / 3600)} hours ago`
        : r < 604800
        ? `${i} ${c}`
        : `${n} ${c}`
    const p = document.getElementById(`chatid_${e}`)
    p && (p.innerHTML = d)
  }
  function MFLChatPopupClose () {
    document
      .getElementById('MFLChatPopupOverlay')
      ?.style.setProperty('display', 'none'),
      document
        .getElementById('MFLChatPopupContainer')
        ?.style.setProperty('display', 'none')
    try {
      bodyScrollLock.clearAllBodyScrollLocks()
    } catch {}
  }
  function createCusChatPopup (e, t) {
    ;(document.querySelector('#MFLChatPopupOverlay').style.display = 'block'),
      (document.querySelector('#MFLChatPopupContainer').style.display =
        'block'),
      (document.querySelector('#MFLChatPopupCaption').textContent = t),
      (document.querySelector('#MFLChatPopupHeader').innerHTML = e)
    try {
      bodyScrollLock.disableBodyScroll(
        document.querySelector('#MFLChatPopupContainer')
      )
    } catch {}
  }
  function chatPopupImage () {
    createCusChatPopup(
      '\n      <table class="report popreport"><tbody><tr class="oddtablerow">\n        <td style="text-align:center">\n          <br/>\n          Image URL: <input type="text" id="chat_imagetext_field" size="23" maxlength="150" />\n          <input type="button" value="Insert" class="imageinsert" style="margin-left:0.313rem" />\n          <br/>\n        </td>\n      </tr></tbody></table>',
      'Add Image to Chat'
    ),
      document.querySelector('.imageinsert').addEventListener('click', () => {
        const e = document.querySelector('#chat_imagetext_field').value
        if (e) {
          const t = e.replace(/https?:\/\//, '').replace(/^\/\//, '')
          document.querySelector(
            '#chat_text_field'
          ).value += ` <img src="//${t}" />`
        }
        MFLChatPopupClose()
      })
  }
  function chatPopupLink () {
    createCusChatPopup(
      '\n      <table class="report popreport"><tbody><tr class="oddtablerow">\n        <td style="text-align:center">\n          Link URL: <input type="text" id="chat_link_field" size="27" maxlength="150" /><br/><br/>\n          Link Text: <input type="text" id="chat_linktext_field" size="23" maxlength="150" />\n          <input type="button" value="Insert" class="linkinsert" style="margin-left:0.313rem" />\n        </td>\n      </tr></tbody></table>',
      'Add Link to Chat'
    ),
      document.querySelector('.linkinsert').addEventListener('click', () => {
        const e = document.querySelector('#chat_link_field').value,
          t = document.querySelector('#chat_linktext_field').value || e
        if (e) {
          const a = e.replace(/https?:\/\//, '').replace(/^\/\//, '')
          document.querySelector(
            '#chat_text_field'
          ).value += ` <a href="//${a}" target="_blank">${t}</a>`
        }
        MFLChatPopupClose()
      })
  }
  function chatPopupEmoji () {
    createCusChatPopup(
      `\n      <table class="report popreport"><tbody><tr class="oddtablerow">\n        <td style="text-align:center">\n          <div id="chatScrollDiv" style="overflow-y:scroll;-webkit-overflow-scrolling:touch;height:10rem">\n            ${Object.entries(
        chatEmojiList
      )
        .map(
          ([e, t]) =>
            `<img src="${chatEmojiPath}${t}" title=":${e}:" class="chatTableEmoji" onclick="addEmoji('${e}')" />`
        )
        .join(
          ''
        )}\n          </div>\n        </td>\n      </tr></tbody></table>`,
      'Add Emoji to Chat'
    )
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (
      (document.querySelectorAll('a').forEach(e => {
        if (
          !e.textContent.includes('League') ||
          !e.textContent.includes('Chat')
        )
          return
        const t = document.createElement('a')
        ;(t.href = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=LEAGUE_CHAT`),
          (t.target = '_blank'),
          (t.textContent = 'League Chat'),
          t.addEventListener('click', function () {
            return openChatWindow(this), !1
          }),
          e.replaceWith(t)
      }),
      !document.getElementById('league_chat'))
    )
      return
    chatDefaultDisplayMessages > 1 &&
      (displayMessages = chatDefaultDisplayMessages - 1)
    const e = document.querySelector('#league_chat caption span a')
    if (e) {
      const t = document.createElement('a')
      ;(t.href = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=LEAGUE_CHAT`),
        (t.target = '_blank'),
        t.addEventListener('click', function () {
          return openChatWindow(this), !1
        })
      const a = document.createElement('img')
      ;(a.src = '//www03.myfantasyleague.com/window-16x16.png'),
        (a.title = 'New Window'),
        (a.alt = 'New Window'),
        (a.width = 16),
        (a.height = 16),
        (a.style.border = '0'),
        t.appendChild(a),
        e.replaceWith(t)
    }
    if (
      'undefined' != typeof franchise_id &&
      document.getElementById('chat_text_field')
    ) {
      let e = 17.5
      '0000' === franchise_id && (e -= 1.25),
        chatHideVideoLink && (e += 1.125),
        chatAddonCustomEmoji && (e -= 1.125),
        chatAddonInsertLink && (e -= 1.125),
        chatAddonInsertImage && (e -= 1.125),
        (document.getElementById('chat_text_field').style.width = `${e}rem`)
    }
    addMoreBottomUpToChat()
    const t = document.createElement('style')
    ;(t.textContent = `#league_chat td .chatTeamIcon + .chatTeamIcon{margin-top:0.313rem}#league_chat td:nth-child(2) img.chatEmoji{max-height:1.5rem;width:auto}.chatTableEmoji{max-height:1.5rem;width:auto;cursor:pointer;margin:0.25rem}.chatTeamIcon{height:${chatFranchiseIconHeight}${
      useREM ? 'rem' : 'px'
    };width:auto;display:block}.chatLapsedTime{font-style:italic;font-size:0.563rem;color:${chatElapsedTimeColor}}.chatNotification{text-align:center;font-style:italic}#league_chat input,#league_chat a,#league_chat img{vertical-align:middle}#chat_text_field{margin:0.188rem 0}#league_chat td:nth-child(2) img{max-height:${chatImageMaxHeight}${
      useREM ? 'rem' : 'px'
    };max-width:${chatImageMaxWidth}${
      useREM ? 'rem' : 'px'
    };width:auto}#league_chat td:nth-child(1){width:0.188rem}@media only screen and (max-height:35.5em) and (orientation:landscape){#MFLChatPopupContainer{max-height:14.688rem}}#MFLChatPopupContainer{overflow:hidden;position:fixed;z-index:99999;width:100%;max-width:25rem;height:max-content;margin:auto;left:0;right:0;top:0;bottom:0}#MFLChatPopupContainer .report{height:auto;padding:0;border-width:0.125rem;overflow:hidden}#MFLChatPopupContainer caption{width:100%;border-left:0;border-right:0;border-top:0;display:inline-block;border-radius:0}#MFLChatPopupContainer .popreport{width:100%;height:auto;border-spacing:0;border:0;margin-bottom:0.313rem}#MFLChatPopupContainer .popreport td{padding:0.625rem 0.313rem}#MFLChatPopupHeader{text-align:center;width:100%}#MFLChatPopupOverlay{height:100%;left:0;opacity:0.7;position:fixed;top:0;width:100%;z-index:99999;background-color:#000}`),
      document.head.appendChild(t)
    const a = document.querySelector('.pagebody')
    if (a) {
      const e = document.createElement('div')
      ;(e.id = 'MFLChatPopupOverlay'),
        (e.style.display = 'none'),
        e.addEventListener('click', MFLChatPopupClose)
      const t = document.createElement('div')
      ;(t.id = 'MFLChatPopupContainer'), (t.style.display = 'none')
      const r = document.createElement('div')
      r.className = 'report'
      const o = document.createElement('caption'),
        n = document.createElement('span')
      ;(n.id = 'MFLChatPopupCaption'), o.appendChild(n)
      const i = document.createElement('span')
      ;(i.id = 'MFLPlayerPopupClose'),
        (i.textContent = 'X'),
        i.addEventListener('click', MFLChatPopupClose)
      const s = document.createElement('div')
      ;(s.id = 'MFLChatPopupHeader'),
        r.appendChild(o),
        r.appendChild(i),
        r.appendChild(s),
        t.appendChild(r),
        a.appendChild(e),
        a.appendChild(t)
    }
    const r = document.querySelector('#league_chat input[value="Post"]')
    r &&
      [
        {
          condition: chatAddonCustomEmoji,
          src: `${chatEmojiPath}smile.png`,
          alt: 'Show Emojis',
          title: 'Show Emojis',
          handler: chatPopupEmoji
        },
        {
          condition: chatAddonInsertLink,
          src: `${chatImagePath}link.png`,
          alt: 'Insert Link',
          title: 'Insert Link',
          handler: chatPopupLink
        },
        {
          condition: chatAddonInsertImage,
          src: `${chatImagePath}insert_image.png`,
          alt: 'Insert Image',
          title: 'Insert Image',
          handler: chatPopupImage
        }
      ].forEach(({ condition: e, src: t, alt: a, title: o, handler: n }) => {
        if (!e) return
        const i = document.createElement('img')
        ;(i.src = t),
          (i.alt = a),
          (i.title = o),
          (i.style.cssText =
            'height:1rem;width:1rem;cursor:pointer;margin-left:0.125rem'),
          i.addEventListener('click', n),
          r.after(i)
      }),
      chatHideVideoLink &&
        document.querySelector("#league_chat a[href*='O=222']")?.remove()
  })
}
if (load_popup) {
  ;(ShowMFLlogin = !1),
    $('.mm-myacct li a[href*=BECOME]').parent().remove(),
    $('.mm-myacct li a[href*=login]').parent().remove(),
    $('.mm-myacct li a[href*=logout]').parent().remove()
  var MFLPlayerPopupTracker = [],
    MFLPlayerPopupTeamNames = [],
    MFLPlayerPopupOnloadContent = [],
    MFLPlayerPopupStart = new Date().getTime(),
    MFLPlayerPopupExtraTitles = {
      salary: 'Salary',
      contractyear: 'Contract Year',
      contractstatus: 'Contract Status',
      contractinfo: 'Contract Information',
      drafted: 'Drafted'
    },
    MFLPlayerPopupCurrentPID
  if (((MFLnewsEnableScoreboard = !0), void 0 === MFLPopupOmitLinks))
    var MFLPopupOmitLinks = !1
  if (void 0 === MFLPopupOmitStatus) var MFLPopupOmitStatus = !1
  if (void 0 === MFLPopupEnableAutoNotification)
    var MFLPopupEnableAutoNotification = !1
  if (void 0 === MFLPopupEnableTrade) var MFLPopupEnableTrade = !0
  if (void 0 === MFLPopupEnableTradePoll) var MFLPopupEnableTradePoll = !0
  if (void 0 === MFLPopupEnableReminders) var MFLPopupEnableReminders = !0
  if (void 0 === MFLPopupEnableMessages) var MFLPopupEnableMessages = !0
  if (void 0 === MFLPopupEnableCommishMessage)
    var MFLPopupEnableCommishMessage = !1
  if (void 0 === MFLPopupCommishMessage) var MFLPopupCommishMessage = ''
  if (void 0 === MFLPlayerPopupIncludeNFLLogo)
    var MFLPlayerPopupIncludeNFLLogo = !0
  if (void 0 === ShowMFLsearch) var ShowMFLsearch = !1
  if (void 0 === MFLFranchisePopup) var MFLFranchisePopup = !1
  if (void 0 === MFLScoreDetailsPopup) var MFLScoreDetailsPopup = !1
  if (void 0 === includeBiologo) var includeBiologo = !1
  if (
    (MFLFranchisePopup && (MFLScoreDetailsPopup = !0),
    void 0 === includeBiologoAsset)
  )
    var includeBiologoAsset = !1
  if (void 0 === ShowMFLlogin) var ShowMFLlogin = !1
  if (void 0 === LoginSearchMobileCSS) var LoginSearchMobileCSS = !1
  if (void 0 === MFLPlayerPopupIncludeProjections)
    var MFLPlayerPopupIncludeProjections = !0
  if (void 0 === MFLPopupWelcomeFontAwesome)
    var MFLPopupWelcomeFontAwesome =
      '<i class="fa-sharp fa-regular fa-lock-keyhole MFLPopupFontAwesome MFLPopupFontAwesomeMenu MFLPopupWelcome" aria-hidden="true"></i>'
  if (void 0 === MFLPopupSearchFontAwesome)
    var MFLPopupSearchFontAwesome =
      '<i class="fa-regular fa-magnifying-glass MFLPopupFontAwesome MFLPopupFontAwesomeMenu MFLPopupSearch" aria-hidden="true"></i>'
  if (void 0 === MFLPopupNotifyFontAwesome)
    var MFLPopupNotifyFontAwesome =
      '<i class="fa-regular fa-circle-exclamation MFLPopupFontAwesome MFLPopupFontAwesomeMenu MFLPopupNotify" aria-hidden="true"></i>'
  'undefined' == typeof NewsNoneIconHeight && (NewsNoneIconHeight = 9),
    'undefined' == typeof NewsNoneIconWidth && (NewsNoneIconWidth = 11),
    'undefined' == typeof NewsOldIconHeight && (NewsOldIconHeight = 9),
    'undefined' == typeof NewsOldIconWidth && (NewsOldIconWidth = 11),
    'undefined' == typeof NewsNewIconHeight && (NewsNewIconHeight = 11),
    'undefined' == typeof NewsNewIconWidth && (NewsNewIconWidth = 18),
    $('.myfantasyleague_menu ul li:eq(0)')
      .parent()
      .append(
        '<div id="icon-wrapper" style="float:left;display:none"><li onclick="toggleLogin()" class="notification-icon-login" style="display:none">' +
          MFLPopupWelcomeFontAwesome +
          '</li><div class="toggle_module_login" style="display:none;"><table class="toggle_login_content report" style="white-space:initial"><tbody><tr><th>Welcome</th></tr><tr class="oddtablerow"></tr></tbody></table></div><li onclick="toggleSearch()" class="notification-icon-search" title="Player Search" style="display:none">' +
          MFLPopupSearchFontAwesome +
          '</li><div class="toggle_module_search" style="display:none"><table class="toggle_search_content report" style="white-space:initial"><tbody><tr><th>Find A Player</th></tr><tr class="oddtablerow"><td><form method="get" action="' +
          baseURLDynamic +
          '/' +
          year +
          '/player_search"><input name="L" value="' +
          league_id +
          '" type="hidden"><input name="NAME" size="15" type="text"><input value="Search" type="submit"></form></td></tr></tbody></table></div><li class="notification-icon-popup" title="Notifications" style="display:none"><span onclick="MFLPlayerPopupPopulateOnload(true)">' +
          MFLPopupNotifyFontAwesome +
          '</span></li><li style="display:none" onclick="location.href=\'' +
          baseURLDynamic +
          '/' +
          year +
          '/mb/message_list.pl?bid=' +
          year +
          league_id +
          '\'" class="notification-icon-new-mb-private-message addon-icons" title="New Private Message!"><i class="fa-regular fa-inbox fa-beat MFLPopupFontAwesomeMenu"></i></li><li style="display:none" onclick="location.href=\'' +
          baseURLDynamic +
          '/' +
          year +
          '/options?L=' +
          league_id +
          '&O=28\'" class="notification-icon-new-mb-message addon-icons" title="New Message Board Post!"><i class="fa-regular fa-comments fa-beat MFLPopupFontAwesomeMenu"></i></li><li style="display:none" onclick="location.href=\'' +
          baseURLDynamic +
          '/' +
          year +
          '/options?L=' +
          league_id +
          '&O=69\'" class="notification-icon-new-poll addon-icons" title="Vote Required!"><i class="fa-regular fa-check-to-slot fa-beat MFLPopupFontAwesomeMenu"></i></li><li style="display:none" onclick="location.href=\'' +
          baseURLDynamic +
          '/' +
          year +
          '/csetup?L=' +
          league_id +
          '&C=REVTRAD\'" class="notification-pending-trade addon-icons" title="Pending Trade to Approve!"><i class="fa-regular fa-triangle-exclamation fa-beat MFLPopupFontAwesomeMenu"></i></li><li style="display:none" onclick="alert(\'You have ' +
          leagueAttributes.PendingTradesAwaitingCommishApproval +
          ' trade(s) awaiting Commissioner Approval!\')" class="notification-awaiting-approval addon-icons" title="Trade(s) Awaiting Commissioner Approval!"><i class="fa-regular fa-hourglass-half fa-beat MFLPopupFontAwesomeMenu"></i></li><li style="display:none" onclick="location.href=\'' +
          baseURLDynamic +
          '/' +
          year +
          '/options?L=' +
          league_id +
          '&O=05\'" class="notification-outstandings-offers-received addon-icons" title="You have been offered a trade!"><i class="fa-regular fa-handshake fa-beat MFLPopupFontAwesomeMenu"></i></li></div>'
      )
  var MFLEnablePlayerImages =
      void 0 !== MFLEnablePlayerImages && !!MFLEnablePlayerImages,
    MFLPopupEnablePlayerNews =
      void 0 !== MFLPopupEnablePlayerNews && !!MFLPopupEnablePlayerNews,
    MFLPopupEnableArticle =
      void 0 !== MFLPopupEnableArticle && !!MFLPopupEnableArticle,
    HidePlayerDetails = void 0 !== HidePlayerDetails && !!HidePlayerDetails
  const K = !(!MFLEnablePlayerImages && !MFLPopupEnablePlayerNews)
  let J = null
  function mergeSelectors (e, t) {
    const a = Array.isArray(e) ? e.slice() : [],
      r = null == t ? [] : Array.isArray(t) ? t : [t],
      o = [],
      n = new Set()
    for (const e of [...a, ...r]) {
      const t = 'string' == typeof e ? e.trim() : ''
      t && (n.has(t) || (n.add(t), o.push(t)))
    }
    return o
  }
  !(function ensureNewsCss () {
    function ensureStyle (e, t) {
      if (document.getElementById(e)) return
      const a = document.createElement('style')
      ;(a.id = e), (a.textContent = t), document.head.appendChild(a)
    }
    const isValidUrl = e => 'string' == typeof e && e.trim().length > 0,
      e =
        isValidUrl(window.MFLPlayerPopupNewsNew) &&
        isValidUrl(window.MFLPlayerPopupNewsOld) &&
        isValidUrl(window.MFLPlayerPopupNewsNone)
    if (MFLPopupEnableArticle) {
      ensureStyle(
        'mfl-article-icons-style',
        e
          ? `\n/*MFLPlayerPopupNewsOld*/\na[data-news-article="1"]::after {\n    height: ${NewsOldIconHeight}px!important;\n    width: ${NewsOldIconWidth}px!important;\n}\na[data-news-article="1"]::after {\n  content: "";\n  display: inline-block;\n  vertical-align: middle;\n  margin-left: 0.3em;\n  background: url("${MFLPlayerPopupNewsOld}") no-repeat center / contain!important;\n}`
          : "\na[data-news-article=\"1\"]::after {\n  content: \"\";\n  width: calc(1em * 16 / 14);\n  aspect-ratio: 16 / 14;\n  display: inline-flex;\n  vertical-align: text-top;\n  background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.5 -133.93)'/><polygon fill='%23f7ea0c' points='12.59 8.63 12.59 11.08 15.05 8.63 12.59 8.63'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.5 -133.93)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.5 -133.93)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.5 -133.93)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.5 -133.93)'/></svg>\") no-repeat center / contain!important;}"
      )
    }
    if (K) {
      let t = ''
      MFLPopupEnablePlayerNews &&
        (t += e
          ? `\n/*MFLPlayerPopupNewsNone*/\na[data-news="no-news"]::after,\na[data-news="no-news"]::before,\na[data-news="no-news"] div.playerLastName::after,\na[data-news="no-news"] div.playerLastName::before {\n    height: ${NewsNoneIconHeight}px!important;\n    width: ${NewsNoneIconWidth}px!important;\n}\n/*MFLPlayerPopupNewsOld*/\na[data-news="news"]::after,\na[data-news="news"]::before,\na[data-news="news"] div.playerLastName::after,\na[data-news="news"] div.playerLastName::before,\na[data-news="recent-news"]::after,\na[data-news="recent-news"]::before,\na[data-news="recent-news"] div.playerLastName::after,\na[data-news="recent-news"] div.playerLastName::before,\na[data-news_preload="1"]:after,\na[data-news_preload="1"] div.playerLastName::after,\na[data-news_preload="1"] div.playerLastName::before {\n    height: ${NewsOldIconHeight}px!important;\n    width: ${NewsOldIconWidth}px!important;\n}\n/*MFLPlayerPopupNewsNew*/\na[data-news="new-news"]::after,\na[data-news="new-news"]::before,\na[data-news="new-news"] div.playerLastName::after,\na[data-news="new-news"] div.playerLastName::before {\n    height: ${NewsNewIconHeight}px!important;\n    width: ${NewsNewIconWidth}px!important;\n}\n\ntd.mondayHomeTeam a[data-news_preload="1"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news*="news"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news*="news"]::after {\n  content: none!important;\n}\ntd.mondayHomeTeam a[data-news_preload="1"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*="news"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*="news"]::before {\n  margin-right:.2em;\n}\na[data-news_preload="1"] div.playerLastName::after,\na[data-news*="news"] div.playerLastName::after,\na[data-news*="news"]::after,\ntd.mondayHomeTeam a[data-news_preload="1"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*="news"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*="news"]::before {\n  content: "";\n  display: inline-block;\n  vertical-align: middle;\n  margin-left: 0.3em;\n  background: url("${MFLPlayerPopupNewsOld}") no-repeat center / contain!important;\n}\na[data-news="recent-news"]::after,\na[data-news="news"]::after,\na[data-news="recent-news"] div.playerLastName::after,\na[data-news="news"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news="recent-news"]::before,\ntd.mondayHomeTeam a[data-news="news"]::before,\ntd.mondayHomeTeam a[data-news="recent-news"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news="news"] div.playerLastName::before {\n  background: url("${MFLPlayerPopupNewsOld}") no-repeat center / contain!important;\n}\na[data-news="no-news"]::after,\na[data-news="no-news"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news="no-news"]::before,\ntd.mondayHomeTeam a[data-news="no-news"] div.playerLastName::before {\n  background: url("${MFLPlayerPopupNewsNone}") no-repeat center / contain!important;\n}\na[data-news="new-news"]::after,\na[data-news="new-news"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news="new-news"]::before,\ntd.mondayHomeTeam a[data-news="new-news"] div.playerLastName::before {\n  background: url("${MFLPlayerPopupNewsNew}") no-repeat center / contain!important;\n}\na[data-pimg-processed]::after,\ntd.mondayHomeTeam a[data-pimg-processed]::before { content: none!important; }\n\n@media (min-width: 768px) {\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*="news"]::after {\n        content: none!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*="news"]::before {\n        margin-right: 0.2em;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*="news"]::before {\n        content: "";\n        display: inline-block;\n        vertical-align: middle;\n        margin-left: 0.3em;\n        background: url("${MFLPlayerPopupNewsOld}") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news="recent-news"]::before,\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news="news"]::before {\n        background: url("${MFLPlayerPopupNewsOld}") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news="no-news"]::before {\n        background: url("${MFLPlayerPopupNewsNone}") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news="new-news"]::before {\n        background: url("${MFLPlayerPopupNewsNew}") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-pimg-processed]::before {\n        content: none!important;\n    }\n}`
          : "\ntd.mondayHomeTeam a[data-news_preload=\"1\"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news*=\"news\"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news*=\"news\"]::after{\n  content: none!important;\n}\ntd.mondayHomeTeam a[data-news_preload=\"1\"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*=\"news\"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*=\"news\"]::before {\n  margin-right:.2em;\n}\na[data-news_preload=\"1\"] div.playerLastName::after,\na[data-news*=\"news\"] div.playerLastName::after,\na[data-news*=\"news\"]::after,\ntd.mondayHomeTeam a[data-news_preload=\"1\"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*=\"news\"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news*=\"news\"]::before {\n  content: \"\";\n  width: calc(1em * 16 / 14);\n  aspect-ratio: 16 / 14;\n  display: inline-flex;\n  vertical-align: text-top;\n  background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.5 -133.93)'/><polygon fill='%23f7ea0c' points='12.59 8.63 12.59 11.08 15.05 8.63 12.59 8.63'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.5 -133.93)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.5 -133.93)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.5 -133.93)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.5 -133.93)'/></svg>\") no-repeat center / contain!important;\n}\na[data-news=\"recent-news\"]::after,\na[data-news=\"news\"]::after,\na[data-news=\"recent-news\"] div.playerLastName::after,\na[data-news=\"news\"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news=\"recent-news\"]::before,\ntd.mondayHomeTeam a[data-news=\"news\"]::before,\ntd.mondayHomeTeam a[data-news=\"recent-news\"] div.playerLastName::before,\ntd.mondayHomeTeam a[data-news=\"news\"] div.playerLastName::before {\n  width: calc(1em * 16 / 14);\n  background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.5 -133.93)'/><polygon fill='%23f7ea0c' points='12.59 8.63 12.59 11.08 15.05 8.63 12.59 8.63'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.5 -133.93)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.5 -133.93)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.5 -133.93)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.5 -133.93)'/></svg>\") no-repeat center / contain!important;\n}\na[data-news=\"no-news\"]::after,\na[data-news=\"no-news\"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news=\"no-news\"]::before,\ntd.mondayHomeTeam a[data-news=\"no-news\"] div.playerLastName::before {\n  width: calc(1em * 16 / 14);\n  background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M210.91,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33H212v-5.56A1.1,1.1,0,0,0,210.91,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-196 -134)'/><polygon fill='%23d6d6d6' points='12.59 8.55 12.59 11 15.05 8.55 12.59 8.55'/><path fill='%23a6a6a6' d='M212,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,212,137.11Zm-4.36,4.45V146h1.09v-3.33H212v-1.11Z' transform='translate(-196 -134)'/><path fill='%23d6d6d6' d='M200.34,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,200.34,145.69Z' transform='translate(-196 -134)'/><path fill='%23ffffff' d='M210.91,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-196 -134)'/><path fill='%23d6d6d6' d='M208.86,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,208.86,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,203.36,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-196 -134)'/></svg>\") no-repeat center / contain!important;\n}\na[data-news=\"new-news\"]::after,\na[data-news=\"new-news\"] div.playerLastName::after,\ntd.mondayHomeTeam a[data-news=\"new-news\"]::before,\ntd.mondayHomeTeam a[data-news=\"new-news\"] div.playerLastName::before {\n  width: calc(1em * 27 / 14);\n  aspect-ratio: 27 / 14;\n  background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 27 14'><rect fill='%23eb008b' opacity='0' width='27' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.45 -134)'/><polygon fill='%23f7ea0c' points='12.64 8.55 12.64 11 15.1 8.55 12.64 8.55'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.45 -134)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.45 -134)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.45 -134)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.45 -134)'/><path fill='%23ffb878' d='M223.93,141.39v-.71h-2.67l1.88-1.88-.5-.5-1.89,1.89v-2.68H220v2.69l-1.9-1.89-.5.5,1.89,1.87h-2.67v.71h2.7l-1.91,1.9.5.5L220,141.9v2.66h.71v-2.67l1.9,1.89.5-.5-1.91-1.89h2.69Zm-3.53.38a.74.74,0,1,1,.73-.74A.74.74,0,0,1,220.4,141.77Z' transform='translate(-199.45 -134)'/><path fill='%23ff320d' d='M226.4,141.6v-1.2h-4.53l3.19-3.21-.85-.84L221,139.57V135h-1.2v4.58l-3.23-3.22-.85.85,3.21,3.19H214.4v1.2H219l-3.24,3.25.85.85,3.21-3.23V147H221v-4.53l3.23,3.21.85-.85-3.25-3.23h4.57Zm-5.25-.3h0l1.62,1.61-.43.43-1.61-1.61V144h-.6v-2.25h0l-1.6,1.61-.43-.43,1.62-1.62H217.4v-.6h2.26l-1.6-1.59.43-.43,1.61,1.61V138h.6v2.28l1.6-1.61.43.43-1.6,1.6h2.27v.6Z' transform='translate(-199.45 -134)'/></svg>\") no-repeat center / contain!important;\n}\na[data-pimg-processed]::after,\ntd.mondayHomeTeam a[data-pimg-processed]::before { content: none!important; }\n@media (min-width: 768px) {\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*=\"news\"]::after {\n        content: none!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*=\"news\"]::before {\n        margin-right: 0.2em;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news*=\"news\"]::before {\n        content: \"\";\n        width: calc(1em * 16 / 14);\n        aspect-ratio: 16 / 14;\n        display: inline-flex;\n        vertical-align: text-top;\n        background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.5 -133.93)'/><polygon fill='%23f7ea0c' points='12.59 8.63 12.59 11.08 15.05 8.63 12.59 8.63'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.5 -133.93)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.5 -133.93)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.5 -133.93)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.5 -133.93)'/></svg>\") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news=\"recent-news\"]::before,\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news=\"news\"]::before {\n        width: calc(1em * 16 / 14);\n        background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.5 -133.93)'/><polygon fill='%23f7ea0c' points='12.59 8.63 12.59 11.08 15.05 8.63 12.59 8.63'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.5 -133.93)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.5 -133.93)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.5 -133.93)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.5 -133.93)'/></svg>\") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news=\"no-news\"]::before {\n        width: calc(1em * 16 / 14);\n        background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 14'><rect fill='%23eb008b' opacity='0' width='16' height='14'/><path fill='%23ebc971' d='M210.91,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33H212v-5.56A1.1,1.1,0,0,0,210.91,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-196 -134)'/><polygon fill='%23d6d6d6' points='12.59 8.55 12.59 11 15.05 8.55 12.59 8.55'/><path fill='%23a6a6a6' d='M212,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,212,137.11Zm-4.36,4.45V146h1.09v-3.33H212v-1.11Z' transform='translate(-196 -134)'/><path fill='%23d6d6d6' d='M200.34,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,200.34,145.69Z' transform='translate(-196 -134)'/><path fill='%23ffffff' d='M210.91,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-196 -134)'/><path fill='%23d6d6d6' d='M208.86,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,208.86,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,203.36,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-196 -134)'/></svg>\") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-news=\"new-news\"]::before {\n        width: calc(1em * 27 / 14);\n        aspect-ratio: 27 / 14;\n        background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 27 14'><rect fill='%23eb008b' opacity='0' width='27' height='14'/><path fill='%23ebc971' d='M214.41,136h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78a1.1,1.1,0,0,0,1.09,1.11h7.64v-3.33h3.27v-5.56A1.1,1.1,0,0,0,214.41,136Zm0,5.56h-3.27v3.33h-5.46a1.1,1.1,0,0,1-1.09-1.11v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.1,1.1,0,0,1,1.09,1.11Z' transform='translate(-199.45 -134)'/><polygon fill='%23f7ea0c' points='12.64 8.55 12.64 11 15.1 8.55 12.64 8.55'/><path fill='%23cc9800' d='M215.5,137.11v4.45h-1.09v-3.34a1.1,1.1,0,0,0-1.09-1.11h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,1.09,1.11h5.46V146h-6.55a1.1,1.1,0,0,1-1.09-1.11v-7.78a1.1,1.1,0,0,1,1.09-1.11h9.82A1.1,1.1,0,0,1,215.5,137.11Zm-4.36,4.45V146h1.09v-3.33h3.27v-1.11Z' transform='translate(-199.45 -134)'/><path fill='%23eaca71' d='M203.84,145.69l1.25-1a1.12,1.12,0,0,1-.5-.91v-5.56a1.1,1.1,0,0,1,1.09-1.11h7.64a1.08,1.08,0,0,1,.76.32l1.2-1a1.07,1.07,0,0,0-.87-.47h-9.82a1.1,1.1,0,0,0-1.09,1.11v7.78A1.11,1.11,0,0,0,203.84,145.69Z' transform='translate(-199.45 -134)'/><path fill='%23fbfc00' d='M214.41,138.22a1,1,0,0,0-.09-.43,1.08,1.08,0,0,0-.24-.36,1,1,0,0,0-.34-.23,1,1,0,0,0-.42-.09h-7.64a1.1,1.1,0,0,0-1.09,1.11v5.56a1.1,1.1,0,0,0,.07.36l.06.13a.5.5,0,0,0,.08.12,1.18,1.18,0,0,0,.29.3,1.1,1.1,0,0,0,.59.2h5.46v-3.33h3.27Z' transform='translate(-199.45 -134)'/><path fill='%23ebc971' d='M212.36,140.52v.81a.14.14,0,0,1-.14.14h-5.36a.15.15,0,0,1-.14-.14v-.81a.14.14,0,0,1,.14-.13h5.36A.13.13,0,0,1,212.36,140.52Zm-5.5-1.73h5.36a.13.13,0,0,0,.14-.13v-.81a.14.14,0,0,0-.14-.14h-5.36a.14.14,0,0,0-.14.14v.81A.14.14,0,0,0,206.86,138.79Zm4.19,4.11h-4.27a.13.13,0,0,0-.14.13v.81a.14.14,0,0,0,.14.14h4.27Z' transform='translate(-199.45 -134)'/><path fill='%23ffb878' d='M223.93,141.39v-.71h-2.67l1.88-1.88-.5-.5-1.89,1.89v-2.68H220v2.69l-1.9-1.89-.5.5,1.89,1.87h-2.67v.71h2.7l-1.91,1.9.5.5L220,141.9v2.66h.71v-2.67l1.9,1.89.5-.5-1.91-1.89h2.69Zm-3.53.38a.74.74,0,1,1,.73-.74A.74.74,0,0,1,220.4,141.77Z' transform='translate(-199.45 -134)'/><path fill='%23ff320d' d='M226.4,141.6v-1.2h-4.53l3.19-3.21-.85-.84L221,139.57V135h-1.2v4.58l-3.23-3.22-.85.85,3.21,3.19H214.4v1.2H219l-3.24,3.25.85.85,3.21-3.23V147H221v-4.53l3.23,3.21.85-.85-3.25-3.23h4.57Zm-5.25-.3h0l1.62,1.61-.43.43-1.61-1.61V144h-.6v-2.25h0l-1.6,1.61-.43-.43,1.62-1.62H217.4v-.6h2.26l-1.6-1.59.43-.43,1.61,1.61V138h.6v2.28l1.6-1.61.43.43-1.6,1.6h2.27v.6Z' transform='translate(-199.45 -134)'/></svg>\") no-repeat center / contain!important;\n    }\n    #LSscoringBox .head-to-head .teamAway + .teamHome .player-name a[data-pimg-processed]::before {\n        content: none!important;\n    }\n}\n"),
        MFLEnablePlayerImages &&
          (t +=
            '\n/***********************************************************/\n/*************** CSS FOR PLAYER IMAGES HTML*****************/\n/***********************************************************/\n/* CSS FOR anchor containing player image html */\na[data-pimg-processed] {\n    display: block;\n    max-width: 100%;\n    text-decoration: none!important;\n}\nth.fixed-side a[data-pimg-processed],\nli a[data-pimg-processed],\n#options_138 a[data-pimg-processed],\n#nfl_team_stats a[data-pimg-processed],\n#lineup td[data-type="hasinput"] input,\n#lineup td[data-type="hasinput"] a,\n#lineup td[data-type="hasinput"] b,\n#submit_lineup td[data-type="hasinput"] input,\n#submit_lineup td[data-type="hasinput"] a,\n#submit_lineup td[data-type="hasinput"] b,\n.articlecaption a[data-pimg-processed],\n#options_144 td[data-type="hasinput"] input,\n#options_144 td[data-type="hasinput"] a,\n#options_144 td[data-type="hasinput"] b {\n    display: inline-block;\n    vertical-align: middle;\n    white-space: break-spaces;\n}\n/* CSS FOR playerImgTable */\n.playerImgTable div {\n    vertical-align: middle;\n}\na[data-pimg-processed] .playerImgTable {\n    border: 0 !important;\n    box-shadow: none !important;\n    text-align: left !important;\n    padding: 0 !important;\n    margin: 0 !important;\n    border-spacing: 0!important;\n    border-collapse: collapse;\n    text-indent: 0!important;\n    width: 100%;\n    max-width: 17em;\n    line-height: 1.4;\n}\na[data-pimg-processed][data-narrow="1"] .playerImgTable {\n    width: auto;\n}\n.articlecaption a[data-pimg-processed] .playerImgTable {\n    width: unset!important;\n    max-width: unset!important;\n}\ntd.mondayHomeTeam a[data-pimg-processed] .playerImgTable {\n    margin-left: auto !important;\n    margin-right: 0 !important;\n}\n/* CSS FOR playerImg */\na[data-pimg-processed] .playerImgTable .playerImg {\n    text-align: center!important;\n}\n.articlecaption a[data-pimg-processed] .playerImg {\n    display: none !important;\n}\n.playerImgTable .playerImg {\n    width: 4em;\n    min-width: 4em;\n}\n/* CSS FOR playerPhoto */\n.playerImgTable .playerWrapper {\n    position: relative;\n}\n/* CSS FOR playerPhoto */\n.playerImgTable .playerPhoto {\n    border-radius: 50%;\n    height: 3.1em;\n    width: 3.1em;\n}\n/* CSS FOR TeamLogo */\n.playerImgTable .playerWrapper img.TeamLogo {\n    height: 1.7em;\n    width: 1.7em;\n    position: absolute;\n    bottom: 0;\n    right: 0.2em;\n}\ntd.mondayHomeTeam .playerImgTable .playerWrapper img.TeamLogo {\n    left: 0.2em;\n    right: auto;\n}\n/* CSS FOR teamPositionCircle */\n#pro_matchup[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_117[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#injury[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_207[data-page-narrow="1"] .recap_preview_players .playerImgTable .teamPositionCircle,\n#options_177[data-page-narrow="1"] .recap_preview_players .playerImgTable .teamPositionCircle,\n#fantasy_box_score[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_205[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#weekly[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_22[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_06[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#options_07[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\ntable.box_details_table[data-page-narrow="1"] .playerImgTable .teamPositionCircle,\n#trade_offer .playerImgTable .teamPositionCircle,\n#options_05 .playerImgTable .teamPositionCircle,\n#options_138 .playerImgTable .teamPositionCircle,\n#options_105 .playerImgTable .teamPositionCircle,\n#nfl_team_stats .playerImgTable .teamPositionCircle,\n#options_17 .playerImgTable .teamPositionCircle,\n#options_03 .playerImgTable .teamPositionCircle,\n#transactions .playerImgTable .teamPositionCircle,\nth.fixed-side a[data-pimg-processed] .teamPositionCircle {\n    display: block!important;\n}\n.playerImgTable .teamPositionCircle {\n    position: absolute;\n    width: 1.3em;\n    height: 1.3em;\n    line-height: 1.3em;\n    border-radius: 50%;\n    left: 0;\n    top: 0;\n    display: none;\n}\na[data-narrow="1"] .playerImgTable .teamPositionCircle {\n    display: block;\n}\ntd.mondayHomeTeam .playerImgTable .teamPositionCircle {\n    right: 0;\n    left: auto;\n}\n.playerImgTable .teamPositionCircleTxt {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n    font-size: 0.5em;\n    font-weight: bold;\n}\n/* CSS FOR playerNames */\ntd.mondayHomeTeam .playerImgTable .playerNames {\n    text-align: right!important;\n}\n/* CSS FOR playerLastName */\n.playerImgTable .playerLastName {\n    font-weight: 900;\n    display: flex;\n    align-items: center;\n    justify-content: left;\n    flex-wrap: wrap;\n}\ntd.mondayHomeTeam .playerImgTable .playerLastName {\n    justify-content: right;\n}\n/* CSS FOR playerFirstName */\n.playerImgTable .playerFirstName {\n    font-size: 0.9em;\n    font-weight: 400;\n}\n.articlecaption a[data-pimg-processed] .playerFirstName {\n    display: none !important;\n}\n.playerFirstName .warning {\n    font-size: inherit;\n}\n/* CSS FOR playerDetails */\n#pro_matchup[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_117[data-page-narrow="1"] .playerImgTable .playerDetails,\n#injury[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_207[data-page-narrow="1"] .recap_preview_players .playerImgTable .playerDetails,\n#options_177[data-page-narrow="1"] .recap_preview_players .playerImgTable .playerDetails,\n#fantasy_box_score[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_205[data-page-narrow="1"] .playerImgTable .playerDetails,\n#weekly[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_22[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_06[data-page-narrow="1"] .playerImgTable .playerDetails,\n#options_07[data-page-narrow="1"] .playerImgTable .playerDetails,\n.playerDetails table.box_details_table[data-page-narrow="1"] .playerImgTable .playerDetails,\n#trade_offer .playerImgTable .playerDetails,\n#options_05 .playerImgTable .playerDetails,\n#options_138 .playerImgTable .playerDetails,\n#options_105 .playerImgTable .playerDetails,\n#nfl_team_stats .playerImgTable .playerDetails,\n#options_17 .playerImgTable .playerDetails,\n#options_03 .playerImgTable .playerDetails,\n#transactions .playerImgTable .playerDetails,\nth.fixed-side a[data-pimg-processed] .playerDetails,\n.articlecaption a[data-pimg-processed] .playerDetails,\na[data-pimg-processed][data-narrow="1"] .playerDetails {\n    display: none!important;\n}\na[data-pimg-processed] .playerImgTable .playerDetails {\n    text-align: center!important;\n}\n.playerImgTable .playerDetails {\n    width: 2.6em;\n    font-size: 0.9em;\n    font-weight: 900;\n}\n/* CSS FIXES FOR SOME REPORTS USING PLAYER IMAGE HTML */\n.monday_player_team_position {\n    display: none!important;\n}\nth.fixed-side,\ntd[data-type="hasinput"],\nspan.plus-toggle-stats + a {\n    padding-right: calc(1em * 27 / 14) !important;\n}\n#submit_lineup > tbody > tr > th:first-child {\n    max-width: 9em;\n    width: 9em;\n}\n#lineup td[data-type="hasinput"],\n#submit_lineup td[data-type="hasinput"] {\n    white-space: nowrap;\n}\n#top .report td.points.tot,\n#top .report td.points.avg,\n#options_08 .report td.points.tot,\n#options_08 .report td.points.avg {\n    cursor: text;\n    pointer-events: auto;\n    user-select: text;\n}\n#top .report td.points.tot a,\n#top .report td.points.avg a,\n#options_08 .report td.points.tot a,\n#options_08 .report td.points.avg a {\n    pointer-events: none;\n    text-decoration: none!important;\n}\n#options_138 .report th.player,\n#options_105 .report td.player,\n#nfl_team_stats .report th[colspan] {\n    text-align: left!important;\n}\n.box_details_table td.player {\n    max-width: 13em;\n    width: 13em;\n    min-width: 13em;\n}\n#detailed.pagebody table.report td b:has(> a[data-pimg-processed]) + br,\n#ScoreDetails table.report td b:has(> a[data-pimg-processed]) + br {\n    display: none !important;\n}\n#teamBox td a[href*="player"][data-pimg-processed] {\n    pointer-events: all !important;\n}\n/***********************************************************/\n/*******CSS MEDIA QUERIES FOR PLAYER NEWS AND IMAGES********/\n/***********************************************************/\n@media only screen and (max-width: 62.5em) {\n    #MFLroster .playerImgTable .playerDetails {\n        display: none !important;\n    }\n    #MFLroster .playerImgTable .teamPositionCircle {\n        display: block !important;\n    }\n    #MFLroster .playerImgTable {\n        width: auto;\n    }\n    #options_03 li a[data-pimg-processed],\n    #transactions li a[data-pimg-processed] {\n        display: block;\n    }\n}'),
        ensureStyle('mfl-news-icons-style', t)
    }
  })()
  const Z = [
      '.myfantasyleague_menu',
      '.team_lineup_table',
      '#MFLPlayerPopupLinks',
      '#player_stats_table',
      '.biohistory',
      '.recap_preview_writeup',
      '#fantasy_recap p',
      '#fantasy_preview p',
      '#top .report td.points.tot',
      '#top .report td.points.avg',
      '#options_08 .report td.points.tot',
      '#options_08 .report td.points.avg',
      '#options_182 p',
      '.player-lineup-link',
      '#LSscoringBox',
      '#body_ajax_ls',
      '.previews_table p',
      '#todays_league_news p',
      '#options_185 table p',
      '#options_185 #toolData'
    ],
    X = [
      '#LSscoringBox',
      '#MFLPlayerPopupLinks',
      '#player_stats_table',
      '.biohistory',
      '#top .report td.points.tot',
      '#top .report td.points.avg',
      '#options_08 .report td.points.tot',
      '#options_08 .report td.points.avg'
    ],
    ee = ['#nodivhere'],
    te = mergeSelectors(Z, window.DO_NOT_PROCESS_IMAGES_EXTRA),
    ae = mergeSelectors(X, window.DO_NOT_PROCESS_NEWSICONS_EXTRA),
    re = mergeSelectors(ee, window.DO_NOT_PROCESS_ARTICLEICONS_EXTRA),
    oe = new Set([
      'JR',
      'SR',
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X'
    ]),
    ne =
      "a[href*='player?'][href*='P='], a[href*='player?'][href*='p='], a[href^='javascript:launch_player_modal']",
    ie =
      'td.headline a[href*="view_news_article?"], table.bionews.report tbody tr > td:not(.reportfooter) > a[href*="view_news_article?"]',
    se =
      /^(ARI|ATL|BAL|BUF|CAR|CHI|CIN|CLE|DAL|DEN|DET|GBP|HOU|IND|JAC|KCC|LAC|SDC|LAR|STL|RAM|LVR|OAK|MIA|MIN|NEP|NOS|NYG|NYJ|PHI|PIT|SEA|SFO|TBB|TEN|WAS|FA)$/,
    le =
      /^(COACH|QB|TMQB|TM|RB|TMRB|FB|WR|TMWR|TE|TMTE|KR|PK|TMPK|PN|TMPN|DE|DT|TMDL|LB|TMLB|CB|S|TMDB|OFF|DEF|ST)$/,
    ce =
      'https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/',
    de = { OAK: 'LVR', SDC: 'LAC', STL: 'LAR', RAM: 'LAR' },
    firstIsInitial = e =>
      'string' == typeof e && 1 === e.replace(/[^A-Za-z]/g, '').trim().length
  function isTeam (e) {
    return se.test(String(e || '').toUpperCase())
  }
  function teamLogoUrl (e) {
    const t = String(e || 'FA').toUpperCase(),
      a = de[t] || t
    return isTeam(a) ? ce + a + '.svg' : ce + 'FA.svg'
  }
  const pe = {
      Coach: 1,
      Off: 1,
      Def: 1,
      ST: 1,
      TM: 1,
      TMQB: 1,
      TMRB: 1,
      TMWR: 1,
      TMTE: 1,
      TMPK: 1,
      TMPN: 1,
      TMDL: 1,
      TMLB: 1,
      TMDB: 1
    },
    ue = new Set(Object.keys(pe).map(e => e.toUpperCase())),
    me = {
      TMQB: 'QB',
      TMRB: 'RB',
      TM: 'TM',
      TMWR: 'WR',
      TMTE: 'TE',
      TMPK: 'PK',
      COACH: 'C',
      TMPN: 'PN',
      TMDL: 'DL',
      TMLB: 'LB',
      TMDB: 'DB',
      OFF: 'O',
      DEF: 'D',
      ST: 'ST'
    },
    fe = {
      TMQB: 'QB',
      TMRB: 'RB',
      TM: 'TM',
      TMWR: 'WR',
      TMTE: 'TE',
      TMPK: 'PK',
      COACH: 'C',
      TMPN: 'PN',
      TMDL: 'DL',
      TMLB: 'LB',
      TMDB: 'DB',
      OFF: 'OFF',
      DEF: 'DEF',
      ST: 'ST'
    },
    he = 'data-pimg-processed'
  function normalizePos (e) {
    if (!e) return ''
    const t = String(e).toUpperCase()
    return le.test(t) ? t : ''
  }
  function isPos (e) {
    const t = normalizePos(e)
    return !!t && le.test(t)
  }
  function inDoNotProcessImages (e) {
    return !!e && ('1' === e.dataset?.pimgSkip || te.some(t => e.closest?.(t)))
  }
  function inDoNotProcessNews (e) {
    return !!e && ae.some(t => e.closest?.(t))
  }
  function inDoNotProcessArticles (e) {
    return !!e && re.some(t => e.closest?.(t))
  }
  let ye = null,
    _e = !1
  function buildDbIndex (e = !1) {
    const t = getLivePlayerDB()
    if (_e && !e) return
    if (!dbLooksPopulated(t)) return
    const a = new Map(),
      addFromRecord = (e, t) => {
        if (!t) return
        ;((e, t) => {
          if (!e || !t) return
          const r = String(e),
            o = r.replace(/^0+/, '')
          a.set(r, t),
            o && o !== r && a.set(o, t),
            a.set('pid_' + r, t),
            a.set('pid_' + o, t)
        })(
          t?.id ??
            t?.pid ??
            t?.playerID ??
            t?.PlayerID ??
            (e ? String(e).replace(/^pid_/, '') : null),
          t
        )
      }
    if (Array.isArray(t)) {
      for (const e of t) addFromRecord(null, e)
      for (const [e, a] of Object.entries(t))
        /^\d+$/.test(e) || addFromRecord(e, a)
    } else if ('object' == typeof t)
      for (const [e, a] of Object.entries(t))
        if (Array.isArray(a)) for (const e of a) addFromRecord(null, e)
        else addFromRecord(e, a)
    ;(ye = a), (_e = a.size > 0)
  }
  function getDbPlayerById (e) {
    _e || buildDbIndex(!1)
    const t = String(e || ''),
      a = t.replace(/^0+/, '')
    if (!_e) {
      const e = getLivePlayerDB()
      if (!dbLooksPopulated(e)) return null
      let r = null
      if (
        (Array.isArray(e)
          ? ((r =
              e.find(
                e => String(e?.id ?? e?.pid ?? e?.playerID ?? e?.PlayerID) === t
              ) ||
              e.find(
                e => String(e?.id ?? e?.pid ?? e?.playerID ?? e?.PlayerID) === a
              )),
            r || (r = e[t] || e[a] || e['pid_' + t] || e['pid_' + a] || null))
          : (r = e[t] || e[a] || e['pid_' + t] || e['pid_' + a] || null),
        r)
      )
        return (
          ye || (ye = new Map()),
          ye.set(t, r),
          ye.set(a, r),
          ye.set('pid_' + t, r),
          ye.set('pid_' + a, r),
          (_e = ye.size > 0),
          r
        )
      buildDbIndex(!0)
    }
    return (
      (ye &&
        (ye.get(t) || ye.get(a) || ye.get('pid_' + t) || ye.get('pid_' + a))) ||
      null
    )
  }
  function pushCustomPlayerImages (e, t, a) {
    return ue.has(String(e || '').toUpperCase())
      ? `https://www.mflscripts.com/playerImages_96x96/mfl_${t}.svg`
      : `https://www.mflscripts.com/playerImages_96x96/mfl_${a}.png`
  }
  function getArticleIdFromHref (e) {
    if (!e) return ''
    try {
      return new URL(e, location.href).searchParams.get('ID') || ''
    } catch {
      const t = e.match(/[?&]ID=([^&]+)/i)
      return t ? decodeURIComponent(t[1]) : ''
    }
  }
  function getArticleMeta (e) {
    const t = e.innerHTML,
      a = e.closest('tr')
    return {
      articleHeadline: t,
      articleAgo: a?.querySelector('td.timestamp')?.innerHTML || '',
      articleLink: getArticleIdFromHref(e.getAttribute('href')) || ''
    }
  }
  function extractPidFromHref (e) {
    if (!e) return null
    if (e.toLowerCase().startsWith('javascript:')) {
      const t = e.match(/launch_player_modal\('\d+','(\d+)'\)/)
      return t ? t[1] : null
    }
    const t = e.match(/[?&]P=(\d+)/i)
    return t ? t[1] : null
  }
  function getAnchorNameText (e) {
    const t = Array.from(e.childNodes).find(e => e.nodeType === Node.TEXT_NODE)
    return ((t ? t.textContent : e.textContent) || '')
      .trim()
      .replace(/\s+/g, ' ')
  }
  function resolveFromHtmlThenDb (e, t, a) {
    let r = !1,
      o = '',
      n = '',
      i = '',
      s = ''
    const l = getAnchorNameText(t)
    if (l.includes(','))
      ({
        first: o,
        last: n,
        team: i,
        pos: s
      } = parseNameTeamPosFromAnchorText(l))
    else if (l) {
      const e = getDbPlayerById(a)
      if (e?.name) {
        const t = String(e.name),
          a = t.indexOf(',')
        ;(n = (a >= 0 ? t.slice(0, a) : t).trim()),
          (o = (a >= 0 ? t.slice(a + 1) : '').trim())
      } else {
        const e = l.split(/\s+/)
        if (1 === e.length) (n = e[0]), (o = '')
        else {
          const t = e[e.length - 1],
            a = t.replace(/\./g, '').toUpperCase()
          if (oe.has(a)) {
            ;(n = e[e.length - 2] + ' ' + t),
              (o = e.slice(0, e.length - 2).join(' '))
          } else (n = e.pop()), (o = e.join(' '))
        }
      }
    }
    if (('Team' === n && (r = !0), !s)) {
      const e = (t.className || '').match(/(^|\s)position_([a-z0-9]+)/i)
      e && (s = e[2])
    }
    ;(s = normalizePos(s)), isPos(s) || (s = '')
    const c = !!i
    let d = !1,
      p = !o || !n || r || firstIsInitial(o)
    if (!o || !n || !i || !s || r || firstIsInitial(o)) {
      const e = getDbPlayerById(a)
      if (e) {
        if ((r || !o || !n) && e.name) {
          const t = String(e.name || ''),
            a = t.indexOf(','),
            i = (a >= 0 ? t.slice(0, a) : t).trim(),
            s = (a >= 0 ? t.slice(a + 1) : '').trim()
          ;(!r && o) || !s || (o = s),
            (!r && n) || !i || (n = i),
            (p = !o || !n || firstIsInitial(o))
        }
        if (!i && e.team) {
          const t = String(e.team).toUpperCase()
          ;('FA' === t && c) || ((i = t), (d = !0))
        }
        if (!s && (e.position || e.pos)) {
          const t = normalizePos(e.position || e.pos || '')
          t && (s = t)
        }
      }
    }
    return (
      (i = String(i || 'FA').toUpperCase()),
      (s = String(s || '').toUpperCase()),
      isPos(s) || (s = ''),
      o || n
        ? {
            first: o,
            last: n,
            team: i,
            pos: s,
            htmlTeamProvided: c,
            usedDbTeam: d,
            needNameRehydrate: p
          }
        : null
    )
  }
  function cloneNormalizedWarning (e) {
    const t = e.cloneNode(!0)
    let a = (e.textContent || '').trim()
    return (a = a.replace(/[()]/g, '').trim()), (t.textContent = a), t
  }
  function pluckRookieAndInjury (e) {
    const isText = e => e && 3 === e.nodeType,
      text = e => e.textContent || '',
      isWS = e => isText(e) && /^\s*$/.test(text(e)),
      isClose = e => isText(e) && /^\s*\)\s*$/.test(text(e)),
      kill = e => {
        e && e.parentNode && e.parentNode.removeChild(e)
      }
    let t = null,
      a = null,
      r = null,
      o = e.nextSibling
    for (; o; )
      if (isWS(o)) o = o.nextSibling
      else if (isText(o) && /\(\s*R\s*\)/i.test(text(o))) {
        t = '(R)'
        const e = o.nextSibling
        kill(o), (o = e)
      } else {
        if (isText((n = o)) && /^\s*\(\s*$/.test(text(n))) {
          let e = o.nextSibling
          for (; isWS(e); ) e = e.nextSibling
          if (e && 1 === e.nodeType && e.matches('span.warning')) {
            a = cloneNormalizedWarning(e)
            let t = e.nextSibling
            for (; isWS(t); ) t = t.nextSibling
            isClose(t) && kill(t), kill(e)
            const r = o.nextSibling
            kill(o), (o = r)
            continue
          }
        }
        if (1 === o.nodeType && o.matches('span.warning')) {
          a = cloneNormalizedWarning(o)
          let e = o.nextSibling
          for (kill(o); isWS(e); ) {
            const t = e.nextSibling
            kill(e), (e = t)
          }
          if (isClose(e)) {
            const t = e.nextSibling
            kill(e), (e = t)
          }
          o = e
        } else {
          if (1 === o.nodeType && 'SUP' === o.tagName) {
            if ('IR' === (o.textContent || '').trim().toUpperCase()) {
              ;(r = o.cloneNode(!0)), (r.textContent = 'IR')
              let e = o.nextSibling
              for (kill(o); isWS(e); ) {
                const t = e.nextSibling
                kill(e), (e = t)
              }
              o = e
              continue
            }
          }
          if (!isClose(o)) break
          {
            const e = o.nextSibling
            kill(o), (o = e)
          }
        }
      }
    var n
    return { rookieText: t, injurySpanClone: a, irSupClone: r }
  }
  function pluckTrailingStar (e) {
    let t = e.nextSibling
    for (; t && 3 === t.nodeType && /^\s*$/.test(t.textContent); )
      t = t.nextSibling
    return (
      !(!t || 3 !== t.nodeType || !/^\s*\*\s*$/.test(t.textContent)) &&
      (t.parentNode.removeChild(t), !0)
    )
  }
  function removeResidualMarkersAfterAnchor (e) {
    const isText = e => e && 3 === e.nodeType,
      txt = e => e.textContent || '',
      onlyParens = e => /^[\s\u00A0]*[()]+[\s\u00A0]*$/.test(e),
      onlyWS = e => /^[\s\u00A0]+$/.test(e)
    let t = e.nextSibling
    for (
      ;
      t &&
      isText(t) &&
      (onlyParens(txt(t)) ||
        ((a = txt(t)), /^\s*\(\s*[A-Za-z]{1,4}\s*\)\s*$/.test(a)) ||
        onlyWS(txt(t)));

    ) {
      const e = t.nextSibling
      t.remove(), (t = e)
    }
    for (
      var a;
      e.nextSibling && isText(e.nextSibling) && onlyParens(txt(e.nextSibling));

    )
      e.nextSibling.remove()
  }
  function purgeAnchorTextCrumbs (e) {
    if (!e) return
    let t = !1
    for (const r of Array.from(e.childNodes))
      3 === r.nodeType
        ? (/^\s*$/.test(r.textContent || ''), r.remove(), (t = !0))
        : 1 !== r.nodeType ||
          ((a = r).matches && a.matches('.playerImgTable')) ||
          (r.remove(), (t = !0))
    var a
    const r = e.querySelector('.playerImgTable')
    if (!r) return
    let o = r.previousSibling
    for (; o; ) {
      const e = o.previousSibling
      3 === o.nodeType && o.remove(), (o = e)
    }
    let n = r.nextSibling
    for (; n; ) {
      const e = n.nextSibling
      3 === n.nodeType && n.remove(), (n = e)
    }
    t && e.normalize && e.normalize()
  }
  function buildInnerTableForAnchor (e) {
    if (!MFLEnablePlayerImages) return null
    if (
      e.classList.contains('mfl-orig-link') ||
      '1' === e.dataset.pimgSkip ||
      e.hidden
    )
      return null
    const t = extractPidFromHref(e.getAttribute('href') || '')
    if (!t) return null
    t && !e.dataset.playerId && (e.dataset.playerId = String(t)),
      e.setAttribute(he, '1')
    const a = e.closest('td') || e.closest('tr') || e.parentElement || e,
      r = resolveFromHtmlThenDb(a, e, t)
    if (!r) return null
    const o = pluckTrailingStar(e),
      {
        rookieText: n,
        injurySpanClone: i,
        irSupClone: s
      } = pluckRookieAndInjury(e),
      l = !(
        !a.classList?.contains('mondayHomeTeam') &&
        !a.closest?.('.mondayHomeTeam')
      )
    !(function markHasInput (e) {
      const prevIsInput = e => 'INPUT' === e?.previousElementSibling?.tagName,
        t = e.parentElement
      if (!(prevIsInput(e) || (t && 'B' === t.tagName && prevIsInput(t))))
        return
      const a = e.closest('td')
      if (!a) return
      const r = (a.dataset.type || '').trim()
      r
        ? r.split(/\s+/).includes('hasinput') ||
          (a.dataset.type = `${r} hasinput`)
        : (a.dataset.type = 'hasinput')
    })(e)
    const c = e.parentElement
    c &&
      ('TD' === c.tagName
        ? (c.classList.add('player'), l && c.classList.add('reverse_row'))
        : 'B' === c.tagName &&
          c.parentElement &&
          'TD' === c.parentElement.tagName &&
          (c.parentElement.classList.add('player'),
          l && c.parentElement.classList.add('reverse_row')))
    const {
      first: d,
      last: p,
      team: u,
      pos: m,
      htmlTeamProvided: f,
      needNameRehydrate: h
    } = r
    m && (e.dataset.pos = String(m).toUpperCase()),
      u &&
        'FA' !== u.toUpperCase() &&
        (e.dataset.team = String(u).toUpperCase())
    const y = String(m || '').toUpperCase(),
      _ = me[y] || m,
      g = fe[y] || m,
      b = Object.prototype.hasOwnProperty.call(me, y),
      w = teamLogoUrl(u),
      k = document.createElement('div')
    ;(k.style.display = 'table-cell'), (k.className = 'playerImg')
    const L = document.createElement('div')
    L.className = 'playerWrapper'
    const P = document.createElement('img')
    if (
      ((P.className = 'playerPhoto'),
      (P.loading = 'lazy'),
      (P.decoding = 'async'),
      (P.width = 96),
      (P.height = 96),
      (P.alt = `${p || ''} ${d || ''}`.trim() || 'Player'),
      (P.src = pushCustomPlayerImages(m, u, t)),
      (P.onerror = () => {
        P.src = 'https://www.mflscripts.com/playerImages_96x96/free_agent.png'
      }),
      !b)
    ) {
      const e = document.createElement('img')
      ;(e.className = 'TeamLogo'),
        (e.width = 24),
        (e.height = 24),
        (e.decoding = 'async'),
        (e.alt = ''),
        e.setAttribute('aria-hidden', 'true'),
        (e.src = w),
        L.appendChild(e)
    }
    const S = document.createElement('div')
    ;(S.className = `teamPositionCircleTxt ${String(m).toLowerCase()}`),
      (S.title = `Position: ${String(m || '').toUpperCase()}`),
      (S.textContent = _ || '')
    const M = document.createElement('div')
    ;(M.className = 'teamPositionCircle'),
      HidePlayerDetails && M.style.setProperty('display', 'block', 'important'),
      M.appendChild(S),
      M.setAttribute('aria-hidden', 'true'),
      S.setAttribute('aria-hidden', 'true'),
      L.prepend(P),
      L.appendChild(M),
      k.appendChild(L)
    const F = document.createElement('div')
    HidePlayerDetails
      ? F.style.setProperty('display', 'none', 'important')
      : (F.style.display = 'table-cell'),
      (F.className = 'playerDetails')
    const x = document.createElement('div')
    ;(x.className = 'playerPosition'), (x.textContent = g || '')
    const T = document.createElement('div')
    ;(T.className = 'playerTeam'), (T.textContent = u), F.append(x, T)
    const C = document.createElement('div')
    ;(C.className = 'playerLastName'), (C.textContent = p || '')
    const B = document.createElement('div')
    ;(B.style.display = 'table-cell'), (B.className = 'playerNames')
    const A = document.createElement('div')
    if (
      ((A.className = 'playerFirstName'),
      (A.textContent = d || ''),
      o && A.appendChild(document.createTextNode(' *')),
      n)
    ) {
      const e = document.createElement('span')
      ;(e.className = 'rookie_status'),
        (e.textContent = n),
        (e.style.display = 'inline-block'),
        (e.title = 'Rookie'),
        l
          ? (e.style.marginRight = '0.188rem')
          : (e.style.marginLeft = '0.188rem'),
        l ? A.prepend(e) : A.appendChild(e)
    }
    const D = i || null
    if (D) {
      const e = (D.textContent || '').replace(/[()]/g, '').trim()
      e &&
        ((D.textContent = `(${e})`),
        l
          ? (D.style.marginRight = '0.188rem')
          : (D.style.marginLeft = '0.188rem'),
        l ? A.prepend(D) : A.appendChild(D))
    }
    if (s) {
      s.classList.add('warning'), (s.title = 'Injured Reserve')
      try {
        ;(s.style.marginLeft = '0.188rem'), (s.style.verticalAlign = 'middle')
      } catch (e) {}
      l ? A.prepend(s) : A.appendChild(s)
    }
    removeResidualMarkersAfterAnchor(e),
      purgeAnchorTextCrumbs(e),
      queueMicrotask(() => purgeAnchorTextCrumbs(e)),
      setTimeout(() => purgeAnchorTextCrumbs(e), 0)
    const E = e.parentElement,
      N = E?.classList?.contains('shouldstart'),
      I = E?.classList?.contains('shouldbench')
    if (N) {
      E.classList.remove('shouldstart')
      const e = document.createElement('span')
      ;(e.className = 'shouldHavestart'),
        (e.style.marginLeft = '0.188rem'),
        (e.innerHTML =
          '<i class="fas fa-angle-double-up" title="Should Have Started" style="color:green;vertical-align:middle"></i>'),
        A.appendChild(e)
    }
    if (I) {
      E.classList.remove('shouldbench')
      const e = document.createElement('span')
      ;(e.className = 'shouldHavebench'),
        (e.style.marginLeft = '0.188rem'),
        (e.innerHTML =
          '<i class="fa-solid fa-angles-down" title="Should Have Benched" style="color:red;vertical-align:middle"></i>'),
        A.appendChild(e)
    }
    B.append(C, A)
    const R = document.createElement('div')
    ;(R.className = 'playerImgTable'), (R.style.display = 'table')
    const O = document.createElement('div')
    ;(O.style.display = 'table-row'),
      l ? O.append(F, B, k) : O.append(k, B, F),
      R.appendChild(O)
    const W = document.createDocumentFragment()
    W.appendChild(R),
      (e.textContent = ''),
      e.replaceChildren(W),
      purgeAnchorTextCrumbs(e)
    const j = [d, p, u && `(${u})`, g].filter(Boolean).join(' ')
    j && (e.setAttribute('aria-label', j), (e.title = j)),
      MFLPopupEnablePlayerNews &&
        !inDoNotProcessNews(a) &&
        (e.setAttribute('aria-haspopup', 'dialog'),
        e.setAttribute('aria-expanded', 'false'))
    if (
      ((!isPos(m) || ('FA' === (u || '').toUpperCase() && !f) || h) &&
        (h && (e.dataset.namePending = '1'),
        queueRehydrate(t, {
          teamDiv: T,
          wrapper: L,
          pImg: P,
          posDiv: x,
          posMobile: S,
          pos: m
        })),
      window.observePlayerLinkWidth && observePlayerLinkWidth(e),
      MFLPopupEnablePlayerNews && !inDoNotProcessNews(a))
    ) {
      e.setAttribute('data-news_preload', '1')
      try {
        tagAnchorNewsFast(e, t)
      } catch (e) {}
    } else e.removeAttribute('data-news_preload')
    return R
  }
  const ge = { pending: new Map(), timer: null }
  function queueRehydrate (e, t) {
    if (!MFLEnablePlayerImages || !e || !t) return
    let a =
      t?.teamDiv?.closest?.('a') ||
      t?.wrapper?.closest?.('a') ||
      t?.posDiv?.closest?.('a') ||
      t?.posMobile?.closest?.('a') ||
      null
    if (
      (a || (a = document.querySelector(`a[data-player-id="${String(e)}"]`)), a)
    ) {
      a.dataset.playerId || (a.dataset.playerId = String(e)),
        ge.pending.has(e) || ge.pending.set(e, new Set()),
        ge.pending.get(e).add(a)
      try {
        buildDbIndex(!1)
      } catch (e) {}
      _e
        ? rehydrateNow()
        : (ge.timer && clearTimeout(ge.timer),
          (ge.timer = setTimeout(() => {
            ;(ge.timer = null), rehydrateNow()
          }, 120)))
    }
  }
  function rehydrateNow () {
    if (
      MFLEnablePlayerImages &&
      0 !== ge.pending.size &&
      (buildDbIndex(!1), _e)
    )
      for (const [e, t] of ge.pending.entries()) {
        const a = getDbPlayerById(e)
        if (!a) {
          ge.pending.delete(e)
          continue
        }
        const r = String(a.team || '').toUpperCase(),
          o = normalizePos(a.position || a.pos || ''),
          n = isPos(o)
        t.forEach(t => {
          if (!t || !t.isConnected) return
          const i = t.querySelector('.playerTeam'),
            s = t.querySelector('.playerWrapper'),
            l = t.querySelector('img.playerPhoto'),
            c = t.querySelector('.playerPosition'),
            d = t.querySelector('.teamPositionCircleTxt')
          if (
            ((t.dataset.playerId = String(e)),
            n && (t.dataset.pos = o),
            r && (t.dataset.team = r),
            i)
          ) {
            const e = (i.textContent || '').trim().toUpperCase()
            r && r !== e && (i.textContent = r)
          }
          if (
            (n &&
              (c && (c.textContent = fe[o] || o),
              d && (d.textContent = me[o] || o)),
            '1' === t.dataset.namePending && a?.name)
          ) {
            const e = String(a.name),
              n = e.indexOf(','),
              i = (n >= 0 ? e.slice(0, n) : e).trim(),
              s = (n >= 0 ? e.slice(n + 1) : '').trim(),
              l = t.querySelector('.playerLastName'),
              c = t.querySelector('.playerFirstName')
            if ((l && i && (l.textContent = i), c && s)) {
              const e = Array.from(c.childNodes).find(
                e => e.nodeType === Node.TEXT_NODE
              )
              e
                ? (e.textContent = s)
                : c.insertBefore(document.createTextNode(s), c.firstChild)
            }
            const d = t.querySelector('img.playerPhoto')
            d && (d.alt = `${i || ''} ${s || ''}`.trim() || 'Player')
            const p = (r || '').trim(),
              u = String(o || t.dataset.pos || '').toUpperCase(),
              m = [s, i, p && `(${p})`, fe[u] || u || '']
                .filter(Boolean)
                .join(' ')
            m && (t.setAttribute('aria-label', m), (t.title = m)),
              delete t.dataset.namePending
          }
          try {
            const e =
                t.querySelector('.playerLastName')?.textContent?.trim() || '',
              a = t.querySelector('.playerFirstName')?.firstChild,
              n =
                a && a.nodeType === Node.TEXT_NODE
                  ? a.textContent.trim()
                  : (t.querySelector('.playerFirstName')?.textContent || '')
                      .split('(')[0]
                      .trim(),
              i = (r || '').trim(),
              s = String(o || '').toUpperCase(),
              l = [n, e, i && `(${i})`, fe[s] || s || '']
                .filter(Boolean)
                .join(' ')
            l && (t.setAttribute('aria-label', l), (t.title = l))
          } catch (e) {}
          if (s) {
            const e = ue.has(o)
            let t = s.querySelector?.('.TeamLogo')
            if (e) t && t.remove()
            else {
              const e = teamLogoUrl(r)
              t ||
                ((t = document.createElement('img')),
                (t.className = 'TeamLogo'),
                (t.width = 24),
                (t.height = 24),
                (t.decoding = 'async'),
                (t.alt = ''),
                t.setAttribute('aria-hidden', 'true'),
                s.appendChild(t)),
                e && t.src !== e && (t.src = e)
            }
          }
          if (l) {
            const a = t.dataset.pos || '',
              i = pushCustomPlayerImages(n ? o : a, r || 'FA', e)
            i && l.src !== i && (l.src = i)
          }
        }),
          t.clear(),
          ge.pending.delete(e)
      }
  }
  function processAllPlayerLinks (e = document) {
    if (!MFLEnablePlayerImages) return
    const t = e.querySelectorAll(ne),
      a = !(!J || 'function' != typeof J.disconnect)
    if (a)
      try {
        J.disconnect()
      } catch (e) {}
    try {
      t.forEach(e => {
        if ('1' !== e.getAttribute(he) && !inDoNotProcessImages(e))
          try {
            buildInnerTableForAnchor(e)
          } catch (e) {}
      })
    } finally {
      if (a)
        try {
          J.observe(document.body, {
            childList: !0,
            subtree: !0,
            attributes: !0,
            attributeFilter: ['href', 'data-player-id'],
            characterData: !0
          })
        } catch (e) {}
    }
  }
  function getNewsAttr (e) {
    return void 0 === newsBreaker
      ? 'news'
      : void 0 === newsBreaker['pid_' + e]
      ? 'no-news'
      : 0 === newsBreaker['pid_' + e]
      ? 'new-news'
      : 'recent-news'
  }
  let be = new Set(),
    we = !1
  const ke = (() => {
    const e =
      'function' == typeof window.requestIdleCallback
        ? window.requestIdleCallback.bind(window)
        : null
    let t = null
    return a => {
      if (e) return e(a, { timeout: 150 })
      clearTimeout(t), (t = setTimeout(a, 16))
    }
  })()
  function scheduleFlushNews () {
    we || ((we = !0), ke(flushNews))
  }
  function flushNews () {
    if (((we = !1), 0 !== be.size)) {
      for (const e of be)
        try {
          tagAnchorNews(e)
        } catch (e) {}
      be.clear()
    }
  }
  function enqueueNews (e) {
    MFLPopupEnablePlayerNews &&
      e &&
      !inDoNotProcessNews(e) &&
      (annotateAnchorMeta(e), be.add(e), scheduleFlushNews())
  }
  function annotateAnchorMeta (e) {
    if (!e) return
    if ('1' === e.getAttribute(he)) return
    if (e.dataset?.pos && e.dataset?.team) return
    let t = e.dataset?.playerId
    if (!t) {
      ;(t = extractPidFromHref(e.getAttribute('href') || '')),
        t && (e.dataset.playerId = String(t))
    }
    if (t && MFLEnablePlayerImages && !inDoNotProcessImages(e)) {
      if (!e.dataset?.pos) {
        const t = (e.className || '').match(
          /(?:^|\s)position_([a-z0-9]+)(?:\s|$)/i
        )
        if (t) {
          const a = normalizePos(t[1])
          a && (e.dataset.pos = a)
        }
      }
      try {
        if (!e.dataset.pos || !e.dataset.team) {
          const a = resolveFromHtmlThenDb(
            e.closest('td') || e.closest('tr') || e.parentElement || e,
            e,
            t
          )
          if (
            a &&
            (!e.dataset.pos &&
              a.pos &&
              (e.dataset.pos = String(a.pos).toUpperCase()),
            !e.dataset.team && a.team)
          ) {
            const t = String(a.team).toUpperCase()
            e.dataset.team =
              a.htmlTeamProvided || 'FA' !== t ? t : e.dataset.team || ''
          }
        }
      } catch (e) {}
      if (!e.dataset.pos || !e.dataset.team) {
        const a = getDbPlayerById(t)
        if (a) {
          if (!e.dataset.pos) {
            const t = normalizePos(a.position || a.pos || '')
            t && (e.dataset.pos = t)
          }
          if (!e.dataset.team && a.team) {
            const t = String(a.team).toUpperCase()
            'FA' !== t && (e.dataset.team = t)
          }
        }
      }
    }
  }
  function parseNameTeamPosFromAnchorText (e) {
    const t = String(e || '')
      .trim()
      .replace(/\s+/g, ' ')
    let a = '',
      r = '',
      o = '',
      n = ''
    if (!t) return { first: a, last: r, team: o, pos: n }
    const i = t.indexOf(',')
    if (i >= 0) {
      r = t.slice(0, i).trim()
      const e = t.slice(i + 1).trim()
      if (e) {
        const t = e.split(/\s+/)
        let r = -1,
          i = -1
        for (let e = 0; e < t.length; e++) {
          const a = t[e].toUpperCase()
          if (-1 === r && se.test(a)) {
            ;(r = e), (o = a)
            continue
          }
          const s = normalizePos(a)
          ;-1 === i && s && ((i = e), (n = s))
        }
        a = t
          .filter((e, t) => t !== r && t !== i)
          .join(' ')
          .trim()
      }
    } else {
      const e = t.split(/\s+/)
      if (1 === e.length) r = e[0]
      else {
        const t = e[e.length - 1],
          o = t.replace(/\./g, '').toUpperCase()
        if (oe.has(o) && e.length >= 2) {
          ;(r = e[e.length - 2] + ' ' + t),
            (a = e.slice(0, e.length - 2).join(' '))
        } else (r = e.pop()), (a = e.join(' '))
      }
    }
    return { first: a, last: r, team: o, pos: n }
  }
  function tagAnchorNewsFast (e, t) {
    if (!MFLPopupEnablePlayerNews) return
    if (!e || inDoNotProcessNews(e)) return
    if (void 0 === newsBreaker)
      return void ('news' !== e.dataset.news && (e.dataset.news = 'news'))
    let a = t || e.dataset.playerId
    if (!a) {
      ;(a = extractPidFromHref(e.getAttribute('href') || '')),
        a && (e.dataset.playerId = String(a))
    }
    if (!a) return
    const r = getNewsAttr(a)
    e.dataset.news !== r && (e.dataset.news = r)
  }
  function tagAnchorNews (e) {
    if (!MFLPopupEnablePlayerNews) return
    if (!e || inDoNotProcessNews(e)) return
    let t = e.dataset.playerId
    if (
      (t ||
        ((t = extractPidFromHref(e.getAttribute('href'))),
        t && (e.dataset.playerId = String(t))),
      !t)
    )
      return
    annotateAnchorMeta(e)
    const a = getNewsAttr(t)
    e.dataset.news !== a && (e.dataset.news = a)
  }
  function ensureArticleDataset (e) {
    MFLPopupEnableArticle &&
      e &&
      !inDoNotProcessArticles(e) &&
      (e.dataset.newsArticle || (e.dataset.newsArticle = '1'))
  }
  if (
    (K &&
      MFLPopupEnablePlayerNews &&
      (document.addEventListener(
        'click',
        function (e) {
          const t = e.target && (e.target.closest ? e.target.closest(ne) : null)
          if (!t) return
          const a = !!t.closest?.('#LSscoringBox'),
            r = !0 === window.MFLnewsEnableScoreboard
          if (inDoNotProcessNews(t) && (!a || !r)) return
          if (e.metaKey || e.ctrlKey) return
          if (!('news' in t.dataset)) {
            try {
              tagAnchorNews(t)
            } catch (e) {}
            if (!('news' in t.dataset)) return
          }
          e.preventDefault(), e.stopPropagation()
          const o = document.getElementById('MFLPlayerPopupNews')
          if (o) {
            o.classList.add('active_div_tab_scroll')
            try {
              bodyScrollLock?.disableBodyScroll?.(o)
            } catch (e) {}
          }
          const n =
            t.dataset.playerId ||
            extractPidFromHref(t.getAttribute('href')) ||
            '(unknown)'
          MFLPlayerPopupCurrentPID = n
          let i = '',
            s = '',
            l = '',
            c = '',
            d = '',
            p = ''
          const u = getDbPlayerById(n)
          if (!u) {
            const e = t.href
            if (
              confirm(
                "MFL Database for selected player has no data.\n\nYou can view the player's info by going to the year this data is available.\n\nClick OK to continue."
              )
            ) {
              const t = window.open(e, '_blank', 'noopener')
              t && (t.opener = null)
            }
            return
          }
          {
            const e = String(u?.name || ''),
              a = e.indexOf(',')
            ;(d = a >= 0 ? e.slice(0, a).trim() : e.trim()),
              (c = a >= 0 ? e.slice(a + 1).trim() : ''),
              (s = String(u.team || '').toUpperCase()),
              'FA' === s && (s = t.dataset.team || 'FA'),
              (i = normalizePos(u.position || u.pos || '')),
              (l = u.name || `${d}, ${c}`),
              (p = `${d}, ${c} ${s} ${i}`)
          }
          ;(isPos(i) && isTeam(s)) ||
            ('string' == typeof baseURLDynamic &&
              baseURLDynamic &&
              'undefined' != typeof year &&
              fetch(
                `${baseURLDynamic}/${year}/export?TYPE=players&PLAYERS=${n}&JSON=1`
              )
                .then(e => e.json())
                .then(e => {
                  try {
                    const t = e?.players?.player
                    t &&
                      ((l = t.name || l),
                      (s = (t.team || s || '').toUpperCase()),
                      (i = normalizePos(t.position || i)),
                      (p = `${l} ${s} ${i}`))
                  } catch (e) {}
                })
                .catch(() => {}))
          const $ = (e, t = document) => t.querySelector(e),
            $$ = (e, t = document) => Array.from(t.querySelectorAll(e)),
            show = e => {
              e && (e.style.display = e.dataset._display || 'block')
            },
            hide = e => {
              e && (e.style.display = 'none')
            }
          show($('#MFLPlayerPopupOverlay')),
            show($('#MFLPlayerPopupContainer #MFLPlayerPopupLoading')),
            $$('.MFLPlayerPopupPlayerTabs').forEach(e => {
              e.closest('#TeamDetails') || (e.style.display = 'table-cell')
            })
          {
            const e = $('#MFLPlayerPopupBioTab')
            e && ((e.style.display = 'none'), e.removeAttribute('style'))
          }
          $$('.MFLPlayerPopupNotificationTabs').forEach(hide)
          {
            const e = $('#MFLPlayerPopupLinks')
            e &&
              (e.style.display =
                void 0 !== MFLPopupOmitLinks && MFLPopupOmitLinks
                  ? 'none'
                  : 'block')
          }
          hide($('#MFLPlayerPopupLoaded')),
            hide($('#MFLPlayerPopupArticleLoaded'))
          {
            const e = $('#MFLPlayerPopupName')
            e && (e.textContent = p || '')
          }
          show($('#MFLPlayerPopupContainer')),
            t.setAttribute('aria-expanded', 'true'),
            setTimeout(() => {
              try {
                MFLPlayerPopupPopulate(n, l, s, i)
              } catch (e) {}
            }, 10),
            $$('.teamdetailsWrap, #TeamDetails').forEach(hide),
            $('#leftTeam') && ($('#leftTeam').innerHTML = ''),
            $('#rightTeam') && ($('#rightTeam').innerHTML = ''),
            $('#ScoreDetails tbody') &&
              ($('#ScoreDetails tbody').innerHTML = ''),
            $$('#teamToggles input').forEach(e => {
              e.value = ''
            })
          const m = $('#fullSeasonPts')
          m && m.parentNode && m.parentNode.removeChild(m),
            $$(
              '.scoredetailsWrap, #ScoreDetails, .scoredetailsWrap, #ScoreNFLDetails'
            ).forEach(hide),
            $$('#ScoreNFLDetails table').forEach(e =>
              e.classList.remove('box_details_table')
            ),
            $$('#ScoreDetails table').forEach(e =>
              e.classList.remove(
                'scoring_details_table',
                'overview_details_table'
              )
            )
          const f = $('#MFLPlayerPopupContainer')
          f?.querySelectorAll('a.dblClicks').forEach(e =>
            e.classList.remove('dblClicks')
          )
        },
        !0
      ),
      document.addEventListener(
        'keydown',
        function (e) {
          const t = e.target && (e.target.closest ? e.target.closest(ne) : null)
          if (!t) return
          const a = !!t.closest?.('#LSscoringBox'),
            r = !0 === window.MFLnewsEnableScoreboard
          if (inDoNotProcessNews(t) && (!a || !r)) return
          const o = 'Enter' === e.key,
            n = ' ' === e.key || 'Spacebar' === e.key
          ;(o || n) && (e.preventDefault(), t.click())
        },
        !0
      )),
    (function enableElementWidthHiding () {
      const e = new WeakSet()
      let t = !1
      const getPageBody = () => document.querySelector('div.pagebody'),
        scopeRoot = () => getPageBody() || document
      let a = 0
      function scheduleUpdatePageNarrowFlag () {
        const e = performance.now()
        if (t) return
        t = !0
        setTimeout(
          () => {
            ;(a = performance.now()),
              (function updatePageNarrowFlagNow () {
                t = !1
                const e = getPageBody(),
                  a = scopeRoot().querySelectorAll('[data-narrow="1"]'),
                  r =
                    a.length > 0 &&
                    Array.from(a).some(e => null !== e.offsetParent)
                e
                  ? r
                    ? e.setAttribute('data-page-narrow', '1')
                    : e.removeAttribute('data-page-narrow')
                  : r
                  ? document.documentElement.setAttribute(
                      'data-page-narrow',
                      '1'
                    )
                  : document.documentElement.removeAttribute(
                      'data-page-narrow'
                    ),
                  document
                    .querySelectorAll('table.box_details_table')
                    .forEach(e => {
                      Array.from(e.querySelectorAll('[data-narrow="1"]')).some(
                        e => null !== e.offsetParent
                      )
                        ? e.setAttribute('data-page-narrow', '1')
                        : e.removeAttribute('data-page-narrow')
                    })
              })()
          },
          e - a < 80 ? 80 : 0
        )
      }
      const r = new ResizeObserver(e => {
        for (const t of e) {
          const e = t.target,
            a = 16 * (parseFloat(getComputedStyle(e).fontSize) || 16)
          let r
          if (t.contentBoxSize) {
            r = (
              Array.isArray(t.contentBoxSize)
                ? t.contentBoxSize[0]
                : t.contentBoxSize
            ).inlineSize
          } else r = e.clientWidth
          r <= a
            ? e.setAttribute('data-narrow', '1')
            : e.removeAttribute('data-narrow')
        }
        scheduleUpdatePageNarrowFlag()
      })
      ;(window.observePlayerLinkWidth = function (t) {
        t &&
          !e.has(t) &&
          (e.add(t),
          r.observe(t),
          requestAnimationFrame(() => {
            const e = 16 * (parseFloat(getComputedStyle(t).fontSize) || 16)
            t.clientWidth <= e
              ? t.setAttribute('data-narrow', '1')
              : t.removeAttribute('data-narrow'),
              scheduleUpdatePageNarrowFlag()
          }))
      }),
        window.addEventListener('resize', scheduleUpdatePageNarrowFlag),
        window.addEventListener(
          'orientationchange',
          scheduleUpdatePageNarrowFlag
        ),
        document.addEventListener(
          'visibilitychange',
          scheduleUpdatePageNarrowFlag
        )
      new MutationObserver(() => scheduleUpdatePageNarrowFlag()).observe(
        document.body,
        {
          childList: !0,
          subtree: !0,
          attributes: !0,
          attributeFilter: ['data-narrow']
        }
      ),
        (window.updatePageNarrowFlag = scheduleUpdatePageNarrowFlag),
        document.addEventListener(
          'DOMContentLoaded',
          scheduleUpdatePageNarrowFlag
        )
    })(),
    (J = new MutationObserver(e => {
      for (const t of e)
        if ('childList' === t.type)
          for (const e of t.addedNodes) {
            if (1 !== e.nodeType) continue
            const t = e,
              a = inDoNotProcessNews(t),
              r = inDoNotProcessImages(t),
              o = t.matches?.(ne)
            if (o) {
              if (
                (MFLPopupEnablePlayerNews && !a && enqueueNews(t),
                MFLEnablePlayerImages && !r && '1' !== t.getAttribute(he))
              )
                try {
                  buildInnerTableForAnchor(t)
                } catch (e) {}
              t.getAttribute &&
                '1' === t.getAttribute(he) &&
                purgeAnchorTextCrumbs(t)
            }
            if (
              (o ||
                t.querySelectorAll?.(ne).forEach(e => {
                  if (
                    (MFLPopupEnablePlayerNews &&
                      !inDoNotProcessNews(e) &&
                      enqueueNews(e),
                    MFLEnablePlayerImages &&
                      !inDoNotProcessImages(e) &&
                      '1' !== e.getAttribute(he))
                  )
                    try {
                      buildInnerTableForAnchor(e)
                    } catch (e) {}
                  '1' === e.getAttribute(he) && purgeAnchorTextCrumbs(e)
                }),
              MFLPopupEnableArticle)
            ) {
              const e = t.matches?.(ie)
              e
                ? ensureArticleDataset(t)
                : t.querySelectorAll?.(ie).forEach(ensureArticleDataset)
            }
          }
        else if ('attributes' === t.type) {
          const e = t.target
          if (1 === e.nodeType && e.matches?.(ne)) {
            const t = e
            if (
              (MFLPopupEnablePlayerNews &&
                !inDoNotProcessNews(t) &&
                enqueueNews(t),
              MFLEnablePlayerImages &&
                !inDoNotProcessImages(t) &&
                '1' !== t.getAttribute(he))
            )
              try {
                buildInnerTableForAnchor(t)
              } catch (e) {}
            '1' === t.getAttribute(he) && purgeAnchorTextCrumbs(t)
          }
          MFLPopupEnableArticle &&
            1 === e.nodeType &&
            e.matches?.(ie) &&
            ensureArticleDataset(e)
        } else if ('characterData' === t.type) {
          const e = t.target.parentNode?.closest?.(ne)
          if (e && 1 === e.nodeType) {
            if (
              (MFLPopupEnablePlayerNews &&
                !inDoNotProcessNews(e) &&
                enqueueNews(e),
              MFLEnablePlayerImages &&
                !inDoNotProcessImages(e) &&
                '1' !== e.getAttribute(he))
            )
              try {
                buildInnerTableForAnchor(e)
              } catch (e) {}
            '1' === e.getAttribute(he) && purgeAnchorTextCrumbs(e)
          }
          if (MFLPopupEnableArticle) {
            const e = t.target?.parentNode?.closest?.(ie)
            e && ensureArticleDataset(e)
          }
        }
    })),
    (K || MFLPopupEnableArticle) && 'undefined' != typeof MutationObserver)
  ) {
    const startObserving = () =>
      J.observe(document.body, {
        childList: !0,
        subtree: !0,
        attributes: !0,
        attributeFilter: ['href', 'data-player-id'],
        characterData: !0
      })
    document.body
      ? startObserving()
      : document.addEventListener('DOMContentLoaded', startObserving, {
          once: !0
        })
  }
  function hydrateAllAnchorMeta (e = document, t = !1) {
    if (!MFLPopupEnablePlayerNews) return
    const a = e.querySelectorAll(ne)
    if (t)
      a.forEach(e => {
        inDoNotProcessNews(e) || tagAnchorNewsFast(e)
      })
    else {
      try {
        buildDbIndex(!1)
      } catch (e) {}
      a.forEach(e => {
        inDoNotProcessNews(e) ||
          ((e.dataset?.pos && e.dataset?.team) || annotateAnchorMeta(e),
          enqueueNews(e))
      })
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    MFLPopupEnableArticle &&
      document.querySelectorAll(ie).forEach(e => {
        inDoNotProcessArticles(e) ||
          e.dataset.newsArticle ||
          (e.dataset.newsArticle = '1')
      }),
      K &&
        (MFLPopupEnablePlayerNews && hydrateAllAnchorMeta(document, !0),
        MFLEnablePlayerImages &&
          (processAllPlayerLinks(document),
          ge.pending.size > 0 &&
            setTimeout(() => {
              buildDbIndex(!1), _e && rehydrateNow()
            }, 400)))
  }),
    document.addEventListener(
      'click',
      function (e) {
        if (!MFLPopupEnableArticle) return
        const t = e.target?.closest?.(ie)
        if (!t || inDoNotProcessArticles(t)) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if (1 === e.button) return
        if ('_blank' === t.target) return
        e.preventDefault(), e.stopPropagation()
        const {
          articleHeadline: a,
          articleAgo: r,
          articleLink: o
        } = getArticleMeta(t)
        try {
          MFLPlayerPopupArticleSetup(a, r, o)
        } catch (e) {
          try {
            const e = window.open(t.href, '_blank', 'noopener')
            e && (e.opener = null)
          } catch (e) {}
        }
      },
      !0
    ),
    (function () {
      if (!K) return
      let e = !1,
        t = { started: !1, rafLeft: 60, intId: null }
      function runPostCacheTasks () {
        try {
          MFLPopupEnablePlayerNews &&
            (function watchNewsBreaker () {
              if (void 0 !== window.newsBreaker)
                return void hydrateAllAnchorMeta(document)
              let e = 0
              const t = setInterval(() => {
                void 0 !== window.newsBreaker
                  ? (clearInterval(t), hydrateAllAnchorMeta(document))
                  : ++e > 200 && clearInterval(t)
              }, 25)
            })(),
            (function ensurePlayerDbHydratedOnce () {
              if (e) return !1
              if (!dbLooksPopulated(getLivePlayerDB())) return !1
              try {
                buildDbIndex(!0),
                  MFLEnablePlayerImages &&
                    ge?.pending?.size > 0 &&
                    rehydrateNow()
              } catch (e) {}
              return (
                (e = !0),
                t.intId && (clearInterval(t.intId), (t.intId = null)),
                !0
              )
            })()
        } catch (e) {}
      }
      try {
        window.MFLGlobalCache.onReady(() => {
          runPostCacheTasks()
        })
      } catch (e) {}
    })(),
    window.addEventListener('MFLCacheUpdate', e => {
      K &&
        'newsBreaker' === e.detail.key &&
        MFLPopupEnablePlayerNews &&
        hydrateAllAnchorMeta(document, !0)
    }),
    (function attachMFLHelpers () {
      function _resolveRoot (e) {
        return e
          ? e instanceof Element || e === document
            ? e
            : ('string' == typeof e && document.querySelector(e)) || document
          : document
      }
      function refreshNewsIcons (e) {
        if (!K || !window.MFLPopupEnablePlayerNews) return
        const t = _resolveRoot(e)
        inDoNotProcessNews(t) ||
          (t.matches?.(ne) && !inDoNotProcessNews(t) && enqueueNews(t),
          t.querySelectorAll?.(ne).forEach(e => {
            inDoNotProcessNews(e) || enqueueNews(e)
          }))
      }
      function refreshPlayerImages (e) {
        if (!K || !window.MFLEnablePlayerImages) return
        const t = _resolveRoot(e)
        if (!inDoNotProcessImages(t)) {
          if (
            t.matches?.(ne) &&
            '1' !== t.getAttribute(he) &&
            !inDoNotProcessImages(t)
          )
            try {
              buildInnerTableForAnchor(t)
            } catch (e) {}
          t.querySelectorAll?.(ne).forEach(e => {
            if ('1' !== e.getAttribute(he) && !inDoNotProcessImages(e))
              try {
                buildInnerTableForAnchor(e)
              } catch (e) {}
          }),
            ge?.pending?.size > 0 &&
              setTimeout(() => {
                buildDbIndex(!1), rehydrateNow()
              }, 200)
        }
      }
      if (!K) {
        const noop = () => {}
        return (
          (window.refreshNewsIcons = noop),
          (window.refreshPlayerImages = noop),
          (window.refreshAll = noop),
          (window.markAllNewsDirty = noop),
          void (window.rehydratePendingNow = noop)
        )
      }
      ;(window.refreshNewsIcons = refreshNewsIcons),
        (window.refreshPlayerImages = refreshPlayerImages),
        (window.refreshAll = function refreshAll (e) {
          refreshNewsIcons(e), refreshPlayerImages(e)
        }),
        (window.markAllNewsDirty = function markAllNewsDirty (e) {
          if (!K || !MFLPopupEnablePlayerNews) return
          const t = _resolveRoot(e)
          if (inDoNotProcessNews(t)) return
          const a = []
          t.matches?.(ne) && a.push(t),
            t.querySelectorAll?.(ne).forEach(e => a.push(e))
          for (const e of a)
            inDoNotProcessNews(e) ||
              (e.dataset && 'news' in e.dataset && delete e.dataset.news,
              enqueueNews(e))
        }),
        (window.rehydratePendingNow = function rehydratePendingNow () {
          if (K && MFLEnablePlayerImages)
            try {
              buildDbIndex(!0), rehydrateNow()
            } catch (e) {}
        })
    })(),
    (function wirePopupA11yClose () {
      if (!K || !MFLPopupEnablePlayerNews) return
      const e = document.getElementById('MFLPlayerPopupOverlay'),
        t = document.getElementById('MFLPlayerPopupClose')
      let a = null
      function closePopupAndRestoreFocus () {
        if (a && a.isConnected) {
          a.setAttribute('aria-expanded', 'false')
          try {
            a.focus({ preventScroll: !0 })
          } catch (e) {}
        }
      }
      document.addEventListener(
        'click',
        e => {
          const t = e.target && (e.target.closest ? e.target.closest(ne) : null)
          t && MFLPopupEnablePlayerNews && !inDoNotProcessNews(t) && (a = t)
        },
        !0
      ),
        e && e.addEventListener('click', closePopupAndRestoreFocus, !0),
        t && t.addEventListener('click', closePopupAndRestoreFocus, !0),
        document.addEventListener(
          'keydown',
          function (e) {
            'Escape' === e.key && closePopupAndRestoreFocus()
          },
          !0
        )
    })(),
    $(document).ready(function () {
      if (document.getElementById('body_player')) {
        const t = new URL(window.location.href).searchParams.get('P')
        var e =
          'https://www.mflscripts.com/playerImages_80x107/mfl_' + t + '.png'
        $('body').addClass('espn_body_player'),
          $('head').append(
            '<style>.espn_body_player td.player_photo img{-webkit-box-sizing:unset;-moz-box-sizing:unset;box-sizing:unset;background:#fff}.espn_body_player td.player_photo{text-align:center}</style>'
          ),
          $('#body_player td.player_photo img').each(function (a, r) {
            var o
            ;(o = $(this)).attr('src', e),
              o.one('error', function () {
                o.one('error', function () {
                  o.one('error', function () {
                    $(this).attr(
                      'src',
                      'https://www63.myfantasyleague.com/player_photos_2010/no_photo_available.jpg'
                    ),
                      $('body').removeClass('espn_body_player')
                  }),
                    $(this).attr(
                      'src',
                      'https://www.mflscripts.com/playerImages_80x107/free_agent.png'
                    ),
                    $('body').addClass('espn_body_player')
                }),
                  $(this).attr(
                    'src',
                    '//www.myfantasyleague.com/player_photos_2014/' +
                      t +
                      '_thumb.jpg'
                  ),
                  $('body').removeClass('espn_body_player')
              })
          })
      }
      $('head').append(
        '<style>.espnImg .articlepicture[src*="playerImages"]{-webkit-box-sizing:unset;-moz-box-sizing:unset;box-sizing:unset;background:#fff;width:auto!important}.espnImg td{display:table;margin:0 auto!important}</style>'
      ),
        $(
          '#body_options_185,#options_177,#options_207,#fantasy_articles,#fantasy_recap,#fantasy_preview'
        )
          .find('img.articlepicture[src*="_thumb"]')
          .each(function () {
            var e = $(this)
                .attr('src')
                .match(/\/(\d+).*\.jpg$/ || ['', ''])[1],
              t =
                'https://www.mflscripts.com/playerImages_80x107/mfl_' +
                e +
                '.png'
            $(this).closest('.articlepicturetable').addClass('espnImg'),
              $(this).attr('src', t),
              $(this).each(function (a, r) {
                var o
                ;(o = $(this)).attr('src', t),
                  o.one('error', function () {
                    o.one('error', function () {
                      o.one('error', function () {
                        $(this).attr(
                          'src',
                          'https://www63.myfantasyleague.com/player_photos_2010/no_photo_available.jpg'
                        ),
                          $(this)
                            .closest('.articlepicturetable')
                            .removeClass('espnImg')
                      }),
                        $(this).attr(
                          'src',
                          'https://www.mflscripts.com/playerImages_80x107/free_agent.png'
                        ),
                        $(this)
                          .closest('.articlepicturetable')
                          .addClass('espnImg')
                    }),
                      $(this).attr(
                        'src',
                        '//www.myfantasyleague.com/player_photos_2014/' +
                          e +
                          '_thumb.jpg'
                      ),
                      $(this)
                        .closest('.articlepicturetable')
                        .removeClass('espnImg')
                  })
              })
          })
    }),
    jQuery('head').append(
      '<style>#MFLPlayerPopupHeader > table > tbody > tr:nth-child(4) br,#MFLPlayerPopupBio > table > tbody > tr:nth-child(4) br{display:none}#MFLPlayerPopupHeader > table > tbody > tr:nth-child(4) td:nth-child(1),#MFLPlayerPopupBio > table > tbody > tr:nth-child(4) td:nth-child(1){overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:6.25rem}.playerPopupIcon[src*=".svg"],.playerPopupIcon[src*=".svg"][src*="newsNew"]{height:0.875rem!important;padding-left:0!important;margin-top:-0.188rem!important;vertical-align: middle!important}#MFLPlayerPopupOverlay[style*="display: block"] + #MFLPlayerPopupContainer{display:block!important}.MFLPlayerPopupNFLTeamLogo{right:0.375rem;left:auto;top:0.188rem;max-width:1.375rem;max-height:1.375rem}#MFLPlayerPopupHeader .popreport td,#MFLPlayerPopupBio .popreport td.pop-photo{padding-right:0.313rem}.MFLPopupFontAwesomeMenu {font-size:1.5rem;float:right;padding-left:0.5rem;padding-top: 0.375rem;}.MFLPopupNotify2{float:initial;font-size:1.25rem}.MFLPopupFontAwesomeCaption {font-size: 1.125rem;}.MFLPlayerPopupHeaderCaption .MFLPopupFontAwesomeMenu{float:none;padding:0;font-size:100%}@media only screen and (max-width: 26.25em){.pt-hide{display:none}}</style>'
    ),
    MFLPlayerPopupIncludeProjections &&
      jQuery('head').append(
        '<style>#MFLPlayerPopupProjections{position:relative;height:17.5rem;height:17.5rem;overflow:auto;-webkit-overflow-scrolling:touch}</style>'
      )
  try {
    CameraTag.jQueryPreInstalled = !0
  } catch (ve) {}
  function setCookie (e, t, a) {
    var r = new Date()
    r.setTime(r.getTime() + 24 * a * 60 * 60 * 1e3)
    var o = 'expires=' + r.toUTCString()
    document.cookie = e + '=' + t + ';' + o + ';path=/'
  }
  function getCookie (e) {
    for (
      var t = e + '=', a = document.cookie.split(';'), r = 0;
      r < a.length;
      r++
    ) {
      for (var o = a[r]; ' ' === o.charAt(0); ) o = o.substring(1)
      if (0 === o.indexOf(t)) return o.substring(t.length, o.length)
    }
    return ''
  }
  function MFLPlayerPopupCreateContainer () {
    jQuery('body').append("<div id='isMediaContainer' style='display:none'>"),
      jQuery('#isMediaContainer').append("<div class='isMedia'>"),
      jQuery('body').append("<div id='MFLPlayerPopupOverlay'>"),
      jQuery('body').append(
        "<div id='MFLPlayerPopupContainer' style='left:0!important;right:0!important;top:0!important;bottom:0!important;margin:auto'>"
      ),
      jQuery('#MFLPlayerPopupContainer').append(
        "<caption class='MFLPlayerPopupHeaderCaption'><span id='MFLPlayerPopupName'></span></caption>"
      ),
      jQuery('#MFLPlayerPopupContainer').append(
        "<span id='MFLPlayerPopupClose' onclick='MFLPlayerPopupClose()'>X</span>"
      ),
      jQuery('#MFLPlayerPopupContainer').append(
        "<div id='MFLPlayerPopupLoading'><center>Loading Content . . .<br><br><div class='MFLPlayerPopupLoader'></div></center></div>"
      ),
      jQuery('#MFLPlayerPopupContainer').append(
        "<div id='MFLPlayerPopupArticleLoaded'>"
      ),
      jQuery('#MFLPlayerPopupContainer').append(
        "<div id='MFLPlayerPopupLoaded'>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupHeader'></div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div class='MFLPopTabWrap'><ul class='MFLPlayerPopupTab'></ul></div><div id='MFLPlayerPopupLinks'></div>"
      ),
      jQuery('.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)').append(
        "<li class='MFLPlayerPopupPlayerTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupNews')\" id='MFLPlayerPopupTabLinksNews'><span class='pt-hide'>Player</span> News</a></li>"
      ),
      jQuery(
        ".MFLPlayerPopupTab:not('#TeamDetails .MFLPlayerPopupTab')"
      ).append(
        "<li class='MFLPlayerPopupPlayerTabs' id='MFLPlayerPopupBioTab'><a href='javascript:void(0)' class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupBio')\">Bio</a></li>"
      ),
      jQuery('.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)').append(
        "<li class='MFLPlayerPopupPlayerTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupStats')\"><span class='pt-hide'>" +
          year +
          '</span> Stats</a></li>'
      ),
      MFLPlayerPopupIncludeProjections &&
        jQuery(
          '.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)'
        ).append(
          "<li class='MFLPlayerPopupPlayerTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupProjections')\">Proj.</a></li>"
        ),
      jQuery('.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)').append(
        "<li class='MFLPlayerPopupPlayerTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupStatsHistory')\">Career <span class='pt-hide'>Stats</span></a></li>"
      ),
      (MFLPopupEnableTrade || MFLPopupEnableTradePoll) &&
        jQuery(
          '.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)'
        ).append(
          "<li class='MFLPlayerPopupNotificationTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupTrades')\" id='MFLPlayerPopupTabLinksTrades'>Trades</a></li>"
        ),
      MFLPopupEnableCommishMessage &&
        '' !== MFLPopupCommishMessage &&
        jQuery(
          '.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)'
        ).append(
          "<li class='MFLPlayerPopupNotificationTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupCommishMessage')\" id='MFLPlayerPopupTabLinksCommishMessage'>Commish Msg</a></li>"
        ),
      MFLPopupEnableReminders &&
        jQuery(
          '.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)'
        ).append(
          "<li class='MFLPlayerPopupNotificationTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupReminders')\" id='MFLPlayerPopupTabLinksReminders'>Reminders</a></li>"
        ),
      MFLPopupEnableMessages &&
        jQuery(
          '.MFLPlayerPopupTab:not(#TeamDetails .MFLPlayerPopupTab)'
        ).append(
          "<li class='MFLPlayerPopupNotificationTabs'><a href='javascript:void(0)'  class='MFLPlayerPopupTabLinks' onclick=\"MFLPlayerPopupOpenTab(event, 'MFLPlayerPopupMessages')\" id='MFLPlayerPopupTabLinksMessages'>Messages</a></li>"
        ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupNews' class='MFLPlayerPopupTabContent'></div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupBio' class='MFLPlayerPopupTabContent'>Bio Table</div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupStatsHistory' class='MFLPlayerPopupTabContent'>Stats History Table</div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupStats' class='MFLPlayerPopupTabContent'>Stats Table</div>"
      ),
      MFLPlayerPopupIncludeProjections &&
        jQuery('#MFLPlayerPopupLoaded').append(
          "<div id='MFLPlayerPopupProjections' class='MFLPlayerPopupTabContent'><div id='MFLPlayerPopupLoading'><center>Loading Content . . .<br><br><div class='MFLPlayerPopupLoader'></div></center></div></div>"
        ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupTrades' class='MFLPlayerPopupTabContent'>No Data</div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupCommishMessage' class='MFLPlayerPopupTabContent'>No Data</div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupReminders' class='MFLPlayerPopupTabContent'>No Data</div>"
      ),
      jQuery('#MFLPlayerPopupLoaded').append(
        "<div id='MFLPlayerPopupMessages' class='MFLPlayerPopupTabContent'>No Data</div>"
      ),
      jQuery('#MFLPlayerPopupContainer').wrapInner(
        "<div class='report'></div>"
      ),
      jQuery('#MFLPlayerPopupOverlay')
        .off()
        .on('click', function () {
          MFLPlayerPopupClose()
        })
  }
  function isElementVisible (e) {
    if (!e) return !1
    const t = getComputedStyle(e),
      a = e.getBoundingClientRect(),
      r = a.width > 0 && a.height > 0 && a.bottom > 0 && a.right > 0
    return (
      'none' !== t.display &&
      'hidden' !== t.visibility &&
      '0' !== t.opacity &&
      r
    )
  }
  function MFLPlayerPopupClose () {
    jQuery('#MFLPlayerPopupOverlay').hide(),
      jQuery('#MFLPlayerPopupContainer').hide(),
      jQuery('.MFLPlayerPopupTabContent').hide(),
      jQuery('#MFLPlayerPopupContainer').removeClass(
        'MFLPlayerPopupArticleContainer'
      ),
      jQuery('#MFLPlayerPopupContainer').removeClass(
        'MFLPlayerPopupNotificationContainer'
      )
    try {
      ;('undefined' != typeof LSMteamBox &&
        LSMteamBox &&
        isElementVisible(LSMteamBox)) ||
        bodyScrollLock.clearAllBodyScrollLocks()
    } catch (e) {}
    $('.MFLPlayerPopupTabContent').removeClass('active_div_tab_scroll'),
      $('.MFLPlayerPopupPlayerTabs a,.MFLPlayerPopupNotificationTabs a')
        .not('#TeamDetails .MFLPlayerPopupPlayerTabs a')
        .removeClass('active')
  }
  function MFLPlayerPopupOpenTab (e, t) {
    var a, r, o
    for (
      $('#TeamDetails .MFLPlayerPopupTab a.active').addClass('dummyClass'),
        r = document.getElementsByClassName('MFLPlayerPopupTabContent'),
        a = 0;
      a < r.length;
      a++
    )
      r[a].style.display = 'none'
    for (
      o = document.getElementsByClassName('MFLPlayerPopupTabLinks'), a = 0;
      a < o.length;
      a++
    )
      o[a].className = o[a].className.replace(' active', '')
    ;(document.getElementById(t).style.display = 'block'),
      (e.currentTarget.className += ' active'),
      'MFLPlayerPopupProjections' === t &&
        setTimeout('MFLPlayerPopupPopulateProjections()', 5),
      $('#TeamDetails .MFLPlayerPopupTab a.dummyClass').addClass('active'),
      $('#TeamDetails .MFLPlayerPopupTab a.dummyClass').removeClass(
        'dummyClass'
      ),
      $('.MFLPlayerPopupTabContent:visible').addClass('active_div_tab_scroll'),
      $('.MFLPlayerPopupTabContent:hidden').removeClass('active_div_tab_scroll')
    const n = document.querySelector('.active_div_tab_scroll')
    try {
      bodyScrollLock.disableBodyScroll(n)
    } catch (e) {}
  }
  function includes (e, t) {
    var a = !1
    return e.indexOf(t) >= 0 && (a = !0), a
  }
  function MFLPlayerPopupSetupTeamNames () {
    for (var e in franchiseDatabase)
      'fid_0000' !== e &&
        franchiseDatabase.hasOwnProperty(e) &&
        (MFLPlayerPopupTeamNames[franchiseDatabase[e].name] = {
          id: franchiseDatabase[e].id,
          abbrev: franchiseDatabase[e].abbrev
        })
  }
  function MFLPlayerPopupMoreNews (e, t) {
    fetch(`${baseURLDynamic}/${year}/${e}`)
      .then(e => e.text())
      .then(e => {
        var a = 0,
          r = ''
        jQuery(e)
          .find('.report tr')
          .each(function () {
            1 === a &&
              (jQuery(this).find('td a').contents().unwrap(),
              (r = jQuery(this).find('td:eq(0)').html()).indexOf(
                'Article Link'
              ) > 0 && (r = r.substring(0, r.indexOf('Article Link') - 2)),
              r.indexOf('Roto Pass from') > 0 &&
                (r = r.substring(0, r.indexOf('Roto Pass from') - 3))),
              a++
          }),
          '' !== r && jQuery('#' + t).html(r)
      })
  }
  function MFLPlayerPopupArticleSetup (e, t, a) {
    const r = document.getElementById('MFLPlayerPopupContainer')
    r && r.classList.add('MFLPlayerPopupArticleContainer')
    const o = document.getElementById('MFLPlayerPopupOverlay'),
      n = document.querySelector(
        '#MFLPlayerPopupContainer #MFLPlayerPopupLoading'
      ),
      i = document.getElementById('MFLPlayerPopupLoaded'),
      s = document.getElementById('MFLPlayerPopupArticleLoaded'),
      l = document.getElementById('MFLPlayerPopupName')
    o && (o.style.display = 'block'),
      n && (n.style.display = 'block'),
      i && (i.style.display = 'none'),
      s && (s.style.display = 'none'),
      l && (l.textContent = `Article Posted ${t} Ago`),
      r && (r.style.display = 'block'),
      document.querySelectorAll('.teamdetailsWrap, #TeamDetails').forEach(e => {
        e.style.display = 'none'
      })
    try {
      const e = document.querySelector('#MFLPlayerPopupArticleLoaded')
      e &&
        window.bodyScrollLock?.disableBodyScroll &&
        window.bodyScrollLock.disableBodyScroll(e)
    } catch {}
    setTimeout(() => {
      MFLPlayerPopupArticlePopulate(e, t, a)
    }, 200)
  }
  function MFLPlayerPopupNotificationPreSetup () {
    jQuery('#MFLPlayerPopupContainer').addClass(
      'MFLPlayerPopupNotificationContainer'
    ),
      jQuery('#MFLPlayerPopupOverlay').show(),
      jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').show(),
      jQuery(
        '.MFLPlayerPopupPlayerTabs:not(#TeamDetails .MFLPlayerPopupPlayerTabs)'
      ).css('display', 'none'),
      jQuery('#MFLPlayerPopupBioTab').attr('style', 'display:none!important'),
      jQuery('.MFLPlayerPopupNotificationTabs').css('display', 'table-cell'),
      jQuery('#MFLPlayerPopupLinks').css('display', 'none'),
      jQuery('#MFLPlayerPopupLoaded').hide(),
      jQuery('#MFLPlayerPopupArticleLoaded').hide(),
      !MFLPopupEnableTrade ||
      ('' === MFLPlayerPopupOnloadContent[0] &&
        '' === MFLPlayerPopupOnloadContent[1])
        ? MFLPopupEnableCommishMessage && '' !== MFLPlayerPopupOnloadContent[4]
          ? ($('#MFLPlayerPopupCommishMessage')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksCommishMessage').addClass('active'))
          : MFLPopupEnableReminders && '' !== MFLPlayerPopupOnloadContent[2]
          ? ($('#MFLPlayerPopupReminders')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksReminders').addClass('active'))
          : MFLPopupEnableMessages && '' !== MFLPlayerPopupOnloadContent[3]
          ? ($('#MFLPlayerPopupMessages')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksMessages').addClass('active'))
          : MFLPopupEnableTrade
          ? ($('#MFLPlayerPopupTrades')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksTrades').addClass('active'))
          : MFLPopupEnableCommishMessage
          ? ($('#MFLPlayerPopupCommishMessage')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksCommishMessage').addClass('active'))
          : MFLPopupEnableReminders
          ? ($('#MFLPlayerPopupReminders')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksReminders').addClass('active'))
          : MFLPopupEnableMessages
          ? ($('#MFLPlayerPopupMessages')
              .addClass('active_div_tab_scroll')
              .show(),
            $('#MFLPlayerPopupTabLinksMessages').addClass('active'))
          : (jQuery('#MFLPlayerPopupHeader')
              .html(
                "<table class='popreport'><tbody><tr><th>You Have No Notifications!</th></tr><tr class='oddtablerow'><td>There are currently no active notifications.</td></tr></tbody></table>"
              )
              .parent()
              .addClass('noHide'),
            $('#MFLPlayerPopupMessages')
              .addClass('active_div_tab_scroll')
              .show())
        : ($('#MFLPlayerPopupTrades').addClass('active_div_tab_scroll').show(),
          $('#MFLPlayerPopupTabLinksTrades').addClass('active'))
    const e = document.querySelector('.active_div_tab_scroll')
    try {
      bodyScrollLock.disableBodyScroll(e)
    } catch (e) {}
    jQuery('#MFLPlayerPopupName').html(
      "League Notifications <span class='MFLPopupLeagueNotification' style='padding:0;background:none' title='Notifications'>" +
        MFLPopupNotifyFontAwesome +
        '</span>'
    ),
      jQuery('#MFLPlayerPopupContainer').show()
  }
  function MFLPlayerPopupNotificationSetup (e) {
    1 === MFLPlayerPopupTracker[0] &&
      1 === MFLPlayerPopupTracker[1] &&
      1 === MFLPlayerPopupTracker[2] &&
      1 === MFLPlayerPopupTracker[3] &&
      1 === MFLPlayerPopupTracker[4] &&
      (e ||
        '' !== MFLPlayerPopupOnloadContent[0] ||
        '' !== MFLPlayerPopupOnloadContent[1] ||
        '' !== MFLPlayerPopupOnloadContent[2] ||
        '' !== MFLPlayerPopupOnloadContent[3] ||
        '' !== MFLPlayerPopupOnloadContent[4]) &&
      (e || MFLPlayerPopupNotificationPreSetup(),
      '' === MFLPlayerPopupOnloadContent[0] &&
      '' === MFLPlayerPopupOnloadContent[1] &&
      '' === MFLPlayerPopupOnloadContent[2] &&
      '' === MFLPlayerPopupOnloadContent[3] &&
      '' === MFLPlayerPopupOnloadContent[4]
        ? jQuery('#MFLPlayerPopupHeader')
            .html(
              "<table class='popreport'><tbody><tr><th>You Have No Notifications!</th></tr><tr class='oddtablerow'><td>There are currently no active notifications.</td></tr></tbody></table>"
            )
            .parent()
            .addClass('noHide')
        : MFLPopupEnableAutoNotification
        ? jQuery('#MFLPlayerPopupHeader').html(
            "<table class='popreport'><tbody><tr><th>You Have Notifications!</th></tr><tr class='oddtablerow'><td>There are one or more active notifications that have been set to automatically display once per browser session.<br><br>After closing this popup you can re-open notifications by either closing and re-opening the browser or clicking on the notification icon in the menu.</td></tr></tbody></table>"
          )
        : jQuery('#MFLPlayerPopupHeader').html(
            "<table class='popreport'><tbody><tr><th>You Have Notifications!</th></tr><tr class='oddtablerow'><td>There are one or more active notifications. Check the tabs below to view them.</td></tr></tbody></table>"
          ),
      '' === MFLPlayerPopupOnloadContent[0] &&
      '' === MFLPlayerPopupOnloadContent[1]
        ? jQuery('#MFLPlayerPopupTrades').html(
            '<br /><center><i>No Current Trade Notifications</i></center>'
          )
        : jQuery('#MFLPlayerPopupTrades').html(
            MFLPlayerPopupOnloadContent[0]
              .replace(/report/g, 'popreport')
              .replace('<caption><span>Pending Trades</span></caption>', '') +
              MFLPlayerPopupOnloadContent[1]
                .replace(/report/g, 'popreport')
                .replace('<caption><span></span></caption>', '')
          ),
      '' === MFLPlayerPopupOnloadContent[2]
        ? jQuery('#MFLPlayerPopupReminders').html(
            "<br /><center><i>No Active League Reminders<br/><br/>OR<br/><br/>League Reminders are Disabled in <a href='" +
              baseURLDynamic +
              '/' +
              year +
              '/csetup?L=' +
              league_id +
              '&C=FCUSTOM&F=' +
              franchise_id +
              "'>Franchise Customization</a> Settings</i></center>"
          )
        : jQuery('#MFLPlayerPopupReminders').html(
            MFLPlayerPopupOnloadContent[2].replace(/report/g, 'popreport')
          ),
      '' === MFLPlayerPopupOnloadContent[3]
        ? jQuery('#MFLPlayerPopupMessages').html(
            '<br /><center><i>No Active Messages from MyFantasyLeague</i></center>'
          )
        : jQuery('#MFLPlayerPopupMessages').html(
            MFLPlayerPopupOnloadContent[3].replace(/report/g, 'popreport')
          ),
      '' === MFLPlayerPopupOnloadContent[4]
        ? jQuery('#MFLPlayerPopupCommishMessage').html(
            '<br /><center><i>No Active Messages from Commissioner</i></center>'
          )
        : jQuery('#MFLPlayerPopupCommishMessage').html(
            MFLPlayerPopupOnloadContent[4].replace(/report/g, 'popreport')
          ),
      setTimeout('MFLPlayerPopupInitiate(2)', 1e3))
  }
  function MFLPlayerPopupPopulateProjections () {
    jQuery('#MFLPlayerPopupProjections #MFLPlayerPopupLoading').show(),
      setTimeout(function () {
        'Loading Content . . .' ===
          jQuery('#MFLPlayerPopupProjections').text() &&
          fetch(
            `${baseURLDynamic}/${year}/player?L=${league_id}&P=${MFLPlayerPopupCurrentPID}&YEAR=${year}&DISPLAY_TYPE=projections`
          )
            .then(function (e) {
              if (!e.ok) throw new Error('Network response was not OK.')
              return e.text()
            })
            .then(function (e) {
              var t = jQuery(e),
                a = -1
              t.find('#player_stats_table tr').each(function () {
                var e = jQuery(this).find('th')
                if (
                  e.length &&
                  (e.each(function (e) {
                    if ('status' === jQuery(this).text().trim().toLowerCase())
                      return (a = e), !1
                  }),
                  -1 !== a)
                )
                  return !1
              })
              var r = 0,
                o = "<table class='popreport'><tbody>"
              t.find('#player_stats_table tr').each(function () {
                var e = jQuery(this)
                if (!(e.find('form').length > 0))
                  if (e.find('th').length > 0) {
                    var t = e.find('th:eq(0)')
                    if (4 === parseInt(t.attr('colspan'), 10))
                      t.attr('colspan', 3)
                    else if (-1 !== a) {
                      var n = e.find('th')
                      n.length > a && n.eq(a).remove()
                    }
                    o += '<tr>' + e.html() + '</tr>'
                  } else {
                    var i = e.find('td')
                    if (i.length > 1) {
                      if (-1 !== a) {
                        var s = e.find('td[colspan]')
                        if (s.length) {
                          var l = parseInt(s.attr('colspan'), 10)
                          Number.isFinite(l) &&
                            l > 1 &&
                            s.attr('colspan', l - 1)
                        } else i.length > a && i.eq(a).remove()
                      }
                      ;(o +=
                        r % 2
                          ? "<tr class='eventablerow'>" + e.html() + '</tr>'
                          : "<tr class='oddtablerow'>" + e.html() + '</tr>'),
                        r++
                    }
                  }
              }),
                (o += '</tbody></table>'),
                jQuery('#MFLPlayerPopupProjections').html(o)
            })
            .catch(function (e) {
              console.error('Error:', e)
            })
      }, 1e3)
  }
  function MFLPlayerPopupPopulate (e, t, a, r) {
    MFLPlayerPopupTracker = []
    var o = ''
    jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').show(),
      jQuery('#MFLPlayerPopupLoaded').hide(),
      jQuery('#MFLPlayerPopupArticleLoaded').hide(),
      fetch(
        `${baseURLDynamic}/${year}/export?TYPE=playerStatus&L=${league_id}&P=${e}&JSON=1`
      )
        .then(e => e.json())
        .then(n => {
          try {
            o = MFLPopupCustomRule(
              'pStatus',
              null,
              null,
              e,
              t,
              a,
              r,
              n,
              null,
              null
            )
          } catch (e) {
            try {
              o = n.playerStatus.status
            } catch (e) {}
          }
          const i = `${baseURLDynamic}/${year}/player?L=${league_id}&P=${e}`
          return fetch(i)
        })
        .then(e => e.text())
        .then(n => {
          var i = {
              ht: '--',
              wt: '--',
              dob: '--',
              age: '--',
              college: '---',
              draftYear: 'n/a',
              draftTeam: '',
              round: '',
              pick: '',
              jersey: '--',
              experience: '',
              acquired: '',
              photo: jQuery(n)
                .find('.player_photo img')
                .each(function () {
                  $(this).attr(
                    'src',
                    'https://www.mflscripts.com/playerImages_80x107/mfl_' +
                      e +
                      '.png'
                  )
                })
                .parent()
                .html()
            },
            s = !0
          const l = ue.has(String(r ?? i?.position ?? '').toUpperCase())
          if (null == i.photo || l) {
            const e = String(a ?? i?.team ?? 'FA').toUpperCase(),
              t = teamLogoUrl(e)
            ;(i.photo = `<img class="playerPhoto" src="${t}" alt="${e}" title="${e}" align="middle">`),
              void 0 !== s && (s = !1)
          } else
            i.photo = String(i.photo).replace(
              /no_photo_available\.jpg/gi,
              'https://www.mflscripts.com/playerImages_80x107/free_agent.png'
            )
          if (
            ((i.photo = i.photo.replace('img', "img class='articlepicture'")),
            !MFLPopupOmitLinks)
          ) {
            var c = "<table class='popreport'><tbody>"
            ;(c += "<tr class='oddtablerow'>"),
              (c +=
                "<td style='text-align:center; text-indent:0;'><a href='" +
                baseURLDynamic +
                '/' +
                year +
                '/player?L=' +
                league_id +
                '&P=' +
                e +
                "'>Full Profile</a></td>")
            var d = ''
            if (
              (jQuery(n)
                .find('h3 a')
                .each(function () {
                  if ('FantasySharks Profile' === jQuery(this).text())
                    return (
                      (d =
                        "<a href='" +
                        jQuery(this).attr('href') +
                        "' title='Fantasy Sharks Profile' target='_blank'>Fantasy Sharks</a>"),
                      !1
                    )
                }),
              '' !== d &&
                (c +=
                  "<td class='screen-hide' style='text-align:center; text-indent:0;'>" +
                  d +
                  '</td>'),
              'undefined' != typeof franchise_id && '0000' !== franchise_id)
            ) {
              var p =
                "<a href='" +
                baseURLDynamic +
                '/' +
                year +
                '/add_drop?L=' +
                league_id +
                '&P=' +
                e +
                "'>Add Player</a>"
              try {
                void 0 !== playerDatabase['pid_' + e].fid &&
                  (p =
                    -1 === playerDatabase['pid_' + e].fid.indexOf(franchise_id)
                      ? "<a href='" +
                        baseURLDynamic +
                        '/' +
                        year +
                        '/options?L=' +
                        league_id +
                        '&O=05&FRANCHISE=' +
                        franchise_id +
                        ',' +
                        playerDatabase['pid_' + e].fid.substring(0, 4) +
                        '&P=' +
                        e +
                        "'>Propose Trade</a>"
                      : "<a href='" +
                        baseURLDynamic +
                        '/' +
                        year +
                        '/add_drop?L=' +
                        league_id +
                        "'>Drop Player</a>")
              } catch (e) {}
              c +=
                "<td style='text-align:center; text-indent:0;'>" + p + '</td>'
              var u =
                "<a href='" +
                baseURLDynamic +
                '/' +
                year +
                '/options?L=' +
                league_id +
                '&O=178&PID=' +
                e +
                "'>Watchlist</a>"
              jQuery(n)
                .find('h3 a')
                .each(function () {
                  return jQuery(this).text().indexOf('Remove') > -1
                    ? ((u =
                        "<a href='" +
                        baseURLDynamic +
                        '/' +
                        year +
                        '/options?L=' +
                        league_id +
                        '&O=178&PID=' +
                        e +
                        "&ACTION=delete'>Watchlist Remove</a>"),
                      !1)
                    : jQuery(this).text().indexOf('Add') > -1
                    ? ((u =
                        "<a href='" +
                        baseURLDynamic +
                        '/' +
                        year +
                        '/options?L=' +
                        league_id +
                        '&O=178&PID=' +
                        e +
                        "&ACTION=add'>Watchlist Add</a>"),
                      !1)
                    : void 0
                }),
                (c +=
                  "<td style='text-align:center; text-indent:0;'>" +
                  u +
                  '</td>')
            }
            ;(c +=
              "<td style='text-align:center; text-indent:0;'><a href='" +
              baseURLDynamic +
              '/' +
              year +
              '/player_history?L=' +
              league_id +
              '&PLAYERS=' +
              e +
              "'>Trans. History</a></td>"),
              (c += '</tr></tbody></table>'),
              jQuery('#MFLPlayerPopupLinks').html(c)
          }
          var m = []
          if (
            (jQuery(n)
              .find('.biography.report tr')
              .each(function () {
                var n = jQuery(this).find('th:eq(0)').html(),
                  s = jQuery(this).find('td:eq(0)').html()
                switch (n) {
                  case 'Height/Weight:':
                    ;(i.ht = s.substring(0, s.indexOf('/') - 1)),
                      (i.wt = s.substring(s.indexOf('/') + 2, s.length))
                    break
                  case 'DOB/Age:':
                    ;(i.dob = s.substring(0, s.indexOf('/') - 1)),
                      (i.age = s.substring(s.indexOf('/') + 2, s.length))
                    break
                  case 'Jersey Num:':
                    i.jersey = parseInt(s)
                    break
                  case 'College:':
                    i.college = s
                    break
                  case 'Drafted:':
                    'Undrafted' === s
                      ? ((i.draftYear = '?'),
                        (i.draftTeam = 'FA'),
                        (i.round = 'n/a'),
                        (i.pick = 'n/a'))
                      : ((i.draftYear = s.substring(0, s.indexOf('/') - 1)),
                        (i.draftTeam = s.substring(
                          s.indexOf('/') + 2,
                          s.indexOf('Round') - 3
                        )),
                        (i.round = parseInt(
                          s.substring(s.indexOf('Round') + 6, s.length)
                        )),
                        (i.pick = parseInt(
                          s.substring(s.indexOf('Pick') + 5, s.length)
                        )))
                    break
                  case 'Experience:':
                    isNaN(parseInt(s))
                      ? ((i.experience = '(Exp.: Rookie)'),
                        (i.experienceInt = 1))
                      : ((i.experience = '(Exp.: ' + parseInt(s) + ' years)'),
                        (i.experienceInt = parseInt(s)))
                    break
                  case 'Acquired:':
                    i.acquired = s
                    break
                  case 'Salary:':
                    try {
                      m[m.length] = MFLPopupCustomRule(
                        'salary',
                        MFLPlayerPopupExtraTitles.salary,
                        s,
                        e,
                        t,
                        a,
                        r,
                        statusData,
                        o,
                        i
                      )
                    } catch (e) {
                      m[m.length] = {
                        title: MFLPlayerPopupExtraTitles.salary,
                        info: s
                      }
                    }
                    break
                  case 'Contract Year:':
                    try {
                      m[m.length] = MFLPopupCustomRule(
                        'contract_year',
                        MFLPlayerPopupExtraTitles.contractyear,
                        s,
                        e,
                        t,
                        a,
                        r,
                        statusData,
                        o,
                        i
                      )
                    } catch (e) {
                      m[m.length] = {
                        title: MFLPlayerPopupExtraTitles.contractyear,
                        info: s
                      }
                    }
                    break
                  case 'Contract Status:':
                    try {
                      m[m.length] = MFLPopupCustomRule(
                        'contract_status',
                        MFLPlayerPopupExtraTitles.contractstatus,
                        s,
                        e,
                        t,
                        a,
                        r,
                        statusData,
                        o,
                        i
                      )
                    } catch (e) {
                      m[m.length] = {
                        title: MFLPlayerPopupExtraTitles.contractstatus,
                        info: s
                      }
                    }
                    break
                  case 'Contract Info:':
                    try {
                      m[m.length] = MFLPopupCustomRule(
                        'contract_info',
                        MFLPlayerPopupExtraTitles.contractinfo,
                        s,
                        e,
                        t,
                        a,
                        r,
                        statusData,
                        o,
                        i
                      )
                    } catch (e) {
                      m[m.length] = {
                        title: MFLPlayerPopupExtraTitles.contractinfo,
                        info: s
                      }
                    }
                }
              }),
            m.length > 0)
          )
            var f = 6
          else f = 4
          if (
            (MFLPopupOmitStatus && 1 === m.length && (f = 4),
            s && MFLPlayerPopupIncludeNFLLogo)
          )
            var h =
              "<img src='https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/" +
              a +
              ".svg' class='MFLPlayerPopupNFLTeamLogo' />"
          else h = ''
          const y = String(i?.jersey ?? '').trim()
          var _ =
              !l && y && '--' !== y
                ? `<span class='MFLPlayerPopupJersey'><span>${y}</span></span>`
                : '',
            g = "<table class='popreport'><tbody>"
          if (
            ((g +=
              "<tr class='oddtablerow rows-" +
              f +
              "'><td class='pop-photo' rowspan='" +
              f +
              "'>" +
              i.photo +
              h +
              _ +
              "</td><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Ht:</span> " +
              i.ht +
              "</td><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Wt:</span> " +
              i.wt +
              '</td></tr>'),
            (g +=
              "<tr class='eventablerow rows-" +
              f +
              "'><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Born:</span> " +
              i.dob +
              " <span class='screen-hide'>(" +
              i.age +
              ")</span></td><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>College:</span> " +
              i.college +
              '</td></tr>'),
            'FA' === i.draftTeam)
          )
            var b = year - i.experienceInt + 1 + ' Undrafted ' + i.experience
          else if ('' === i.round) b = i.draftYear + ' ' + i.experience
          else
            b =
              i.draftYear +
              ' #' +
              i.round +
              '.' +
              i.pick +
              ' ' +
              i.draftTeam +
              " <span class='screen-hide'>" +
              i.experience +
              '</span>'
          if (
            ((g +=
              "<tr class='oddtablerow rows-" +
              f +
              "'><td colspan='2'><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Draft:</span> " +
              b +
              '</td></tr>'),
            MFLPopupOmitStatus)
          )
            var w = 'even',
              k = 'odd'
          else {
            g +=
              "<tr class='eventablerow rows-" +
              f +
              "'><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Status:</span> " +
              o +
              "</td><td><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold'>Acquired:</span> " +
              i.acquired +
              '</td></tr>'
            ;(w = 'odd'), (k = 'even')
          }
          switch (m.length) {
            case 1:
              ;(g +=
                "<tr class='" +
                w +
                'tablerow rows-' +
                f +
                "'><td colspan='2'><span class='MFLPlayerPopupHeaderTitle' style='font-weight:bold' id='extras-0-title'>" +
                m[0].title +
                ':</span> ' +
                m[0].info +
                '</td></tr>'),
                MFLPopupOmitStatus ||
                  (g +=
                    "<tr class='" +
                    k +
                    'tablerow rows-' +
                    f +
                    "'><td colspan='2'> </td></tr>")
              break
            case 2:
              ;(g +=
                "<tr class='" +
                w +
                'tablerow rows-' +
                f +
                "'><td colspan='2'><span class='MFLPlayerPopupHeaderTitle extras-0-title'style='font-weight:bold'>" +
                m[0].title +
                ':</span> ' +
                m[0].info +
                '</td></tr>'),
                (g +=
                  "<tr class='" +
                  k +
                  'tablerow rows-' +
                  f +
                  "'><td colspan='2'><span class='MFLPlayerPopupHeaderTitle extras-1-title' style='font-weight:bold'>" +
                  m[1].title +
                  ':</span> ' +
                  m[1].info +
                  '</td></tr>')
              break
            case 3:
              ;(g +=
                "<tr class='" +
                w +
                'tablerow rows-' +
                f +
                "'><td><span class='MFLPlayerPopupHeaderTitle extras-0-title' style='font-weight:bold'>" +
                m[0].title +
                ':</span> ' +
                m[0].info +
                "</td><td><span class='MFLPlayerPopupHeaderTitle extras-1-title' style='font-weight:bold'>" +
                m[1].title +
                ':</span> ' +
                m[1].info +
                '</td></tr>'),
                (g +=
                  "<tr class='" +
                  k +
                  'tablerow rows-' +
                  f +
                  "'><td colspan='2'><span class='MFLPlayerPopupHeaderTitle extras-2-title' style='font-weight:bold'>" +
                  m[2].title +
                  ':</span> ' +
                  m[2].info +
                  '</td></tr>')
              break
            case 4:
              ;(g +=
                "<tr class='" +
                w +
                'tablerow rows-' +
                f +
                "'><td><span class='MFLPlayerPopupHeaderTitle extras-0-title' style='font-weight:bold'>" +
                m[0].title +
                ':</span> ' +
                m[0].info +
                "</td><td><span class='MFLPlayerPopupHeaderTitle extras-1-title' style='font-weight:bold'>" +
                m[1].title +
                ':</span> ' +
                m[1].info +
                '</td></tr>'),
                (g +=
                  "<tr class='" +
                  k +
                  'tablerow rows-' +
                  f +
                  "'><td><span class='MFLPlayerPopupHeaderTitle extras-2-title' style='font-weight:bold'>" +
                  m[2].title +
                  ':</span> ' +
                  m[2].info +
                  "</td><td><span class='MFLPlayerPopupHeaderTitle extras-3-title' style='font-weight:bold'>" +
                  m[3].title +
                  ':</span> ' +
                  m[3].info +
                  '</td></tr>')
          }
          ;(g += '</tbody></table>'),
            jQuery('#MFLPlayerPopupHeader').html(g),
            jQuery('#MFLPlayerPopupBio').html(g)
          var L = 0,
            P = "<table class='popreport'><tbody>"
          jQuery(n)
            .find('.biohistory.report tr')
            .each(function () {
              jQuery(this).find('form').length > 0 ||
                (jQuery(this).find('th').length > 0
                  ? (P += '<tr>' + jQuery(this).html() + '</tr>')
                  : jQuery(this).find('td').length > 0 &&
                    (jQuery(this).find('td a').contents().unwrap(),
                    jQuery(this).find('td a').remove(),
                    (P +=
                      L % 2
                        ? "<tr class='eventablerow'>" +
                          jQuery(this).html() +
                          '</tr>'
                        : "<tr class='oddtablerow'>" +
                          jQuery(this).html() +
                          '</tr>'),
                    L++))
            }),
            (P += '</tbody></table>'),
            jQuery('#MFLPlayerPopupStatsHistory').html(P)
          L = 0
          var S = [],
            M = "<table class='popreport'><tbody>"
          function removeCellsByIndex (e, t) {
            for (var a = 0; a < t.length; a++) {
              var r = t[a]
              e.length > r && e.eq(r).remove()
            }
          }
          function adjustColspanForRemoved (e, t) {
            var a = e.find('td[colspan], th[colspan]').first()
            if (a.length) {
              var r = parseInt(a.attr('colspan'), 10)
              if (Number.isFinite(r) && !(r <= 1)) {
                var o = e.children('th,td').index(a)
                if (!(o < 0)) {
                  for (var n = o + r - 1, i = 0, s = 0; s < t.length; s++) {
                    var l = t[s]
                    l >= o && l <= n && i++
                  }
                  if (i > 0) {
                    var c = r - i
                    c < 1 && (c = 1), a.attr('colspan', c)
                  }
                }
              }
            }
          }
          jQuery(n)
            .find('#player_stats_table tr')
            .each(function () {
              var e = jQuery(this).find('th')
              if (e.length) {
                var t = e
                    .map(function () {
                      return jQuery(this).text().trim().replace(/\s+/g, ' ')
                    })
                    .get(),
                  a = t.some(e => /^week$/i.test(e)),
                  r = t.some(e => /^pts$/i.test(e))
                if (a && r) {
                  for (var o = 0; o < t.length; o++) {
                    var n = t[o]
                    ;(/^opp\s*avg\b/i.test(n) || /^opp\s*rank\b/i.test(n)) &&
                      S.push(o)
                  }
                  return !1
                }
              }
            }),
            S.sort(function (e, t) {
              return t - e
            }),
            jQuery(n)
              .find('#player_stats_table tr')
              .each(function () {
                var e = jQuery(this)
                if (!(e.find('form').length > 0)) {
                  if (e.find('th').length > 0)
                    return (
                      adjustColspanForRemoved(e, S),
                      removeCellsByIndex(e.find('th'), S),
                      void (M += '<tr>' + e.html() + '</tr>')
                    )
                  var t = e.find('td')
                  if (t.length > 1) {
                    if (
                      (e.find('td a').contents().unwrap(),
                      e.find('td a').remove(),
                      e.find('td[colspan]').length > 0)
                    )
                      adjustColspanForRemoved(e, S)
                    else {
                      removeCellsByIndex(t, S)
                      var a = e.find('td'),
                        r = S.length ? 3 : 5,
                        o = a.eq(r).html() || '',
                        n = o.indexOf(' - ')
                      if (n > 0) {
                        var i = o.substring(0, n)
                        MFLPlayerPopupTeamNames.hasOwnProperty(i) &&
                          '' !== MFLPlayerPopupTeamNames[i].abbrev &&
                          a
                            .eq(r)
                            .html(
                              o.replace(
                                i,
                                "<span title='" +
                                  i +
                                  "'>" +
                                  MFLPlayerPopupTeamNames[i].abbrev
                              ) + '</span>'
                            )
                      }
                    }
                    ;(M +=
                      L % 2
                        ? "<tr class='eventablerow'>" + e.html() + '</tr>'
                        : "<tr class='oddtablerow'>" + e.html() + '</tr>'),
                      L++
                  }
                }
              }),
            (M += '</tbody></table>'),
            jQuery('#MFLPlayerPopupStats').html(M),
            MFLPlayerPopupIncludeProjections &&
              jQuery('#MFLPlayerPopupProjections').html(
                "<div id='MFLPlayerPopupLoading'><center>Loading Content . . .<br><br><div class='MFLPlayerPopupLoader'></div></center></div>"
              ),
            (MFLPlayerPopupTracker[0] = 1),
            MFLPlayerPopupInitiate(0)
        })
        .catch(e => {
          console.error('Error:', e)
        }),
      fetch(`${baseURLDynamic}/${year}/news_articles?PLAYERS=${e}&DAYS=30`)
        .then(e => {
          if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
          return e.text()
        })
        .then(t => {
          fetch(
            `${baseURLDynamic}/${year}/news_articles?TEAM=${a}&SOURCE=RotoWire&DAYS=30`
          )
            .then(e => {
              if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
              return e.text()
            })
            .then(r => {
              var o = ''
              jQuery(t).find('.report tr').length < 2 &&
                ((t = r),
                (o =
                  "<h3 class='warning'>No News for Player - Showing Recent News for " +
                  a +
                  '</h3>'))
              var n = "<table class='popreport'>" + o + '<tbody>',
                i = 0
              jQuery(t)
                .find('.report tr')
                .each(function () {
                  if (i > 0) {
                    var t = jQuery(this).find('td:eq(1) a').attr('href'),
                      a = e + '_' + i
                    jQuery(this).find('td a').contents().unwrap()
                    var r = jQuery(this).find('td:eq(2)').html()
                    ;(r = (r = r.replace(
                      'Analysis:',
                      '<br><br><b>Analysis:</b>'
                    )).replace(
                      '(More)',
                      "(<span class='MFLPlayerPopupMoreNews warning' onclick='MFLPlayerPopupMoreNews(\"" +
                        t +
                        '","' +
                        a +
                        '")\'>More</span>)'
                    )),
                      (n +=
                        "<tr class='oddtablerow headline'><th>" +
                        jQuery(this).find('td:eq(1)').html() +
                        '<span>' +
                        jQuery(this).find('td:eq(3)').html() +
                        ' ago</span></th></tr>'),
                      (n +=
                        "<tr class='eventablerow article'><td id='" +
                        a +
                        "' style='position:relative'>" +
                        r +
                        '</td></tr>')
                  }
                  i++
                }),
                (n += '</tbody></table>'),
                jQuery('#MFLPlayerPopupNews').html(n)
            })
            .catch(e => {
              console.error('Error fetching newsData2:', e)
            })
        })
        .catch(e => {
          console.error('Error fetching newsData:', e)
        }),
      (MFLPlayerPopupTracker[1] = 1),
      MFLPlayerPopupInitiate(0)
  }
  function MFLPlayerPopupArticlePopulate (e, t, a) {
    const r = document.querySelector(
        '#MFLPlayerPopupContainer #MFLPlayerPopupLoading'
      ),
      o = document.getElementById('MFLPlayerPopupLoaded'),
      n = document.getElementById('MFLPlayerPopupArticleLoaded')
    r && (r.style.display = 'block'),
      o && (o.style.display = 'none'),
      n && (n.style.display = 'none')
    const i = `${baseURLDynamic}/${year}/view_news_article?ID=${encodeURIComponent(
      a
    )}`
    fetch(i)
      .then(e => {
        if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
        return e.text()
      })
      .then(t => {
        const a = new DOMParser().parseFromString(t, 'text/html'),
          r = Array.from(a.querySelectorAll('.report tr'))
        let o = ''
        if (r.length > 1) {
          const e = r[1].querySelector('td')
          if (e) {
            e.querySelectorAll('a').forEach(e => {
              const t = document.createDocumentFragment()
              for (; e.firstChild; ) t.appendChild(e.firstChild)
              e.replaceWith(t)
            })
            let t = e.innerHTML || ''
            const a = t.indexOf('Article Link')
            a > 0 && (t = t.substring(0, a - 2))
            const r = t.indexOf('Roto Pass from')
            r > 0 && (t = t.substring(0, r - 3)), (o = t)
          }
        }
        if (n) {
          const t = document.createElement('table')
          t.className = 'popreport'
          const a = document.createElement('tbody'),
            r = document.createElement('tr')
          r.className = 'oddtablerow headline'
          const i = document.createElement('th')
          ;(i.innerHTML = e), r.appendChild(i)
          const s = document.createElement('tr')
          s.className = 'eventablerow article'
          const l = document.createElement('td')
          ;(l.innerHTML = o),
            s.appendChild(l),
            a.append(r, s),
            t.appendChild(a),
            (n.innerHTML = ''),
            n.appendChild(t)
          try {
            MFLPlayerPopupInitiate(1)
          } catch {}
        }
      })
      .catch(e => {
        console.error('Error fetching articleData:', e)
      })
  }
  function MFLPlayerPopupPopulateOnload (e) {
    e
      ? (MFLPlayerPopupNotificationPreSetup(),
        setTimeout('MFLPlayerPopupPopulateNotification(true)', 200))
      : MFLPlayerPopupPopulateNotification(!1),
      jQuery('.toggle_module_login').hide(),
      jQuery('.toggle_module_search').hide(),
      jQuery('.skinSelectorContainer').hide()
  }
  function MFLPlayerPopupPopulateNotification (e) {
    if (
      ((MFLPlayerPopupTracker = []),
      (MFLPlayerPopupOnloadContent[0] = ''),
      (MFLPlayerPopupOnloadContent[1] = ''),
      (MFLPlayerPopupOnloadContent[2] = ''),
      (MFLPlayerPopupOnloadContent[3] = ''),
      (MFLPlayerPopupOnloadContent[4] = ''),
      jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').show(),
      jQuery('#MFLPlayerPopupLoaded').hide(),
      jQuery('#MFLPlayerPopupArticleLoaded').hide(),
      MFLPopupEnableTrade
        ? fetch(`${baseURLDynamic}/${year}/home/${league_id}?MODULE=TRADES`)
            .then(e => {
              if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
              return e.text()
            })
            .then(t => {
              jQuery(t)
                .find('#trades td')
                .each(function () {
                  ;-1 !== jQuery(this).text().indexOf('proposed by me') &&
                    parseInt(jQuery(this).text()) > 0 &&
                    (MFLPlayerPopupOnloadContent[0] = jQuery(t)
                      .find('#trades')
                      .parent()
                      .html()),
                    -1 !== jQuery(this).text().indexOf('proposed by others') &&
                      parseInt(jQuery(this).text()) > 0 &&
                      (MFLPlayerPopupOnloadContent[0] = jQuery(t)
                        .find('#trades')
                        .parent()
                        .html()),
                    -1 !==
                      jQuery(this).text().indexOf('awaiting your review') &&
                      parseInt(jQuery(this).text()) > 0 &&
                      (MFLPlayerPopupOnloadContent[0] = jQuery(t)
                        .find('#trades')
                        .parent()
                        .html()),
                    -1 !==
                      jQuery(this)
                        .text()
                        .indexOf('pending commissioner review') &&
                      parseInt(jQuery(this).text()) > 0 &&
                      (MFLPlayerPopupOnloadContent[0] = jQuery(t)
                        .find('#trades')
                        .parent()
                        .html())
                }),
                (MFLPlayerPopupTracker[0] = 1),
                MFLPlayerPopupNotificationSetup(e)
            })
            .catch(e => {
              console.error('Error fetching tradeData:', e)
            })
        : ((MFLPlayerPopupTracker[0] = 1), MFLPlayerPopupNotificationSetup(e)),
      MFLPopupEnableTradePoll)
    ) {
      fetch(`${baseURLDynamic}/${year}/options?L=${league_id}&O=69`)
        .then(e => {
          if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
          return e.text()
        })
        .then(t => {
          jQuery(t)
            .find('table.report[id^="poll_"]')
            .each(function () {
              ;-1 !== jQuery(this).find('th:eq(0)').text().indexOf('gave up') &&
                (MFLPlayerPopupOnloadContent[1] += jQuery(this)
                  .parent()
                  .parent()
                  .html())
            }),
            (MFLPlayerPopupTracker[1] = 1),
            MFLPlayerPopupNotificationSetup(e)
        })
        .catch(e => {
          console.error('Error fetching pollData:', e)
        })
    } else (MFLPlayerPopupTracker[1] = 1), MFLPlayerPopupNotificationSetup(e)
    MFLPopupEnableReminders || MFLPopupEnableMessages
      ? fetch(`${baseURLDynamic}/${year}/home/${league_id}`)
          .then(function (e) {
            if (e.ok) return e.text()
            throw new Error('Network response was not ok.')
          })
          .then(function (t) {
            MFLPopupEnableReminders &&
              jQuery(t)
                .find('#league_reminders')
                .each(function () {
                  MFLPlayerPopupOnloadContent[2] =
                    "<table align='center' cellspacing='1' class='homepagemodule report'>" +
                    jQuery(this).html() +
                    '</table>'
                }),
              (MFLPlayerPopupTracker[2] = 1),
              MFLPopupEnableMessages &&
                jQuery(t)
                  .find('.homepagemessage:not(#league_reminders)')
                  .each(function () {
                    MFLPlayerPopupOnloadContent[3] +=
                      "<table align='center' cellspacing='1' class='homepagemodule report'>" +
                      jQuery(this).html() +
                      '</table>'
                  }),
              (MFLPlayerPopupTracker[3] = 1),
              MFLPlayerPopupNotificationSetup(e)
          })
          .catch(function (e) {
            console.log('Error:', e)
          })
      : ((MFLPlayerPopupTracker[2] = 1),
        (MFLPlayerPopupTracker[3] = 1),
        MFLPlayerPopupNotificationSetup(e)),
      MFLPopupEnableCommishMessage && '' !== MFLPopupCommishMessage
        ? ((MFLPlayerPopupOnloadContent[4] =
            "<table align='center' cellspacing='1' class='homepagemodule report'><tr><th>From the Commissioner's Desk</th></tr><tr class='oddtablerow'><td>" +
            MFLPopupCommishMessage +
            '</td></tr></table>'),
          (MFLPlayerPopupTracker[4] = 1),
          MFLPlayerPopupNotificationSetup(e))
        : ((MFLPlayerPopupTracker[4] = 1), MFLPlayerPopupNotificationSetup(e))
  }
  function getPidFromHref (e) {
    if (!e) return null
    let t = e.match(/[?&]P=(\d+)/)
    return t
      ? t[1]
      : ((t = e.match(
          /launch_player_modal\(\s*['"]\d+['"]\s*,\s*['"](\d+)['"]\s*\)/
        )),
        t ? t[1] : null)
  }
  function MFLPlayerPopupInitiate (e) {
    0 === e &&
      1 === MFLPlayerPopupTracker[0] &&
      1 === MFLPlayerPopupTracker[1] &&
      (jQuery('#MFLPlayerPopupNews').show(),
      jQuery('#MFLPlayerPopupTabLinksNews').addClass('active'),
      jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').hide(),
      jQuery('#MFLPlayerPopupArticleLoaded').hide(),
      jQuery('#MFLPlayerPopupLoaded').show(),
      jQuery('#MFLPlayerPopupNews').scrollTop(0),
      jQuery('#MFLPlayerPopupBio').scrollTop(0),
      jQuery('#MFLPlayerPopupStats').scrollTop(0),
      jQuery('#MFLPlayerPopupProjections').scrollTop(0),
      jQuery('#MFLPlayerPopupStatsHistory').scrollTop(0),
      $('#MFLPlayerPopupNews').addClass('active_div_tab_scroll')),
      1 === e &&
        (jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').hide(),
        jQuery('#MFLPlayerPopupLoaded').hide(),
        jQuery('#MFLPlayerPopupArticleLoaded').show()),
      2 === e &&
        (jQuery('#MFLPlayerPopupContainer #MFLPlayerPopupLoading').hide(),
        jQuery('#MFLPlayerPopupLoaded').show(),
        jQuery('#MFLPlayerPopupArticleLoaded').hide(),
        setCookie(
          'MFLPlayerPopup_' + year + '_' + league_id + '_' + franchise_id
        ))
  }
  if (
    ($(document).on(
      'click',
      '#roster_column_middle a[href*="player?L="][href*="P="], #roster_column_middle a[href^="javascript:launch_player_modal"]',
      function (e) {
        e.preventDefault(), e.stopPropagation()
        if (!getPidFromHref(this.getAttribute('href') || '')) return !1
        $(this)
          .html()
          .replace(/[\\"']/g, '\\')
          .replace(/\u0000/g, '\\0')
        return !1
      }
    ),
    MFLPopupOmitStatus &&
      jQuery('head').append(
        '<style>#MFLPlayerPopupStats th:nth-child(4), #MFLPlayerPopupStats td:nth-child(4) {display:none}</style>'
      ),
    ShowMFLlogin)
  ) {
    function toggleLogin () {
      jQuery('.skinSelectorContainer').fadeOut(700),
        'none' === jQuery('.toggle_module_login').css('display')
          ? (jQuery('.toggle_module_login').show(700),
            jQuery('.toggle_module_search').hide(700))
          : jQuery('.toggle_module_login').hide(700)
    }
    jQuery('head').append(
      '<style>.pageheader .welcome{display:none}.toggle_login_content td b{display:block}.toggle_login_content td{text-align:center;font-size:90%}.toggle_module_login{position:absolute;z-index:999999;width:18.75rem;width:18.750rem;margin-top:0.313rem;margin-top:0.313rem;margin-left:-5.938rem;}</style>'
    ),
      $('head').append(
        '<style>li.notification-icon-login{display:inline-block!important}</style>'
      ),
      $('#icon-wrapper-mobile,#icon-wrapper').show(),
      jQuery('.pageheader .welcome').appendTo(
        '.toggle_login_content .oddtablerow'
      ),
      jQuery('.toggle_login_content .welcome small').remove(),
      jQuery('.toggle_login_content .welcome').removeClass()
  }
  if (ShowMFLsearch) {
    function toggleSearch () {
      jQuery('.skinSelectorContainer').fadeOut(700),
        'none' === jQuery('.toggle_module_search').css('display')
          ? (jQuery('.toggle_module_search').show(700),
            jQuery('.toggle_module_login').hide(700))
          : jQuery('.toggle_module_search').hide(700)
    }
    jQuery('head').append(
      "<style>.toggle_search_content td{text-align:center;font-size:90%}.toggle_search_content input[type='submit']{margin:0 0.313rem;margin:0 0.313rem;border-radius:0.188rem;border-radius:0.188rem;padding:0.188rem;padding:0.188rem}.toggle_search_content input{position:relative;display:inline}.toggle_module_search{position:absolute;z-index:999999;width:18.75rem;margin-top:0.313rem;margin-left:-8.125rem;}.toggle_search_content td,.toggle_search_content form,.toggle_search_content input{vertical-align:middle;}</style>"
    ),
      $('head').append(
        '<style>li.notification-icon-search{display:inline-block!important}</style>'
      ),
      $('#icon-wrapper-mobile,#icon-wrapper').show()
  }
  if (
    (LoginSearchMobileCSS &&
      jQuery(window).width() < 768 &&
      ((jQuery.fn.toggle_center = function () {
        return (
          this.css('position', 'absolute'),
          this.css(
            'left',
            Math.max(
              0,
              (jQuery(window).width() - jQuery(this).outerWidth()) / 2 +
                jQuery(window).scrollLeft()
            ) + 'px'
          ),
          this
        )
      }),
      jQuery('.toggle_module_search,.toggle_module_login').toggle_center(),
      jQuery('head').append(
        '<style>.toggle_module_search,.toggle_module_login{margin-left:-8.125rem;margin-top:0.875rem}#skinSelectorContainer{margin-top:0.875rem}</style>'
      )),
    'undefined' != typeof franchise_id &&
      (MFLPopupEnableTrade ||
        MFLPopupEnableTradePoll ||
        MFLPopupEnableReminders ||
        MFLPopupEnableMessages ||
        (MFLPopupEnableCommishMessage && '' !== MFLPopupCommishMessage)) &&
      ($('head').append(
        '<style>li.notification-icon-popup{display:inline-block!important}</style>'
      ),
      $('#icon-wrapper-mobile,#icon-wrapper').show()),
    MFLPopupEnableReminders &&
      jQuery('#body_home .homepagemessage').css('display', 'none'),
    MFLPopupEnableMessages &&
      jQuery('#league_reminders').css('display', 'none'),
    MFLPlayerPopupSetupTeamNames(),
    0 === jQuery('#MFLPlayerPopupContainer').length &&
      MFLPlayerPopupCreateContainer(),
    'undefined' != typeof franchise_id &&
      (MFLPopupEnableTrade ||
        MFLPopupEnableTradePoll ||
        MFLPopupEnableReminders ||
        MFLPopupEnableMessages ||
        (MFLPopupEnableCommishMessage && '' !== MFLPopupCommishMessage)) &&
      MFLPopupEnableAutoNotification &&
      !getCookie(
        'MFLPlayerPopup_' + year + '_' + league_id + '_' + franchise_id
      ) &&
      MFLPlayerPopupPopulateOnload(!1),
    fetch(`${baseURLDynamic}/${year}/home/${league_id}?MODULE=ROSTER`)
      .then(e => {
        if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
        return e.text()
      })
      .then(e => {
        for (var t in MFLPlayerPopupExtraTitles)
          MFLPlayerPopupExtraTitles.hasOwnProperty(t) &&
            jQuery(e).find('th[class="' + t + '"]').length > 0 &&
            (MFLPlayerPopupExtraTitles[t] = jQuery(e)
              .find('th[class="' + t + '"]')
              .text())
      })
      .catch(e => {
        console.error('Error fetching extrasTitleData:', e)
      }),
    MFLScoreDetailsPopup)
  ) {
    if (void 0 === detailsOverlay) var detailsOverlay = 'rgba(0,0,0,.7)'
    if (void 0 === detailsWrapBG) var detailsWrapBG = '#fff'
    if (void 0 === detailsWrapBorder) var detailsWrapBorder = '#000'
    if (void 0 === detailsWrapBorWidh) var detailsWrapBorWidh = '0'
    if (void 0 === detailsWrapBoxShdw)
      var detailsWrapBoxShdw = '0 0 0.188rem 0.188rem rgba(0,0,0,.1)'
    if (void 0 === detailsWrapPadding) var detailsWrapPadding = '0.625rem'
    if (void 0 === detailsWrapRadius) var detailsWrapRadius = '0.188rem'
    $('body').append(
      '<div class="scoredetailsWrap" style="display:none;position:fixed;height:100%;width:100%;background:' +
        detailsOverlay +
        ';left:0;top:0;z-index:999991"></div><div id="ScoreDetails" class="detailsReportWrap" style="z-index: 999991;display:none;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:' +
        detailsWrapBG +
        ';border:' +
        detailsWrapBorWidh +
        ' solid ' +
        detailsWrapBorder +
        ';box-shadow:' +
        detailsWrapBoxShdw +
        ';border-radius:' +
        detailsWrapRadius +
        ';padding:' +
        detailsWrapPadding +
        ';max-height: 90%;overflow:auto"><table><caption><span></span></caption><span id="MFLPlayerPopupClose">X</span><tbody></tbody></table></div><div id="ScoreNFLDetails" class="detailsReportWrap" style="z-index: 999991;display:none;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:' +
        detailsWrapBG +
        ';border:' +
        detailsWrapBorWidh +
        ' solid ' +
        detailsWrapBorder +
        ';box-shadow:' +
        detailsWrapBoxShdw +
        ';border-radius:' +
        detailsWrapRadius +
        ';padding:' +
        detailsWrapPadding +
        ';max-height:90%;overflow:auto"><table><caption><span></span></caption><span id="MFLPlayerPopupClose">X</span><tbody><tr><td><div id="teamToggles"><div class="leftT" style="vertical-align:top;display:inline-block;width:50%;text-align:center"><input type="submit" value="" style="min-width:6.25rem;outline:none"></div><div class="rightT" style="vertical-align:top;opacity:.5;display:inline-block;width:50%;text-align:center"><input type="submit" value="" style="min-width:6.25rem;outline:none"></div></div></td></tr></tbody><tbody id="leftTeam"></tbody><tbody id="rightTeam" style="display:none"></tbody></table></div><style>a[href*="&MATCHUP=%2CFA"],a[href*="MATCHUP=FA%2C"]{display:none}table.scoring_details_table td.points,table.box_details_table td,table.box_details_table th {text-align:center!important}table.scoring_details_table th,table.scoring_details_table td,table.box_details_table td:nth-child(1),table.box_details_table tr:nth-child(2) > th:nth-child(1){text-align:left!important}#body_ajax_ls td.ls_game_info{pointer-events:none}a.boxmatchLink{display:block!important}</style>'
    ),
      $('body').on('click', '.scoredetailsWrap', function () {
        $('#ScoreDetails tbody,#leftTeam ,#rightTeam').html(''),
          $('.scoredetailsWrap,#ScoreDetails,#ScoreNFLDetails').hide(),
          $('#teamToggles input').val(''),
          $('#fullSeasonPts').remove(),
          $('#ScoreNFLDetails table').removeClass('box_details_table'),
          $('#ScoreDetails table').removeClass(
            'scoring_details_table overview_details_table'
          ),
          $('a').removeClass('dblClicks')
        try {
          ;('undefined' != typeof LSMteamBox &&
            LSMteamBox &&
            isElementVisible(LSMteamBox)) ||
            bodyScrollLock.clearAllBodyScrollLocks()
        } catch (e) {}
      }),
      $('body').on('click', '.dblClicks', function (e) {
        e.preventDefault()
      }),
      $('body').on(
        'click',
        '.report a[href*="detailed?L"][href*="P="]:not(#player_records a):not(#body_options_157 a)',
        function (e) {
          $('.scoredetailsWrap').show(),
            $('.detailsReportWrap table').addClass('report')
          var t = $(this).attr('href'),
            a = t.substring(t.indexOf('detailed?') - 1, t.length),
            r = `${baseURLDynamic}/${year}/${a}&PRINTER=1`
          if (
            this.href.substring(
              this.href.indexOf('YEAR=') + 5,
              this.href.length
            ) < year
          )
            var o = !0
          fetch(r)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('.report tbody')
              $('#ScoreDetails caption span').html('Scoring Breakdown'),
                $('#fullSeasonPts').remove(),
                $('#ScoreDetails tbody').replaceWith(t),
                $('#ScoreNFLDetails table').removeClass('box_details_table'),
                $('#ScoreDetails table').removeClass('overview_details_table'),
                $('#ScoreDetails table').addClass('scoring_details_table'),
                o &&
                  ($('a[href*="&MATCHUP="]').remove(),
                  $(
                    '#ScoreDetails tr.oddtablerow:nth-child(2) td:nth-child(1)'
                  ).css('visibility', 'hidden'),
                  $(
                    '#ScoreDetails tr.oddtablerow:nth-child(2) td:nth-child(1) b'
                  ).css('visibility', 'visible')),
                $('#ScoreDetails td b a[class*="position_').attr(
                  'href',
                  function (e, t) {
                    return t.replace('&PRINTER=1', '')
                  }
                ),
                $(
                  'a[href*="&MATCHUP=%2CFA"],a[href*="MATCHUP=FA%2C"]'
                ).remove(),
                $('.scoredetailsWrap,#ScoreDetails').show()
              const a = document.querySelector('#ScoreDetails')
              try {
                bodyScrollLock.disableBodyScroll(a)
              } catch (e) {}
              $('#leftTeam ,#rightTeam').html(''),
                $('#teamToggles input').val(''),
                $('#ScoreNFLDetails').hide(),
                $('#ScoreDetails #MFLPlayerPopupClose').on(
                  'click',
                  function () {
                    $('#ScoreDetails tbody').html(''),
                      $('.scoredetailsWrap,#ScoreDetails').hide()
                    try {
                      ;('undefined' != typeof LSMteamBox &&
                        LSMteamBox &&
                        isElementVisible(LSMteamBox)) ||
                        bodyScrollLock.clearAllBodyScrollLocks()
                    } catch (e) {}
                    $('#ScoreNFLDetails table').removeClass(
                      'box_details_table'
                    ),
                      $('#ScoreDetails table').removeClass(
                        'scoring_details_table overview_details_table'
                      ),
                      $('a').removeClass('dblClicks')
                  }
                )
            })
            .catch(e => {
              console.error('Error:', e)
            }),
            e.preventDefault()
        }
      ),
      $('body').on('click', '.report a[href*="MATCHUP"]', function (e) {
        $('#fullSeasonPts').remove(),
          $('.detailsReportWrap table').addClass('report')
        var t = `${$(this).attr('href')}&PRINTER=1`
        $('#ScoreNFLDetails caption span').html('Detailed Results'),
          fetch(t)
            .then(e => e.text())
            .then(e => {
              var t = $(e)
                  .find(
                    'td.two_column_layout:nth-of-type(1) .report tbody:nth-child(2)'
                  )
                  .contents(),
                a = $(e)
                  .find(
                    'td.two_column_layout:nth-of-type(2) .report tbody:nth-child(2)'
                  )
                  .contents(),
                r = $(e)
                  .find(
                    'td.two_column_layout:nth-of-type(1) .report caption:nth-child(1) span'
                  )
                  .text(),
                o = $(e)
                  .find(
                    'td.two_column_layout:nth-of-type(2) .report caption:nth-child(1) span'
                  )
                  .text()
              $('#fullSeasonPts').remove(),
                $('#ScoreDetails table').removeClass(
                  'scoring_details_table overview_details_table'
                ),
                $('#ScoreNFLDetails table').addClass('box_details_table'),
                $('tbody#leftTeam').html(t),
                $('tbody#rightTeam').html(a),
                $('#ScoreNFLDetails td a[class*="position_').attr(
                  'href',
                  function (e, t) {
                    return t.replace('&PRINTER=1', '')
                  }
                ),
                $('#teamToggles .leftT input').val(r),
                $('#teamToggles .rightT input').val(o),
                $(
                  'a[href*="&MATCHUP=%2CFA"],a[href*="MATCHUP=FA%2C"]'
                ).remove(),
                $('#ScoreDetails tbody').html(''),
                $('#ScoreDetails').hide(),
                $('.scoredetailsWrap,#ScoreNFLDetails').show()
              const n = document.querySelector('#ScoreNFLDetails')
              try {
                bodyScrollLock.disableBodyScroll(n)
              } catch (e) {}
              $('.leftT').click(function () {
                $(this).css('opacity', '1'),
                  $('.rightT').css('opacity', '.5'),
                  $('#leftTeam').show(),
                  $('#rightTeam').hide()
              }),
                $('.rightT').click(function () {
                  $(this).css('opacity', '1'),
                    $('.leftT').css('opacity', '.5'),
                    $('#leftTeam').hide(),
                    $('#rightTeam').show()
                }),
                $('#ScoreNFLDetails #MFLPlayerPopupClose').on(
                  'click',
                  function () {
                    $('#leftTeam ,#rightTeam').html(''),
                      $('#teamToggles input').val(''),
                      $('.scoredetailsWrap,#ScoreNFLDetails').hide()
                    try {
                      ;('undefined' != typeof LSMteamBox &&
                        LSMteamBox &&
                        isElementVisible(LSMteamBox)) ||
                        bodyScrollLock.clearAllBodyScrollLocks()
                    } catch (e) {}
                    $('#ScoreNFLDetails table').removeClass(
                      'box_details_table'
                    ),
                      $('#ScoreDetails table').removeClass(
                        'scoring_details_table overview_details_table'
                      ),
                      $('a').removeClass('dblClicks')
                  }
                ),
                $('.box_details_table a[href*="player?"]').length
                  ? ($('#teamToggles').show(), $('.no_detail_data').remove())
                  : $('.no_detail_data').length < 1 &&
                    ($('#teamToggles').hide(),
                    $('#teamToggles').after(
                      '<div class="no_detail_data"><h3 class="warning">Game Not Started</h3></div>'
                    ))
            })
            .catch(e => {
              console.error('Error:', e)
            }),
          e.preventDefault()
      }),
      $('body').on(
        'click',
        '.report a[href*="options?L="][href*="O=08"][href*="PLAYER_ID="]:not(#body_options_08 a):not([class*="dblClicks"])',
        function (e) {
          $(this).addClass('dblClicks'),
            $('#fullSeasonPts').remove(),
            $('.detailsReportWrap table').addClass('report'),
            $(
              '<tbody id="fullSeasonPts"><tr><th colspan="4" style="text-align:center!important">Points Summary</th></tr><tr class="oddtablerow"><td style="text-align:right!important">YTD Pts:</td><td class="dYTDpoints" style="text-align:left!important"></td><td style="text-align:right!important">Avg Pts:</td><td class="dAVGpoints" style="text-align:left!important"></td></tr><tr><th colspan="4" style="text-align:center!important">Weekly Point Totals</th></tr></tbody>'
            ).insertAfter('#ScoreDetails tbody')
          var t = $(this).attr('href')
          fetch(t + '&PRINTER=1')
            .then(e => e.text())
            .then(e => {
              $('#ScoreDetails caption span').html(
                $(e).find('.report tbody td.player a').contents()
              ),
                $(e)
                  .find('.report td.points.tot')
                  .contents()
                  .appendTo('td.dYTDpoints'),
                $(e)
                  .find('.report td.points.avg')
                  .contents()
                  .appendTo('td.dAVGpoints')
              for (
                var t = $(e).find(
                    '.report tbody th a[href*="SORT="]:not([href*="SORT=NAME"]):not([href*="SORT=TOT"]):not([href*="SORT=AVG"]):not([href*="SORT=SALARY"]):not([href*="SORT=YEAR"])'
                  ).length,
                  a = '',
                  r = $(e)
                    .find('table.report tr:nth-child(2) th:nth-child(5) a')
                    .attr('href'),
                  o = parseInt(r.substr(r.indexOf('SORT=') + 5, 2)),
                  n = 5;
                n < t + 5;
                n++
              )
                n % 2 && (a += '<tr class="dRow">'),
                  (a +=
                    '<td style="text-align:right!important">Week ' +
                    (o + n - 5) +
                    ':</td>'),
                  (a +=
                    '<td style="text-align:left!important"> ' +
                    $(e)
                      .find('table.report td:nth-child(' + n + ')')
                      .html() +
                    '</td>'),
                  !n % 2 && (a += '</tr>')
              !t % 2 && (a += '</tr>'),
                $('#fullSeasonPts').append(a),
                $('#ScoreDetails th a').removeAttr('href'),
                $(
                  'a[href*="&MATCHUP=%2CFA"],a[href*="MATCHUP=FA%2C"]'
                ).remove(),
                $('#ScoreNFLDetails table').removeClass('box_details_table'),
                $('#ScoreDetails table').removeClass('scoring_details_table'),
                $('#ScoreDetails table').addClass('overview_details_table'),
                $('#ScoreDetails td.dYTDpoints a,#ScoreDetails td.dAVGpoints a')
                  .contents()
                  .unwrap(),
                $('.scoredetailsWrap,#ScoreDetails').show(),
                $('#leftTeam ,#rightTeam').html(''),
                $('#teamToggles input').val(''),
                $('#ScoreNFLDetails,#TeamDetails,.teamdetailsWrap').hide()
              const i = document.querySelector('#ScoreDetails')
              try {
                bodyScrollLock.disableBodyScroll(i)
              } catch (e) {}
              $('#ScoreDetails #MFLPlayerPopupClose').on('click', function () {
                $('#fullSeasonPts').remove(),
                  $('#ScoreDetails tbody').html(''),
                  $('.scoredetailsWrap,#ScoreDetails').hide()
                try {
                  ;('undefined' != typeof LSMteamBox &&
                    LSMteamBox &&
                    isElementVisible(LSMteamBox)) ||
                    bodyScrollLock.clearAllBodyScrollLocks()
                } catch (e) {}
                $('#ScoreNFLDetails table').removeClass('box_details_table'),
                  $('#ScoreDetails table').removeClass(
                    'scoring_details_table overview_details_table'
                  ),
                  $('a').removeClass('dblClicks')
              }),
                $('#fullSeasonPts td').html(function (e, t) {
                  return t.replace(/&nbsp;/g, '0')
                }),
                $('#fullSeasonPts td').html(function (e, t) {
                  return t.replace(/B/g, 'Bye')
                }),
                $('#fullSeasonPts tr.dRow:odd').addClass('oddtablerow'),
                $('#fullSeasonPts tr.dRow:even').addClass('eventablerow'),
                $('#fullSeasonPts tr:last').children().length < 3 &&
                  $('#fullSeasonPts tr:last').append('<td></td><td></td>'),
                $('td.dYTDpoints img').remove()
            })
            .catch(e => {
              console.error('Error:', e)
            }),
            e.preventDefault()
        }
      )
  }
  if (MFLFranchisePopup) {
    if (void 0 === load_playerIcons) var load_playerIcons = !1
    if (
      ((window.lu_popup_weatherPopup = function (e, t) {
        if (void 0 === weather) return !1
        if (weather.hasOwnProperty(e) && weather[e].location) {
          var a = document.createElement('style')
          ;(a.innerHTML =
            '.current-conditions-wrapper{margin-bottom:0.625rem}.current-conditions-wrapper,.kickoff-conditions-wrapper{border:0.188rem solid #ccc;border-radius:0.313rem;padding:0.625rem}.current-conditions-text,.kickoff-conditions-text{font-size:1rem;font-weight:700}.current-conditions-localtime{display:block;font-size:0.688rem;font-style:italic}.current-conditions-temp,.kickoff-conditions-temp{font-size:2.25rem;display:inline-block;vertical-align:top;margin-top:0.25rem;font-weight:700}.current-conditions-extras-wrapper,.kickoff-conditions-extras-wrapper{display:inline-block;vertical-align:top;margin-top:0.625rem;margin-left:0.938rem}.current-conditions-wind-wrapper,.current-conditions-rain-wrapper,.current-conditions-snow-wrapper,.kickoff-conditions-wind-wrapper,.kickoff-conditions-rain-wrapper,.kickoff-conditions-snow-wrapper{display:block}.weather-more-link{text-align:center;margin-top:0.375rem;cursor:pointer}#popup-weather-wrapper.modal{width:100%;height:100%;position:fixed;left:0;top:0;z-index:111111111;background:rgba(0,0,0,.7);display:none}#popup-weather-container{background:#fff;z-index:99999;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);border:0 solid #000;box-shadow:#000 0 0 1.563rem;border-radius:0.188rem;padding:0.625rem;max-height:95%;overflow:auto}img.kickoff-conditions-icon,img.current-conditions-icon{height:3.125rem;width:auto}.weather_caption{line-height:1.875rem;height:1.875rem;position:relative;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;padding-right:1.438rem}.current-conditions-place{font-size:1.25rem;font-weight:700;max-width:0}.as_close_btn{position:absolute;z-index:1;cursor:pointer;border-radius:0.188rem;text-align:center;border:0.125rem solid transparent;font-weight:700;background:red;color:#fff;right:0;height:1.375rem;width:1.375rem;line-height:1.4;top:50%;transform:translateY(-50%)}.as_close_btn:hover{background:#000;color:#fff}'),
            document.head.appendChild(a)
          let r = document.querySelector('body'),
            o = document.createElement('div')
          ;(o.id = 'popup-weather-wrapper'),
            (o.className = 'modal'),
            (o.style.display = 'none')
          let n = document.createElement('div')
          ;(n.id = 'popup-weather-container'),
            (n.className = 'modal-content animate'),
            (n.style.display = 'none'),
            o.appendChild(n),
            r.appendChild(o)
          let i = ''
          ;(i += '<div id="weather-wrapper">'),
            (i +=
              '<div class="weather_caption"><span class="current-conditions-place">' +
              weather[e].location.name +
              ', ' +
              weather[e].location.region +
              '</span><span class="as_close_btn">X</span></div>'),
            (i += '<div class="current-conditions-wrapper">'),
            (i +=
              '<div class="current-conditions-header"><span class="current-conditions-text">Current Conditions</span><span class="current-conditions-localtime"> last updated ' +
              weather[e].current.last_updated +
              ' local time</span></div>'),
            (i += '<div class="current-conditions-detail">'),
            (i +=
              '<span class="current-conditions-temp">' +
              weather[e].current.temp_f +
              '&degF</span><span class="current-conditions-icon-wrapper"><img class="current-conditions-icon" src="' +
              weather[e].current.condition.icon +
              '" /></span>'),
            (i += '<span class="current-conditions-extras-wrapper">'),
            (i +=
              '<span class="current-conditions-wind-wrapper">Wind: <span class="current-conditions-wind-speed">' +
              weather[e].current.wind_mph +
              'mph</span> <span class="current-conditions-wind-direction">' +
              weather[e].current.wind_dir +
              '</span></span>')
          for (
            let t = 0;
            t < weather[e].forecast.forecastday[0].hour.length;
            t++
          ) {
            const a = weather[e].forecast.forecastday[0].hour[t],
              r = 0 === t ? a : weather[e].forecast.forecastday[0].hour[t - 1]
            if (a.time_epoch >= currentServerTime) {
              r.chance_of_rain > 0 &&
                (i +=
                  '<span class="current-conditions-rain-wrapper">Rain: <span class="current-conditions-chance-of-rain">' +
                  r.chance_of_rain +
                  '%</span></span>'),
                r.chance_of_snow > 0 &&
                  (i +=
                    '<span class="current-conditions-snow-wrapper">Snow: <span class="current-conditions-chance-of-snow">' +
                    r.chance_of_snow +
                    '%</span></span>')
              break
            }
          }
          ;(i += '</span>'),
            (i +=
              '<div class="current-conditions-text">' +
              weather[e].current.condition.text +
              '</div>'),
            (i += '</div>'),
            (i += '</div>'),
            (i += '<div class="kickoff-conditions-wrapper">'),
            (i +=
              '<div class="kickoff-conditions-header"><span class="kickoff-conditions-text">Expected Conditions at Kickoff</span></div>')
          try {
            ;(i += '<div class="kickoff-conditions-detail">'),
              (i +=
                '<span class="kickoff-conditions-temp">' +
                weather[e].kickoff_weather.temp_f +
                '&degF</span><span class="kickoff-conditions-icon-wrapper"><img class="kickoff-conditions-icon" src="' +
                weather[e].kickoff_weather.condition.icon +
                '" /></span>'),
              (i += '<span class="kickoff-conditions-extras-wrapper">'),
              (i +=
                '<span class="kickoff-conditions-wind-wrapper">Wind: <span class="kickoff-conditions-wind-speed">' +
                weather[e].kickoff_weather.wind_mph +
                'mph</span> <span class="kickoff-conditions-wind-direction">' +
                weather[e].kickoff_weather.wind_dir +
                '</span></span>'),
              weather[e].kickoff_weather.chance_of_rain > 0 &&
                (i +=
                  '<span class="kickoff-conditions-rain-wrapper">Rain: <span class="kickoff-conditions-chance-of-rain">' +
                  weather[e].kickoff_weather.chance_of_rain +
                  '%</span></span>'),
              weather[e].kickoff_weather.chance_of_snow > 0 &&
                (i +=
                  '<span class="kickoff-conditions-snow-wrapper">Snow: <span class="kickoff-conditions-chance-of-snow">' +
                  weather[e].kickoff_weather.chance_of_snow +
                  '%</span></span>'),
              (i += '</span>'),
              (i +=
                '<div class="current-conditions-text">' +
                weather[e].kickoff_weather.condition.text +
                '</div>')
          } catch (e) {
            i +=
              '<div class="kickoff-conditions-no-data-available" style="color:red">Future forecasts available 72 hours prior to kickoff</div>'
          }
          ;(i += '</div>'),
            (i += '</div>'),
            (i +=
              '<div class="weather-more-link"><a onclick="window.open(\'' +
              t +
              "', '_blank')\">More at Weather.com</a></div>"),
            (i += '</div>'),
            (n.innerHTML = i),
            (o.style.display = 'block'),
            (n.style.display = 'block')
          try {
            bodyScrollLock.disableBodyScroll(o)
          } catch (e) {}
          let s = document.querySelector('.teamdetailsWrap'),
            l = document.querySelector('#TeamDetails')
          s && (s.style.display = 'none'),
            l && (l.style.display = 'none'),
            o.addEventListener('click', function (e) {
              e.target === e.currentTarget ||
              e.target.classList.contains('as_close_btn')
                ? (o.remove(),
                  document
                    .querySelectorAll('.modal')
                    .forEach(e => (e.style.display = 'none')),
                  document
                    .querySelectorAll('.modal-content')
                    .forEach(e => (e.style.display = 'none')),
                  s && (s.style.display = 'block'),
                  l && (l.style.display = 'block'))
                : (s && (s.style.display = 'block'),
                  l && (l.style.display = 'block'))
            })
        } else alert('Weather for this game is not defined')
      }),
      $('body').append(
        '<div class="teamdetailsWrap" style="display:none;position:fixed;height:100%;width:100%;background:' +
          detailsOverlay +
          ';left:0;top:0;z-index:99999"></div><div id="TeamDetails" class="detailsReportWrap" style="z-index:99999;display:none;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:3.125rem;left:50%;transform:translate(-50%, 0%);background:' +
          detailsWrapBG +
          ';border:' +
          detailsWrapBorWidh +
          ' solid ' +
          detailsWrapBorder +
          ';box-shadow:' +
          detailsWrapBoxShdw +
          ';border-radius:' +
          detailsWrapRadius +
          ';padding:' +
          detailsWrapPadding +
          ';max-height: calc(90% - 3.125rem);overflow:auto"><table><caption><span></span></caption><span id="MFLPlayerPopupClose">X</span><tbody id="allTabview"><tr><td colspan="100"><div class="MFLPopTabWrap" style="margin:0"><ul class="MFLPlayerPopupTab" style="padding:0"><li class="MFLPlayerPopupPlayerTabs" id="frachiseBioTab"><a class="MFLPlayerPopupTabLinks active">Bio</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseRostersTab"><a class="MFLPlayerPopupTabLinks">Roster</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseScheduleTab"><a class="MFLPlayerPopupTabLinks">Schedule</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseAwardsTab"><a class="MFLPlayerPopupTabLinks">Awards</a></li></ul></div></td></tr></tbody><tbody id="ownerTabview"><tr><td colspan="100"><div class="MFLPopTabWrap" style="margin:0"><ul class="MFLPlayerPopupTab" style="padding:0"><li class="MFLPlayerPopupPlayerTabs" id="frachiseLineupTab"><a class="MFLPlayerPopupTabLinks">Lineup</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseOptionsTab"><a class="MFLPlayerPopupTabLinks">Options</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseNewsTab"><a class="MFLPlayerPopupTabLinks">News</a></li><li class="MFLPlayerPopupPlayerTabs" id="frachiseWatchTab"><a class="MFLPlayerPopupTabLinks">WatchList</a></li></ul></div></td></tr></tbody><tbody id="teamLinks"><tr><td colspan="100" style="text-align:center"><div><ul><li id="full_profile_link"><a>Full Profile</a></li><li id="propose_trade_link"><a>Propose Trade</a></li><li id="trade_bait_link"><a>Trade Bait</a></li><li id="transactions_link"><a>Transactions</a></li></ul></div></td></tr></tbody><tbody class="TeamData team_roster_table" style="display:none"></tbody><tbody class="TeamData team_bio_table" style="display:none"></tbody><tbody class="TeamData team_schedule_table" style="display:none"></tbody><tbody class="TeamData team_awards_table" style="display:none"></tbody><tbody class="TeamData team_lineup_table" style="display:none"></tbody><tbody class="TeamData team_options_table" style="display:none"></tbody><tbody class="TeamData team_news_table" style="display:none"></tbody><tbody class="TeamData team_watch_table" style="display:none"></tbody></table></div><style>#TeamDetails caption span img{height:2.5rem;vertical-align:middle;width:auto}#TeamDetails ul.MFLPlayerPopupTab{display:flex;padding:0 0.188rem;}#TeamDetails li.MFLPlayerPopupPlayerTabs{flex:1;margin:0;cursor:pointer}#TeamDetails ul.MFLPlayerPopupTab li a:hover{text-decoration:none}#teamLinks ul{display:table;width:100%;margin:0;padding:0.188rem 0}#teamLinks li{display:inline-block;padding:0 0.313rem;margin:0;list-style:none;cursor:pointer;text-align:center}#teamLinks li a:hover,#teamLinks li a:visited, #teamLinks li a:link{text-decoration:none!important}#ownerTabview td div ul{margin-top:0.25rem}.TeamData.team_roster_table td,.TeamData.team_roster_table th{text-align:center!important}.TeamData.team_roster_table td.player,.TeamData.team_roster_table th.player{text-align:left!important}.team_schedule_table .week,.team_schedule_table .points{text-align:center!important}.team_schedule_table th.matchup,.team_schedule_table td{text-align:left!important}.team_schedule_table img{width:auto;height:1.875rem}.team_awards_table td,.team_awards_table th{text-align:center!important}.team_awards_table td.awardtitle,.team_awards_table th.awardtitle{text-align:left!important}.team_awards_table .franchisename,.team_awards_table .comments{display:none}.team_options_table td{text-align:left!important}.team_bio_table td[class="inputlabel"]{text-align:right!important;white-space:nowrap}.team_bio_table td{text-align:left!important}.team_news_table td,.team_news_table th{text-align:center!important}.team_news_table td.headline,.team_news_table th.headline{text-align:left!important}.team_watch_table td,.team_watch_table th{text-align:center!important}.team_watch_table td.player+td,.team_watch_table td.player,.team_watch_table th:nth-child(1){text-align:left!important}.TeamData.team_roster_table th[colspan="3"]{text-align:right!important}.team_roster_table th:nth-child(9),.team_roster_table td:nth-child(9),.team_roster_table th:nth-child(8),.team_roster_table td:nth-child(8),.team_roster_table th:nth-child(7),.team_roster_table td:nth-child(7),.team_roster_table th:nth-child(6),.team_roster_table td:nth-child(6),.team_roster_table th:nth-child(5),.team_roster_table td:nth-child(5),.team_roster_table th[colspan="3"] + th + th,.team_roster_table th[colspan="3"] + th + th + th,.team_roster_table th[colspan="3"] + th + th + th + th,.team_roster_table td[colspan="3"] + td + td,.team_roster_table td[colspan="3"] + td + td + td,.team_roster_table td[colspan="3"] + td + td + td + td{display:none}.current-conditions-wrapper{margin-bottom:0.625rem}.current-conditions-wrapper,.kickoff-conditions-wrapper{border:0.188rem solid #ccc;border-radius:0.313rem;padding:0.625rem}.current-conditions-text,.kickoff-conditions-text{font-size:1rem;font-weight:700}.current-conditions-localtime{display:block;font-size:0.688rem;font-style:italic}.current-conditions-temp,.kickoff-conditions-temp{font-size:2.25rem;display:inline-block;vertical-align:top;margin-top:0.25rem;font-weight:700}.current-conditions-extras-wrapper,.kickoff-conditions-extras-wrapper{display:inline-block;vertical-align:top;margin-top:0.625rem;margin-left:0.938rem}.current-conditions-wind-wrapper,.current-conditions-rain-wrapper,.current-conditions-snow-wrapper,.kickoff-conditions-wind-wrapper,.kickoff-conditions-rain-wrapper,.kickoff-conditions-snow-wrapper{display:block}.team_lineup_table .reportnavigation{display:none}.weather-more-link{text-align:center;margin-top:0.375rem;cursor:pointer}#popup-weather-wrapper.modal{width:100%;height:100%;position:fixed;left:0;top:0;z-index:111111111;background:rgba(0,0,0,.7);display:none}#popup-weather-container{background:#fff;z-index:99999;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);border:0 solid #000;box-shadow:#000 0 0 1.563rem;border-radius:0.188rem;padding:0.625rem;max-height:95%;overflow:auto}img.kickoff-conditions-icon,img.current-conditions-icon{height:3.125rem;width:auto}.weather_caption{line-height:1.875rem;height:1.875rem;position:relative;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;padding-right:1.438rem}.current-conditions-place{font-size:1.25rem;font-weight:700;max-width:0}.as_close_btn{position:absolute;z-index:1;cursor:pointer;border-radius:0.188rem;text-align:center;border:0.125rem solid transparent;font-weight:700;background:red;color:#fff;right:0;height:1.375rem;width:1.375rem;line-height:1.4;top:50%;transform:translateY(-50%)}.as_close_btn:hover{background:#000;color:#fff}td.pphoto img{image-rendering:-webkit-optimize-contrast;image-rendering: optimize-contrast}.lineup_player_row td.weekly-opp .warning:before{content:"Player\\00a0"}.lineup_player_row td.weekly-opp .warning:after{content:"\\00a0Week"}.lineup_player_row td.weekly-opp .warning{font-weight:400}.lineup_head{padding:0.125rem 0.313rem;font-size:1rem;font-weight:bold;display:block;text-align:left}.target_report tr.lineup_player_row{position:relative;display:block;height:3.75rem}.target_report .lineup_player_row.eventablerow td,.target_report .lineup_player_row.oddtablerow td,.target_report tr.lineup_player_row td{border:0!important;box-shadow:none!important;padding: 0!important;text-align:left!important;background:none!important}.target_report tr.starters_pos_row + tr.lineup_player_row{border-top:0}.target_report tr.lineup_player_row:after{font-family:"Font Awesome 6 Pro";position:absolute;z-index:1;right:0;top:50%;transform:translateY(-50%);width:2.063rem;font-size:1.6rem}.target_report tr.current_starters_row:after{content: "\\f046"}.target_report tr.current_bench_row:after{content:"\\f096"}.target_report tr.lineup_player_row.locked_starter:after,.target_report tr.lineup_player_row.locked_bench::after{content:"\\f30d"}.target_report tr.lineup_player_row:hover{cursor:pointer}.target_report{width:100%}.target_report tr.lineup_player_row input{display:none}.target_report .tie_breakers_row select,.target_report textarea{width:100%;margin:0 auto;}.target_report tr.lineup_player_row input{display:none}.target_report tr.lineup_player_row .weekly-opp a{text-decoration:none}.target_report .headshot{height: 100%;width: 100%;border-radius: 50%}.target_report .headshot[src*="player_photos_"]{object-fit:contain}.target_report td.pphoto {text-align: center!important;border-radius: 50%;width: 3.125rem;height: 3.125rem;position: absolute;left: 0;top: 50%;transform: translateY(-50%);}.target_report tr.lineup_player_row td.pos-rank {font-size: 0.625rem;position: absolute;text-align: center!important;width: 3rem;z-index: 1;pointer-events: none;text-decoration: none;left: 0.188rem;bottom: 0.125rem;border-radius: 0.313rem}.target_report{width:100%}.target_report tr.previous_starter td.pphoto:before{content:"\\f05d";font-family:"Font Awesome 6 Pro";position:absolute;top:0;z-index:1;font-size:1rem;left:0;cursor:default;height:0.75rem;width:0.75rem;background:none}.target_report tr.lineup_player_row td.pos-rank:before{content:attr(data-content) "\\00a0#";display:inline;padding-bottom:0.313rem;margin-top:-1.25rem;text-transform:uppercase}.target_report tr.lineup_player_row td.pos-rank:empty:before{content:attr(data-content) "\\00a0#0";display:inline;padding-bottom:0.313rem;margin-top:-1.25rem;text-transform:uppercase}.target_report tr.lineup_player_row.last_row td.pos-rank{bottom:0.188rem}.target_report tr.lineup_player_row td.inj{text-align:center!important}.target_report tr.lineup_player_row td.player{position:absolute;top:0.188rem;left:3.75rem;font-size:1rem;white-space:nowrap}.target_report td.pphoto img[src*="nflTeamsvg_lineup"]{object-fit: cover;object-position: 50% -0.188rem}.target_report td.pphoto img[src*="svg"]{padding: 0.25rem}.target_report tr.lineup_player_row td.player a{font-weight:700;text-decoration:none}.target_report tr.lineup_player_row td.weekly-opp{position:absolute;top:1.375rem;left:4.063rem;font-size:0.875rem;white-space:nowrap}.target_report td.inj b.warning{font-size:0.625rem;font-weight:400;border-radius:50%;width:1rem;height:1rem;line-height:1rem;display:block;top:2.125rem;left:2.5rem;position:absolute;z-index:2}.target_report tr.lineup_player_row td.bye,.target_report tr.lineup_player_row td.pass-rank,.target_report tr.lineup_player_row td.rush-rank,.target_report tr.lineup_player_row td[class*="-start"]{display:none}tr.lineup_player_row{border-top:0.188rem solid #182a4a}tr.lineup_player_row.last_row{border-bottom:0.188rem solid #182a4a}tr.lineup_player_row.current_bench_row:after{color:red}tr.lineup_player_row.locked_bench:after{color:red}tr.lineup_player_row td.inj b.warning{color:#fff;background:red}tr.lineup_player_row.current_starters_row:after{color:green}tr.lineup_player_row.locked_starter:after{color:green}tr.previous_starter td.pphoto:before{color:green}tr.lineup_player_row td.pos-rank{background:#182a4a;color:#fff}tr.lineup_player_row td.weekly-opp{color:#cd2122}.target_report span.points_row{position:absolute;top:2.5rem;left:4.063rem}.target_report span.points_row span.ytd-pts,.target_report span.points_row span.proj-pts{margin-left:0.625rem}.target_report span.points_row span span{margin-left:0.188rem}.target_report span.points_row span.avg-pts,.target_report span.points_row span.ytd-pts,.target_report span.points_row span.proj-pts{font-size:0.813rem}.target_report span.points_row span.avg-pts span:empty:after{content:"0.0"}.target_report span.points_row span.ytd-pts span:empty:after{content:"0.0"}.target_report span.points_row span.proj-pts span:empty:after{content:"0.0"}tr.lineup_player_row span.points_row span.proj-pts{color:green}@media only screen and (max-width: 28em){.target_report tr.lineup_player_row td.player{font-size:0.875rem}.target_report tr.lineup_player_row td.weekly-opp{font-size:0.75rem}.target_report tr.lineup_player_row td.player{left:3.125rem;font-size:0.875rem}.target_report tr.lineup_player_row td.weekly-opp{left:3.438rem;font-size:0.75rem}.target_report span.points_row{left:3.75rem}.target_report span.points_row span.avg-pts,.target_report span.points_row span.proj-pts,.target_report span.points_row span.ytd-pts{font-size:0.688rem}}</style>'
      ),
      void 0 === removeSchedule)
    )
      var removeSchedule = !1
    if (void 0 === removeWatchlist) var removeWatchlist = !1
    if (void 0 === removeLineup) var removeLineup = !1
    if (void 0 === hideLinks) var hideLinks = !1
    if (void 0 === commishTeam) var commishTeam = '0001'
    removeSchedule && $('#frachiseScheduleTab,.team_schedule_table').remove(),
      removeWatchlist && $('#frachiseWatchTab,.team_watch_table').remove(),
      removeLineup && $('#frachiseLineupTab,.team_lineup_table').remove(),
      hideLinks &&
        $(
          '#teamLinks #propose_trade_link,#teamLinks #trade_bait_link,#teamLinks #transactions_link'
        ).remove(),
      $('body').on('click', '.teamdetailsWrap', function () {
        $('#TeamDetails .TeamData').html(''),
          $('.teamdetailsWrap,#TeamDetails').hide(),
          $(
            '#MFLPlayerPopupContainer #MFLPlayerPopupClose,#MFLPlayerPopupOverlay'
          ).removeClass('teamdetails_activated'),
          $(
            '#ScoreDetails #MFLPlayerPopupClose,#ScoreNFLDetails #MFLPlayerPopupClose,.scoredetailsWrap'
          ).removeClass('scoredetails_activated'),
          $('a').removeClass('dblClick')
        try {
          ;('undefined' != typeof LSMteamBox &&
            LSMteamBox &&
            isElementVisible(LSMteamBox)) ||
            bodyScrollLock.clearAllBodyScrollLocks()
        } catch (e) {}
      }),
      $('body').on(
        'click',
        '.teamdetails_activated , .scoredetails_activated',
        function () {
          $('#TeamDetails,.teamdetailsWrap').show()
          const e = document.querySelector('#TeamDetails')
          try {
            bodyScrollLock.disableBodyScroll(e)
          } catch (e) {}
        }
      ),
      $('body').on(
        'click',
        '#TeamDetails li.MFLPlayerPopupPlayerTabs a',
        function () {
          $('#TeamDetails li.MFLPlayerPopupPlayerTabs a').removeClass('active'),
            $(this).addClass('active')
        }
      ),
      $('body').on('click', '#TeamDetails li#frachiseRostersTab', function () {
        $('.TeamData').hide(), $('.team_roster_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseBioTab', function () {
        $('.TeamData').hide(), $('.team_bio_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseScheduleTab', function () {
        $('.TeamData').hide(), $('.team_schedule_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseAwardsTab', function () {
        $('.TeamData').hide(), $('.team_awards_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseLineupTab', function () {
        $('.TeamData').hide(),
          $('.team_lineup_table').show(),
          $("td.weekly-opp:contains('Weather')").each(function () {
            var e
            if (-1 === $(this).text().indexOf('@')) {
              var t = $(this).closest('tr').find('td.player a')
              if (t.length) {
                var a = t.text().split(' ')
                e = a[a.length - 2]
              }
            } else e = $(this).text().substr(1, 3)
            var r = $(this).find('a'),
              o = r.length ? r.attr('href') : '#'
            r.attr('onclick', `lu_popup_weatherPopup("${e}", "${o}")`)
              .attr('title', 'View Weather')
              .removeAttr('target')
              .removeAttr('href')
          })
      }),
      $('body').on('click', '#TeamDetails li#frachiseOptionsTab', function () {
        $('.TeamData').hide(), $('.team_options_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseNewsTab', function () {
        $('.TeamData').hide(), $('.team_news_table').show()
      }),
      $('body').on('click', '#TeamDetails li#frachiseWatchTab', function () {
        $('.TeamData').hide(), $('.team_watch_table').show()
      }),
      $('body').on('click', '.dblClick', function (e) {
        e.preventDefault()
      }),
      $('body').on('click', '#TeamDetails #MFLPlayerPopupClose', function () {
        $('#TeamDetails .TeamData').html(''),
          $('.teamdetailsWrap,#TeamDetails').hide()
        try {
          ;('undefined' != typeof LSMteamBox &&
            LSMteamBox &&
            isElementVisible(LSMteamBox)) ||
            bodyScrollLock.clearAllBodyScrollLocks()
        } catch (e) {}
        $(
          '#MFLPlayerPopupContainer #MFLPlayerPopupClose,#MFLPlayerPopupOverlay'
        ).removeClass('teamdetails_activated'),
          $(
            '#ScoreDetails #MFLPlayerPopupClose,#ScoreNFLDetails #MFLPlayerPopupClose,.scoredetailsWrap'
          ).removeClass('scoredetails_activated'),
          $('a').removeClass('dblClick')
      }),
      $('body').on(
        'click',
        '#LSscoringBox .franchise-icon a , #LSscoringBox .franchise-name a , .report a[href*="options?L="][href*="F="][href*="O=07"]:not([class*="dblClick"]):not([href*="F=0000"]):not([href*="api.myfantasyleague.com"]),.report a[href*="options?L="][href*="F="][href*="O=01"]:not([class*="dblClick"]):not([class*="pop_profile"]):not([href*="F=0000"]):not([href*="api.myfantasyleague.com"]),.report a[class*="franchise_"][href*="options?L="][href*="F="]:not([class*="dblClick"]):not([href*="F=0000"]):not([href*="api.myfantasyleague.com"])',
        function (e) {
          $(this).addClass('dblClick'),
            $('#TeamDetails table').addClass('report'),
            $(
              '#MFLPlayerPopupContainer #MFLPlayerPopupClose,#MFLPlayerPopupOverlay'
            ).addClass('teamdetails_activated'),
            $(
              '#ScoreDetails #MFLPlayerPopupClose,#ScoreNFLDetails #MFLPlayerPopupClose,.scoredetailsWrap'
            ).addClass('scoredetails_activated')
          var t = $(this).attr('href'),
            a = t.substring(t.indexOf('F=') + 2, t.length)
          a = a.substring(0, a.indexOf('&'))
          var r = $(this).parent().find('a').attr('href'),
            o = r.substr(r.indexOf('F=') + 2, 4)
          if ('undefined' == typeof franchise_id)
            $(
              '#ownerTabview,#teamLinks #propose_trade_link,#teamLinks #trade_bait_link'
            ).remove()
          else if (o === franchise_id) {
            $('#ownerTabview').attr(
              'style',
              'display:table-row-group!important'
            ),
              $('#teamLinks #propose_trade_link').html(
                '<a href="' +
                  baseURLDynamic +
                  '/' +
                  year +
                  '/options?L=' +
                  league_id +
                  '&O=05">Propose A Trade</a>'
              )
            var n = !0
          } else if ('0000' === franchise_id && o === commishTeam) {
            $('#ownerTabview').attr(
              'style',
              'display:table-row-group!important'
            ),
              $('#teamLinks #propose_trade_link').html(
                '<a href="' +
                  baseURLDynamic +
                  '/' +
                  year +
                  '/options?L=' +
                  league_id +
                  '&O=05">Propose A Trade</a>'
              )
            n = !0
          } else if ('0000' === franchise_id) {
            $('#ownerTabview').attr(
              'style',
              'display:table-row-group!important'
            ),
              $('#teamLinks #propose_trade_link').html(
                '<a href="' +
                  baseURLDynamic +
                  '/' +
                  year +
                  '/options?L=' +
                  league_id +
                  '&FRANCHISE=' +
                  commishTeam +
                  '&OPTION=05&FRANCHISE=' +
                  a +
                  '">Offer A Trade</a>'
              )
            n = !0
          } else {
            $('#ownerTabview').attr('style', 'display:none!important'),
              $('#teamLinks #propose_trade_link').html(
                '<a href="' +
                  baseURLDynamic +
                  '/' +
                  year +
                  '/options?L=' +
                  league_id +
                  '&FRANCHISE=' +
                  franchise_id +
                  '&OPTION=05&FRANCHISE=' +
                  a +
                  '">Offer A Trade</a>'
              )
            n = !0
          }
          if (
            ($('#teamLinks #full_profile_link').html(
              '<a class="pop_profile" href="' +
                baseURLDynamic +
                '/' +
                year +
                '/options?L=' +
                league_id +
                '&F=' +
                a +
                '&O=01">Full Profile</a>'
            ),
            $('#teamLinks #trade_bait_link').html(
              '<a href="' +
                baseURLDynamic +
                '/' +
                year +
                '/options?L=' +
                league_id +
                '&O=133">Trade Bait</a>'
            ),
            $('#teamLinks #transactions_link').html(
              '<a href="' +
                baseURLDynamic +
                '/' +
                year +
                '/options?L=' +
                league_id +
                '&O=03&F=' +
                a +
                '">Transactions</a>'
            ),
            $('#TeamDetails caption span').html($(this).html()),
            load_playerIcons)
          ) {
            var i = $(this)
              .attr('class')
              .substr($(this).attr('class').indexOf('franchise_') + 10, 4)
            try {
              $('#TeamDetails caption span').css('white-space', 'nowrap'),
                $('#TeamDetails caption span').prepend(
                  "<div class='franTeam_" +
                    i +
                    "' title='" +
                    franchiseDatabase['fid_' + i].name +
                    "'></div>"
                )
            } catch (e) {}
          }
          $('#TeamDetails caption span a').contents().unwrap(),
            $('#TeamDetails li.MFLPlayerPopupPlayerTabs a').removeClass(
              'active'
            ),
            $('#TeamDetails #frachiseBioTab a').addClass('active')
          var s = `${baseURLDynamic}/${year}/options?L=${league_id}&O=07&F=${a}&PRINTER=1`
          fetch(s)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('.report tbody').contents()
              $('#TeamDetails .team_roster_table').html(t),
                $('#TeamDetails td a[class*="position_').attr(
                  'href',
                  function (e, t) {
                    return t.replace('&PRINTER=1', '')
                  }
                ),
                $('.team_roster_table th.points').text('Pts')
            })
            .catch(e => {
              console.error('Error:', e)
            })
          var l = `${baseURLDynamic}/${year}/options?L=${league_id}&F=${a}&O=01&PRINTER=1`,
            c =
              '<tr><td colspan="2" style="text-align:center!important;border:0;box-shadow:none;padding:0"><img style="max-width:100%;margin:0;width:100%" src="' +
              franchiseDatabase['fid_' + a].logo +
              '" class="franchiselogo pop_logo"/></td></tr>'
          fetch(l)
            .then(e => e.text())
            .then(e => {
              includeBiologo && $('#TeamDetails .team_bio_table').append(c),
                $('#TeamDetails .team_bio_table').append(
                  '<tr><th colspan="2">Owner Information</th></tr>'
                )
              var t = $(e).find(
                '.report tr.emailaddress,.report tr.ownername,.report tr.daytimephone,.report tr.cellnumber,.report tr.mailingaddress,.report tr.lastvisit,.report tr.conference,.report tr.division,.report tr.accounting,.report tr.bbidtotalspent,.report tr.h2hrecord,.report tr.ytdpoints'
              )
              if (
                ($('#TeamDetails .team_bio_table').append(t),
                $('#TeamDetails .team_bio_table').append(
                  '<tr class="eventablerow reportfooter"><td colspan="2" style="text-align:center!important"><a href="' +
                    baseURLDynamic +
                    '/' +
                    year +
                    '/options?L=' +
                    league_id +
                    '&O=208">Career Record</a> |  <a href="' +
                    baseURLDynamic +
                    '/' +
                    year +
                    '/options?L=' +
                    league_id +
                    '&O=171&FID=' +
                    a +
                    '">All-Time Series Records</a></td></tr>'
                ),
                jQuery('#TeamDetails .h2hrecord td:nth-child(2)').text(
                  jQuery('.h2hrecord td:nth-child(2)')
                    .text()
                    .substr(
                      0,
                      jQuery('.h2hrecord td:nth-child(2)').text().indexOf('(')
                    )
                ),
                $('.TeamData').hide(),
                includeBiologoAsset && n)
              ) {
                if ('0000' === franchise_id)
                  var r = `${baseURLDynamic}/${year}/options?L=${league_id}&FRANCHISE=${commishTeam}&OPTION=05&FRANCHISE=${a}&PRINTER=1`
                else
                  r = `${baseURLDynamic}/${year}/options?L=${league_id}&FRANCHISE=${franchise_id}&OPTION=05&FRANCHISE=${a}&PRINTER=1`
                fetch(r)
                  .then(e => e.text())
                  .then(e => {
                    $('#TeamDetails .team_bio_table').append(
                      '<tr><th colspan="2">Owner Assets</th></tr>'
                    )
                    var t = $(e)
                        .find(
                          'form table tr td:nth-child(2) table tr:contains("Draft Pick")'
                        )
                        .addClass('alter_td'),
                      a = $(e)
                        .find(
                          'form table tr td:nth-child(2) table tr:contains("Blind Bidding Dollars")'
                        )
                        .addClass('alter_td')
                    $('#TeamDetails .team_bio_table').append(t),
                      $('#TeamDetails .team_bio_table').append(a),
                      $('.alter_td td:nth-child(1)').remove(),
                      $('.alter_td td').attr('colspan', '2'),
                      $('.alter_td td').attr(
                        'style',
                        'text-align:center!important'
                      ),
                      $('#TeamDetails .team_bio_table tr.alter_td').length >
                        0 ||
                        ('0000' === franchise_id
                          ? $('#TeamDetails .team_bio_table').append(
                              '<tr class="oddtablerow"><td colspan="2" class="warning" style="text-align:center!important">Commish Abilities Do Not Permit Access To Trades Data</th></tr>'
                            )
                          : $('#TeamDetails .team_bio_table').append(
                              '<tr class="oddtablerow"><td colspan="2" class="warning" style="text-align:center!important">If Trades Disabled, No Assets Will Be Displayed</th></tr>'
                            )),
                      $('.team_bio_table').show(),
                      $('.teamdetailsWrap,#TeamDetails').show()
                    const r = document.querySelector('#TeamDetails')
                    try {
                      bodyScrollLock.disableBodyScroll(r)
                    } catch (e) {}
                  })
                  .catch(e => {
                    console.error('Error fetching biodata asset:', e)
                  })
              } else {
                $('.team_bio_table').show(),
                  $('.teamdetailsWrap,#TeamDetails').show()
                const e = document.querySelector('#TeamDetails')
                try {
                  bodyScrollLock.disableBodyScroll(e)
                } catch (e) {}
              }
            })
            .catch(e => {
              console.error('Error fetching biodata:', e)
            })
          var d = `${baseURLDynamic}/${year}/options?L=${league_id}&O=16&F=${a}&PRINTER=1`
          fetch(d)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('.report tbody').contents()
              $('#TeamDetails .team_schedule_table').html(t),
                load_playerIcons
                  ? $('body')
                      .find('.team_schedule_table a[class*="franchise_"]')
                      .each(function () {
                        var e = $(this)
                          .attr('class')
                          .substr(
                            $(this).attr('class').indexOf('franchise_') + 10,
                            4
                          )
                        try {
                          $(this).parent().css('white-space', 'nowrap'),
                            $(this)
                              .parent()
                              .prepend(
                                "<div class='franTeam_" +
                                  e +
                                  "' title='" +
                                  franchiseDatabase['fid_' + e].name +
                                  "'></div>"
                              ),
                            setTimeout(function () {
                              $('.team_schedule_table a').contents().unwrap()
                            }, 1e3)
                        } catch (e) {}
                      })
                  : $('.team_schedule_table a').contents().unwrap()
            })
            .catch(e => {
              console.error('Error:', e)
            })
          var p = `${baseURLDynamic}/${year}/options?L=${league_id}&O=202&FID=${a}&PRINTER=1`
          if (
            (fetch(p)
              .then(e => e.text())
              .then(e => {
                var t = $(e).find('.report tbody').contents()
                $('#TeamDetails .team_awards_table').html(t),
                  $('#TeamDetails .team_awards_table td.reportfooter').html(
                    '<a href="' +
                      baseURLDynamic +
                      '/' +
                      year +
                      '/csetup?C=AWARDS&L=' +
                      league_id +
                      '">Create New Award</a> |  <a href="' +
                      baseURLDynamic +
                      '/' +
                      year +
                      '/options?L=' +
                      league_id +
                      '&O=201">Edit League Awards</a>'
                  )
              })
              .catch(e => {
                console.error('Error:', e)
              }),
            completedWeek >= endWeek)
          )
            var u = `${baseURLDynamic}/${year}/lineup?L=${league_id}&FRANCHISE=${a}&WEEK=${endWeek}&PRINTER=1`
          else
            u = `${baseURLDynamic}/${year}/lineup?L=${league_id}&FRANCHISE=${a}&PRINTER=1`
          fetch(u)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('.mobile-wrap form'),
                a = $(e).find('h3.warning')
              $('#TeamDetails .team_lineup_table').append(a),
                $('#TeamDetails .team_lineup_table h3.warning a')
                  .contents()
                  .unwrap(),
                $('#TeamDetails .team_lineup_table').append(t),
                $('.team_lineup_table form').wrap('<tr><td>'),
                $('.team_lineup_table table.report caption a').remove(),
                $('.team_lineup_table table.report caption')
                  .contents()
                  .unwrap()
                  .prependTo('.team_lineup_table')
                  .addClass('lineup_head'),
                $('.team_lineup_table .lineup_head').append(
                  '<div class="lineup_filter" style="float:right;font-size:1.375rem"><div style="padding:0;text-indent:0;display:inline;margin-right:0.625rem;cursor:pointer" id="LineupResetRow" title="Reset Starting Lineup"><i class="fa-regular fa-arrows-rotate" aria-hidden="true"></i></div><div style="padding:0;text-indent:0;display:inline;cursor:pointer" id="LineupClearRow" title="Clear Starting Lineup"><i class="fa-regular fa-eraser" aria-hidden="true"></i></div></div>'
                ),
                $('.team_lineup_table table.report')
                  .removeClass('report')
                  .addClass('target_report')
              var r = []
              $('.target_report tr:eq(0) th').each(function () {
                var e = $(this).text().toLowerCase().replace(/ /g, '-')
                ;('rush' !== e && 'pass' !== e) || (e += '-rank'),
                  'opp-avgvs-pos' === e && (e = 'pass-rank'),
                  'opp-rankvs-pos' === e && (e = 'rush-rank'),
                  -1 !== e.indexOf('select-a') && (e = 'select-total-starters'),
                  -1 !== e.indexOf('week-') && (e = 'weekly-opp'),
                  $(this).addClass(e),
                  r.push(e)
              })
              $('.target_report tr').each(function () {
                var e = 0
                $(this)
                  .find('td')
                  .each(function () {
                    $(this).addClass(r[e + 1]), e++
                  })
              }),
                $('.target_report tr:has(select)').addClass('tie_breakers_row'),
                $(
                  '.target_report .nfl-news,.target_report table .pass-rank'
                ).remove(),
                $(
                  '.target_report tr th:contains("Select"):contains(":")'
                ).addClass('starters_pos_th'),
                $('.target_report .starters_pos_th')
                  .parent('tr')
                  .before('<tr class="starters_pos_row"></tr>'),
                $('.target_report .starters_pos_th').each(function () {
                  $(this).attr('colspan', '100'),
                    $(this).parent('tr').prev('.starters_pos_row').append(this)
                }),
                $(
                  '.target_report tr th:contains("Select"):contains("A"):contains("Total"):contains("Of")'
                ).addClass('starters_count_th'),
                $('.target_report .starters_count_th')
                  .parent('tr')
                  .before('<tr class="starters_count_row"></tr>'),
                $('.target_report .starters_count_th').each(function () {
                  $(this).attr('colspan', '100'),
                    $(this)
                      .parent('tr')
                      .prev('.starters_count_row')
                      .append(this)
                }),
                $(
                  '.target_report tr th:contains("Optional"):contains("Message")'
                ).addClass('message_th'),
                $('.target_report .message_th')
                  .parent('tr')
                  .before('<tr class="message_row"></tr>'),
                $('.target_report .message_th').each(function () {
                  $(this).attr('colspan', '100'),
                    $(this).parent('tr').prev('.message_row').append(this)
                }),
                $(
                  '.target_report th:not(.starters_pos_th):not(.starters_count_th):not(.message_th)'
                ).remove(),
                $('.target_report tr td.player')
                  .not(':has(a[href*="player?"])')
                  .removeClass('player'),
                $(
                  '.team_lineup_table td.pass-rank a,.team_lineup_table td.rush-rank a,.team_lineup_table td.ytd-pts a'
                )
                  .contents()
                  .unwrap(),
                $(
                  '.team_lineup_table td.pass-rank a:empty,.team_lineup_table td.rush-rank a:empty,.team_lineup_table td.ytd-pts a:empty'
                ).remove(),
                $('.team_lineup_table tr').removeClass('newposition'),
                $('.target_report td a[class*="position_').attr(
                  'href',
                  function (e, t) {
                    return t.replace('&PRINTER=1', '')
                  }
                ),
                jQuery('.target_report td.player a').each(function () {
                  jQuery(this).closest('tr').addClass('lineup_player_row')
                }),
                $('.target_report tr.lineup_player_row td.player input')
                  .closest('tr')
                  .addClass('current_bench_row'),
                $(
                  '.target_report tr.lineup_player_row td.player input[checked="checked"]'
                )
                  .closest('tr')
                  .removeClass('current_bench_row')
                  .addClass('current_starters_row previous_starter'),
                $(
                  '.target_report tr.lineup_player_row td.player input[checked="checked"][disabled="disabled"]'
                )
                  .closest('tr')
                  .removeClass('current_bench_row current_starters_row')
                  .addClass('locked_starter'),
                $(
                  '.target_report tr.lineup_player_row td.player input[disabled="disabled"]'
                )
                  .not('input[checked="checked"]')
                  .closest('tr')
                  .removeClass('current_bench_row locked_starter')
                  .addClass('locked_bench'),
                jQuery('.starters_pos_row').each(function () {
                  $(this)
                    .nextUntil('.starters_pos_row')
                    .addBack()
                    .wrapAll('<tbody>')
                }),
                $(document).on(
                  'click',
                  '.target_report tr.current_starters_row',
                  function () {
                    $(this).nextAll('.locked_bench').length &&
                    $(this).nextAll('.current_bench_row').length < 1
                      ? $(this).nextAll('.locked_bench:first').before(this)
                      : ($(this).nextAll('.locked_bench').length &&
                          $(this).nextAll('.current_bench_row').length > 0) ||
                        $(this).nextAll('.current_bench_row').length
                      ? $(this).nextAll('.current_bench_row:first').before(this)
                      : $(this).nextAll('.current_starters_row').length &&
                        $(this)
                          .nextAll('.current_starters_row:last')
                          .after(this),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .find(':checkbox')
                        .prop('checked', !1)
                        .change(),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .removeClass('current_starters_row')
                        .addClass('current_bench_row'),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .attr('title', 'Move To Starting Lineup'),
                      $('.target_report .lineup_player_row:odd')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('eventablerow'),
                      $('.target_report .lineup_player_row:even')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('oddtablerow'),
                      $('.target_report tr.lineup_player_row')
                        .removeClass('last_row')
                        .last()
                        .addClass('last_row')
                  }
                ),
                $(document).on(
                  'click',
                  '.target_report tr.current_bench_row',
                  function () {
                    $(this).prevAll('.locked_starter').length &&
                    $(this).prevAll('.current_starters_row').length < 1
                      ? $(this).prevAll('.locked_starter:first').after(this)
                      : $(this).prevAll('.current_starters_row').length
                      ? $(this)
                          .prevAll('.current_starters_row:first')
                          .after(this)
                      : $(this).prevAll('.starters_pos_row').length &&
                        $(this).prevAll('.starters_pos_row:first').after(this),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .find(':checkbox')
                        .prop('checked', !0)
                        .change(),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .removeClass('current_bench_row')
                        .addClass('current_starters_row'),
                      $(this)
                        .not('.locked_starter')
                        .not('.locked_bench')
                        .attr('title', 'Move To Bench'),
                      $('.target_report .lineup_player_row:odd')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('eventablerow'),
                      $('.target_report .lineup_player_row:even')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('oddtablerow'),
                      $('.target_report tr.lineup_player_row')
                        .removeClass('last_row')
                        .last()
                        .addClass('last_row')
                  }
                ),
                $(document).on(
                  'click',
                  '.target_report tr.lineup_player_row.previous_starter.cleared',
                  function () {
                    $(this).prevAll('.locked_starter').length &&
                    $(this).prevAll('.current_starters_row').length < 1
                      ? $(this).prevAll('.locked_starter:first').after(this)
                      : $(this).prevAll('.current_starters_row').length
                      ? $(this)
                          .prevAll('.current_starters_row:first')
                          .after(this)
                      : $(this).prevAll('.starters_pos_row').length &&
                        $(this).prevAll('.starters_pos_row:first').after(this),
                      $(this)
                        .not('.current_starter')
                        .find(':checkbox')
                        .prop('checked', !0)
                        .change(),
                      $(this)
                        .removeClass('current_bench_row')
                        .addClass('current_starters_row'),
                      $(this)
                        .not('.locked_starter')
                        .attr('title', 'Move To Bench'),
                      $('.target_report .lineup_player_row:odd')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('eventablerow'),
                      $('.target_report .lineup_player_row:even')
                        .removeClass('oddtablerow eventablerow')
                        .addClass('oddtablerow'),
                      $('.target_report tr.lineup_player_row')
                        .removeClass('last_row')
                        .last()
                        .addClass('last_row'),
                      $(
                        '.target_report tr.lineup_player_row.previous_starter.cleared'
                      ).removeClass('cleared')
                  }
                ),
                $(document).on('click', '#LineupClearRow', function () {
                  $('.target_report tr.lineup_player_row')
                    .not('tr.locked_starter')
                    .not('tr.locked_bench')
                    .find('input')
                    .prop('checked', !1)
                    .change(),
                    $('.target_report tr.lineup_player_row')
                      .not('tr.locked_starter')
                      .not('tr.locked_bench')
                      .removeClass('current_starters_row')
                      .addClass('current_bench_row'),
                    $('.target_report tr.lineup_player_row')
                      .not('tr.locked_starter')
                      .not('tr.locked_bench')
                      .attr('title', 'Move To Starting Lineup')
                }),
                $(document).on('click', '#LineupResetRow', function () {
                  $('.target_report tr.lineup_player_row.previous_starter')
                    .not('tr.locked_starter')
                    .addClass('cleared'),
                    $('.target_report tr.lineup_player_row')
                      .not('tr.locked_starter')
                      .not('tr.locked_bench')
                      .find('input')
                      .prop('checked', !1)
                      .change(),
                    $('.target_report tr.lineup_player_row')
                      .not('tr.locked_starter')
                      .not('tr.locked_bench')
                      .removeClass('current_starters_row')
                      .addClass('current_bench_row'),
                    $(
                      '.target_report tr.lineup_player_row.previous_starter.cleared'
                    ).trigger('click')
                }),
                $(
                  '.target_report tr.lineup_player_row td.weekly-opp,.target_report tr.lineup_player_row td.player'
                ).click(function (e) {
                  e.stopPropagation()
                }),
                $('.team_lineup_table tr.current_bench_row')
                  .not('.locked_bench')
                  .attr('title', 'Move To Starting Lineup'),
                $('.team_lineup_table tr.current_starters_row')
                  .not('.locked_starter')
                  .attr('title', 'Move To Bench'),
                $(
                  '.team_lineup_table tr.locked_starter,.team_lineup_table tr.locked_bench'
                ).attr('title', 'Game Has Started - Player Locked'),
                $('.target_report tr.lineup_player_row').each(function () {
                  $(
                    '.target_report td.points,.target_report td.ytd,.target_report td.avg'
                  ).hide()
                  var e = $(this).find('td.proj-pts').html(),
                    t = $(this).find('td.ytd-pts').html(),
                    a = $(this).find('td.avg-pts').html()
                  void 0 === a && (a = 0),
                    void 0 === e && (e = 0),
                    void 0 === t && (t = 0),
                    $(this).append(
                      '<span class="points_row"><span class="avg-pts">Avg:<span>' +
                        a +
                        '</span></span><span class="ytd-pts">YTD:<span>' +
                        t +
                        '</span></span><span class="proj-pts">Proj:<span>' +
                        e +
                        '</span></span></span>'
                    ),
                    setTimeout(function () {
                      $(
                        '.target_report td.points,.target_report td.ytd,.target_report td.avg'
                      ).remove()
                    }, 1e3)
                }),
                $('.target_report tr.tie_breakers_row').before(
                  '<tr><th class="tiebreaker_th" colspan="100" valign="top">Select Tie-Breakers</th></tr>'
                )
              var o = {
                Coach: !0,
                QB: !1,
                TMQB: !0,
                TMRB: !0,
                RB: !1,
                FB: !1,
                WR: !1,
                TMWR: !0,
                TE: !1,
                TMTE: !0,
                KR: !1,
                PK: !1,
                TMPK: !0,
                PN: !1,
                TMPN: !0,
                Off: !0,
                DT: !1,
                DE: !1,
                TMDL: !0,
                LB: !1,
                TMLB: !0,
                CB: !1,
                S: !1,
                TMDB: !0,
                Def: !0,
                ST: !0
              }
              if (
                ('undefined' != typeof franchise_id &&
                  function () {
                    var e, t, a
                    ;(e = function (e) {
                      var t, a, r, o
                      if (-1 !== e.indexOf('launch_player_modal'))
                        return (a = e.split(','))[1]
                          .replace(/'/g, '')
                          .replace(');', '')
                      for (
                        r = 0, o = (a = e.split('?')[1].split('&')).length;
                        r < o;
                        r++
                      )
                        if ('P' === (t = a[r].split('='))[0]) return t[1]
                    }),
                      (t = function (e) {
                        var t
                        return (t = e.split(' '))[t.length - 1]
                      }),
                      (a = function (e) {
                        var t
                        return (t = e.split(' '))[t.length - 2]
                      }),
                      $(function () {
                        var r
                        if ((r = $('.team_lineup_table')).length)
                          return (
                            $('a[class^="position"]').each(function (r, n) {
                              var i, s, l, c, d
                              return (
                                (i = $(n)),
                                (l = e(i.attr('href'))),
                                (c = t(i.text())),
                                (d = a(i.text())),
                                (s = o[c]
                                  ? 'https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_lineup/' +
                                    d +
                                    '.svg'
                                  : 'https://www.mflscripts.com/playerImages_96x96/mfl_' +
                                    l +
                                    '.png'),
                                i
                                  .parentsUntil(
                                    '.team_lineup_table tr',
                                    '.team_lineup_table td'
                                  )
                                  .before(
                                    '<td class="pphoto"><img class="headshot" data-player-img-url="' +
                                      s +
                                      '" /></td>'
                                  )
                                  .find('img')
                              )
                            }),
                            r.find('img').each(function (t, a) {
                              var r
                              return (
                                (r = $(this)).one('error', function () {
                                  return (
                                    r.one('error', function () {
                                      return (
                                        r.one('error', function () {
                                          return $(this).attr(
                                            'src',
                                            'https://www.mflscripts.com/playerImages_96x96/free_agent.png'
                                          )
                                        }),
                                        ($el1 = $(this)),
                                        $el1.attr(
                                          'src',
                                          $el1
                                            .attr('src')
                                            .replace('2014', String(year))
                                        )
                                      )
                                    }),
                                    ($el1 = $(this)),
                                    (id = e(
                                      r
                                        .parent()
                                        .parent()
                                        .find('td.player a')
                                        .attr('href')
                                    )),
                                    $el1.attr(
                                      'src',
                                      '//www.myfantasyleague.com/player_photos_2014/' +
                                        id +
                                        '_thumb.jpg'
                                    )
                                  )
                                }),
                                r.attr('src', r.data('player-img-url'))
                              )
                            })
                          )
                      })
                  }.call(this),
                $('.target_report tr.lineup_player_row').each(function () {
                  var e = $(this).find('td.player a').text(),
                    t = e.split(' ')[e.split(' ').length - 1]
                  $(this).addClass('position_' + t.toLowerCase()),
                    $(this)
                      .find('td.pos-rank')
                      .attr('data-content', t.toUpperCase())
                }),
                setTimeout(function () {
                  $('.target_report tr.locked_bench').each(function () {
                    $(this).prevAll('.starters_pos_row:first').after(this)
                  })
                }, 10),
                setTimeout(function () {
                  $('.target_report tr.current_bench_row').each(function () {
                    $(this).prevAll('.starters_pos_row:first').after(this)
                  })
                }, 40),
                setTimeout(function () {
                  $('.target_report tr.current_starters_row').each(function () {
                    $(this).prevAll('.starters_pos_row:first').after(this)
                  })
                }, 70),
                setTimeout(function () {
                  $('.target_report tr.locked_starter').each(function () {
                    $(this).prevAll('.starters_pos_row:first').after(this)
                  })
                }, 100),
                setTimeout(function () {
                  $('.target_report .lineup_player_row:odd')
                    .removeClass('oddtablerow eventablerow')
                    .addClass('eventablerow'),
                    $('.target_report .lineup_player_row:even')
                      .removeClass('oddtablerow eventablerow')
                      .addClass('oddtablerow'),
                    $('.target_report tr.lineup_player_row')
                      .last()
                      .addClass('last_row')
                }, 150),
                'undefined' != typeof franchise_id &&
                  '0000' !== franchise_id &&
                  completedWeek >= endWeek)
              ) {
                const e = 'team-lineup-week-over-style'
                document.getElementById(e) ||
                  $('head').append(
                    `\n\t\t\t\t<style id="${e}">\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_starter_game_over,\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_bench_game_over{pointer-events:none}\n\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_starter_game_over:after,\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_bench_game_over::after{\n\t\t\t\t\t\tcontent:"\\f30d"!important;\n\t\t\t\t\t\twidth:2.25rem!important;\n\t\t\t\t\t\tfont-size:2.25rem!important;\n\t\t\t\t\t\tright:-0.188rem!important\n\t\t\t\t\t}\n\n\t\t\t\t\t.team_lineup_table.week_over .lineup_filter,\n\t\t\t\t\t.team_lineup_table.week_over input[type="submit"]{pointer-events:none}\n\n\t\t\t\t\t.team_lineup_table.week_over input[type="submit"],\n\t\t\t\t\t.team_lineup_table.week_over .form_buttons:before{opacity:.5}\n\n\t\t\t\t\t.team_lineup_table.week_over .starter_count,\n\t\t\t\t\t.team_lineup_table.week_over .starter_count_sub{display:none!important}\n\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_starter_game_over td.player,\n\t\t\t\t\t.team_lineup_table.week_over tr.locked_bench_game_over td.player{pointer-events:all}\n\t\t\t\t</style>\n\t\t\t`
                  ),
                  $('.team_lineup_table').addClass('week_over'),
                  $(
                    '.team_lineup_table.week_over .current_starters_row'
                  ).addClass('locked_starter_game_over'),
                  $('.team_lineup_table.week_over .current_bench_row').addClass(
                    'locked_bench_game_over'
                  ),
                  $('.team_lineup_table.week_over .player_row').attr(
                    'title',
                    'Game Over'
                  )
              }
            })
            .catch(e => {
              console.error('Error:', e)
            })
          var m = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=MY_OPTIONS`
          fetch(m)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('#my_options tbody').contents()
              $('#TeamDetails .team_options_table').html(t),
                $('.myoptions td[class="inputlabel"]').remove(),
                $('tr.mailingaddress td a').contents().unwrap()
            })
            .catch(e => {
              console.error('Error:', e)
            })
          var f = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=MY_NEWS`
          fetch(f)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('#my_news tbody').contents()
              $('#TeamDetails .team_news_table').html(t)
            })
            .catch(e => {
              console.error('Error:', e)
            })
          var h = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=MY_WATCH_LIST`
          fetch(h)
            .then(e => e.text())
            .then(e => {
              var t = $(e).find('#my_watch_list tbody').contents()
              $('#TeamDetails .team_watch_table').html(t),
                $('.TeamData.team_watch_table > tr:nth-child(1)').replaceWith(
                  '<tr><th>Player</th><th style="text-align: left!important">Owner Status</th><th>YTD Pts</th></tr>'
                )
            })
            .catch(e => {
              console.error('Error:', e)
            }),
            e.preventDefault()
        }
      )
  }
}
if (load_mini_boxscore) {
  if (void 0 === mini_offseason_hide) var mini_offseason_hide = !1
  if (void 0 === deactivate_all_offseason) var deactivate_all_offseason = !1
  if (
    (is_offseason && mini_offseason_hide) ||
    (is_offseason && deactivate_all_offseason)
  )
    $('#MFLBoxWrapper').parent('.mobile-wrap').remove(),
      $('#MFLBoxWrapper').remove()
  else {
    if (void 0 === mflBoxHomePageOnly) var mflBoxHomePageOnly = !0
    if (void 0 === mflBoxUseIcon) var mflBoxUseIcon = !1
    if (void 0 === mflBoxUseLogo) var mflBoxUseLogo = !1
    if (void 0 === mflBoxUseAbbrev) var mflBoxUseAbbrev = !1
    if (void 0 === mflBoxIconBase) var mflBoxIconBase = ''
    if (void 0 === mflBoxIconExt) var mflBoxIconExt = ''
    if (void 0 === mflBoxNFLLogoPath)
      var mflBoxNFLLogoPath =
        'https://www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/'
    if (void 0 === mflBoxNFLLogoExt) var mflBoxNFLLogoExt = 'svg'
    if (void 0 === mflBoxPositionSort)
      var mflBoxPositionSort = [
        'Coach',
        'Off',
        'QB',
        'TMQB',
        'RB',
        'TMRB',
        'WR',
        'TMWR',
        'TE',
        'TMTE',
        'PK',
        'TMPK',
        'PN',
        'TMPN',
        'DT',
        'DE',
        'TMDL',
        'LB',
        'TMLB',
        'CB',
        'S',
        'TMDB',
        'Def',
        'ST'
      ]
    if (void 0 === mflBoxIncludeTiebreaker) var mflBoxIncludeTiebreaker = !1
    if (void 0 === mflBoxShowNonStarter) var mflBoxShowNonStarter = !1
    if (void 0 === mflBoxShowMFLByeTeams) var mflBoxShowMFLByeTeams = !0
    if (void 0 === mflBoxHideNFLMatchups) var mflBoxHideNFLMatchups = !1
    if (void 0 === mflBoxHideFantasyMatchups) var mflBoxHideFantasyMatchups = !1
    if (void 0 === mflBoxHidePaceScores) var mflBoxHidePaceScores = !1
    if (void 0 === precision) var precision = 0
    if (void 0 === mflBoxIsTotalPts) var mflBoxIsTotalPts = !1
    var doMFLBox = !1
    function initMiniDomCaches () {
      try {
        'undefined' != typeof window &&
          (window.__mini_nodes || (window.__mini_nodes = Object.create(null)),
          window.__mini_lists || (window.__mini_lists = Object.create(null)),
          window.el$ ||
            (window.el$ = function el$ (e) {
              const t = window.__mini_nodes
              return t[e] || (t[e] = document.getElementById(e))
            }),
          window.els$ ||
            (window.els$ = function els$ (e) {
              const t = window.__mini_lists
              return t[e] || (t[e] = document.querySelectorAll(e))
            }),
          window.invalidateMiniQsCache ||
            (window.invalidateMiniQsCache = function () {
              try {
                for (const e in window.__mini_lists)
                  delete window.__mini_lists[e]
                for (const e in window.__mini_nodes)
                  delete window.__mini_nodes[e]
              } catch (e) {}
            }))
      } catch (e) {}
    }
    function initMiniOnce () {
      try {
        'undefined' != typeof window &&
          (window.__mini_once || (window.__mini_once = new Set()),
          window.addHeadStyleOnce ||
            (window.addHeadStyleOnce = function (e, t) {
              try {
                if (window.__mini_once.has(e)) return
                window.__mini_once.add(e)
                const a = document.createElement('style')
                ;(a.textContent = t), document.head.appendChild(a)
              } catch (e) {}
            }))
      } catch (e) {}
    }
    if (
      (mflBoxHomePageOnly
        ? ('undefined' != typeof thisProgram &&
            'home' === thisProgram &&
            (doMFLBox = !0),
          'undefined' != typeof thisProgram &&
            'options_247' === thisProgram &&
            (doMFLBox = !1),
          new URLSearchParams(window.location.search).has('MODULE') &&
            (doMFLBox = !1))
        : (doMFLBox = !0),
      doMFLBox && (initMiniDomCaches(), initMiniOnce()),
      doMFLBox)
    ) {
      var mflBoxJSON_league,
        mflBox_byeWeek = {},
        mflBoxJSON_matchups,
        mflBoxJSON_nflSchedule,
        mflBoxJSON_projectedScores = {},
        mflBoxJSON_projectedScoresWeek = {},
        mflBox_matchups = [],
        mflBox_nflSchedule = [],
        mflBox_nflOpponents = {},
        mflBox_players = {},
        mflBoxStartWeek,
        mflBoxLastRegularSeasonWeek,
        mflBoxEndWeek,
        mflBoxMFLSchedule = !0,
        mflBoxStarters = leagueAttributes.MaxStarters,
        mflBoxCurrentWeekKickoff = 0,
        mflBoxActiveWeekKickoff = 0,
        mflBoxCurrentWeek = completedWeek,
        mflBoxCurrentLiveScoring = !1,
        mflBoxActiveWeek = liveScoringWeek
      liveScoringWeek > endWeek && (mflBoxActiveWeek = endWeek)
      var mflBoxIsAllPlay = !1,
        mflBoxAllPlayId = '0001',
        mflBoxDetailsTracker = {},
        mflBoxFirstKickoff = {},
        mflBoxNFLKickoff = {},
        mflBoxFranchise = {},
        mflBoxPlayerDetailsFid = { fid: '', boxid: 0 },
        mflBoxPlayerProjected = {},
        mflBoxLiveStatsPlayer = {},
        mflBoxLiveStatsTeam = {},
        mflBoxTiebreaker = {}
      'undefined' != typeof franchise_id &&
        '0000' !== franchise_id &&
        (mflBoxAllPlayId = franchise_id)
      var mflBoxWeekDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        mflBoxMonth = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec'
        ],
        mflBoxNflGameStatus = {},
        mflBox_player_fid_tracker = {}
      document.getElementById('MFLBoxWrapper') ||
        document.write('<div id="MFLBoxWrapper"></div>'),
        jQuery('#MFLBoxWrapper').html(
          '<div id="MFLBoxContainer"></div><div id="MFLBoxPlayerDetails" style="display:none"></div><div id="MFLBoxOverlay" onclick="mflBoxPlayerDetailsClose()" style="display:none"></div>'
        ),
        addHeadStyleOnce(
          'css-b31e9c4a',
          '#MFLBoxContainer .MFLGameLinks .matchupLolite{border-right:0.375rem solid transparent}#MFLBoxContainer .MFLGameLinks .matchupLolite:last-child{border-right:0}#MFLBoxWrapper .MFLBoxPlayerDetailsTR[onclick*="BYE"]:hover,#MFLBoxWrapper .MFLBoxPlayerDetailsTR[onclick*="AVG"]:hover{background:none!important;cursor:default!important}#MFLBoxWrapper{margin:0.625rem auto}#MFLBoxContainer .MFLGameLinks{width:auto;margin:0 auto;}#MFLBoxContainer .MFLGameLinks tr{height:1.688rem}#MFLBoxContainer .MFLGameLinks .MFLLiveTeam,#MFLBoxContainer .MFLGameLinks .MFLNFLLiveTeam{width:100%}#MFLBoxContainer .MFLGameLinks .MFLPaceScore{font-size:80%;font-style:italic;padding:0 0.313rem;padding:0 .313rem}#MFLBoxContainer .MFLGameLinks .nflicon{height:1.5rem;height:1.5rem;width:auto}#MFLBoxContainer .MFLGameLinks .MFLLiveScore,#MFLBoxContainer .MFLGameLinks .MFLNFLLiveScore{font-weight:700}#MFLBoxContainer .MFLBoxNav .MFLGameLinks td{font-size:0.625rem;text-transform:uppercase;text-align:center}#MFLBoxContainer .MFLGameTable{white-space:nowrap;border:0;padding:0 0.125rem;border-radius:0.188rem;min-width:auto;border-spacing:0;min-width:8.125rem}#MFLBoxMatchups td.matchupLolite:nth-child(1) .MFLGameTable{border-left:0}#MFLBoxContainer .matchupLolite,#MFLBoxContainer .matchupHilite{cursor:default;margin-bottom:0.188rem}#MFLBoxContainer .MFLLiveTeam img{max-height:0.938rem}#MFLBoxContainer .MFLLiveClock,#MFLBoxContainer .MFLNFLLiveClock{text-align:center}#MFLBoxContainer .MFLLiveScore,#MFLBoxContainer .MFLNFLLiveScore{text-align:right}#MFLBoxContainer .MFLExtrasPMR,#MFLBoxContainer .MFLExtrasCP,#MFLBoxContainer .MFLExtrasYTP{text-align:center;font-size:smaller;display:none}#MFLBoxContainer .MFLBoxDetailsArrow{position:absolute;bottom:0.375rem;right:0.125rem;cursor:pointer}.MFLBoxArrowRight:before{content:"\\f054";font-family:"Font Awesome 6 Pro";position:absolute;right:0.125rem;top:2.875rem;font-size:1.875rem;cursor:pointer}.MFLBoxArrowLeft:before{content:"\\f053";font-family:"Font Awesome 6 Pro";position:absolute;right:0.313rem;top:0.375rem;font-size:1.875rem;cursor:pointer}.MFLBoxArrowLeft.MFLBoxArrowFaded:before,.MFLBoxArrowRight.MFLBoxArrowFaded:before{cursor:default;opacity:.4}.mflBoxButtonFaded{opacity:.5}#MFLBoxOverlay{display:none;height:100%;left:0;opacity:.7;position:fixed;top:0;width:100%;z-index:99999;background-color:#000}#MFLBoxWrapper .MFLBoxPlayerDetailsClose{position:absolute;z-index:1;cursor:pointer;text-align:center;font-weight:700;padding:0;right:0.75rem;top:0.938rem;height:1.375rem;width:1.375rem;line-height:1.4;border-radius:0.188rem;border-radius:.188rem;font-family:"Open Sans",sans-serif;font-size:0.813rem;font-size:.813rem;opacity:.6}#MFLBoxWrapper .MFLBoxPlayerDetailsClose:hover{opacity:1}#MFLBoxWrapper .MFLBoxPlayerDetailsNone{text-align:center;font-style:italic}#MFLBoxWrapper #MFLBoxPlayerDetails{position:fixed;z-index:100000;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:0.188rem;padding:0.625rem;width:90%;max-width:28.125rem;height:80%;max-height:25rem;overflow-y: auto;left: 0!important;right: 0!important;top: 0!important;bottom: 0!important;margin: auto;}#MFLBoxWrapper .MFLBoxPlayerDetailsTR:hover{cursor:pointer}#MFLBoxWrapper #MFLBoxPlayerDetails td{font-size:small;}#MFLBoxWrapper #MFLBoxPlayerDetails .MFLPaceScore{font-style:italic}#MFLBoxWrapper #MFLBoxPlayerDetailsTable{padding:0.25rem}#MFLBoxWrapper .MFLBoxLiveStatsScore{cursor:pointer}#MFLBoxWrapper .MFLBoxLiveStatsWrapper{position:relative}#MFLBoxWrapper .MFLBoxLiveStatsContent{position:absolute;right:1.875rem;top:-3.25rem;cursor:default;padding:0.625rem 0.875rem 0.625rem 0.5rem;border-radius:0.313rem;font-weight:700;width:12.5rem;text-align:center;white-space:pre-wrap}#MFLBoxWrapper .MFLBoxLiveStatsClose{position:absolute;right:0.188rem;top:0.188rem;cursor:pointer;font-weight:700}#MFLBoxWrapper #MFLBoxContainer{position:relative;margin:0.625rem 0;margin-top:0}#MFLBoxWrapper #MFLBoxMatchups{min-height:5.313rem;border:0.188rem solid transparent;overflow-y:hidden}#MFLBoxWrapper #MFLBoxMatchups div.warning{line-height:5.188rem;margin:0!important;padding:0!important;border-radius:0.188rem;display:table;width:100%}#MFLBoxWrapper #MFLBoxContainer input[type="button"]{padding:0.188rem;margin:0;font-weight:400;font-size:0.875rem;opacity:1}#MFLBoxWrapper #MFLBoxContainer .matchupAllPlay{cursor:pointer}#MFLBoxWrapper .MFLNFLBoxContainer{overflow:auto;width:auto!important;margin-left:2.188rem;margin-right:1.875rem;-webkit-overflow-scrolling:touch}#MFLBoxWrapper .MFLBoxMFLNFL{position:absolute;top:0.125rem;width:auto;margin-left:-1.563rem;width:2.813rem}.MFLLiveTeam{min-width:3.75rem}#MFLBoxWrapper .downDistance{font-size:0.563rem;font-style:italic}#MFLBoxWrapper .possession:before{background-image:url(https://www.mflscripts.com/ImageDirectory/script-images/football.svg)}#MFLBoxWrapper .redzone:before{background-image:url(https://www.mflscripts.com/ImageDirectory/script-images/goal-post.svg)}#MFLBoxWrapper .possession,#MFLBoxWrapper .redzone{position:relative;padding-left:0.875rem}#MFLBoxWrapper .possession:before,#MFLBoxWrapper .redzone:before{content: "";background-size:0.75rem 0.75rem;height:0.75rem;width:0.75rem;position:absolute;top:50%;transform:translateY(-50%);left:0}#MFLBoxWrapper .redzone{background-image:none;padding-right:0}@media only screen and (max-width: 38em){#MFLBoxWrapper #MFLBoxPlayerDetails td,#MFLBoxWrapper #MFLBoxPlayerDetails th{font-size:0.688rem}}@media only screen and (max-width: 22em){#MFLBoxWrapper #MFLBoxPlayerDetails td,#MFLBoxWrapper #MFLBoxPlayerDetails th{font-size:0.563rem}}'
        ),
        mflBoxShowMFLByeTeams &&
          addHeadStyleOnce(
            'css-2eb4dcec',
            '#MFLBoxContainer .MFLGameLinks.fantasyBoxMatchup{width:100%}'
          ),
        mflBoxHideNFLMatchups &&
          addHeadStyleOnce(
            'css-2c106b0d',
            '#MFLBoxNFLCell,#MFLBoxMFLCell{display:none!important}'
          ),
        mflBoxHidePaceScores &&
          addHeadStyleOnce(
            'css-f3634b97',
            '.MFLGameTable .MFLPaceScore,.MFLGameTable .MFLPaceScore .warning{font-size:0!important;color:transparent!important}'
          ),
        jQuery('#MFLBoxContainer').append(
          '<div class="MFLBoxNav MFLBoxArrowLeft MFLBoxArrowFaded" onclick="mflBoxNewWeek(-1)" style="left:0;"></div>'
        ),
        jQuery('#MFLBoxContainer').append(
          `\n\t<div class="MFLBoxNav MFLBoxMFLNFL" style="left:1.125rem;">\n\t\t<table class="MFLGameLinks">\n\t\t\t<tbody>\n\t\t\t\t<tr>\n\t\t\t\t\t<td id="MFLBoxMFLCell" class="mflBoxCell">\n\t\t\t\t\t\t<span class="form_buttons">\n\t\t\t\t\t\t\t<input \n\t\t\t\t\t\t\t\tid="mflBoxButtonMFL" \n\t\t\t\t\t\t\t\tclass="mflBoxButton" \n\t\t\t\t\t\t\t\tonclick="mflBoxMFLSchedule=true;\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonMFL').attr('style','cursor:default');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonNFL').attr('style','cursor:pointer');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonMFL').removeClass('mflBoxButtonFaded');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonNFL').addClass('mflBoxButtonFaded');\n\t\t\t\t\t\t\t\t\tmflBoxNewWeek(0);" \n\t\t\t\t\t\t\t\tstyle="cursor:default" \n\t\t\t\t\t\t\t\ttype="button" \n\t\t\t\t\t\t\t\tvalue="MFL"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t</span>\n\t\t\t\t\t</td>\n\t\t\t\t</tr>\n\t\t\t\t<tr>\n\t\t\t\t\t<td id="MFLBoxWeekCell">Wk ${mflBoxActiveWeek}</td>\n\t\t\t\t</tr>\n\t\t\t\t<tr>\n\t\t\t\t\t<td id="MFLBoxNFLCell" class="mflBoxCell mflBoxCellInactive">\n\t\t\t\t\t\t<span class="form_buttons">\n\t\t\t\t\t\t\t<input \n\t\t\t\t\t\t\t\tid="mflBoxButtonNFL" \n\t\t\t\t\t\t\t\tclass="mflBoxButton mflBoxButtonFaded" \n\t\t\t\t\t\t\t\tonclick="mflBoxMFLSchedule=false;\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonNFL').attr('style','cursor:default');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonMFL').attr('style','cursor:pointer');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonMFL').addClass('mflBoxButtonFaded');\n\t\t\t\t\t\t\t\t\tjQuery('#mflBoxButtonNFL').removeClass('mflBoxButtonFaded');\n\t\t\t\t\t\t\t\t\tmflBoxNewWeek(0);" \n\t\t\t\t\t\t\t\ttype="button" \n\t\t\t\t\t\t\t\tvalue="NFL"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t</span>\n\t\t\t\t\t</td>\n\t\t\t\t</tr>\n\t\t\t</tbody>\n\t\t</table>\n\t</div>\n`
        ),
        jQuery('#MFLBoxContainer').append(
          '<div id="MFLBoxMatchups" class="report MFLNFLBoxContainer"><div class="warning" style="padding:0.938rem;font-weight:bold;vertical-align:middle;text-align:center;font-style:italic;font-size:1.125rem"></div></div>'
        ),
        (function () {
          try {
            if (!window.MFLCache) return
            var e = window.MFLCache.KEY.mflBoxMatchups(year, league_id),
              t = window.MFLCache.getSync(e)
            if (t && t.data)
              return void (document.getElementById('MFLBoxMatchups').innerHTML =
                t.data)
            window.MFLCache.get(e)
              .then(function (e) {
                if (e && e.data) {
                  var t = document.getElementById('MFLBoxMatchups')
                  t && (t.innerHTML = e.data)
                }
              })
              .catch(function () {})
          } catch (e) {}
        })(),
        jQuery('#MFLBoxContainer').append(
          '<div class="MFLBoxNav MFLBoxArrowRight" onclick="mflBoxNewWeek(1)"></div>'
        )
    } else jQuery('#MFLBoxWrapper').remove()
    function doMFLBoxFantasyWeek () {
      if (mflBoxMFLSchedule)
        return (
          (mflBoxJSON_matchups = {}),
          mflBoxActiveWeek === mflBoxCurrentWeek &&
          liveScoringWeek > completedWeek &&
          !liveScoringLiveWeek?.error
            ? mflBoxCurrentLiveScoring
              ? Promise.resolve()
                  .then(() => {
                    const e = liveScoringLiveWeek || {}
                    if (
                      (e.liveScoring?.matchup &&
                        (e.liveScoring.matchup.franchise
                          ? (mflBoxJSON_matchups.matchup = [
                              e.liveScoring.matchup
                            ])
                          : (mflBoxJSON_matchups.matchup =
                              e.liveScoring.matchup)),
                      e.liveScoring?.franchise &&
                        (e.liveScoring?.id
                          ? (mflBoxJSON_matchups.franchise = [
                              e.liveScoring.franchise
                            ])
                          : (mflBoxJSON_matchups.franchise =
                              e.liveScoring.franchise)),
                      mflBoxIncludeTiebreaker)
                    ) {
                      const e = Math.min(mflBoxActiveWeek, endWeek),
                        t = reportWeeklyResults_ar[`w_${e}`]
                      try {
                        mflBoxPopulateTiebreaker(t.weeklyResults)
                      } catch {}
                    }
                    return mflBoxJSON_matchups
                  })
                  .catch(e => {
                    console.log('Error:', e)
                  })
              : Promise.resolve().then(() => {
                  const e = Math.min(mflBoxActiveWeek, endWeek),
                    t = reportWeeklyResults_ar[`w_${e}`]
                  try {
                    mflBoxJSON_matchups = t.weeklyResults
                  } catch {}
                  return mflBoxJSON_matchups
                })
            : Promise.resolve().then(() => {
                const e = Math.min(mflBoxActiveWeek, endWeek),
                  t = reportWeeklyResults_ar[`w_${e}`]
                try {
                  mflBoxJSON_matchups = t.weeklyResults
                } catch {}
                return mflBoxJSON_matchups
              })
        )
    }
    function mflBoxCheckWeeklyResultsForScore (e) {
      const t = 'w_' + Math.min(Number(e ?? mflBoxActiveWeek) || 0, endWeek),
        a = reportWeeklyResults_ar?.[t]?.weeklyResults
      if (!a || !a.matchup) return !1
      const r = Array.isArray(a.matchup) ? a.matchup : [a.matchup]
      for (const e of r) {
        const t = Array.isArray(e?.franchise)
          ? e.franchise
          : e?.franchise
          ? [e.franchise]
          : []
        for (const e of t) {
          const t = Number(e?.score)
          if (!Number.isNaN(t) && t > 0) return !0
        }
      }
      return !1
    }
    function doMFLBoxNFLWeek () {
      return Promise.resolve().then(() => {
        doMFLBoxNFLWeek_response(
          (mflBoxJSON_nflSchedule =
            reportNflSchedule_ar[`w_${mflBoxActiveWeek}`].nflSchedule)
        )
      })
    }
    function doMFLBoxNFLWeek_response (e) {
      mflBoxNflGameStatus = {}
      var t = []
      e.matchup && e.matchup.hasOwnProperty('team')
        ? (t[0] = e.matchup)
        : (t = e.matchup || [])
      for (var a = 0; a < t.length; a++) {
        var r = t[a]
        if (r && r.team && !(r.team.length < 2)) {
          var o = r.team[0],
            n = r.team[1],
            i = o.id,
            s = n.id,
            l = parseInt(r.kickoff, 10) || 0,
            c = void 0 !== o.score ? parseInt(o.score, 10) : null,
            d = void 0 !== n.score ? parseInt(n.score, 10) : null
          ;(mflBoxNflGameStatus[i] = {
            time: l,
            isHome: !1,
            isBye: !1,
            score: c
          }),
            (mflBoxNflGameStatus[s] = {
              time: l,
              isHome: !0,
              isBye: !1,
              score: d
            })
        }
      }
    }
    function doMFLBoxProjectedScores () {
      return mflBoxCurrentWeek >= mflBoxActiveWeek &&
        !mflBoxHideFantasyMatchups &&
        mflBoxMFLSchedule
        ? Promise.resolve().then(() => {
            const e = `w_${mflBoxActiveWeek}`
            if (mflBoxJSON_projectedScoresWeek.hasOwnProperty(e))
              mflBoxJSON_projectedScores = mflBoxJSON_projectedScoresWeek[e]
            else
              try {
                ;(mflBoxJSON_projectedScoresWeek[e] =
                  reportProjectedScores_ar[e]),
                  (mflBoxJSON_projectedScores = reportProjectedScores_ar[e])
              } catch (e) {
                console.error('Error:', e)
              }
          })
        : Promise.resolve()
    }
    function doMFLBoxArrays () {
      for (var e in ((mflBox_players = {}),
      (mflBox_player_fid_tracker = {}),
      (mflBox_matchups = []),
      (mflBox_nflSchedule = []),
      (mflBox_nflOpponents = {}),
      (mflBoxIsAllPlay = !1),
      (mflBoxFranchise = {}),
      (mflBoxPlayerProjected = {}),
      reportStandingsFid_ar))
        if (reportStandingsFid_ar.hasOwnProperty(e)) {
          var t = '0',
            a = '0',
            r = '0'
          reportStandingsFid_ar[e].hasOwnProperty('w') &&
            (t = reportStandingsFid_ar[e].w),
            reportStandingsFid_ar[e].hasOwnProperty('l') &&
              (a = reportStandingsFid_ar[e].l),
            reportStandingsFid_ar[e].hasOwnProperty('t') &&
              (r = reportStandingsFid_ar[e].t),
            (franchiseDatabase['fid_' + e].record =
              '(' + t + '-' + a + '-' + r + ')')
        }
      if (
        mflBoxJSON_matchups &&
        'object' == typeof mflBoxJSON_matchups &&
        ('matchup' in mflBoxJSON_matchups || 'franchise' in mflBoxJSON_matchups)
      ) {
        if ('matchup' in mflBoxJSON_matchups) {
          var o = []
          mflBoxJSON_matchups.matchup.hasOwnProperty('franchise')
            ? o.push(mflBoxJSON_matchups.matchup)
            : (o = mflBoxJSON_matchups.matchup)
          for (var n = 0; n < o.length; n++) {
            var i = o[n].franchise[0],
              s = o[n].franchise[1]
            ;(mflBox_matchups[n] = {
              roadId: i.id,
              homeId: s.id,
              roadScore: i.score,
              homeScore: s.score,
              roadProjected: 0,
              homeProjected: 0,
              roadYetToPlay: 0,
              homeYetToPlay: 0,
              roadCurrentlyPlaying: 0,
              homeCurrentlyPlaying: 0,
              roadPlayerMinutesRemaining: 0,
              homePlayerMinutesRemaining: 0
            }),
              (mflBox_matchups[n].roadSpread = ''),
              (mflBox_matchups[n].homeSpread = ''),
              void 0 !== i.spread &&
                parseFloat(i.spread) < 0 &&
                (mflBox_matchups[n].roadSpread = parseFloat(i.spread).toFixed(
                  1
                )),
              void 0 !== s.spread &&
                parseFloat(s.spread) < 0 &&
                (mflBox_matchups[n].homeSpread = parseFloat(s.spread).toFixed(
                  1
                )),
              mflBoxActiveWeek > liveScoringWeek &&
                mflBoxActiveWeek > completedWeek + 1 &&
                ((mflBox_matchups[n].roadSpread = ''),
                (mflBox_matchups[n].homeSpread = '')),
              (mflBox_matchups[n].roadResult = ''),
              (mflBox_matchups[n].homeResult = ''),
              void 0 !== i.result && (mflBox_matchups[n].roadResult = i.result),
              void 0 !== s.result && (mflBox_matchups[n].homeResult = s.result),
              (mflBox_matchups[n].roadStarters = ''),
              (mflBox_matchups[n].homeStarters = ''),
              i.hasOwnProperty('starters') &&
                void 0 !== i.starters &&
                (mflBox_matchups[n].roadStarters = i.starters),
              s.hasOwnProperty('starters') &&
                void 0 !== s.starters &&
                (mflBox_matchups[n].homeStarters = s.starters)
            try {
              if (
                ((mflBox_matchups[n].roadYetToPlay = parseInt(
                  o[n].franchise[0].playersYetToPlay
                )),
                (mflBox_matchups[n].homeYetToPlay = parseInt(
                  o[n].franchise[1].playersYetToPlay
                )),
                (mflBox_matchups[n].roadCurrentlyPlaying = parseInt(
                  o[n].franchise[0].playersCurrentlyPlaying
                )),
                (mflBox_matchups[n].homeCurrentlyPlaying = parseInt(
                  o[n].franchise[1].playersCurrentlyPlaying
                )),
                (mflBox_matchups[n].roadPlayerMinutesRemaining = parseInt(
                  parseInt(o[n].franchise[0].gameSecondsRemaining) / 60 + 0.99
                )),
                (mflBox_matchups[n].homePlayerMinutesRemaining = parseInt(
                  parseInt(o[n].franchise[1].gameSecondsRemaining) / 60 + 0.99
                )),
                o[n].franchise[0].players.hasOwnProperty('player'))
              )
                for (
                  var l = 0;
                  l < o[n].franchise[0].players.player.length;
                  l++
                ) {
                  if (
                    'starter' ===
                    (p = o[n].franchise[0].players.player[l]).status
                  )
                    var c = '1'
                  else c = '0'
                  if (
                    (void 0 === mflBox_players['pid_' + p.id]
                      ? ((mflBox_players['pid_' + p.id] = {
                          id: p.id,
                          fid: i.id,
                          score: p.score,
                          gameSecondsRemaining: parseInt(
                            p.gameSecondsRemaining
                          ),
                          isStarter: c
                        }),
                        (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1))
                      : void 0 ===
                          mflBox_player_fid_tracker[p.id + '_' + i.id] &&
                        ((mflBox_players['pid_' + p.id].fid += ',' + i.id),
                        (mflBox_players['pid_' + p.id].isStarter += ',' + c),
                        (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1)),
                    '1' === c)
                  )
                    try {
                      void 0 === mflBoxFirstKickoff[o[n].franchise[0].id]
                        ? mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          (mflBoxFirstKickoff[o[n].franchise[0].id] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                        : mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] <
                            mflBoxFirstKickoff[o[n].franchise[0].id] &&
                          (mflBoxFirstKickoff[o[n].franchise[0].id] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                    } catch (e) {
                      console.log('error road')
                    }
                  void 0 === mflBoxFranchise['fid_' + i.id] &&
                    (mflBoxFranchise['fid_' + i.id] = {
                      starter: {},
                      bench: {},
                      tiebreaker: {}
                    }),
                    'starter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      }),
                    'nonstarter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      })
                }
              if (o[n].franchise[1].players.hasOwnProperty('player'))
                for (l = 0; l < o[n].franchise[1].players.player.length; l++) {
                  if (
                    'starter' ===
                    (p = o[n].franchise[1].players.player[l]).status
                  )
                    c = '1'
                  else c = '0'
                  if (
                    (void 0 === mflBox_players['pid_' + p.id]
                      ? ((mflBox_players['pid_' + p.id] = {
                          id: p.id,
                          fid: s.id,
                          score: p.score,
                          gameSecondsRemaining: parseInt(
                            p.gameSecondsRemaining
                          ),
                          isStarter: c
                        }),
                        (mflBox_player_fid_tracker[p.id + '_' + s.id] = 1))
                      : void 0 ===
                          mflBox_player_fid_tracker[p.id + '_' + s.id] &&
                        ((mflBox_players['pid_' + p.id].fid += ',' + s.id),
                        (mflBox_players['pid_' + p.id].isStarter += ',' + c),
                        (mflBox_player_fid_tracker[p.id + '_' + s.id] = 1)),
                    '1' === c)
                  )
                    try {
                      void 0 === mflBoxFirstKickoff[o[n].franchise[1].id]
                        ? mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          (mflBoxFirstKickoff[o[n].franchise[1].id] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                        : mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] <
                            mflBoxFirstKickoff[o[n].franchise[1].id] &&
                          (mflBoxFirstKickoff[o[n].franchise[1].id] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                    } catch (e) {
                      console.log('error home')
                    }
                  void 0 === mflBoxFranchise['fid_' + s.id] &&
                    (mflBoxFranchise['fid_' + s.id] = {
                      starter: {},
                      bench: {},
                      tiebreaker: {}
                    }),
                    'starter' === p.status &&
                      (mflBoxFranchise['fid_' + s.id].starter[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      }),
                    'nonstarter' === p.status &&
                      (mflBoxFranchise['fid_' + s.id].bench[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      })
                }
            } catch (e) {
              try {
                if (mflBoxActiveWeek <= completedWeek) {
                  ;(i = o[n].franchise[0]), (s = o[n].franchise[1])
                  try {
                    for (var d = 0; d < o[n].franchise[0].player.length; d++) {
                      var p = o[n].franchise[0].player[d]
                      void 0 === mflBoxFranchise['fid_' + i.id] &&
                        (mflBoxFranchise['fid_' + i.id] = {
                          starter: {},
                          bench: {},
                          tiebreaker: {}
                        }),
                        'starter' === p.status &&
                          (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                            score: p.score,
                            gsr: 0
                          }),
                        'nonstarter' === p.status &&
                          (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                            score: p.score,
                            gsr: 0
                          })
                    }
                  } catch (e) {}
                  try {
                    for (d = 0; d < o[n].franchise[1].player.length; d++) {
                      p = o[n].franchise[1].player[d]
                      void 0 === mflBoxFranchise['fid_' + s.id] &&
                        (mflBoxFranchise['fid_' + s.id] = {
                          starter: {},
                          bench: {},
                          tiebreaker: {}
                        }),
                        'starter' === p.status &&
                          (mflBoxFranchise['fid_' + s.id].starter[p.id] = {
                            score: p.score,
                            gsr: 0
                          }),
                        'nonstarter' === p.status &&
                          (mflBoxFranchise['fid_' + s.id].bench[p.id] = {
                            score: p.score,
                            gsr: 0
                          })
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
          }
        } else if (
          mflBoxJSON_matchups &&
          mflBoxJSON_matchups.franchise &&
          mflBoxJSON_matchups.franchise.length
        ) {
          mflBoxIsAllPlay = !0
          for (s = null, n = 0; n < mflBoxJSON_matchups.franchise.length; n++)
            if (mflBoxAllPlayId === mflBoxJSON_matchups.franchise[n].id) {
              s = mflBoxJSON_matchups.franchise[n]
              break
            }
          if (s) {
            var u = 0
            for (n = 0; n < mflBoxJSON_matchups.franchise.length; n++) {
              if (mflBoxAllPlayId !== mflBoxJSON_matchups.franchise[n].id) {
                i = mflBoxJSON_matchups.franchise[n]
                ;(mflBox_matchups[u] = {
                  roadId: i.id,
                  homeId: s.id,
                  roadScore: i.score,
                  homeScore: s.score,
                  roadProjected: 0,
                  homeProjected: 0,
                  roadYetToPlay: 0,
                  homeYetToPlay: 0,
                  roadCurrentlyPlaying: 0,
                  homeCurrentlyPlaying: 0,
                  roadPlayerMinutesRemaining: 0,
                  homePlayerMinutesRemaining: 0
                }),
                  (mflBox_matchups[u].roadSpread = ''),
                  (mflBox_matchups[u].homeSpread = ''),
                  (mflBox_matchups[u].roadResult = ''),
                  (mflBox_matchups[u].homeResult = ''),
                  mflBoxActiveWeek <= completedWeek &&
                    (parseFloat(i.score) > parseFloat(s.score) &&
                      (mflBox_matchups[u].roadResult = 'W'),
                    parseFloat(s.score) > parseFloat(i.score) &&
                      (mflBox_matchups[u].homeResult = 'W')),
                  (mflBox_matchups[u].roadYetToPlay = parseInt(
                    i.playersYetToPlay
                  )),
                  (mflBox_matchups[u].homeYetToPlay = parseInt(
                    s.playersYetToPlay
                  )),
                  (mflBox_matchups[u].roadCurrentlyPlaying = parseInt(
                    i.playersCurrentlyPlaying
                  )),
                  (mflBox_matchups[u].homeCurrentlyPlaying = parseInt(
                    s.playersCurrentlyPlaying
                  )),
                  (mflBox_matchups[u].roadPlayerMinutesRemaining = parseInt(
                    parseInt(i.gameSecondsRemaining) / 60 + 0.99
                  )),
                  (mflBox_matchups[u].homePlayerMinutesRemaining = parseInt(
                    parseInt(s.gameSecondsRemaining) / 60 + 0.99
                  )),
                  u++
              }
              try {
                for (
                  l = 0;
                  l < mflBoxJSON_matchups.franchise[n].players.player.length;
                  l++
                ) {
                  i = mflBoxJSON_matchups.franchise[n]
                  if (
                    'starter' ===
                    (p = mflBoxJSON_matchups.franchise[n].players.player[l])
                      .status
                  )
                    c = '1'
                  else c = '0'
                  if (
                    (void 0 === mflBox_players['pid_' + p.id]
                      ? ((mflBox_players['pid_' + p.id] = {
                          id: p.id,
                          fid: i.id,
                          score: p.score,
                          gameSecondsRemaining: parseInt(
                            p.gameSecondsRemaining
                          ),
                          isStarter: c
                        }),
                        (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1))
                      : void 0 ===
                          mflBox_player_fid_tracker[p.id + '_' + i.id] &&
                        ((mflBox_players['pid_' + p.id].fid += ',' + i.id),
                        (mflBox_players['pid_' + p.id].isStarter += ',' + c),
                        (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1)),
                    '1' === c)
                  )
                    try {
                      void 0 ===
                      mflBoxFirstKickoff[mflBoxJSON_matchups.franchise[n].id]
                        ? mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          (mflBoxFirstKickoff[
                            mflBoxJSON_matchups.franchise[n].id
                          ] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                        : mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                            0 &&
                          mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] <
                            mflBoxFirstKickoff[
                              mflBoxJSON_matchups.franchise[n].id
                            ] &&
                          (mflBoxFirstKickoff[
                            mflBoxJSON_matchups.franchise[n].id
                          ] =
                            mflBoxNFLKickoff[
                              playerDatabase['pid_' + p.id].team
                            ])
                    } catch (e) {}
                  void 0 === mflBoxFranchise['fid_' + i.id] &&
                    (mflBoxFranchise['fid_' + i.id] = {
                      starter: {},
                      bench: {},
                      tiebreaker: {}
                    }),
                    'starter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      }),
                    'nonstarter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                        score: p.score,
                        gsr: p.gameSecondsRemaining
                      })
                }
              } catch (e) {
                try {
                  if (mflBoxActiveWeek <= completedWeek)
                    for (
                      i = mflBoxJSON_matchups.franchise[n], d = 0;
                      d < mflBoxJSON_matchups.franchise[n].player.length;
                      d++
                    ) {
                      p = mflBoxJSON_matchups.franchise[n].player[d]
                      void 0 === mflBoxFranchise['fid_' + i.id] &&
                        (mflBoxFranchise['fid_' + i.id] = {
                          starter: {},
                          bench: {},
                          tiebreaker: {}
                        }),
                        'starter' === p.status &&
                          (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                            score: p.score,
                            gsr: 0
                          }),
                        'nonstarter' === p.status &&
                          (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                            score: p.score,
                            gsr: 0
                          })
                    }
                } catch (e) {}
              }
            }
            mflBox_matchups.sort(function (e, t) {
              return parseFloat(e.roadScore) < parseFloat(t.roadScore)
                ? 1
                : parseFloat(e.roadScore) > parseFloat(t.roadScore)
                ? -1
                : 0
            })
          }
        }
      } else;
      if (
        !mflBoxIsAllPlay &&
        mflBoxShowMFLByeTeams &&
        mflBoxJSON_matchups &&
        mflBoxJSON_matchups.hasOwnProperty('franchise')
      ) {
        if (mflBoxJSON_matchups.franchise.hasOwnProperty('id'))
          (m = { franchise: [] }).franchise.push(mflBoxJSON_matchups.franchise)
        else var m = mflBoxJSON_matchups
        for (n = 0; n < m.franchise.length; n++) {
          ;(u = mflBox_matchups.length), (i = m.franchise[n])
          ;(mflBox_matchups[u] = {
            roadId: i.id,
            homeId: 'BYE',
            roadScore: i.score,
            homeScore: 0,
            roadProjected: 0,
            homeProjected: 0,
            roadYetToPlay: 0,
            homeYetToPlay: 0,
            roadCurrentlyPlaying: 0,
            homeCurrentlyPlaying: 0,
            roadPlayerMinutesRemaining: 0,
            homePlayerMinutesRemaining: 0
          }),
            (mflBox_matchups[u].roadSpread = ''),
            (mflBox_matchups[u].homeSpread = ''),
            (mflBox_matchups[u].roadResult = ''),
            (mflBox_matchups[u].homeResult = ''),
            (mflBox_matchups[u].roadYetToPlay = parseInt(i.playersYetToPlay)),
            (mflBox_matchups[u].homeYetToPlay = 0),
            (mflBox_matchups[u].roadCurrentlyPlaying = parseInt(
              i.playersCurrentlyPlaying
            )),
            (mflBox_matchups[u].homeCurrentlyPlaying = 0),
            (mflBox_matchups[u].roadPlayerMinutesRemaining = parseInt(
              parseInt(i.gameSecondsRemaining) / 60 + 0.99
            )),
            (mflBox_matchups[u].homePlayerMinutesRemaining = 0),
            u++
          try {
            for (l = 0; l < m.franchise[n].players.player.length; l++) {
              if ('starter' === (p = m.franchise[n].players.player[l]).status)
                c = '1'
              else c = '0'
              if (
                (void 0 === mflBox_players['pid_' + p.id]
                  ? ((mflBox_players['pid_' + p.id] = {
                      id: p.id,
                      fid: i.id,
                      score: p.score,
                      gameSecondsRemaining: parseInt(p.gameSecondsRemaining),
                      isStarter: c
                    }),
                    (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1))
                  : void 0 === mflBox_player_fid_tracker[p.id + '_' + i.id] &&
                    ((mflBox_players['pid_' + p.id].fid += ',' + i.id),
                    (mflBox_players['pid_' + p.id].isStarter += ',' + c),
                    (mflBox_player_fid_tracker[p.id + '_' + i.id] = 1)),
                '1' === c)
              )
                try {
                  void 0 === mflBoxFirstKickoff[m.franchise[n].id]
                    ? mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                        0 &&
                      (mflBoxFirstKickoff[m.franchise[n].id] =
                        mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team])
                    : mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] >
                        0 &&
                      mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team] <
                        mflBoxFirstKickoff[m.franchise[n].id] &&
                      (mflBoxFirstKickoff[m.franchise[n].id] =
                        mflBoxNFLKickoff[playerDatabase['pid_' + p.id].team])
                } catch (e) {}
              void 0 === mflBoxFranchise['fid_' + i.id] &&
                (mflBoxFranchise['fid_' + i.id] = {
                  starter: {},
                  bench: {},
                  tiebreaker: {}
                }),
                'starter' === p.status &&
                  (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                    score: p.score,
                    gsr: p.gameSecondsRemaining
                  }),
                'nonstarter' === p.status &&
                  (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                    score: p.score,
                    gsr: p.gameSecondsRemaining
                  })
            }
          } catch (e) {
            try {
              if (mflBoxActiveWeek <= completedWeek)
                for (
                  i = m.franchise[n], d = 0;
                  d < m.franchise[n].player.length;
                  d++
                ) {
                  p = m.franchise[n].player[d]
                  void 0 === mflBoxFranchise['fid_' + i.id] &&
                    (mflBoxFranchise['fid_' + i.id] = {
                      starter: {},
                      bench: {},
                      tiebreaker: {}
                    }),
                    'starter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].starter[p.id] = {
                        score: p.score,
                        gsr: 0
                      }),
                    'nonstarter' === p.status &&
                      (mflBoxFranchise['fid_' + i.id].bench[p.id] = {
                        score: p.score,
                        gsr: 0
                      })
                }
            } catch (e) {}
          }
        }
      }
      var f = []
      if (!mflBoxJSON_nflSchedule || !mflBoxJSON_nflSchedule.matchup) return !0
      void 0 === mflBoxJSON_nflSchedule.matchup.length
        ? ((f.matchup = []), f.matchup.push(mflBoxJSON_nflSchedule.matchup))
        : (f = mflBoxJSON_nflSchedule)
      for (l = 0; l < 3; l++)
        for (n = 0; n < f.matchup.length; n++) {
          ;(i = f.matchup[n].team[0]), (s = f.matchup[n].team[1])
          switch (l) {
            case 0:
              if ('INPROG' !== mflBoxNflGameStatus[s.id].status) continue
              break
            case 1:
              if ('SCHED' !== mflBoxNflGameStatus[s.id].status) continue
              break
            case 2:
              if ('OVER' !== mflBoxNflGameStatus[s.id].status) continue
          }
          if (parseFloat(i.spread) < 0) var h = parseFloat(i.spread).toFixed(1)
          else h = ''
          if (parseFloat(s.spread) < 0) var y = parseFloat(s.spread).toFixed(1)
          else y = ''
          mflBoxActiveWeek > liveScoringWeek &&
            mflBoxActiveWeek > completedWeek + 1 &&
            ((y = ''), (h = '')),
            mflBox_nflSchedule.push({
              roadId: i.id,
              homeId: s.id,
              roadScore: mflBoxLiveStatsTeam[i.id].TPS,
              homeScore: mflBoxLiveStatsTeam[s.id].TPS,
              roadSpread: h,
              homeSpread: y,
              roadResult: mflBoxLiveStatsTeam[i.id].RES,
              homeResult: mflBoxLiveStatsTeam[s.id].RES,
              kickoff: mflBoxNflGameStatus[s.id].kickoff,
              gameSecondsRemaining: mflBoxNflGameStatus[s.id].secs_left,
              clock: mflBoxNflGameStatus[s.id].clock,
              roadPossession: mflBoxNflGameStatus[i.id].possession,
              roadRedzone: mflBoxNflGameStatus[i.id].redzone,
              roadDownAndDist: mflBoxNflGameStatus[i.id].down_and_dist,
              homePossession: mflBoxNflGameStatus[s.id].possession,
              homeRedzone: mflBoxNflGameStatus[s.id].redzone,
              homeDownAndDist: mflBoxNflGameStatus[s.id].down_and_dist
            }),
            0 === mflBoxCurrentWeekKickoff &&
              (mflBoxCurrentWeekKickoff = parseInt(f.matchup[n].kickoff)),
            0 === n &&
              (mflBoxActiveWeekKickoff = parseInt(f.matchup[n].kickoff)),
            (mflBox_nflOpponents[i.id] = {
              opponent: s.id,
              isHome: !1,
              score: mflBoxLiveStatsTeam[i.id].TPS,
              result: mflBoxLiveStatsTeam[i.id].RES
            }),
            (mflBox_nflOpponents[s.id] = {
              opponent: i.id,
              isHome: !0,
              score: mflBoxLiveStatsTeam[s.id].TPS,
              result: mflBoxLiveStatsTeam[s.id].RES
            })
        }
      return !0
    }
    function doMFLBoxArrows () {
      mflBoxMFLSchedule &&
        mflBoxActiveWeek > mflBoxEndWeek &&
        (mflBoxActiveWeek = mflBoxEndWeek)
      const e = el$('MFLBoxWeekCell')
      e && (e.textContent = 'Wk ' + mflBoxActiveWeek)
      const t = els$('.MFLBoxArrowLeft'),
        a = els$('.MFLBoxArrowRight'),
        setFaded = (e, t) =>
          e.forEach(e => e.classList.toggle('MFLBoxArrowFaded', t))
      setFaded(
        t,
        mflBoxMFLSchedule
          ? !(mflBoxActiveWeek > mflBoxStartWeek)
          : !(mflBoxActiveWeek > 1)
      )
      const r = document.querySelector('#mflBoxButtonMFL.mflBoxButtonFaded'),
        o = document.querySelector('#mflBoxButtonNFL.mflBoxButtonFaded')
      if (r) {
        setFaded(a, !1)
        let e = !1
        try {
          const t = mflBoxActiveWeek + 1,
            r = 'w_' + t,
            o = reportNflSchedule_ar?.[r]?.nflSchedule
          o &&
            parseInt(o.week, 10) === t &&
            (Array.isArray(o.matchup)
              ? (e = o.matchup.length > 0)
              : o.matchup &&
                Array.isArray(o.matchup.team) &&
                (e = o.matchup.team.length > 0)),
            setFaded(a, !e)
        } catch (e) {
          console.log('No Schedule For NFL Week Requested'), setFaded(a, !0)
        }
      } else
        o && (mflBoxActiveWeek >= endWeek ? setFaded(a, !0) : setFaded(a, !1))
    }
    function mflBoxExpand (e, t) {
      t
        ? (jQuery('.MFLExtras_' + e).show(),
          jQuery('#mflBoxCollapse_' + e).show(),
          jQuery('#mflBoxExpand_' + e).hide(),
          (mflBoxDetailsTracker[e] = t))
        : (jQuery('.MFLExtras_' + e).hide(),
          jQuery('#mflBoxCollapse_' + e).hide(),
          jQuery('#mflBoxExpand_' + e).show(),
          (mflBoxDetailsTracker[e] = t))
    }
    function mflBoxPopulateTiebreaker (e) {
      for (var t in ((mflBoxTiebreaker = {}), franchiseDatabase))
        franchiseDatabase.hasOwnProperty(t) &&
          parseInt(franchiseDatabase[t].id) > 0 &&
          (mflBoxTiebreaker[t] = {})
      try {
        for (var a = 0; a < e.matchup.length; a++) {
          var r = e.matchup[a].franchise[0],
            o = e.matchup[a].franchise[1]
          if (void 0 !== r.tiebreaker && 0 !== r.tiebreaker.length)
            for (var n = r.tiebreaker.split(','), i = 0; i < n.length; i++)
              parseInt(n[i]) > 0 &&
                (mflBoxTiebreaker['fid_' + r.id]['pid_' + n[i]] = 1)
          if (void 0 !== o.tiebreaker && 0 !== o.tiebreaker.length)
            for (n = o.tiebreaker.split(','), i = 0; i < n.length; i++)
              parseInt(n[i]) > 0 &&
                (mflBoxTiebreaker['fid_' + o.id]['pid_' + n[i]] = 1)
        }
      } catch (t) {
        try {
          ;(r = e.matchup.franchise[0]), (o = e.matchup.franchise[1])
          if (void 0 !== r.tiebreaker && 0 !== r.tiebreaker.length)
            for (n = r.tiebreaker.split(','), i = 0; i < n.length; i++)
              parseInt(n[i]) > 0 &&
                (mflBoxTiebreaker['fid_' + r.id]['pid_' + n[i]] = 1)
          if (void 0 !== o.tiebreaker && 0 !== o.tiebreaker.length)
            for (n = o.tiebreaker.split(','), i = 0; i < n.length; i++)
              parseInt(n[i]) > 0 &&
                (mflBoxTiebreaker['fid_' + o.id]['pid_' + n[i]] = 1)
        } catch (t) {
          for (a = 0; a < e.franchise.length; a++) {
            if (mflBoxAllPlayId !== e.franchise[a].id)
              if (
                void 0 !== (r = e.franchise[a]).tiebreaker &&
                0 !== r.tiebreaker.length
              )
                for (n = r.tiebreaker.split(','), i = 0; i < n.length; i++)
                  parseInt(n[i]) > 0 &&
                    (mflBoxTiebreaker['fid_' + r.id]['pid_' + n[i]] = 1)
          }
        }
      }
    }
    function mflBoxCheckLive () {
      return (
        mflBoxCurrentLiveScoring &&
        mflBoxActiveWeek === mflBoxCurrentWeek &&
        !liveScoringLiveWeek?.error
      )
    }
    function mflBoxCheckCompletedWeek () {
      return mflBoxActiveWeek <= completedWeek
    }
    function mflBoxNewWeek (e) {
      if (
        ($('#MFLBoxPlayerDetails').hide(),
        (mflBoxPlayerDetailsFid.fid = ''),
        e > 0)
      ) {
        if (jQuery('.MFLBoxArrowRight').hasClass('MFLBoxArrowFaded')) return !1
      } else if (
        e < 0 &&
        jQuery('.MFLBoxArrowLeft').hasClass('MFLBoxArrowFaded')
      )
        return !1
      ;(mflBoxActiveWeek += e), doMFLBoxArrows(), doMFLBoxUpdate(!0)
    }
    function mflBoxGameClockMinutes (e) {
      var t = parseInt((60 * e) / 100),
        a = (60 * e) / 100 - parseInt((60 * e) / 100),
        r = parseInt(60 * a)
      return r < 10 && (r = '0' + r), t + ':' + r
    }
    function mflBoxGameClock (e, t) {
      if (0 === t || 3 === t) {
        if (3 === t) {
          if (0 === e) return 'Final'
          if (0 === e) return '4th - 0:00'
        }
        return e < 25
          ? '4th - ' + mflBoxGameClockMinutes(e)
          : 25 === e
          ? '4th - 15:00'
          : e < 50
          ? '3rd - ' + mflBoxGameClockMinutes(e - 25)
          : 50 === e
          ? 'Halftime'
          : e < 75
          ? '2nd - ' + mflBoxGameClockMinutes(e - 50)
          : 75 === e
          ? '2nd - 15:00'
          : e < 100
          ? '1st - ' + mflBoxGameClockMinutes(e - 75)
          : '1st - 15:00'
      }
      if (1 === t) {
        var a = new Date(1e3 * e)
        return (
          mflBoxWeekDay[a.getDay()] +
          ' ' +
          mflBoxMonth[a.getMonth()] +
          ' ' +
          a.getDate()
        )
      }
      if (2 === t) {
        if ((a = new Date(1e3 * e)).getHours() > 11) var r = 'pm'
        else r = 'am'
        if (a.getHours() > 12) var o = a.getHours() - 12
        else o = a.getHours()
        0 === o && (o = 12)
        const t = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes()
        return mflBoxWeekDay[a.getDay()] + ' ' + o + ':' + t + r
      }
    }
    function doMFLBoxLiveStatsClose () {
      $('.MFLBoxLiveStatsWrapper').attr('style', 'display:none')
    }
    function doMFLBoxLiveStatsPopup (e, t) {
      $('.MFLBoxLiveStatsWrapper').attr('style', 'display:none'),
        $('#MFLBoxLiveStatsWrapper_' + e + '_' + t).removeAttr('style')
      var a = mflBoxGetStatsStr(t)
      '' === a && (a = 'no stats'),
        $('#MFLBoxLiveStatsContent_' + e + '_' + t).html(
          a +
            '<span class="MFLBoxLiveStatsClose" onclick="doMFLBoxLiveStatsClose()"></span>'
        )
    }
    function mflBoxGetStatsStr (e) {
      var t = []
      if (null == mflBoxLiveStatsPlayer[e]) return ''
      if (mflBoxLiveStatsPlayer[e].PA > 0) {
        var a = []
        void 0 === mflBoxLiveStatsPlayer[e].PC &&
          (mflBoxLiveStatsPlayer[e].PC = 0),
          void 0 === mflBoxLiveStatsPlayer[e].PY &&
            (mflBoxLiveStatsPlayer[e].PY = 0),
          a.push(
            'Pass: ' +
              mflBoxLiveStatsPlayer[e].PC +
              '-' +
              mflBoxLiveStatsPlayer[e].PA +
              '-' +
              mflBoxLiveStatsPlayer[e].PY
          ),
          mflBoxLiveStatsPlayer[e]['#P'] > 0 &&
            a.push(
              mflBoxLiveStatsPlayer[e]['#P'] +
                ' PaTD (' +
                mflBoxLiveStatsPlayer[e].PS +
                ')'
            ),
          mflBoxLiveStatsPlayer[e].IN > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].IN + ' Int'),
          mflBoxLiveStatsPlayer[e].P2 > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].P2 + ' Pa2P'),
          t.push(a.join(', '))
      }
      if (mflBoxLiveStatsPlayer[e].RA > 0) {
        a = []
        void 0 === mflBoxLiveStatsPlayer[e].RY &&
          (mflBoxLiveStatsPlayer[e].RY = 0),
          a.push(
            'Rush: ' +
              mflBoxLiveStatsPlayer[e].RA +
              '-' +
              mflBoxLiveStatsPlayer[e].RY
          ),
          mflBoxLiveStatsPlayer[e]['#R'] > 0 &&
            a.push(
              mflBoxLiveStatsPlayer[e]['#R'] +
                ' RuTD (' +
                mflBoxLiveStatsPlayer[e].RS +
                ')'
            ),
          mflBoxLiveStatsPlayer[e].R2 > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].R2 + ' Ru2P'),
          t.push(a.join(', '))
      }
      if (mflBoxLiveStatsPlayer[e].CC > 0) {
        a = []
        void 0 === mflBoxLiveStatsPlayer[e].CY &&
          (mflBoxLiveStatsPlayer[e].CY = 0),
          a.push(
            'Rec: ' +
              mflBoxLiveStatsPlayer[e].CC +
              '-' +
              mflBoxLiveStatsPlayer[e].CY
          ),
          mflBoxLiveStatsPlayer[e]['#C'] > 0 &&
            a.push(
              mflBoxLiveStatsPlayer[e]['#C'] +
                ' ReTD (' +
                mflBoxLiveStatsPlayer[e].RC +
                ')'
            ),
          mflBoxLiveStatsPlayer[e].C2 > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].C2 + ' Re2P'),
          t.push(a.join(', '))
      }
      if (
        (mflBoxLiveStatsPlayer[e].FL > 0 &&
          t.push(mflBoxLiveStatsPlayer[e].FL + ' Fum Lost'),
        mflBoxLiveStatsPlayer[e].TK > 0 ||
          mflBoxLiveStatsPlayer[e].AS > 0 ||
          mflBoxLiveStatsPlayer[e].PD > 0)
      ) {
        a = []
        if (
          (mflBoxLiveStatsPlayer[e].TK > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].TK + ' T'),
          mflBoxLiveStatsPlayer[e].TFL > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].TKL + ' TFL'),
          mflBoxLiveStatsPlayer[e].AS > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].AS + ' A'),
          mflBoxLiveStatsPlayer[e].SK > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].SK + ' SK'),
          mflBoxLiveStatsPlayer[e].PD > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].PD + ' PD'),
          mflBoxLiveStatsPlayer[e].IC > 0)
        ) {
          var r = mflBoxLiveStatsPlayer[e].IC + ' INT'
          mflBoxLiveStatsPlayer[e]['#IR'] > 0 &&
            (r =
              r +
              ' ' +
              mflBoxLiveStatsPlayer[e]['#IR'] +
              ' IntTD (' +
              mflBoxLiveStatsPlayer[e].IR +
              ')'),
            a.push(r)
        }
        if (
          (mflBoxLiveStatsPlayer[e].FF > 0 &&
            a.push(mflBoxLiveStatsPlayer[e].FF + ' FF'),
          mflBoxLiveStatsPlayer[e].FC > 0)
        ) {
          r = mflBoxLiveStatsPlayer[e].FC + ' FR'
          mflBoxLiveStatsPlayer[e]['#DR'] > 0 &&
            (r =
              r +
              ' ' +
              mflBoxLiveStatsPlayer[e]['#DR'] +
              ' FRTD (' +
              mflBoxLiveStatsPlayer[e].DR +
              ')'),
            a.push(r)
        }
        t.push(a.join(', '))
      }
      if (
        mflBoxLiveStatsPlayer[e]['#A'] > 0 ||
        mflBoxLiveStatsPlayer[e].EA > 0
      ) {
        ;(a = []), (r = 'Kick: ')
        if (mflBoxLiveStatsPlayer[e]['#A'] > 0) {
          var o = ''
          void 0 === mflBoxLiveStatsPlayer[e]['#F'] &&
            (mflBoxLiveStatsPlayer[e]['#F'] = 0),
            void 0 !== mflBoxLiveStatsPlayer[e].FG &&
              (o = '(' + mflBoxLiveStatsPlayer[e].FG + ')'),
            a.push(
              r +
                mflBoxLiveStatsPlayer[e]['#F'] +
                '-' +
                mflBoxLiveStatsPlayer[e]['#A'] +
                ' FG ' +
                o
            ),
            (r = '')
        }
        mflBoxLiveStatsPlayer[e].EA > 0 &&
          (void 0 === mflBoxLiveStatsPlayer[e].EP &&
            (mflBoxLiveStatsPlayer[e].EP = 0),
          a.push(
            r +
              mflBoxLiveStatsPlayer[e].EP +
              '-' +
              mflBoxLiveStatsPlayer[e].EA +
              ' XP'
          ),
          (r = '')),
          t.push(a.join(', '))
      }
      return t.join('; ')
    }
    function mflBoxGetTeamStatsStr (e) {
      for (var t = [], a = 0; a < show_tstats.length; a++) {
        var r = show_tstats[a]
        void 0 !== mflBoxLiveStatsTeam[e][r] &&
          0 !== mflBoxLiveStatsTeam[e][r] &&
          t.push(mflBoxLiveStatsTeam[e][r] + ' ' + r)
      }
      return (
        mflBoxLiveStatsTeam[e].FC > 0 &&
          (t.push(mflBoxLiveStatsTeam[e].FC + ' FR'),
          mflBoxLiveStatsTeam[e]['#DR'] > 0 &&
            t.push(
              mflBoxLiveStatsTeam[e]['#DR'] +
                ' FR TD (' +
                mflBoxLiveStatsTeam[e].DR +
                ')'
            )),
        mflBoxLiveStatsTeam[e].IC > 0 &&
          (t.push(mflBoxLiveStatsTeam[e].IC + ' Int'),
          mflBoxLiveStatsTeam[e]['#IR'] > 0 &&
            t.push(
              mflBoxLiveStatsTeam[e]['#IR'] +
                ' Int TD (' +
                mflBoxLiveStatsTeam[e].IR +
                ')'
            )),
        mflBoxLiveStatsTeam[e]['#KT'] > 0 &&
          t.push(
            mflBoxLiveStatsTeam[e]['#KT'] +
              ' KTD (' +
              mflBoxLiveStatsTeam[e].KO +
              ')'
          ),
        mflBoxLiveStatsTeam[e]['#UT'] > 0 &&
          t.push(
            mflBoxLiveStatsTeam[e]['#UT'] +
              ' PTD (' +
              mflBoxLiveStatsTeam[e].PR +
              ')'
          ),
        mflBoxLiveStatsTeam[e].BLF > 0 &&
          (t.push(mflBoxLiveStatsTeam[e].BLF + ' BLF'),
          mflBoxLiveStatsTeam[e]['#BF'] > 0 &&
            t.push(
              mflBoxLiveStatsTeam[e]['#BF'] +
                ' BF (' +
                mflBoxLiveStatsTeam[e].BF +
                ')'
            )),
        mflBoxLiveStatsTeam[e].BLP > 0 &&
          (t.push(mflBoxLiveStatsTeam[e].BLP + ' BLP'),
          mflBoxLiveStatsTeam[e]['#BP'] > 0 &&
            t.push(
              mflBoxLiveStatsTeam[e]['#BP'] +
                ' BP (' +
                mflBoxLiveStatsTeam[e].BP +
                ')'
            )),
        mflBoxLiveStatsTeam[e].BLE > 0 &&
          t.push(mflBoxLiveStatsTeam[e].BLE + ' BLE'),
        t.join(', ')
      )
    }
    function mflBoxNflGameTime (e) {
      var t = new Date(1e3 * parseInt(e)),
        a = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()],
        r = t.getHours()
      if (r >= 12) var o = 'pm'
      else o = 'am'
      return (
        0 === r ? (r = 12) : r > 12 && (r -= 12),
        a + ' ' + r + ':' + ('0' + t.getMinutes()).substr(-2) + o
      )
    }
    function mflBoxParseLiveStats (e, t) {
      if (
        ((mflBoxLiveStatsPlayer = {}),
        (mflBoxLiveStatsTeam = {}),
        'CACHE' === e)
      )
        (lsm_last_update_secs = lsm_last_update_secs_first),
          'function' == typeof structuredClone
            ? ((mflBoxLiveStatsPlayer = structuredClone(lsm_stats)),
              (mflBoxLiveStatsTeam = structuredClone(lsm_tstats)))
            : ((mflBoxLiveStatsPlayer = JSON.parse(JSON.stringify(lsm_stats))),
              (mflBoxLiveStatsTeam = JSON.parse(JSON.stringify(lsm_tstats))))
      else {
        const t = e.split('\n'),
          a = t.length
        for (let e = 0; e < a; e++) {
          const a = t[e]
          if (!a) continue
          const r = a.split('|'),
            o = r[0]
          if ('DATE' === o) {
            ;(lsm_last_update_secs = r[1]), (ls_last_update = r[2])
            continue
          }
          if ('REFRESH' === o) continue
          let n
          '' === o || isNaN(o)
            ? (mflBoxLiveStatsTeam[o] || (mflBoxLiveStatsTeam[o] = {}),
              (n = mflBoxLiveStatsTeam[o]))
            : (mflBoxLiveStatsPlayer[o] || (mflBoxLiveStatsPlayer[o] = {}),
              (n = mflBoxLiveStatsPlayer[o]))
          for (let e = 1; e < r.length; e++) {
            const t = r[e].indexOf(' ')
            t > 0 && (n[r[e].slice(0, t)] = r[e].slice(t + 1))
          }
        }
      }
      for (var a in mflBoxNflGameStatus)
        if (
          (mflBoxLiveStatsTeam[a] || (mflBoxLiveStatsTeam[a] = {}),
          (mflBoxNFLKickoff[a] = mflBoxNflGameStatus[a].time),
          0 === mflBoxNflGameStatus[a].time)
        )
          (mflBoxNflGameStatus[a].clock = 'BYE'),
            (mflBoxNflGameStatus[a].secs_left = 0),
            (mflBoxNflGameStatus[a].status = 'BYE'),
            (mflBoxLiveStatsTeam[a].TPS = ''),
            (mflBoxLiveStatsTeam[a].TPA = '')
        else if (mflBoxNflGameStatus[a].time > lsm_last_update_secs)
          (mflBoxNflGameStatus[a].clock = mflBoxNflGameTime(
            mflBoxNflGameStatus[a].time
          )),
            (mflBoxNflGameStatus[a].secs_left = 3600),
            (mflBoxNflGameStatus[a].status = 'SCHED'),
            (mflBoxLiveStatsTeam[a].TPS = ''),
            (mflBoxLiveStatsTeam[a].TPA = '')
        else
          try {
            if (
              (void 0 === mflBoxLiveStatsTeam[a].TPS &&
                (mflBoxLiveStatsTeam[a].TPS = 0),
              void 0 === mflBoxLiveStatsTeam[mflBoxLiveStatsTeam[a].OPP]?.TPS &&
                (mflBoxLiveStatsTeam[a].TPA = 0),
              '' === mflBoxLiveStatsTeam[a].QUARTER ||
                'F' === mflBoxLiveStatsTeam[a].QUARTER)
            )
              (mflBoxNflGameStatus[a].secs_left = 0),
                (mflBoxNflGameStatus[a].status = 'OVER')
            else {
              mflBoxNflGameStatus[a].status = 'INPROG'
              const e = mflBoxLiveStatsTeam[a].REMAINING.split(':')
              let t
              ;(mflBoxNflGameStatus[a].secs_left = 60 * e[0] + Number(e[1])),
                'O' === mflBoxLiveStatsTeam[a].QUARTER ||
                mflBoxLiveStatsTeam[a].QUARTER > 4
                  ? (t = 'OT')
                  : 'H' === mflBoxLiveStatsTeam[a].QUARTER
                  ? ((t = 'H'),
                    (mflBoxNflGameStatus[a].secs_left += 1800),
                    (custom_is_half = !0))
                  : ((mflBoxNflGameStatus[a].secs_left +=
                      900 * (4 - mflBoxLiveStatsTeam[a].QUARTER)),
                    (t = mflBoxLiveStatsTeam[a].QUARTER + 'Q')),
                (mflBoxNflGameStatus[a].clock =
                  t + '&nbsp;' + mflBoxLiveStatsTeam[a].REMAINING)
              let r = parseInt(mflBoxLiveStatsTeam[a].DOWN)
              ;(isNaN(r) || 0 === r) && (r = 1)
              ;(r += ['', 'st', 'nd', 'rd', 'th'][r] || 'th'),
                (mflBoxNflGameStatus[a].possession = !1),
                (mflBoxNflGameStatus[a].redzone = !1),
                (mflBoxNflGameStatus[a].down_and_dist = '')
              const o = mflBoxLiveStatsTeam[a].YARDLINE,
                n = mflBoxLiveStatsTeam[a].TOGO
              if (o) {
                const e = o.split(':')
                let t = e[0],
                  i = Number(e[1])
                '50' === t && ((t = ''), (i = 50)),
                  n &&
                    ((mflBoxNflGameStatus[
                      a
                    ].down_and_dist = `${r}&nbsp;and&nbsp;${n} at ${t}&nbsp;${i}`),
                    mflBoxLiveStatsTeam[a].POSSESSION > 0 &&
                      ((mflBoxNflGameStatus[a].possession = !0),
                      t !== a &&
                        i < 20 &&
                        (mflBoxNflGameStatus[a].redzone = !0)))
              }
            }
          } catch (e) {}
    }
    function getMFLBoxNameIcon (e) {
      return 'BYE' === e
        ? '<span class="mflBoxBye">BYE</span>'
        : 'AVG' === e
        ? '<span class="mflBoxAvg">AVG</span>'
        : mflBoxUseAbbrev &&
          '' !== franchiseDatabase['fid_' + e].abbrev &&
          '' !== mflBoxIconBase &&
          '' !== mflBoxIconExt
        ? '<img src="' +
          mflBoxIconBase +
          e +
          '.' +
          mflBoxIconExt +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" style="vertical-align:middle" /> <span style="vertical-align:middle">' +
          franchiseDatabase['fid_' + e].abbrev +
          '</span>'
        : mflBoxUseAbbrev &&
          '' !== franchiseDatabase['fid_' + e].abbrev &&
          mflBoxUseIcon &&
          '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
          franchiseDatabase['fid_' + e].icon +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" style="vertical-align:middle" /> <span style="vertical-align:middle">' +
          franchiseDatabase['fid_' + e].abbrev +
          '</span>'
        : mflBoxUseAbbrev &&
          '' !== franchiseDatabase['fid_' + e].abbrev &&
          mflBoxUseLogo &&
          '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
          franchiseDatabase['fid_' + e].logo +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" style="vertical-align:middle" /> <span style="vertical-align:middle">' +
          franchiseDatabase['fid_' + e].abbrev +
          '</span>'
        : '' !== mflBoxIconBase && '' !== mflBoxIconExt
        ? '<img src="' +
          mflBoxIconBase +
          e +
          '.' +
          mflBoxIconExt +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" />'
        : mflBoxUseIcon && '' !== franchiseDatabase['fid_' + e].icon
        ? '<img src="' +
          franchiseDatabase['fid_' + e].icon +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" />'
        : mflBoxUseLogo && '' !== franchiseDatabase['fid_' + e].logo
        ? '<img src="' +
          franchiseDatabase['fid_' + e].logo +
          '" title="' +
          franchiseDatabase['fid_' + e].name +
          '" />'
        : mflBoxUseAbbrev && '' !== franchiseDatabase['fid_' + e].abbrev
        ? '<span title="' +
          franchiseDatabase['fid_' + e].name +
          '">' +
          franchiseDatabase['fid_' + e].abbrev +
          '</span>'
        : franchiseDatabase['fid_' + e].name
    }
    function getMFLBoxNFLIcon (e) {
      return '' !== mflBoxNFLLogoPath && '' !== mflBoxNFLLogoExt
        ? '<img src="' +
            mflBoxNFLLogoPath +
            e +
            '.' +
            mflBoxNFLLogoExt +
            '" title="' +
            e +
            '" style="vertical-align:middle;max-height:1rem;max-width:1.25rem" />'
        : e
    }
    function mflBoxPlayerDetailsClose () {
      $('#MFLBoxOverlay').hide(), $('#MFLBoxPlayerDetails').hide()
      const e = document.querySelector('#MFLBoxPlayerDetails')
      try {
        bodyScrollLock.enableBodyScroll(e)
      } catch (e) {}
      mflBoxPlayerDetailsFid.fid = ''
    }
    function doMFLBoxPlayerDetails (e, t) {
      ;(mflBoxPlayerDetailsFid.fid = e), (mflBoxPlayerDetailsFid.boxid = t)
      var a = ''
      a +=
        '<table align="center" cellspacing="1" class="report" id="MFLBoxPlayerDetailsTable"><caption><span>' +
        franchiseDatabase['fid_' + e].name +
        '</span><span class="MFLBoxPlayerDetailsClose" onclick="mflBoxPlayerDetailsClose()">X</span></caption>'
      for (var r = 0; r < 4; r++)
        if (
          (3 !== r || mflBoxShowNonStarter) &&
          ((0 !== r && 1 !== r) ||
            !(
              liveScoringWeek === completedWeek ||
              mflBoxActiveWeek < liveScoringWeek
            ))
        ) {
          var o = ''
          0 === r &&
            (a +=
              '<tr class="MFLBoxPlayerDetailsHeader"><th colspan="5">Players Games In Progress</th></tr>'),
            1 === r &&
              (a +=
                '<tr class="MFLBoxPlayerDetailsHeader"><th colspan="5">Players Games Scheduled</th></tr>'),
            2 === r &&
              (a +=
                '<tr class="MFLBoxPlayerDetailsHeader"><th colspan="5">Players Games Over</th></tr>'),
            3 === r &&
              (a +=
                '<tr class="MFLBoxPlayerDetailsHeader"><th colspan="5">Bench Player</th></tr>')
          for (var n = 0, i = 0; i < mflBoxPositionSort.length; i++)
            try {
              if (3 === r) var s = mflBoxFranchise['fid_' + e].bench
              else s = mflBoxFranchise['fid_' + e].starter
              for (var l in s)
                if (
                  playerDatabase['pid_' + l].position === mflBoxPositionSort[i]
                ) {
                  var c = !1
                  mflBox_byeWeek[playerDatabase['pid_' + l].team] ===
                    mflBoxActiveWeek && (c = !0)
                  var d = !1
                  if (
                    !c &&
                    (0 === r || 3 === r) &&
                    parseInt(s[l].gsr) > 0 &&
                    parseInt(s[l].gsr) < 3600
                  ) {
                    var p = mflBoxGameClock(
                        (parseInt(s[l].gsr) / 3600) * 100,
                        3
                      ),
                      u =
                        '<span class="MFLBoxLiveStatsScore" onmouseout="doMFLBoxLiveStatsClose()" onmouseover="doMFLBoxLiveStatsPopup(\'' +
                        e +
                        "','" +
                        l +
                        '\')">' +
                        s[l].score +
                        '</span><span id="MFLBoxLiveStatsWrapper_' +
                        e +
                        '_' +
                        l +
                        '" class="MFLBoxLiveStatsWrapper" style="display:none"><span  id="MFLBoxLiveStatsContent_' +
                        e +
                        '_' +
                        l +
                        '" class="MFLBoxLiveStatsContent"></span><span class="MFLBoxLiveStatsArrow"></span></span>'
                    try {
                      if (
                        (f =
                          mflBoxPlayerProjected[l] *
                            (parseInt(s[l].gsr) / 3600) +
                          parseFloat(s[l].score)) > mflBoxPlayerProjected[l]
                      )
                        var m =
                          '<span title="On Pace Points" class="MFLPaceScore MFLPaceScorePositive">' +
                          f.toFixed(precision) +
                          '</span>'
                      else
                        m =
                          '<span title="On Pace Points" class="MFLPaceScore MFLPaceScoreNegative">' +
                          f.toFixed(precision) +
                          '</span>'
                    } catch (e) {
                      m = (0).toFixed(precision)
                    }
                    d = !0
                  }
                  if (
                    !c &&
                    (1 === r || 3 === r) &&
                    3600 === parseInt(s[l].gsr)
                  ) {
                    ;(p = mflBoxGameClock(
                      mflBoxNFLKickoff[playerDatabase['pid_' + l].team],
                      2
                    )),
                      (u = s[l].score)
                    try {
                      m =
                        '<span title="Projected Points" class="MFLPaceScore">' +
                        (f = mflBoxPlayerProjected[l].toFixed(precision)) +
                        '</span>'
                    } catch (e) {
                      m = (0).toFixed(precision)
                    }
                    d = !0
                  }
                  if ((2 === r || 3 === r) && 0 === parseInt(s[l].gsr)) {
                    if (c) p = '--'
                    else
                      try {
                        p =
                          mflBox_nflOpponents[playerDatabase['pid_' + l].team]
                            .result
                      } catch (e) {
                        p = ''
                      }
                    if (c) u = '--'
                    else
                      var u =
                        '<span class="MFLBoxLiveStatsScore" style="cursor: pointer" onmouseout="doMFLBoxLiveStatsClose()" onmouseover="doMFLBoxLiveStatsPopup(\'' +
                        e +
                        "','" +
                        l +
                        '\')">' +
                        s[l].score +
                        '</span><span id="MFLBoxLiveStatsWrapper_' +
                        e +
                        '_' +
                        l +
                        '" class="MFLBoxLiveStatsWrapper" style="display:none"><span  id="MFLBoxLiveStatsContent_' +
                        e +
                        '_' +
                        l +
                        '" class="MFLBoxLiveStatsContent"></span><span class="MFLBoxLiveStatsArrow"></span></span>'
                    if (c) m = '--'
                    else
                      try {
                        var f
                        m =
                          '<span title="Original Projection" class="MFLPaceScore">' +
                          (f = mflBoxPlayerProjected[l]).toFixed(precision) +
                          '</span>'
                        if (parseFloat(s[l].score) > mflBoxPlayerProjected[l])
                          u =
                            '<span class="MFLPaceScorePositive">' +
                            u +
                            '</span>'
                        else
                          u =
                            '<span class="MFLPaceScoreNegative" style="cursor: pointer;">' +
                            u +
                            '</span>'
                      } catch (e) {
                        m = (0).toFixed(precision)
                      }
                    d = !0
                  }
                  if (d) {
                    if (c) var h = 'BYE'
                    else
                      try {
                        if (
                          mflBox_nflOpponents[playerDatabase['pid_' + l].team]
                            .isHome
                        )
                          h =
                            'v ' +
                            mflBox_nflOpponents[playerDatabase['pid_' + l].team]
                              .opponent
                        else
                          h =
                            '@ ' +
                            mflBox_nflOpponents[playerDatabase['pid_' + l].team]
                              .opponent
                      } catch (e) {
                        h = ''
                      }
                    try {
                      var y =
                        ' (<span style="color:red" title="' +
                        mfl_injuries.player['pid_' + l].details +
                        '">' +
                        mfl_injuries.player['pid_' + l].code +
                        '</span>)'
                    } catch (e) {
                      y = ''
                    }
                    if (n % 2) var _ = 'eventablerow'
                    else _ = 'oddtablerow'
                    3 === r
                      ? 3600 === parseInt(s[l].gsr)
                        ? (o +=
                            '<tr class="' +
                            _ +
                            '"><td colspan="2">' +
                            playerDatabase['pid_' + l].name +
                            ' ' +
                            playerDatabase['pid_' + l].team +
                            ' ' +
                            playerDatabase['pid_' + l].position +
                            y +
                            '</td><td style="text-align:center;white-space:nowrap">' +
                            h +
                            '</td><td style="text-align:center">' +
                            m +
                            ' </td><td style="text-align:center">-- </td></tr>')
                        : (o +=
                            '<tr class="' +
                            _ +
                            '"><td colspan="2">' +
                            playerDatabase['pid_' + l].name +
                            ' ' +
                            playerDatabase['pid_' + l].team +
                            ' ' +
                            playerDatabase['pid_' + l].position +
                            y +
                            '</td><td style="text-align:center;white-space:nowrap">' +
                            h +
                            '</td><td style="text-align:center">' +
                            m +
                            ' </td><td style="text-align:center">' +
                            u +
                            ' </td></tr>')
                      : (o +=
                          1 === r
                            ? '<tr class="' +
                              _ +
                              '"><td>' +
                              playerDatabase['pid_' + l].name +
                              ' ' +
                              playerDatabase['pid_' + l].team +
                              ' ' +
                              playerDatabase['pid_' + l].position +
                              y +
                              '</td><td style="text-align:center;white-space:nowrap">' +
                              h +
                              '</td><td colspan="2" style="text-align:center">' +
                              p +
                              '</td><td style="text-align:center">' +
                              m +
                              ' </td></tr>'
                            : '<tr class="' +
                              _ +
                              '"><td>' +
                              playerDatabase['pid_' + l].name +
                              ' ' +
                              playerDatabase['pid_' + l].team +
                              ' ' +
                              playerDatabase['pid_' + l].position +
                              y +
                              '</td><td style="text-align:center;white-space:nowrap">' +
                              h +
                              '</td><td style="text-align:center">' +
                              p +
                              '</td><td style="text-align:center">' +
                              m +
                              ' </td><td style="text-align:center">' +
                              u +
                              ' </td></tr>'),
                      n++
                  }
                }
            } catch (e) {}
          '' === o
            ? (a +=
                '<tr class="oddtablerow"><td colspan="5" class="MFLBoxPlayerDetailsNone">NONE</td></tr>')
            : (0 === r &&
                (a +=
                  '<tr class="MFLBoxPlayerDetailsSubHeader"><th style="text-align:left">Player</th><th>Opp</th><th>Clock</th><th>Pace</th><th>Actual</th></tr>'),
              1 === r &&
                (a +=
                  '<tr class="MFLBoxPlayerDetailsSubHeader"><th style="text-align:left">Player</th><th>Opp</th><th colspan="2">Game Time</th><th>Proj.</th></tr>'),
              2 === r &&
                (a +=
                  '<tr class="MFLBoxPlayerDetailsSubHeader"><th style="text-align:left">Player</th><th>Opp</th><th>Result</th><th>Proj.</th><th>Actual</th></tr>'),
              3 === r &&
                (a +=
                  '<tr class="MFLBoxPlayerDetailsSubHeader"><th colspan="2" style="text-align:left">Player</th><th>Opp</th><th>Proj/Pace</th><th>Actual</th></tr>'),
              (a += o))
        }
      if (mflBoxIncludeTiebreaker) {
        a +=
          '<tr class="MFLBoxPlayerDetailsHeader"><th colspan="5">Tiebreaker(s)</th></tr>'
        n = 0
        for (var g in mflBoxTiebreaker['fid_' + e]) {
          if (n % 2) _ = 'eventablerow'
          else _ = 'oddtablerow'
          ;(a +=
            '<tr class="' +
            _ +
            '"><td colspan="5">' +
            playerDatabase[g].name +
            ' ' +
            playerDatabase[g].team +
            ' ' +
            playerDatabase[g].position +
            '</td></tr>'),
            n++
        }
      }
      ;(a += '</tbody></table>'), $('#MFLBoxOverlay').show()
      const b = document.querySelector('#MFLBoxPlayerDetails')
      try {
        bodyScrollLock.disableBodyScroll(b)
      } catch (e) {}
      $('#MFLBoxPlayerDetails').html(a).show(),
        $(
          '#MFLBoxPlayerDetails td span.MFLBoxLiveStatsScore:contains("undefined")'
        )
          .parents('td')
          .replaceWith('<td style="text-align:center">-- </td>')
    }
    function computePaceScores () {
      const e = Object.create(null),
        t = Object.create(null)
      try {
        const a = mflBoxJSON_projectedScores.projectedScores.playerScore,
          r = a.length,
          o = Object.create(null)
        for (let e = 0; e < r; e++) {
          const t = a[e]
          ;(o['pid_' + t.id] = !0),
            (mflBoxPlayerProjected[t.id] = parseFloat(t.score) || 0)
        }
        for (const e in playerDatabase)
          playerDatabase.hasOwnProperty(e) &&
            !o[e] &&
            a.push({ id: playerDatabase[e].id, score: 0 })
        const n = a.length
        for (let o = 0; o < n; o++) {
          const n = a[o],
            i = n.id,
            s = '' === n.score ? 0 : parseFloat(n.score) || 0
          o >= r && (mflBoxPlayerProjected[i] = 0)
          try {
            const a = mflBox_players['pid_' + i]
            if (!a) continue
            const r = parseFloat(a.score) || 0,
              o = 0 | a.gameSecondsRemaining,
              n = r + (o / 3600) * s,
              l = a.fid.split(','),
              c = a.isStarter.split(','),
              d = l.length
            for (let a = 0; a < d; a++) {
              const r = l[a]
              if ('1' !== c[a]) continue
              const d = i + '_' + r
              t[d] ||
                ((t[d] = 1),
                e[r] ||
                  (e[r] = {
                    pace: 0,
                    expected_pace: 0,
                    players: 0,
                    gameSecondsRemaining: 0
                  }),
                (e[r].pace += n),
                (e[r].expected_pace += s),
                (e[r].players += 1),
                (e[r].gameSecondsRemaining += o))
            }
          } catch (e) {}
        }
      } catch (e) {}
      for (const t in e) {
        const a = e[t]
        a.gameSecondsRemaining > 0
          ? ((a.paceClass =
              a.pace > a.expected_pace
                ? ' MFLPaceScorePositive'
                : a.pace < a.expected_pace
                ? ' MFLPaceScoreNegative'
                : ''),
            (a.paceHtml = `<span class="warning${
              a.paceClass
            }" title="Original projection ${a.expected_pace.toFixed(
              precision
            )}">${a.pace.toFixed(precision)}</span>`))
          : ((a.paceClass = ''), (a.paceHtml = ''))
      }
      return e
    }
    function doMFLBoxHTML (e) {
      const t = mflBoxCheckLive(),
        a = mflBoxCheckCompletedWeek(),
        r =
          mflBoxActiveWeek <= completedWeek ||
          mflBoxActiveWeek === liveScoringWeek
      let o = {}
      t && mflBoxMFLSchedule && (o = computePaceScores())
      let n = {}
      if (!t && !a && mflBoxMFLSchedule) {
        const e = mflBoxJSON_projectedScores?.projectedScores?.playerScore
        if (Array.isArray(e))
          for (let t = 0; t < e.length; t++) {
            const a = e[t]
            null != a?.id && (n['pid_' + a.id] = Number(a.score) || 0)
          }
      }
      const i = []
      if (mflBoxMFLSchedule && !mflBoxHideFantasyMatchups)
        if (0 === mflBox_matchups.length)
          i.push(
            '<div class="warning" style="padding:0.938rem;font-weight:bold;vertical-align:middle;text-align:center;font-style:italic;font-size:1.125rem">NO MATCHUPS FOUND - STARTERS MAY BE HIDDEN UNTIL KICKOFF</div>'
          )
        else {
          i.push('<table class="MFLGameLinks fantasyBoxMatchup"><tbody><tr>')
          const getProjected = (e, t) => {
            const a = (e || '').split(',').filter(Boolean)
            if (a.length) {
              let e = 0
              for (let t = 0; t < a.length; t++) e += n['pid_' + a[t]] || 0
              return `<span class="warning projected" title="Projected Score">${e.toFixed(
                precision
              )}</span>`
            }
            return `<span class="warning">${t ?? ''}</span>`
          }
          for (let e = 0; e < mflBox_matchups.length; e++) {
            const n = mflBox_matchups[e],
              s = n.roadId,
              l = n.homeId,
              c = `${s}_${l}`,
              d = `MFLExtras_${c}`,
              p = r
                ? `<tr class="MFLBoxPlayerDetailsTR" onclick="doMFLBoxPlayerDetails('${s}',${e})">`
                : '<tr>',
              u = r
                ? `<tr class="MFLBoxPlayerDetailsTR" onclick="doMFLBoxPlayerDetails('${l}',${e})">`
                : '<tr>',
              m = mflBoxIsAllPlay
                ? `<span style="position:absolute;${
                    a ? 'right' : 'left'
                  }:0.313rem;bottom:0.438rem;cursor:pointer" title="Swap All Play Team" onclick="mflBoxAllPlayId='${s}';mflBoxNewWeek(0)"><i class="fa-regular fa-arrow-right-arrow-left" aria-hidden="true"></i></span>`
                : ''
            let f = '',
              h = '',
              y = '',
              _ = '',
              g = '',
              b = '',
              w = '',
              k = '',
              L = '',
              P = '',
              S = '',
              M = '',
              F = '',
              x = '',
              T = ''
            if (a)
              (f = parseFloat(n.roadScore).toFixed(precision)),
                (h = parseFloat(n.homeScore).toFixed(precision)),
                (y =
                  'W' === n.roadResult
                    ? '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'
                    : ''),
                (_ =
                  'W' === n.homeResult
                    ? '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'
                    : ''),
                (L = 'Final' + m)
            else if (t)
              if (
                ((f = parseFloat(n.roadScore).toFixed(precision)),
                (h =
                  'BYE' === l
                    ? '&nbsp;'
                    : parseFloat(n.homeScore).toFixed(precision)),
                (g = o[s]?.paceHtml || ''),
                (b = o[l]?.paceHtml || ''),
                (P = isNaN(n.roadPlayerMinutesRemaining)
                  ? ''
                  : parseFloat(n.roadPlayerMinutesRemaining)),
                (S = isNaN(n.homePlayerMinutesRemaining)
                  ? ''
                  : parseFloat(n.homePlayerMinutesRemaining)),
                (M = isNaN(n.roadYetToPlay) ? '' : parseFloat(n.roadYetToPlay)),
                (F = isNaN(n.homeYetToPlay) ? '' : parseFloat(n.homeYetToPlay)),
                (x = isNaN(n.roadCurrentlyPlaying)
                  ? ''
                  : parseFloat(n.roadCurrentlyPlaying)),
                (T = isNaN(n.homeCurrentlyPlaying)
                  ? ''
                  : parseFloat(n.homeCurrentlyPlaying)),
                'BYE' === l)
              )
                L = '&nbsp;'
              else {
                const e = o[s],
                  t = o[l],
                  a = (e?.players || 0) + (t?.players || 0),
                  r =
                    (e?.gameSecondsRemaining || 0) +
                    (t?.gameSecondsRemaining || 0),
                  i = 3600 * a || 1
                if (r === i) {
                  let e = mflBoxActiveWeekKickoff
                  try {
                    const t = mflBoxFirstKickoff[s],
                      a = mflBoxFirstKickoff[l]
                    void 0 !== t && void 0 !== a
                      ? (e = Math.min(t, a))
                      : void 0 !== t
                      ? (e = t)
                      : void 0 !== a && (e = a)
                  } catch (e) {}
                  L = mflBoxGameClock(e, 2) + m
                } else
                  r > 0
                    ? (L =
                        mflBoxGameClock((r / i) * 100, 0) +
                        `<span class="MFLBoxDetailsArrow" id="mflBoxExpand_${c}" onclick="mflBoxExpand('${c}',true)"><i class="fa-regular fa-square-right" aria-hidden="true"></i></span>` +
                        `<span class="MFLBoxDetailsArrow" id="mflBoxCollapse_${c}" onclick="mflBoxExpand('${c}',false)" style="display:none"><i class="fa-regular fa-square-left" aria-hidden="true"></i></span>` +
                        m)
                    : ((L = mflBoxGameClock((r / i) * 100, 3) + m),
                      parseFloat(n.roadScore) > parseFloat(n.homeScore) &&
                        (y =
                          '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'),
                      parseFloat(n.homeScore) > parseFloat(n.roadScore) &&
                        (_ =
                          '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'))
              }
            else
              (w = getProjected(n.roadStarters, n.roadSpread)),
                (k = getProjected(n.homeStarters, n.homeSpread)),
                mflBoxIsAllPlay && mflBoxIsTotalPts
                  ? ((f = '0'), (h = '0'))
                  : ((f = franchiseDatabase?.['fid_' + s]?.record ?? ''),
                    (h = franchiseDatabase?.['fid_' + l]?.record ?? '')),
                (L = mflBoxGameClock(mflBoxActiveWeekKickoff, 1) + m)
            i.push(
              `<td class="matchupLolite"><table class="MFLGameTable matchupLolite" id="mflBoxMatchup_${e}"><tbody>`
            ),
              i.push(p),
              i.push(`<td class="MFLLiveTeam">${getMFLBoxNameIcon(s)}</td>`),
              i.push(`<td class="MFLPaceSpread">${w}</td>`),
              i.push(`<td class="MFLPaceScore">${g}</td>`),
              i.push(
                `<td class="MFLLiveScore" style="text-align:right">${f}</td>`
              ),
              i.push(`<td class="MFLWinMarker">${y}</td>`),
              t &&
                (i.push(`<td class="MFLExtras MFLExtrasPMR ${d}">${P}</td>`),
                i.push(`<td class="MFLExtras MFLExtrasYTP ${d}">${M}</td>`),
                i.push(`<td class="MFLExtras MFLExtrasCP ${d}">${x}</td>`)),
              i.push('</tr>'),
              i.push(u),
              i.push(`<td class="MFLLiveTeam">${getMFLBoxNameIcon(l)}</td>`),
              i.push(`<td class="MFLPaceSpread">${k}</td>`),
              i.push(`<td class="MFLPaceScore">${b}</td>`),
              i.push(
                `<td class="MFLLiveScore" style="text-align:right">${h}</td>`
              ),
              i.push(`<td class="MFLWinMarker">${_}</td>`),
              t &&
                (i.push(`<td class="MFLExtras MFLExtrasPMR ${d}">${S}</td>`),
                i.push(`<td class="MFLExtras MFLExtrasYTP ${d}">${F}</td>`),
                i.push(`<td class="MFLExtras MFLExtrasCP ${d}">${T}</td>`)),
              i.push('</tr>'),
              i.push(
                `<tr><td colspan="5" class="MFLLiveClock" style="position:relative" id="mflBoxClock_${c}">${L}</td>`
              ),
              t &&
                (i.push(
                  `<td class="MFLExtras MFLExtrasPMR ${d}" title="Player Minutes Remaining">PMR</td>`
                ),
                i.push(
                  `<td class="MFLExtras MFLExtrasYTP ${d}" title="Players Yet To Play">YTP</td>`
                ),
                i.push(
                  `<td class="MFLExtras MFLExtrasCP ${d}" title="Players Currently Playing">CP</td>`
                )),
              i.push('</tr></tbody></table></td>')
          }
          i.push('</tr></tbody></table>')
        }
      else if (!mflBoxHideNFLMatchups) {
        i.push('<table class="MFLGameLinks NFLBoxMatchup"><tbody><tr>')
        for (let e = 0; e < mflBox_nflSchedule.length; e++) {
          const t = mflBox_nflSchedule[e],
            a = t.roadId,
            r = t.homeId,
            o = parseInt(t.gameSecondsRemaining)
          let n = '',
            s = '',
            l = '',
            c = '',
            d = '',
            p = '',
            u = ''
          0 === o
            ? ((n = t.roadScore),
              (s = t.homeScore),
              (u = 'Final'),
              parseFloat(t.roadScore) > parseFloat(t.homeScore) &&
                (l =
                  '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'),
              parseFloat(t.homeScore) > parseFloat(t.roadScore) &&
                (c =
                  '<i class="fa-regular fa-caret-left" aria-hidden="true"></i>'))
            : 3600 === o
            ? ((u = t.clock),
              (d = `<span class="warning">${t.roadSpread}</span>`),
              (p = `<span class="warning">${t.homeSpread}</span>`))
            : ((n = t.roadScore),
              (s = t.homeScore),
              (u = mflBoxGameClock((o / 3600) * 100, 3)),
              (d = t.roadRedzone
                ? `<span class="downDistance redzone">${t.roadDownAndDist}</span>`
                : t.roadPossession
                ? `<span class="downDistance possession">${t.roadDownAndDist}</span>`
                : ''),
              (p = t.homeRedzone
                ? `<span class="downDistance redzone">${t.homeDownAndDist}</span>`
                : t.homePossession
                ? `<span class="downDistance possession">${t.homeDownAndDist}</span>`
                : '')),
            o < 3500
              ? i.push(
                  `<td class="matchupLolite" style="position:relative"><a class="boxmatchLink" style="display:none;position:absolute;width:100%;height:100%;z-index:1;" href="${baseURLDynamic}/${year}/pro_matchup?L=${league_id}&W=${mflBoxActiveWeek}&MATCHUP=${r},${a}"></a>`
                )
              : i.push('<td class="matchupLolite" style="position:relative">'),
            i.push(
              `<table class="MFLGameTable matchupLolite" id="mflBoxMatchup_${e}"><tbody>`
            ),
            i.push('<tr>'),
            i.push(
              `<td class="MFLLiveTeam">${getMFLBoxNFLIcon(
                a
              )} <span class="MFLLiveAbbrev" style="vertical-align:middle">${a}</span></td>`
            ),
            i.push(`<td class="MFLPaceSpread">${d}</td>`),
            i.push('<td class="MFLPaceScore"></td>'),
            i.push(
              `<td class="MFLLiveScore" style="text-align:right">${n}</td>`
            ),
            i.push(`<td class="MFLWinMarker">${l}</td>`),
            i.push('</tr>'),
            i.push('<tr>'),
            i.push(
              `<td class="MFLLiveTeam">${getMFLBoxNFLIcon(
                r
              )} <span class="MFLLiveAbbrev" style="vertical-align:middle">${r}</span></td>`
            ),
            i.push(`<td class="MFLPaceSpread">${p}</td>`),
            i.push('<td class="MFLPaceScore"></td>'),
            i.push(
              `<td class="MFLLiveScore" style="text-align:right">${s}</td>`
            ),
            i.push(`<td class="MFLWinMarker">${c}</td>`),
            i.push('</tr>'),
            i.push(
              `<tr><td colspan="5" class="MFLLiveClock" id="mflBoxClock_${a}_${r}">${u}</td></tr>`
            ),
            i.push('</tbody></table></td>')
        }
        i.push('</tr></tbody></table>')
      }
      if (
        ((document.getElementById('MFLBoxMatchups').innerHTML = i.join('')),
        e && jQuery('#MFLBoxMatchups').scrollLeft(0),
        t && mflBoxMFLSchedule)
      )
        for (let e = 0; e < mflBox_matchups.length; e++) {
          const t = mflBox_matchups[e],
            a = `${t.roadId}_${t.homeId}`
          mflBoxDetailsTracker[a] && mflBoxExpand(a, !0)
        }
      if (a && mflBoxMFLSchedule)
        try {
          const e = mflBoxJSON_projectedScores.projectedScores.playerScore
          for (let t = 0; t < e.length; t++) {
            const a = parseFloat(e[t].score)
            mflBoxPlayerProjected[e[t].id] = isNaN(a) ? 0 : a
          }
        } catch (e) {}
      mflBoxMFLSchedule &&
        '' !== mflBoxPlayerDetailsFid.fid &&
        doMFLBoxPlayerDetails(
          mflBoxPlayerDetailsFid.fid,
          mflBoxPlayerDetailsFid.boxid
        )
    }
    function mflBoxLeagueSettings () {
      ;(mflBoxStartWeek = startWeek),
        (mflBoxLastRegularSeasonWeek = standingsEndWeek),
        (mflBoxEndWeek = void 0 === endWeek ? 18 : endWeek),
        completedWeek === liveScoringWeek
          ? ((mflBoxCurrentWeek = completedWeek),
            (mflBoxCurrentLiveScoring =
              !mflBoxCheckWeeklyResultsForScore(mflBoxCurrentWeek)))
          : ((mflBoxCurrentWeek = liveScoringWeek),
            (mflBoxCurrentLiveScoring = !0)),
        mflBoxCurrentWeek > mflBoxEndWeek &&
          ((mflBoxCurrentWeek = mflBoxEndWeek),
          (mflBoxCurrentLiveScoring = !1)),
        0 === liveScoringWeek && (mflBoxCurrentLiveScoring = !1),
        mflBoxCurrentWeek < 1 && (mflBoxCurrentWeek = 1),
        (mflBoxActiveWeek = mflBoxCurrentWeek)
      for (var e = 0; e < reportNflByeWeeks_ar.nflByeWeeks.team.length; e++)
        mflBox_byeWeek[reportNflByeWeeks_ar.nflByeWeeks.team[e].id] = parseInt(
          reportNflByeWeeks_ar.nflByeWeeks.team[e].bye_week
        )
    }
    function doMFLBoxLiveStats () {
      if (liveScoringWeek < 1 || mflBoxActiveWeek > liveScoringWeek) {
        for (var e in mflBoxNflGameStatus)
          (mflBoxNflGameStatus[e].clock = mflBoxNflGameTime(
            mflBoxNflGameStatus[e].time
          )),
            (mflBoxNflGameStatus[e].secs_left = 3600),
            (mflBoxNflGameStatus[e].status = 'SCHED'),
            mflBoxLiveStatsTeam[e] || (mflBoxLiveStatsTeam[e] = {}),
            (mflBoxLiveStatsTeam[e].TPS = ''),
            (mflBoxLiveStatsTeam[e].TPA = '')
        return doMFLBoxArrays(), !0
      }
      if (
        (mflBoxActiveWeek === liveScoringWeek &&
          mflBoxActiveWeek !== completedWeek) ||
        mflBoxMFLSchedule
      ) {
        if (mflBoxActiveWeek === liveScoringWeek) {
          return (
            mflBoxParseLiveStats(
              'CACHE',
              (t = Date.now ? Date.now() : new Date().getTime())
            ),
            doMFLBoxArrays(),
            !0
          )
        }
        var t
        t = Date.now ? Date.now() : new Date().getTime()
        var a = xmlBaseURL + 'live_stats_'
        return (
          (a =
            (a += 'idp_') +
            (mflBoxActiveWeek < 10
              ? '0' + mflBoxActiveWeek
              : mflBoxActiveWeek) +
            '.txt?RANDOM=' +
            t),
          new Promise(function (e) {
            jQuery.ajax({
              url: a,
              success: function (a) {
                mflBoxParseLiveStats(a, t), doMFLBoxArrays(), e()
              },
              error: function (t, a, r) {
                console.log('Live stats fetch failed: ' + a + ' ' + r), e()
              }
            })
          })
        )
      }
      for (var e in mflBoxNflGameStatus) {
        var r = mflBoxNflGameStatus[e].score ?? 0
        delete mflBoxNflGameStatus[e].clock,
          (mflBoxNflGameStatus[e].secs_left = 0),
          (mflBoxNflGameStatus[e].status = 'OVER'),
          mflBoxLiveStatsTeam[e] || (mflBoxLiveStatsTeam[e] = {}),
          (mflBoxLiveStatsTeam[e].TPS = r),
          (mflBoxLiveStatsTeam[e].TPA = '')
      }
      return doMFLBoxArrays(), !0
    }
    function doMFLBoxLiveUpdate (e) {
      doMFLBox &&
        mflBoxActiveWeek === liveScoringWeek &&
        Promise.all([
          doMFLBoxFantasyWeek(),
          doMFLBoxNFLWeek(),
          doMFLBoxProjectedScores()
        ])
          .then(() => doMFLBoxLiveStats())
          .then(() => {
            doMFLBoxArrows(), doMFLBoxHTML(!0)
          })
    }
    function doMFLBoxUpdate (e) {
      Promise.all([
        doMFLBoxFantasyWeek(),
        doMFLBoxNFLWeek(),
        doMFLBoxProjectedScores()
      ])
        .then(() => doMFLBoxLiveStats())
        .then(() => {
          doMFLBoxArrows(), doMFLBoxHTML(!0)
        })
    }
    jQuery('.mobile-wrap #MFLBoxWrapper').unwrap()
    try {
      window.MFLGlobalCache.onReady(() => {
        mflBoxHomePageOnly
          ? ('undefined' != typeof thisProgram &&
              'home' === thisProgram &&
              (doMFLBox = !0),
            'undefined' != typeof thisProgram &&
              'options_247' === thisProgram &&
              (doMFLBox = !1),
            new URLSearchParams(window.location.search).has('MODULE') &&
              (doMFLBox = !1))
          : (doMFLBox = !0),
          doMFLBox &&
            (mflBoxHideFantasyMatchups && (mflBoxMFLSchedule = !1),
            mflBoxLeagueSettings(),
            Promise.all([
              doMFLBoxFantasyWeek(),
              doMFLBoxNFLWeek(),
              doMFLBoxProjectedScores()
            ])
              .then(() => {
                for (var e in mflBoxNflGameStatus) {
                  var t = mflBoxNflGameStatus[e].score ?? 0
                  delete mflBoxNflGameStatus[e].clock,
                    (mflBoxNflGameStatus[e].secs_left = 0),
                    (mflBoxNflGameStatus[e].status = 'OVER'),
                    mflBoxLiveStatsTeam[e] || (mflBoxLiveStatsTeam[e] = {}),
                    (mflBoxLiveStatsTeam[e].TPS = t),
                    (mflBoxLiveStatsTeam[e].TPA = '')
                }
                return (
                  doMFLBoxArrays(),
                  doMFLBoxHTML(),
                  doMFLBoxArrows(),
                  doMFLBoxLiveStats()
                )
              })
              .then(() => {
                doMFLBoxHTML(!1)
                try {
                  var e = document.getElementById('MFLBoxMatchups')
                  if (e && e.innerHTML && window.MFLCache) {
                    var t = window.MFLCache.KEY.mflBoxMatchups(year, league_id)
                    window.MFLCache.set(
                      t,
                      e.innerHTML,
                      window.MFLCache.TTL.SIX_HOUR
                    ).catch(function () {})
                  }
                } catch (e) {}
              }))
      })
    } catch {
      console.log('MFL CACHE DID NOT LOAD')
    }
  }
}
if (load_marquee) {
  if (void 0 === marq_offseason_hide) var marq_offseason_hide = !1
  if (void 0 === deactivate_all_offseason) var deactivate_all_offseason = !1
  if (
    (is_offseason && marq_offseason_hide) ||
    (is_offseason && deactivate_all_offseason)
  ) {
    const Le = document
      .querySelector('.ticker-wrapper')
      ?.closest('.mobile-wrap')
    Le && Le.remove()
    const Pe = document.querySelector('.ticker-wrapper')
    Pe && Pe.remove()
  } else {
    if (void 0 === tickerHomePageOnly) var tickerHomePageOnly = !0
    let doTicker = !1
    if (
      (tickerHomePageOnly
        ? (window.location.href.indexOf('/home/') > -1 && (doTicker = !0),
          window.location.href.toUpperCase().indexOf('MODULE=') > -1 &&
            (doTicker = !1))
        : (doTicker = !0),
      doTicker)
    ) {
      let currentMessage = 0,
        counter = 0,
        counter_interval
      const tickerIndexTracker = {},
        tickerSpeedIndex = [2, 3, 4, 5, 6, 7, 8],
        tickerSpeedMax = 6,
        tickerSpeedMin = 0,
        tickerSpeedBase = 3,
        minimum_duration = 2
      let tickerAllPlayId = '0001',
        tickerSpeed
      if (
        ('undefined' != typeof franchise_id &&
          '0000' !== franchise_id &&
          (tickerAllPlayId = franchise_id),
        void 0 === tickerContent)
      )
        var tickerContent = []
      if (void 0 === tickerName) var tickerName = 'Headlines'
      if (void 0 === responsiveTicker) var responsiveTicker = !0
      if (void 0 === isLeagueIDP) var isLeagueIDP = !1
      if (void 0 === tickerSize) var tickerSize = 'medium'
      if (void 0 === tickerLastPlayoffWeek) var tickerLastPlayoffWeek = 16
      if (void 0 === tickerSpeedDefault) var tickerSpeedDefault = 2
      if (void 0 === tickerDelay) var tickerDelay = 3
      tickerSpeed = localStorage.hasOwnProperty('ticker_speed_' + league_id)
        ? parseInt(localStorage.getItem('ticker_speed_' + league_id))
        : tickerSpeedDefault
      let tickerStartWeek = startWeek,
        tickerEndWeek = endWeek
      const tickerLastRegularWeek = standingsEndWeek
      let tickerCompletedWeek = completedWeek,
        tickerLiveScoringWeek = liveScoringWeek
      0 === tickerLiveScoringWeek && (tickerLiveScoringWeek = 1)
      let isPlayoffLeague = !1,
        scrollingTriggered = !1
      if (
        (localStorage.hasOwnProperty('ticker_tickerSize_' + league_id) &&
          (tickerSize = localStorage.getItem('ticker_tickerSize_' + league_id)),
        'large' !== tickerSize &&
          'medium' !== tickerSize &&
          'small' !== tickerSize &&
          (tickerSize = 'medium'),
        void 0 === includeFranchiseIcons)
      )
        var includeFranchiseIcons = !1
      if (void 0 === includeLatestArticles) var includeLatestArticles = 5
      if (void 0 === includeTopPlayerStats) var includeTopPlayerStats = 3
      if (void 0 === includeTopPlayerStatsIDP) var includeTopPlayerStatsIDP = !1
      if (void 0 === includeTopPlayerPts) var includeTopPlayerPts = 3
      if (void 0 === includePowerRank) var includePowerRank = !1
      if (void 0 === includeAltPowerRank) var includeAltPowerRank = !1
      if (void 0 === includePointScoredTeam) var includePointScoredTeam = !1
      if (void 0 === includeAllplayRecord) var includeAllplayRecord = !1
      if (void 0 === includeLastWeekResults) var includeLastWeekResults = !0
      if (void 0 === includeNextWeekMatchups) var includeNextWeekMatchups = !0
      if (void 0 === includeLastWeekNflResults)
        var includeLastWeekNflResults = !0
      if (void 0 === includeNextWeekNflMatchups)
        var includeNextWeekNflMatchups = !0
      if (void 0 === includeWaiverOrder) var includeWaiverOrder = !0
      if (void 0 === includeDraft) var includeDraft = !1
      if (void 0 === draftShowEntire) var draftShowEntire = !1
      if (void 0 === draftTopPicksOnly) var draftTopPicksOnly = 0
      if (void 0 === draftShowPicksMade) var draftShowPicksMade = 5
      if (void 0 === draftShowPicksPending) var draftShowPicksPending = 5
      if (void 0 === includeLiveLeaders) var includeLiveLeaders = 5
      if (void 0 === includeLiveLeadersIDP) var includeLiveLeadersIDP = !1
      if (void 0 === includeNflMatchups) var includeNflMatchups = !0
      if (void 0 === includeNflMatchupLeaders) var includeNflMatchupLeaders = !0
      if (void 0 === includeFantasyMatchups) var includeFantasyMatchups = !0
      if (void 0 === tickerWidth) var tickerWidth = '100%'
      if (void 0 === tickerMargin) var tickerMargin = '0 auto 0.625rem auto'
      if (void 0 === tickerFont) var tickerFont = 'Roboto Condensed'
      if (void 0 === bigHeadingBG) var bigHeadingBG = 'var(--accent, #B82601)'
      if (void 0 === bigHeadingClr) var bigHeadingClr = '#fff'
      if (void 0 === tickerHeadBG) var tickerHeadBG = '#fff'
      if (void 0 === tickerTxtShdw) var tickerTxtShdw = 'transparent'
      if (void 0 === tickerHeadClr) var tickerHeadClr = 'var(--accent, #B82601)'
      if (void 0 === tickerTxtBG) var tickerTxtBG = '#eee'
      if (void 0 === tickerTxtClr) var tickerTxtClr = '#000'
      if (void 0 === tickerTxtWgt) var tickerTxtWgt = '300'
      if (void 0 === tickerTxtTrans) var tickerTxtTrans = 'none'
      if (void 0 === tickerLinkClr) var tickerLinkClr = '#000'
      if (void 0 === tickerLinkHvr) var tickerLinkHvr = 'var(--accent, #B82601)'
      if (void 0 === tickerBoxShdw)
        var tickerBoxShdw = '0 0 0.188rem 0.188rem rgba(0,0,0,0.1)'
      if (void 0 === controlsGreen) var controlsGreen = 'green'
      if (void 0 === controlsRed) var controlsRed = 'red'
      if (void 0 === tickerBorder) var tickerBorder = bigHeadingBG
      if (void 0 === tickerCogWheel) var tickerCogWheel = tickerHeadClr
      ;(tickerSpeed = parseInt(tickerSpeed, 10)),
        isNaN(tickerSpeed)
          ? (tickerSpeed = tickerSpeedDefault)
          : tickerSpeed > tickerSpeedMax
          ? (tickerSpeed = tickerSpeedMax)
          : tickerSpeed < tickerSpeedMin && (tickerSpeed = tickerSpeedMin),
        (tickerDelay = parseInt(tickerDelay, 10)),
        isNaN(tickerDelay) && (tickerDelay = 3),
        tickerDelay > 6 && (tickerDelay = 6),
        tickerDelay < 1 && (tickerDelay = 1)
      let tickerOnloadDelay = tickerDelay + 2
      tickerOnloadDelay > 6 && (tickerOnloadDelay = 6)
      let tickerLiveStatsPlayer = {},
        tickerLiveStatsTeam = {},
        tickerNflGameStatus = {},
        tickerNflGameResults = {},
        tickerNflGameNext = {},
        tickerNFLKickoff = {},
        liveUpdateScheduled = !1,
        draftResultsInterval,
        fantasyMatchupsInterval
      function qs (e) {
        return document.querySelector(e)
      }
      function qsa (e) {
        return document.querySelectorAll(e)
      }
      function injectStyle (e) {
        const t = document.createElement('style')
        ;(t.textContent = e), document.head.appendChild(t)
      }
      function insertAfter (e, t) {
        e.insertAdjacentHTML('afterend', t)
      }
      function slideToggle (e, t) {
        t = t || 500
        'none' === e.style.display || 'none' === getComputedStyle(e).display
          ? ((e.style.display = 'block'),
            (e.style.overflow = 'hidden'),
            (e.style.maxHeight = '0'),
            requestAnimationFrame(function () {
              ;(e.style.transition = 'max-height ' + t + 'ms ease'),
                (e.style.maxHeight = e.scrollHeight + 'px')
            }),
            setTimeout(function () {
              ;(e.style.overflow = ''),
                (e.style.maxHeight = ''),
                (e.style.transition = '')
            }, t))
          : ((e.style.overflow = 'hidden'),
            (e.style.maxHeight = e.scrollHeight + 'px'),
            requestAnimationFrame(function () {
              ;(e.style.transition = 'max-height ' + t + 'ms ease'),
                (e.style.maxHeight = '0')
            }),
            setTimeout(function () {
              ;(e.style.display = 'none'),
                (e.style.overflow = ''),
                (e.style.maxHeight = ''),
                (e.style.transition = '')
            }, t))
      }
      function slideDown (e, t) {
        ;(t = t || 500),
          (e.style.display = 'block'),
          (e.style.overflow = 'hidden'),
          (e.style.maxHeight = '0'),
          requestAnimationFrame(function () {
            ;(e.style.transition = 'max-height ' + t + 'ms ease'),
              (e.style.maxHeight = e.scrollHeight + 'px')
          }),
          setTimeout(function () {
            ;(e.style.overflow = ''),
              (e.style.maxHeight = ''),
              (e.style.transition = '')
          }, t)
      }
      function parseHTML (e) {
        return new DOMParser().parseFromString(e, 'text/html')
      }
      function getText (e, t) {
        const a = e.querySelector(t)
        return a ? a.textContent.trim() : ''
      }
      function getAttr (e, t, a) {
        const r = e.querySelector(t)
        return r ? r.getAttribute(a) : void 0
      }
      sessionStorage.getItem('ticker_position_' + league_id) &&
        (currentMessage = parseInt(
          sessionStorage.getItem('ticker_position_' + league_id)
        ))
      const mobileWrapped = document.querySelectorAll(
        '.mobile-wrap > .ticker-wrapper'
      )
      mobileWrapped.forEach(function (e) {
        const t = e.parentNode
        t && t.replaceWith(e)
      })
      const tickerWrapper = qs('.ticker-wrapper')
      tickerWrapper.insertAdjacentHTML(
        'beforeend',
        '<div class="bigHeading"><i class="fa-regular fa-circle-pause icon_state_pause" aria-hidden="true" title="Pause Ticker"></i><i class="fa-regular fa-circle-play icon_state_play" aria-hidden="true" title="Resume Ticker" style="display:none"></i><i class="fa-regular fa-forward-step icon_state_skip" aria-hidden="true" title="Skip Forward"></i><span>' +
          tickerName +
          '<span></div><div class="ticker-core-wrapper"><div class="ticker-header"><div class="title"></div><span class="settings_cog_span" style="position:absolute;z-index:1;right:0.313rem;top:50%;transform:translateY(-50%);cursor:pointer"><i title="Display Settings" class="fa-regular fa-gear ticker_setting" aria-hidden="true" style="font-size:0.875rem;color:' +
          tickerCogWheel +
          '"></i></span></div><div class="ticker-update" title="Ticker Paused On Hover"></div></div>'
      ),
        insertAfter(
          tickerWrapper,
          '<div class="ticker-update-dummy"></div><div class="marquee_settings_table"><table align="center" cellspacing="1"><caption><span>Marquee Settings</span></caption><tbody><tr><th colspan="3" style="text-align:center">Control Ticker Speed</th></tr><tr class="oddtablerow"><td colspan="3"><div class="ticker_controls"></div></td></tr><tr><th colspan="3" style="text-align:center">Play / Pause / Skip</th></tr><tr class="eventablerow"><td colspan="3" style="text-align: center"><i class="fa-regular fa-circle-play icon_state_play" aria-hidden="true" title="Resume Ticker"></i><i class="fa-regular fa-circle-pause icon_state_pause" aria-hidden="true" title="Pause Ticker"></i><i class="fa-regular fa-forward-step icon_state_skip" aria-hidden="true" title="Skip Forward"></i></td></tr><tr><th colspan="3" style="text-align:center">Display Options</th></tr></tbody><tbody id="tbody_display_settings"></tbody></table></div>'
        ),
        injectStyle(
          '.ticker-wrapper{overflow:hidden;position:relative;margin:' +
            tickerMargin +
            ';max-width:' +
            tickerWidth +
            ';border:0.125rem solid ' +
            tickerBorder +
            ';font-family:' +
            tickerFont +
            '!important;border-radius:0.188rem;box-shadow:' +
            tickerBoxShdw +
            '}.ticker-core-wrapper{overflow:hidden}.bigHeading{white-space: nowrap;background:' +
            bigHeadingBG +
            ';color:' +
            bigHeadingClr +
            ';display:block;position:absolute;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.188rem;font-weight:600;z-index:2;height:2.25rem;line-height:2.25rem}.bigHeading::before{content:"";width:0;position:absolute;border-width: 2.25rem 2.25rem 0 0;border-style:solid;top:0;z-index:-1}.bigHeading::before{border-color: ' +
            bigHeadingBG +
            ' transparent transparent transparent;right:-2.25rem}.icon_state_pause,.icon_state_play,.icon_state_skip{font-weight:300;font-size:1.125rem;width:1.563rem;text-align:right;line-height:2.25rem}.icon_state_skip{font-size:1rem;text-align:center}.ticker-header{white-space:nowrap;height:1.125rem;line-height: 1.125rem;position:relative;color:' +
            tickerHeadClr +
            ';text-transform:uppercase;font-size:0.75rem;font-weight:600;background:' +
            tickerHeadBG +
            ';font-style:italic}.ticker-update{height:1.125rem;line-height: 1.125rem;background:' +
            tickerTxtBG +
            ';position:relative;color:' +
            tickerTxtClr +
            ';font-size:0.75rem;align-items:center}.animation{white-space:nowrap;position:absolute;margin:0;text-align:left;animation:moving linear;font-weight:' +
            tickerTxtWgt +
            ';text-transform:' +
            tickerTxtTrans +
            '}.animation a,.animation a:link,.animation a:active,.animation a:visited{font-family:' +
            tickerFont +
            '!important;display:block;color:' +
            tickerLinkClr +
            ';outline:none;text-decoration:none}.animation a:hover,.animation a:link:hover,.animation a:active:hover,.animation a:visited:hover{color:' +
            tickerLinkHvr +
            '}.ticker-update:hover .animation{animation-play-state:paused!important;cursor:pointer}.bigHeading i,.bigHeading i:hover,.ticker-update:hover{cursor:pointer}.ticker-update-dummy{position:fixed;top:0;left:0;font-family:' +
            tickerFont +
            '!important;height:1.125rem;text-transform:' +
            tickerTxtTrans +
            ';font-size:0.75rem;visibility:hidden;align-items:center;white-space:nowrap}.bigHeading,.ticker_setting{text-shadow:-0.188rem 0.188rem ' +
            tickerTxtShdw +
            '}.animation span{display:inline-flex;align-items:center;vertical-align:top}.animation a span{display:inline-block}.franchise_icon_ticker,.redzone_ticker,.has_ball_ticker{vertical-align:middle;height:1rem;width:auto;padding:0.188rem 0}.redzone_ticker,.has_ball_ticker{height:0.75rem}.settings_cog_span:after{content:".";position:absolute;width:93.75rem;z-index:-1;left:-81.25rem;color:transparent}.franchise_icon_ticker.icon_ticker_nfl{height:0.875rem;max-width:1.25rem}.matchup-leaders-content{padding-right:0.875rem}.matchup-leaders-wrapper {font-style:italic}.ticker_points .warning{font-size: 0.563rem}'
        ),
        injectStyle(
          '.marquee_settings_table.mobile-wrap,.marquee_settings_table{display:none;margin:0.625rem auto;max-width:25.875rem}.ticker_controls{text-align:center;width:100%;margin:0.625rem 0}.speed-inactive{display:inline-block;width:0.5rem;height:0.5rem;border:0.188rem solid ' +
            controlsRed +
            ';vertical-align:middle;margin:0.125rem}.speed-active{display:inline-block;width:0.5rem;height:0.5rem;background-color:' +
            controlsGreen +
            ';border:0.188rem solid green;vertical-align:middle;margin:0.125rem}.speed-active.red{background-color:' +
            controlsRed +
            ';border:0.188rem solid ' +
            controlsRed +
            '}.speed-active.green{background-color:' +
            controlsGreen +
            '}.speed-slower i,.speed-faster i{vertical-align:middle;font-size:1.25rem;margin:0 0.625rem;cursor:pointer}.speed-slower i{color:' +
            controlsRed +
            '}.speed-faster i{color:' +
            controlsGreen +
            '}.marquee_settings_table .icon_state_pause,.marquee_settings_table .icon_state_play,.marquee_settings_table .icon_state_skip{display:inline-block!important;position: relative;top: auto;transform: none;margin: 0.625rem;left: auto!important;cursor: pointer;font-size: 1.25rem;line-height:initial;width:auto}.marquee_settings_table .icon_state_pause{color:' +
            controlsRed +
            '}.marquee_settings_table .icon_state_play,.marquee_settings_table .icon_state_skip{color:' +
            controlsGreen +
            '}#tbody_display_settings td{position:relative}#tbody_display_settings div{position:relative}#tbody_display_settings input[type="checkbox"]{display:none}#tbody_display_settings label{padding-left:1.25rem;cursor:pointer;display:block}#tbody_display_settings input+label:before{color:' +
            controlsRed +
            ';font-family:"Font Awesome 6 Pro";display:inline-block;content:"\\f096";position:absolute;left:0.188rem;transform:translate(0,-50%);top:50%}#tbody_display_settings input:checked+label:before{color:' +
            controlsGreen +
            ';content:"\\f046";z-index:0}#tbody_display_settings .select-display-options{font-size:0.75rem}#tbody_display_settings .display-options-disabled,#tbody_display_settings .display-options-disabled label{opacity:0.65;cursor:default}#tbody_display_settings input[type="button"]{min-width:5rem}#tbody_display_settings .form_buttons input{text-transform: uppercase}.marquee_settings_table #tbody_display_settings td{text-align:left;text-indent:0}.displayToggleSet:before{content:".";position:absolute;color:transparent;width:31.25rem;left:-25rem;top:50%;transform:translateY(-50%)}'
        ),
        'medium' === tickerSize &&
          (injectStyle(
            '.bigHeading{font-size:1rem;height:2.5rem;line-height:2.5rem}.bigHeading .icon_state_pause,.bigHeading .icon_state_play,.bigHeading .icon_state_skip{font-size:1.125rem;line-height:2.5rem}.bigHeading .icon_state_skip{font-size:1rem}.ticker-header{height:1.25rem;line-height:1.25rem;font-size:0.875rem}.ticker-update,.ticker-update-dummy{height:1.25rem;line-height:1.25rem;font-size:0.938rem}.franchise_icon_ticker{height:1.25rem}.bigHeading::before{right:-2.5rem;border-width: 2.5rem 2.5rem 0 0;}.fa-gear.ticker_setting{font-size:.9rem!important}.franchise_icon_ticker.icon_ticker_nfl{height:1rem;max-width:1.375rem}.ticker_points .warning{font-size:0.625rem}.redzone_ticker,.has_ball_ticker{height:0.875rem}'
          ),
          responsiveTicker &&
            injectStyle(
              '@media only screen and (max-width:25.875em) {.bigHeading .icon_state_pause,.bigHeading .icon_state_play{font-size:1.25rem}.bigHeading .icon_state_skip{font-size:1.125rem}}'
            )),
        'large' === tickerSize &&
          (injectStyle(
            '.bigHeading{font-size:1.125rem;height:2.75rem;line-height:2.75rem}.bigHeading .icon_state_pause,.bigHeading .icon_state_play,.bigHeading .icon_state_skip{font-size:1.25rem;line-height:2.75rem}.bigHeading .icon_state_skip{font-size:1.125rem}.ticker-header{height:1.375rem;line-height:1.375rem;font-size:1rem}.ticker-update,.ticker-update-dummy{height:1.375rem;line-height:1.375rem;font-size:1rem}.franchise_icon_ticker{height:1.375rem}.bigHeading::before{right:-2.75rem;border-width: 2.75rem 2.75rem 0 0;}.fa-gear.ticker_setting{font-size:1rem!important}.franchise_icon_ticker.icon_ticker_nfl{height:1.125rem;max-width:1.5rem}.ticker_points .warning{font-size:0.688rem}.redzone_ticker,.has_ball_ticker{height:1rem}'
          ),
          responsiveTicker &&
            injectStyle(
              '@media only screen and (max-width:25.875em) {.bigHeading .icon_state_pause,.bigHeading .icon_state_play{font-size:1.375rem}.bigHeading .icon_state_skip{font-size:1.25rem}}'
            )),
        responsiveTicker &&
          injectStyle(
            '@media only screen and (max-width:25.875em) {.bigHeading{width:3.75rem}.bigHeading span{display:none}.icon_state_skip{text-align:right}.ticker-header{padding-left:6.563rem}}@media only screen and (max-width:25.875em) {.animation{transform: translateX(5.438rem)}@keyframes moving{0%{transform:translateX(5.438rem)}100%{transform:translateX(-100%)}}}'
          ),
        document.addEventListener('DOMContentLoaded', function () {
          const e = qs('.bigHeading')
          if (e) {
            const t = calcREM2(parseFloat(e.getBoundingClientRect().width)),
              a = calcREM2(40),
              r = calcREM2(9),
              o = +t + +calcREM2(29)
            injectStyle(
              '.ticker-header{padding-left:' +
                (+t + +a + +r) +
                'rem}.animation{transform:translateX(' +
                o +
                'rem)}@keyframes moving{0%{transform:translateX(' +
                o +
                'rem)}100%{transform:translateX(-100%)}}'
            )
          }
        }),
        qsa('.icon_state_pause').forEach(function (e) {
          e.addEventListener('click', function () {
            qsa('.animation').forEach(function (e) {
              e.style.animationPlayState = 'paused'
            }),
              qsa('.icon_state_play').forEach(function (e) {
                e.style.display = 'inline-block'
              }),
              qsa('.icon_state_pause').forEach(function (e) {
                e.style.display = 'none'
              })
          })
        }),
        qsa('.icon_state_play').forEach(function (e) {
          e.addEventListener('click', function () {
            qsa('.animation').forEach(function (e) {
              e.style.animationPlayState = ''
            }),
              qsa('.icon_state_pause').forEach(function (e) {
                e.style.display = 'inline-block'
              }),
              qsa('.icon_state_play').forEach(function (e) {
                e.style.display = 'none'
              })
          })
        }),
        qsa('.icon_state_skip').forEach(function (e) {
          e.addEventListener('click', function () {
            updateTicker(!1),
              qsa('.animation').forEach(function (e) {
                e.style.animationPlayState = ''
              }),
              qsa('.icon_state_pause').forEach(function (e) {
                e.style.display = 'inline-block'
              }),
              qsa('.icon_state_play').forEach(function (e) {
                e.style.display = 'none'
              })
          })
        })
      const cogSpan = qs('.settings_cog_span')
      function animationListener () {
        const e = qs('.animation')
        if (e)
          try {
            e.addEventListener(
              'animationend',
              function () {
                updateTicker(!1)
              },
              { passive: !0 }
            )
          } catch (e) {}
      }
      function updateSpeedControl () {
        let e =
          '<span class="speed-slower" id="speed_slower_btn"><i title="Decrease Speed" class="fa-regular fa-circle-minus" aria-hidden="true"></i></span>'
        for (let t = tickerSpeedMin; t <= tickerSpeedMax; t++)
          e +=
            tickerSpeed < t
              ? '<span class="speed-inactive"></span>'
              : '<span class="speed-active"></span>'
        e +=
          '<span class="speed-faster" id="speed_faster_btn"><i title="Increase Speed" class="fa-regular fa-circle-plus" aria-hidden="true"></i></span>'
        const t = qs('.ticker_controls')
        if (t) {
          t.innerHTML = e
          const a = qs('#speed_slower_btn'),
            r = qs('#speed_faster_btn')
          a &&
            a.addEventListener('click', function () {
              changeTickerSpeed(!1)
            }),
            r &&
              r.addEventListener('click', function () {
                changeTickerSpeed(!0)
              })
        }
      }
      function addTickerContent (e, t, a) {
        tickerContent.push({ header: e, message: t }),
          void 0 !== a &&
            (tickerIndexTracker[a] = {
              index: tickerContent.length - 1,
              message: t
            })
      }
      function changeTickerSpeed (e) {
        if (e && tickerSpeed >= tickerSpeedMax) return !1
        if (!e && tickerSpeed <= tickerSpeedMin) return !1
        e
          ? (tickerSpeed++,
            setTimeout(function () {
              qsa('.speed-active').forEach(function (e) {
                e.classList.add('green')
              })
            }, 5))
          : (tickerSpeed--,
            setTimeout(function () {
              qsa('.speed-active').forEach(function (e) {
                e.classList.add('red')
              })
            }, 5)),
          updateSpeedControl(),
          localStorage.setItem('ticker_speed_' + league_id, tickerSpeed)
        const t = qs('.animation')
        t && t.setAttribute('style', getAnimationStyle(!1))
      }
      function getAnimationStyle (e) {
        const t = qs('.ticker-update-dummy'),
          a = qs('.ticker-core-wrapper')
        if (!t || !a) return ''
        const r = t.getBoundingClientRect().width,
          o = a.getBoundingClientRect().width
        let n =
          parseInt(
            (((o / 1e3) *
              (tickerSpeedBase / tickerSpeedIndex[tickerSpeed]) *
              r) /
              o) *
              100
          ) / 10
        n < minimum_duration && (n = minimum_duration)
        return (
          'width:' +
          r +
          'px;animation-delay:' +
          (e ? tickerOnloadDelay : tickerDelay) +
          's;animation-duration:' +
          n +
          's'
        )
      }
      function updateTicker (e) {
        let t, a
        e
          ? ((t = sessionStorage.getItem('ticker_header_' + league_id)),
            (a = sessionStorage.getItem('ticker_message_' + league_id)),
            (scrollingTriggered = !0))
          : (currentMessage++,
            currentMessage > tickerContent.length - 1 && (currentMessage = 0),
            (t = tickerContent[currentMessage].header),
            (a = tickerContent[currentMessage].message),
            sessionStorage.setItem(
              'ticker_position_' + league_id,
              currentMessage
            ),
            sessionStorage.setItem('ticker_header_' + league_id, t),
            sessionStorage.setItem('ticker_message_' + league_id, a),
            (scrollingTriggered = !0))
        const r = qs('.ticker-header .title')
        r && (r.innerHTML = t)
        const o = qs('.ticker-update-dummy')
        if (
          (o && (o.innerHTML = a), liveUpdateScheduled && 0 === currentMessage)
        ) {
          for (const e of Object.keys(tickerIndexTracker))
            tickerContent[tickerIndexTracker[e].index].message =
              tickerIndexTracker[e].message
          liveUpdateScheduled = !1
        }
        const n = document.createElement('p')
        ;(n.className = 'animation'),
          (n.style.cssText = 'display:none;' + getAnimationStyle(e)),
          (n.innerHTML = a),
          n.addEventListener('touchmove', function () {}, { passive: !0 })
        const i = qs('.ticker-update')
        i && ((i.innerHTML = ''), i.appendChild(n), slideDown(n, 500)),
          animationListener()
      }
      function getFranchiseIcon (e, t) {
        if (
          void 0 !== t &&
          franchiseDatabase.hasOwnProperty('fid_' + t) &&
          '' !== franchiseDatabase['fid_' + t].icon
        )
          return (
            '<img src="' +
            franchiseDatabase['fid_' + t].icon +
            '" class="franchise_icon franchise_icon_ticker" alt="' +
            franchiseDatabase['fid_' + t].name +
            '" title="' +
            franchiseDatabase['fid_' + t].name +
            '" />'
          )
        if (
          'undefined' != typeof playerDatabase &&
          playerDatabase.hasOwnProperty('pid_' + e) &&
          playerDatabase['pid_' + e].hasOwnProperty('fid')
        ) {
          const t = playerDatabase['pid_' + e].fid.split(',')
          if (
            franchiseDatabase.hasOwnProperty('fid_' + t[0]) &&
            '' !== franchiseDatabase['fid_' + t[0]].icon
          )
            return (
              '<img src="' +
              franchiseDatabase['fid_' + t[0]].icon +
              '" class="franchise_icon franchise_icon_ticker" alt="' +
              franchiseDatabase['fid_' + t[0]].name +
              '" title="' +
              franchiseDatabase['fid_' + t[0]].name +
              '" />'
            )
        }
        return ''
      }
      function getNflMatchupsForWeek (e) {
        try {
          const t = reportNflSchedule_ar[e]
          if (!t || !t.nflSchedule) return null
          const a = t.nflSchedule
          return a.hasOwnProperty('matchup')
            ? a.matchup.hasOwnProperty('team')
              ? [a.matchup]
              : a.matchup
            : null
        } catch (e) {
          return null
        }
      }
      function initTickerNflSchedule () {
        try {
          const e = getNflMatchupsForWeek('w_' + (completedWeek + 1))
          if (e && e.length) {
            tickerNflGameStatus = {}
            for (let t = 0; t < e.length; t++) {
              const a = e[t],
                r = a.team[0].id,
                o = a.team[1].id,
                n = a.team[0].spread,
                i = a.team[1].spread,
                s = parseInt(a.kickoff, 10)
              ;(tickerNflGameStatus[r] = {
                time: s,
                isHome: !1,
                isBye: !1,
                opponent: o,
                spread: n
              }),
                (tickerNflGameStatus[o] = {
                  time: s,
                  isHome: !0,
                  isBye: !1,
                  opponent: r,
                  spread: i
                })
            }
            for (const e of Object.keys(tickerNflGameStatus))
              (tickerNflGameStatus[e].clock = tickerNflGameTime(
                tickerNflGameStatus[e].time
              )),
                (tickerNflGameStatus[e].secs_left = 3600),
                (tickerNflGameStatus[e].status = 'SCHED')
            tickerNflGameNext = tickerNflGameStatus
          }
          const t = getNflMatchupsForWeek(
            0 === completedWeek ? 'w_1' : 'w_' + completedWeek
          )
          if (t && t.length) {
            tickerNflGameResults = {}
            for (let e = 0; e < t.length; e++) {
              const a = t[e],
                r = a.team[0].id,
                o = a.team[1].id
              ;(tickerNflGameResults[r] = {
                isHome: !1,
                score: a.team[0].score,
                opponent: o,
                spread: a.team[0].spread
              }),
                (tickerNflGameResults[o] = {
                  isHome: !0,
                  score: a.team[1].score,
                  opponent: r,
                  spread: a.team[1].spread
                })
            }
          }
        } catch (e) {}
      }
      function tickerNflGameTime (e) {
        const t = new Date(1e3 * parseInt(e)),
          a = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()]
        let r = t.getHours()
        const o = r >= 12 ? 'pm' : 'am'
        0 === r ? (r = 12) : r > 12 && (r -= 12)
        return a + ' ' + r + ':' + ('0' + t.getMinutes()).substr(-2) + o
      }
      function getNflMatchupLeaders (e, t, a) {
        let r = -100,
          o = -100,
          n = -100,
          i = -100,
          s = '',
          l = '',
          c = '',
          d = ''
        for (const t of Object.keys(tickerLiveStatsPlayer))
          if (
            '' !== t &&
            '0' !== t.substring(0, 1) &&
            playerDatabase.hasOwnProperty('pid_' + t) &&
            playerDatabase['pid_' + t].team === e
          ) {
            const e = playerDatabase['pid_' + t].name,
              a = e.substring(e.indexOf(',') + 2),
              p = e.substring(0, e.indexOf(','))
            parseInt(tickerLiveStatsPlayer[t].PY) > r &&
              parseInt(tickerLiveStatsPlayer[t].PY) > 0 &&
              ((r = parseInt(tickerLiveStatsPlayer[t].PY)),
              (s =
                '<span class="matchup-leaders-content">' +
                a +
                ' ' +
                p +
                ' ' +
                r +
                'yds passing ' +
                (tickerLiveStatsPlayer[t]['#P'] > 0
                  ? parseInt(tickerLiveStatsPlayer[t]['#P']) + 'td '
                  : '') +
                (tickerLiveStatsPlayer[t].IN > 0
                  ? parseInt(tickerLiveStatsPlayer[t].IN) + 'int '
                  : '') +
                '</span>')),
              parseInt(tickerLiveStatsPlayer[t].RY) > o &&
                parseInt(tickerLiveStatsPlayer[t].RY) > 0 &&
                ((o = parseInt(tickerLiveStatsPlayer[t].RY)),
                (l =
                  '<span class="matchup-leaders-content">' +
                  a +
                  ' ' +
                  p +
                  ' ' +
                  o +
                  'yds rushing ' +
                  (tickerLiveStatsPlayer[t]['#R'] > 0
                    ? parseInt(tickerLiveStatsPlayer[t]['#R']) + 'td '
                    : '') +
                  (tickerLiveStatsPlayer[t].FL > 0
                    ? parseInt(tickerLiveStatsPlayer[t].FL) + 'fl '
                    : '') +
                  '</span>')),
              parseInt(tickerLiveStatsPlayer[t].CY) > n &&
                parseInt(tickerLiveStatsPlayer[t].CY) > 0 &&
                ((n = parseInt(tickerLiveStatsPlayer[t].CY)),
                (c =
                  '<span class="matchup-leaders-content">' +
                  a +
                  ' ' +
                  p +
                  ' ' +
                  n +
                  'yds receiving ' +
                  (tickerLiveStatsPlayer[t].CC > 0
                    ? parseInt(tickerLiveStatsPlayer[t].CC) + 'catches '
                    : '') +
                  (tickerLiveStatsPlayer[t]['#C'] > 0
                    ? parseInt(tickerLiveStatsPlayer[t]['#C']) + 'td '
                    : '') +
                  '</span>')),
              isLeagueIDP &&
                parseInt(tickerLiveStatsPlayer[t].TK) > i &&
                parseInt(tickerLiveStatsPlayer[t].TK) > 0 &&
                ((i = parseInt(tickerLiveStatsPlayer[t].TK)),
                (d =
                  '<span class="matchup-leaders-content">' +
                  a +
                  ' ' +
                  p +
                  ' ' +
                  i +
                  'tackles ' +
                  (tickerLiveStatsPlayer[t].AS > 0
                    ? parseInt(tickerLiveStatsPlayer[t].AS) + 'assists '
                    : '') +
                  (tickerLiveStatsPlayer[t].SK > 0
                    ? parseInt(tickerLiveStatsPlayer[t].SK) + 'sacks '
                    : '') +
                  (tickerLiveStatsPlayer[t].PD > 0
                    ? parseInt(tickerLiveStatsPlayer[t].PD) + 'pd '
                    : '') +
                  '</span>'))
          }
        let p = ''
        return (
          ('' === s && '' === l && '' === c && '' === d) ||
            ((p +=
              ' <img src="' +
              t +
              e +
              a +
              '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
              e +
              '" /><span style="display:inline-block;visibility:hidden">.</span>'),
            (p += s + l + c + d)),
          p
        )
      }
      function tickerParseLiveStats (e, t) {
        if (
          ((tickerLiveStatsPlayer = {}),
          (tickerLiveStatsTeam = {}),
          (lsm_last_update_secs = lsm_last_update_secs_first),
          'function' == typeof structuredClone
            ? ((tickerLiveStatsPlayer = structuredClone(lsm_stats)),
              (tickerLiveStatsTeam = structuredClone(lsm_tstats)))
            : ((tickerLiveStatsPlayer = JSON.parse(JSON.stringify(lsm_stats))),
              (tickerLiveStatsTeam = JSON.parse(JSON.stringify(lsm_tstats)))),
          includeNflMatchups)
        ) {
          for (const e of Object.keys(tickerNflGameStatus))
            if (
              (tickerNflGameStatus.hasOwnProperty(e) ||
                (tickerNflGameStatus[e] = { time: 0, isBye: !0 }),
              tickerLiveStatsTeam.hasOwnProperty(e) ||
                (tickerLiveStatsTeam[e] = {}),
              (tickerNFLKickoff[e] = tickerNflGameStatus[e].time),
              0 === tickerNflGameStatus[e].time)
            )
              (tickerNflGameStatus[e].clock = 'BYE'),
                (tickerNflGameStatus[e].secs_left = 0),
                (tickerNflGameStatus[e].status = 'BYE'),
                (tickerLiveStatsTeam[e].TPS = ''),
                (tickerLiveStatsTeam[e].TPA = '')
            else if (tickerNflGameStatus[e].time > lsm_last_update_secs)
              (tickerNflGameStatus[e].clock = tickerNflGameTime(
                tickerNflGameStatus[e].time
              )),
                (tickerNflGameStatus[e].secs_left = 3600),
                (tickerNflGameStatus[e].status = 'SCHED'),
                (tickerLiveStatsTeam[e].TPS = ''),
                (tickerLiveStatsTeam[e].TPA = '')
            else
              try {
                if (
                  (void 0 === tickerLiveStatsTeam[e].TPS &&
                    (tickerLiveStatsTeam[e].TPS = 0),
                  void 0 ===
                    tickerLiveStatsTeam[tickerLiveStatsTeam[e].OPP].TPS &&
                    (tickerLiveStatsTeam[e].TPA = 0),
                  '' === tickerLiveStatsTeam[e].QUARTER ||
                    'F' === tickerLiveStatsTeam[e].QUARTER)
                )
                  (tickerNflGameStatus[e].secs_left = 0),
                    (tickerNflGameStatus[e].status = 'OVER')
                else {
                  let t
                  tickerNflGameStatus[e].status = 'INPROG'
                  const a = tickerLiveStatsTeam[e].REMAINING.split(':')
                  ;(tickerNflGameStatus[e].secs_left =
                    60 * a[0] + Number(a[1])),
                    'O' === tickerLiveStatsTeam[e].QUARTER ||
                    tickerLiveStatsTeam[e].QUARTER > 4
                      ? (t = 'OT')
                      : 'H' === tickerLiveStatsTeam[e].QUARTER
                      ? ((t = 'H'),
                        (tickerNflGameStatus[e].secs_left += 1800),
                        (custom_is_half = !0))
                      : ((tickerNflGameStatus[e].secs_left +=
                          900 * (4 - tickerLiveStatsTeam[e].QUARTER)),
                        (t = tickerLiveStatsTeam[e].QUARTER + 'Q')),
                    (t = t + '&nbsp;' + tickerLiveStatsTeam[e].REMAINING),
                    (tickerNflGameStatus[e].clock = t)
                  let r = parseInt(tickerLiveStatsTeam[e].DOWN, 10)
                  if (
                    ((isNaN(r) || 0 === r || void 0 === r) && (r = 1),
                    1 === r
                      ? (r += 'st')
                      : 2 === r
                      ? (r += 'nd')
                      : 3 === r
                      ? (r += 'rd')
                      : 4 === r && (r += 'th'),
                    (tickerNflGameStatus[e].possession = !1),
                    (tickerNflGameStatus[e].redzone = !1),
                    (tickerNflGameStatus[e].down_and_dist = ''),
                    void 0 !== tickerLiveStatsTeam[e].YARDLINE &&
                      '' !== tickerLiveStatsTeam[e].YARDLINE)
                  ) {
                    const t = tickerLiveStatsTeam[e].YARDLINE.split(':')
                    let a = t[0],
                      o = Number(t[1])
                    if (
                      ('50' === a && ((a = ''), (o = 50)),
                      void 0 !== tickerLiveStatsTeam[e].TOGO &&
                        '' !== tickerLiveStatsTeam[e].TOGO)
                    ) {
                      const t =
                        r +
                        '&nbsp;and&nbsp;' +
                        tickerLiveStatsTeam[e].TOGO +
                        ' at ' +
                        a +
                        '&nbsp;' +
                        o
                      ;(tickerNflGameStatus[e].down_and_dist = t),
                        tickerLiveStatsTeam[e].POSSESSION > 0 &&
                          ((tickerNflGameStatus[e].possession = !0),
                          a !== e &&
                            o < 20 &&
                            (tickerNflGameStatus[e].redzone = !0))
                    }
                  }
                }
              } catch (e) {}
          let e = ''
          for (let t = 0; t < 3; t++)
            for (const t of Object.keys(tickerNflGameStatus))
              tickerNflGameStatus[t].isHome && (e = t)
          let a = ''
          const r =
              '//www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/',
            o = '.svg'
          for (let t = 0; t < 3; t++)
            for (const n of Object.keys(tickerNflGameStatus))
              if (tickerNflGameStatus[n].isHome) {
                const i = e === n ? 'margin-right:0' : 'margin-right:3.75rem'
                if (0 === t && 'INPROG' === tickerNflGameStatus[n].status) {
                  let e = '',
                    t = '',
                    s = '',
                    l = ''
                  const c = tickerNflGameStatus[n].opponent
                  if (
                    (tickerNflGameStatus[c].possession &&
                      (t =
                        '<img src="//www.mflscripts.com/ImageDirectory/script-images/football.svg" class="has_ball_ticker" alt="has ball" title="has ball" />'),
                    tickerNflGameStatus[c].redzone &&
                      (t =
                        '<img src="//www.mflscripts.com/ImageDirectory/script-images/goal-post.svg" class="redzone_ticker" alt="redzone" title="redzone" />'),
                    tickerNflGameStatus[c].possession &&
                      (l = tickerNflGameStatus[c].down_and_dist),
                    tickerNflGameStatus[n].possession &&
                      (s =
                        '<img src="//www.mflscripts.com/ImageDirectory/script-images/football.svg" class="has_ball_ticker" alt="has ball" title="has ball" />'),
                    tickerNflGameStatus[n].redzone &&
                      (s =
                        '<img src="//www.mflscripts.com/ImageDirectory/script-images/goal-post.svg" class="redzone_ticker" alt="redzone" title="redzone" />'),
                    tickerNflGameStatus[n].possession &&
                      (l = tickerNflGameStatus[n].down_and_dist),
                    includeNflMatchupLeaders)
                  ) {
                    const t = getNflMatchupLeaders(c, r, o),
                      a = getNflMatchupLeaders(n, r, o)
                    ;('' === t && '' === a) ||
                      (e =
                        '<span class="matchup-leaders-wrapper"><span style="display:inline-block;visibility:hidden">.......</span>Leaders:<span style="display:inline-block;visibility:hidden">....</span>' +
                        t +
                        '<span style="display:inline-block;visibility:hidden">....</span>' +
                        a +
                        '</span>')
                  }
                  a +=
                    '<span style="' +
                    i +
                    '">' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span><img src="' +
                    r +
                    c +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    c +
                    '" /><span style="display:inline-block;visibility:hidden">.</span>' +
                    tickerLiveStatsTeam[n].TPA +
                    '<span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span>' +
                    tickerLiveStatsTeam[n].TPS +
                    '<span style="display:inline-block;visibility:hidden">.</span><img src="' +
                    r +
                    n +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    n +
                    '" /><span style="display:inline-block;visibility:hidden">.</span>' +
                    s +
                    '<span style="display:inline-block;visibility:hidden">.</span> ' +
                    tickerNflGameStatus[n].clock +
                    ' ' +
                    l +
                    e +
                    '</span>'
                } else if (
                  1 === t &&
                  'SCHED' === tickerNflGameStatus[n].status
                ) {
                  const e = tickerNflGameStatus[n].opponent
                  a +=
                    '<span style="' +
                    i +
                    '"><img src="' +
                    r +
                    e +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    e +
                    '" /><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><img src="' +
                    r +
                    n +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    n +
                    '" /><span style="display:inline-block;visibility:hidden">.</span>' +
                    tickerNflGameStatus[n].clock +
                    '</span>'
                } else if (
                  2 === t &&
                  'OVER' === tickerNflGameStatus[n].status
                ) {
                  let e = ''
                  const t = tickerNflGameStatus[n].opponent
                  if (includeNflMatchupLeaders) {
                    const a = getNflMatchupLeaders(t, r, o),
                      i = getNflMatchupLeaders(n, r, o)
                    ;('' === a && '' === i) ||
                      (e =
                        '<span class="matchup-leaders-wrapper"><span style="display:inline-block;visibility:hidden">.......</span>Leaders:<span style="display:inline-block;visibility:hidden">....</span>' +
                        a +
                        '<span style="display:inline-block;visibility:hidden">....</span>' +
                        i +
                        '</span>')
                  }
                  const s =
                      parseInt(tickerLiveStatsTeam[n].TPA) >
                      parseInt(tickerLiveStatsTeam[n].TPS)
                        ? '<i class="fa-regular fa-caret-right" aria-hidden="true" style="margin-right:0.188rem;color:' +
                          controlsGreen +
                          '"></i>'
                        : '',
                    l =
                      parseInt(tickerLiveStatsTeam[n].TPS) >
                      parseInt(tickerLiveStatsTeam[n].TPA)
                        ? '<i class="fa-regular fa-caret-left" aria-hidden="true" style="margin-left:0.188rem;color:' +
                          controlsGreen +
                          '"></i>'
                        : ''
                  a +=
                    '<span class="ticker_gameover" style="' +
                    i +
                    '"><img src="' +
                    r +
                    t +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    t +
                    '" /><span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
                    s +
                    tickerLiveStatsTeam[n].TPA +
                    '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
                    tickerLiveStatsTeam[n].TPS +
                    l +
                    '</span><span style="display:inline-block;visibility:hidden">.</span><img src="' +
                    r +
                    n +
                    o +
                    '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                    n +
                    '" /><span style="display:inline-block;visibility:hidden">.</span>' +
                    e +
                    '</span>'
                }
              }
          t
            ? (tickerIndexTracker.liveMatchups.message = a)
            : '' !== a &&
              (tickerLiveLeaders_ar.Matchups[0] = {
                header: 'Week ' + (completedWeek + 1) + ' NFL Matchups',
                message: a
              })
        }
      }
      function getTickerLiveStats (e) {
        if (parseInt(includeLiveLeaders) <= 0 && !includeNflMatchups) return !1
        if (isNaN(parseInt(includeLiveLeaders))) return !1
        if (liveScoringWeek !== tickerLiveScoringWeek) return !1
        if (!doTicker) return
        const t = []
        tickerParseLiveStats(Date.now ? Date.now() : new Date().getTime(), e)
        for (const e of Object.keys(tickerLiveStatsPlayer))
          '' !== e &&
            '0' !== e.substring(0, 1) &&
            playerDatabase.hasOwnProperty('pid_' + e) &&
            t.push({
              id: e,
              pa_yds:
                void 0 === tickerLiveStatsPlayer[e].PY
                  ? -100
                  : parseInt(tickerLiveStatsPlayer[e].PY),
              ru_att:
                void 0 === tickerLiveStatsPlayer[e].RA
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].RA),
              ru_yds:
                void 0 === tickerLiveStatsPlayer[e].RY
                  ? -100
                  : parseInt(tickerLiveStatsPlayer[e].RY),
              re_cmp:
                void 0 === tickerLiveStatsPlayer[e].CC
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].CC),
              re_yds:
                void 0 === tickerLiveStatsPlayer[e].CY
                  ? -100
                  : parseInt(tickerLiveStatsPlayer[e].CY),
              pa_td:
                void 0 === tickerLiveStatsPlayer[e]['#P']
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e]['#P']),
              pa_int:
                void 0 === tickerLiveStatsPlayer[e].IN
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].IN),
              ru_td:
                void 0 === tickerLiveStatsPlayer[e]['#R']
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e]['#R']),
              re_td:
                void 0 === tickerLiveStatsPlayer[e]['#C']
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e]['#C']),
              idp_tk:
                void 0 === tickerLiveStatsPlayer[e].TK
                  ? -100
                  : parseInt(tickerLiveStatsPlayer[e].TK),
              idp_as:
                void 0 === tickerLiveStatsPlayer[e].AS
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].AS),
              idp_sk:
                void 0 === tickerLiveStatsPlayer[e].SK
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].SK),
              idp_pd:
                void 0 === tickerLiveStatsPlayer[e].PD
                  ? 0
                  : parseInt(tickerLiveStatsPlayer[e].PD)
            })
        t.sort(function (e, t) {
          return e.pa_yds > t.pa_yds ? -1 : 1
        })
        let a = ''
        for (let e = 0; e < t.length && !(t[e].pa_yds <= -100); e++) {
          liveLeadersFound = !0
          const r = e + 1 !== t.length && t[e + 1].pa_yds > -100,
            o = playerDatabase['pid_' + t[e].id],
            n = o.name,
            i = n.substring(n.indexOf(',') + 2),
            s = n.substring(0, n.indexOf(',')),
            l = includeFranchiseIcons ? getFranchiseIcon(t[e].id) : '',
            c = !(e + 1 < parseInt(includeLiveLeaders) && r)
          if (
            ((a +=
              '<span style="margin-right:' +
              (c ? '0' : '3.75rem') +
              '">' +
              (e + 1) +
              '.<span style="display:inline-block;visibility:hidden">.</span>' +
              l +
              '<span style="display:inline-block;visibility:hidden">.</span>' +
              o.position +
              ' ' +
              i +
              ' ' +
              s +
              ' ' +
              o.team +
              ' ' +
              t[e].pa_yds +
              ' yds ' +
              t[e].pa_td +
              ' tds ' +
              t[e].pa_int +
              ' ints</span>'),
            c)
          )
            break
        }
        e
          ? ((liveUpdateScheduled = !0),
            (tickerIndexTracker.livePassers.message = a))
          : (tickerLiveLeaders_ar.Passing[0] = {
              header: 'Top ' + includeLiveLeaders + ' Live Passing Leaders ',
              message: a || 'will update as stats become available'
            }),
          t.sort(function (e, t) {
            return e.ru_yds > t.ru_yds ? -1 : 1
          }),
          (a = '')
        for (let e = 0; e < t.length && !(t[e].ru_yds <= -100); e++) {
          liveLeadersFound = !0
          const r = e + 1 !== t.length && t[e + 1].ru_yds > -100,
            o = playerDatabase['pid_' + t[e].id],
            n = o.name,
            i = n.substring(n.indexOf(',') + 2),
            s = n.substring(0, n.indexOf(',')),
            l = includeFranchiseIcons ? getFranchiseIcon(t[e].id) : '',
            c = !(e + 1 < parseInt(includeLiveLeaders) && r)
          if (
            ((a +=
              '<span style="margin-right:' +
              (c ? '0' : '3.75rem') +
              '">' +
              (e + 1) +
              '.<span style="display:inline-block;visibility:hidden">.</span>' +
              l +
              '<span style="display:inline-block;visibility:hidden">.</span>' +
              o.position +
              ' ' +
              i +
              ' ' +
              s +
              ' ' +
              o.team +
              ' ' +
              t[e].ru_yds +
              ' yds ' +
              t[e].ru_att +
              ' att ' +
              t[e].ru_td +
              ' tds</span>'),
            c)
          )
            break
        }
        e
          ? (tickerIndexTracker.liveRushers.message = a)
          : (tickerLiveLeaders_ar.Rushing[0] = {
              header: 'Top ' + includeLiveLeaders + ' Live Rushing Leaders ',
              message: a || 'will update as stats become available'
            }),
          t.sort(function (e, t) {
            return e.re_yds > t.re_yds ? -1 : 1
          }),
          (a = '')
        for (let e = 0; e < t.length && !(t[e].re_yds <= -100); e++) {
          liveLeadersFound = !0
          const r = e + 1 !== t.length && t[e + 1].re_yds > -100,
            o = playerDatabase['pid_' + t[e].id],
            n = o.name,
            i = n.substring(n.indexOf(',') + 2),
            s = n.substring(0, n.indexOf(',')),
            l = includeFranchiseIcons ? getFranchiseIcon(t[e].id) : '',
            c = !(e + 1 < parseInt(includeLiveLeaders) && r)
          if (
            ((a +=
              '<span style="margin-right:' +
              (c ? '0' : '3.75rem') +
              '">' +
              (e + 1) +
              '.<span style="display:inline-block;visibility:hidden">.</span>' +
              l +
              '<span style="display:inline-block;visibility:hidden">.</span>' +
              o.position +
              ' ' +
              i +
              ' ' +
              s +
              ' ' +
              o.team +
              ' ' +
              t[e].re_yds +
              ' yds ' +
              t[e].re_cmp +
              ' rec. ' +
              t[e].re_td +
              ' tds</span>'),
            c)
          )
            break
        }
        if (
          (e
            ? (tickerIndexTracker.liveReceivers.message = a)
            : (tickerLiveLeaders_ar.Receiving[0] = {
                header:
                  'Top ' + includeLiveLeaders + ' Live Receiving Leaders ',
                message: a || 'will update as stats become available'
              }),
          includeLiveLeadersIDP && isLeagueIDP)
        ) {
          t.sort(function (e, t) {
            return e.idp_tk > t.idp_tk
              ? -1
              : e.idp_tk < t.idp_tk
              ? 1
              : e.idp_as > t.idp_as
              ? -1
              : (e.idp_as, t.idp_as, 1)
          }),
            (a = '')
          for (let e = 0; e < t.length && !(t[e].idp_tk <= -100); e++) {
            liveLeadersFound = !0
            const r = e + 1 !== t.length && t[e + 1].idp_tk > -100,
              o = playerDatabase['pid_' + t[e].id],
              n = o.name,
              i = n.substring(n.indexOf(',') + 2),
              s = n.substring(0, n.indexOf(',')),
              l = includeFranchiseIcons ? getFranchiseIcon(t[e].id) : '',
              c = !(e + 1 < parseInt(includeLiveLeaders) && r)
            if (
              ((a +=
                '<span style="margin-right:' +
                (c ? '0' : '3.75rem') +
                '">' +
                (e + 1) +
                '.<span style="display:inline-block;visibility:hidden">.</span>' +
                l +
                '<span style="display:inline-block;visibility:hidden">.</span>' +
                o.position +
                ' ' +
                i +
                ' ' +
                s +
                ' ' +
                o.team +
                ' ' +
                t[e].idp_tk +
                ' tackles ' +
                t[e].idp_as +
                ' assists ' +
                t[e].idp_sk +
                ' sacks</span>'),
              c)
            )
              break
          }
          e
            ? (tickerIndexTracker.liveDefenders.message = a)
            : (tickerLiveLeaders_ar.Defenders[0] = {
                header: 'Top ' + includeLiveLeaders + ' Live IDP Leaders ',
                message: a || 'will update as stats become available'
              })
        }
      }
      function getLatestArticles () {
        if (parseInt(includeLatestArticles) <= 0) return !1
        if (isNaN(parseInt(includeLatestArticles))) return !1
        const e = `${baseURLDynamic}/${year}/news_articles?P=*&L=${league_id}&PRINTER=1`
        return fetch(e)
          .then(function (e) {
            if (!e.ok) throw new Error('Network response was not ok')
            return e.text()
          })
          .then(function (e) {
            const t = parseHTML(e).querySelector('.headline')
            if (!t) return
            const a = t.closest('table')
            if (!a) return
            const r = a.querySelectorAll('tr'),
              o = parseInt(includeLatestArticles)
            for (
              let e = 0;
              e < r.length && !(latestArticles_ar.length >= o);
              e++
            ) {
              const t = r[e]
              if (t.querySelector('th')) continue
              const a = t.querySelector('td.headline b a')
              if (!a) continue
              const o =
                '<a href="' +
                (baseURLDynamic +
                  '/' +
                  year +
                  '/' +
                  (a.getAttribute('href') || '').replace('&PRINTER=1', '')) +
                '" target="_blank">' +
                a.textContent.trim() +
                ' <span style="color:' +
                tickerHeadClr +
                '"><i class="fa-solid fa-square-arrow-up-right" aria-hidden="true"></i> View</span></a>'
              latestArticles_ar.push({ header: 'Latest Articles', message: o })
            }
          })
          .catch(function (e) {
            return console.error('Error fetching latest articles:', e), !1
          })
      }
      function getTopPlayerStats (e) {
        return (
          !(parseInt(includeTopPlayerStats) <= 0) &&
          !isNaN(parseInt(includeTopPlayerStats)) &&
          !('Defenders' === e && !isLeagueIDP) &&
          !('Defenders' === e && !includeTopPlayerStatsIDP) &&
          fetch(
            `${baseURLDynamic}/${year}/top?L=${league_id}&SEARCHTYPE=ADVANCED&COUNT=100&YEAR=${year}&START_WEEK=${tickerStartWeek}&END_WEEK=${tickerCompletedWeek}&CATEGORY=overall&POSITION=*&DISPLAY=${e}&TEAM=*&PRINTER=1`
          )
            .then(function (e) {
              return e.text()
            })
            .then(function (t) {
              const a = parseHTML(t).querySelector('.points')
              if (!a) return
              const r = a.closest('table')
              if (!r) return
              let o = !1,
                n = '',
                i = 0
              r.querySelectorAll('tr').forEach(function (t) {
                if (o) return
                if (t.querySelector('th')) return
                let a = getAttr(t, 'td.player a', 'href') || ''
                a = a.substring(a.indexOf('P=') + 2).replace('&PRINTER=1', '')
                let r = getText(t, 'td.player').replace('(R)', '').trim(),
                  s = r.substr(-3).trim()
                if ('Def' === s || 'Off' === s) return
                if (
                  ((s = r.substr(-4).trim()),
                  [
                    'TMQB',
                    'TMRB',
                    'TMWR',
                    'TMTE',
                    'TMPK',
                    'TMPN',
                    'TMDL',
                    'TMLB',
                    'TMDB'
                  ].indexOf(s) > -1)
                )
                  return
                if (((s = r.substr(-5).trim()), 'Coach' === s)) return
                if (((s = r.substr(-2).trim()), 'PN' === s || 'ST' === s))
                  return
                let l = r
                  .substring(0, r.length - 2)
                  .trim()
                  .substr(-3)
                r = r.substring(0, r.length - 6).trim()
                const c = r.substring(r.indexOf(',') + 2),
                  d = r.substring(0, r.indexOf(',')),
                  p = includeFranchiseIcons ? getFranchiseIcon(a) : '',
                  u = t.querySelectorAll('td')
                switch (e) {
                  case 'Passers': {
                    if ('QB' !== s) return void (o = !0)
                    let e = (u[4] ? u[4].textContent.trim() : '')
                      .replace(/,/g, '')
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    const t = u[7] ? u[7].textContent.trim() : '',
                      a = u[8] ? u[8].textContent.trim() : ''
                    i++,
                      (n +=
                        '<span style="margin-right:' +
                        (i < parseInt(includeTopPlayerStats)
                          ? '3.75rem'
                          : '0') +
                        '">' +
                        i +
                        '.<span style="display:inline-block;visibility:hidden">.</span>' +
                        p +
                        '<span style="display:inline-block;visibility:hidden">.</span>' +
                        s +
                        ' ' +
                        c +
                        ' ' +
                        d +
                        ' ' +
                        l +
                        ' ' +
                        e +
                        ' yds ' +
                        t +
                        ' tds ' +
                        a +
                        ' ints</span>')
                    break
                  }
                  case 'Rushers': {
                    if (!['QB', 'RB', 'WR', 'TE'].includes(s))
                      return void (o = !0)
                    const e = u[5] ? u[5].textContent.trim() : ''
                    let t = (u[4] ? u[4].textContent.trim() : '')
                      .replace(/,/g, '')
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    const a = u[6] ? u[6].textContent.trim() : ''
                    i++,
                      (n +=
                        '<span style="margin-right:' +
                        (i < parseInt(includeTopPlayerStats)
                          ? '3.75rem'
                          : '0') +
                        '">' +
                        i +
                        '.<span style="display:inline-block;visibility:hidden">.</span>' +
                        p +
                        '<span style="display:inline-block;visibility:hidden">.</span>' +
                        s +
                        ' ' +
                        c +
                        ' ' +
                        d +
                        ' ' +
                        l +
                        ' ' +
                        t +
                        ' yds ' +
                        e +
                        ' atts ' +
                        a +
                        ' tds</span>')
                    break
                  }
                  case 'Receivers': {
                    if (!['QB', 'RB', 'WR', 'TE'].includes(s))
                      return void (o = !0)
                    const e = u[4] ? u[4].textContent.trim() : ''
                    let t = (u[5] ? u[5].textContent.trim() : '')
                      .replace(/,/g, '')
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    const a = u[6] ? u[6].textContent.trim() : ''
                    i++,
                      (n +=
                        '<span style="margin-right:' +
                        (i < parseInt(includeTopPlayerStats)
                          ? '3.75rem'
                          : '0') +
                        '">' +
                        i +
                        '.<span style="display:inline-block;visibility:hidden">.</span>' +
                        p +
                        '<span style="display:inline-block;visibility:hidden">.</span>' +
                        s +
                        ' ' +
                        c +
                        ' ' +
                        d +
                        ' ' +
                        l +
                        ' ' +
                        t +
                        ' yds ' +
                        e +
                        ' rec. ' +
                        a +
                        ' tds</span>')
                    break
                  }
                  case 'Kickers': {
                    if ('PK' !== s) return void (o = !0)
                    const e = u[4] ? u[4].textContent.trim() : '',
                      t = u[5] ? u[5].textContent.trim() : '',
                      a = u[6] ? u[6].textContent.trim() : ''
                    i++,
                      (n +=
                        '<span style="margin-right:' +
                        (i < parseInt(includeTopPlayerStats)
                          ? '3.75rem'
                          : '0') +
                        '">' +
                        i +
                        '.<span style="display:inline-block;visibility:hidden">.</span>' +
                        p +
                        '<span style="display:inline-block;visibility:hidden">.</span>' +
                        s +
                        ' ' +
                        c +
                        ' ' +
                        d +
                        ' ' +
                        l +
                        ' ' +
                        e +
                        '/' +
                        t +
                        ' fg ' +
                        a +
                        ' xp</span>')
                    break
                  }
                  case 'Defenders': {
                    const e = u[4] ? u[4].textContent.trim() : '',
                      t = u[5] ? u[5].textContent.trim() : '',
                      a = u[6] ? u[6].textContent.trim() : ''
                    i++,
                      (n +=
                        '<span style="margin-right:' +
                        (i < parseInt(includeTopPlayerStats)
                          ? '3.75rem'
                          : '0') +
                        '">' +
                        i +
                        '.<span style="display:inline-block;visibility:hidden">.</span>' +
                        p +
                        '<span style="display:inline-block;visibility:hidden">.</span>' +
                        s +
                        ' ' +
                        c +
                        ' ' +
                        d +
                        ' ' +
                        l +
                        ' ' +
                        e +
                        ' tackles ' +
                        t +
                        ' assists ' +
                        a +
                        ' sacks</span>')
                    break
                  }
                }
                o ||
                  (i >= parseInt(includeTopPlayerStats) &&
                    (topPlayerStats_ar[e][0] = {
                      header: 'Top ' + includeTopPlayerStats + ' ' + e,
                      message: n
                    }))
              })
            })
            .catch(function (e) {
              console.log('Fetch error:', e)
            })
        )
      }
      function getTopPlayerPts (e) {
        if (parseInt(includeTopPlayerPts) <= 0) return !1
        if (isPlayoffLeague && !e) return !1
        let t, a
        if (
          (e
            ? ((t = tickerStartWeek),
              (a = isPlayoffLeague ? tickerEndWeek : tickerLastRegularWeek))
            : ((t = tickerLastRegularWeek + 1), (a = tickerLastPlayoffWeek)),
          a > completedWeek && (a = completedWeek),
          t > a)
        )
          return !1
        const r = {},
          o = {}
        return fetch(
          `${baseURLDynamic}/${year}/top?L=${league_id}&SEARCHTYPE=ADVANCED&COUNT=500&YEAR=${year}&START_WEEK=${t}&END_WEEK=${a}&CATEGORY=overall&POSITION=*&DISPLAY=points&TEAM=*&PRINTER=1`
        )
          .then(function (e) {
            return e.text()
          })
          .then(function (t) {
            const a = parseHTML(t).querySelector('.points')
            if (!a) return
            const n = a.closest('table')
            if (!n) return
            n.querySelectorAll('tr').forEach(function (e) {
              if (e.querySelector('th')) return
              let t = getAttr(e, 'td.player a', 'href') || ''
              t = t.substring(t.indexOf('P=') + 2).replace('&PRINTER=1', '')
              let a = getText(e, 'td.player').replace('(R)', '').trim(),
                n = !1,
                i = a.substr(-3).trim()
              if (
                ('Def' === i && (n = !0),
                n || ((i = a.substr(-5).trim()), 'Coach' === i && (n = !0)),
                n ||
                  ((i = a.substr(-2).trim()),
                  [
                    'QB',
                    'RB',
                    'WR',
                    'TE',
                    'PK',
                    'DT',
                    'DE',
                    'LB',
                    'CB',
                    'S'
                  ].includes(i) && (n = !0)),
                !n)
              )
                return
              if (
                (r.hasOwnProperty(i) || ((r[i] = 0), (o[i] = '')),
                r[i] >= includeTopPlayerPts)
              )
                return
              const s = a.replace(i, '').trim().substr(-3)
              ;(a = a.substring(0, a.length - i.length).trim()),
                (a = a.substring(0, a.length - s.length).trim())
              const l = a.substring(a.indexOf(',') + 2),
                c = a.substring(0, a.indexOf(',')),
                d = includeFranchiseIcons ? getFranchiseIcon(t) : '',
                p = e.querySelectorAll('td'),
                u = p[2] ? p[2].textContent.trim() : ''
              r[i]++,
                (o[i] +=
                  '<span style="margin-right:' +
                  (r[i] < parseInt(includeTopPlayerPts) ? '3.75rem' : '0') +
                  '">' +
                  r[i] +
                  '.<span style="display:inline-block;visibility:hidden">.</span> ' +
                  d +
                  '<span style="display:inline-block;visibility:hidden">.</span>' +
                  l +
                  ' ' +
                  c +
                  ' ' +
                  s +
                  ' ' +
                  u +
                  ' pts</span>')
            })
            for (const t of Object.keys(o))
              if (e) {
                const e = isPlayoffLeague
                  ? 'Top ' + includeTopPlayerPts + ' Fantasy Pts ' + t
                  : 'Top ' +
                    includeTopPlayerPts +
                    ' Pts ' +
                    t +
                    ' Fantasy Regular Season'
                topPlayerPts_ar.regular[t][0] = { header: e, message: o[t] }
              } else
                topPlayerPts_ar.playoff[t][0] = {
                  header:
                    'Top ' +
                    includeTopPlayerPts +
                    ' Pts ' +
                    t +
                    ' Fantasy Playoffs',
                  message: o[t]
                }
          })
          .catch(function (e) {
            console.log('Fetch error:', e)
          })
      }
      function getLastWeekResults () {
        if (0 === tickerCompletedWeek) return !1
        if (!includeLastWeekResults) return !1
        let e = tickerCompletedWeek
        return (
          !isAllPlay &&
            !isPlayoffLeague &&
            e > tickerLastPlayoffWeek &&
            (e = tickerLastPlayoffWeek),
          fetch(
            `${baseURLDynamic}/${year}/weekly?L=${league_id}&W=${e}&PRINTER=1`
          )
            .then(function (e) {
              return e.text()
            })
            .then(function (t) {
              const a = parseHTML(t).querySelector('.scoresummary')
              if (!a) return
              const r = a.closest('table')
              if (!r) return
              const o = [],
                n = []
              let i = 0
              r.querySelectorAll('tr').forEach(function (e) {
                if (e.querySelector('th')) return
                getText(e, 'td:first-child')
                let t = getAttr(e, 'td:first-child a', 'href'),
                  a = ''
                if (t) {
                  t = t.substr(t.indexOf('F=') + 2, 4)
                  const r = e.querySelector('td:last-child')
                  a = r ? r.textContent.trim() : ''
                } else t = 'BYE'
                isAllPlay
                  ? o.push({ fid: t, score: a })
                  : (i % 2
                      ? n.push({ fid: t, score: a })
                      : o.push({ fid: t, score: a }),
                    i++)
              })
              let s = ''
              for (let e = 0; e < o.length; e++) {
                let t = '',
                  a = ''
                if (
                  (includeFranchiseIcons &&
                    ((t =
                      'BYE' === o[e].fid
                        ? 'BYE'
                        : 'AVG' === o[e].fid
                        ? 'AVG'
                        : getFranchiseIcon('', o[e].fid)),
                    isAllPlay ||
                      (a =
                        'BYE' === n[e].fid
                          ? 'BYE'
                          : 'AVG' === n[e].fid
                          ? 'AVG'
                          : getFranchiseIcon('', n[e].fid))),
                  '' === t &&
                    (t =
                      'BYE' === o[e].fid
                        ? 'BYE'
                        : 'AVG' === o[e].fid
                        ? 'AVG'
                        : franchiseDatabase['fid_' + o[e].fid].name),
                  isAllPlay ||
                    '' !== a ||
                    (a =
                      'BYE' === n[e].fid
                        ? 'BYE'
                        : 'AVG' === n[e].fid
                        ? 'AVG'
                        : franchiseDatabase['fid_' + n[e].fid].name),
                  isAllPlay)
                ) {
                  s +=
                    '<span class="ticker_gameover" style="margin-right:' +
                    (e === o.length - 1 ? '0' : '3.75rem') +
                    '">' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
                    o[e].score +
                    '</span></span>'
                } else {
                  const r =
                      parseFloat(o[e].score) > parseFloat(n[e].score)
                        ? '<i class="fa-regular fa-caret-right" aria-hidden="true" style="margin-right:0.188rem;color:' +
                          controlsGreen +
                          '"></i>'
                        : '',
                    i =
                      parseFloat(n[e].score) > parseFloat(o[e].score)
                        ? '<i class="fa-regular fa-caret-left" aria-hidden="true" style="margin-left:0.188rem;color:' +
                          controlsGreen +
                          '"></i>'
                        : ''
                  s +=
                    '<span class="ticker_gameover" style="margin-right:' +
                    (e === o.length - 1 ? '0' : '3.75rem') +
                    '">' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
                    r +
                    o[e].score +
                    '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
                    n[e].score +
                    i +
                    '</span><span style="display:inline-block;visibility:hidden">.</span>' +
                    a +
                    '</span>'
                }
              }
              '' !== s &&
                (tickerLastWeekResults_ar[0] = {
                  header: 'Week ' + e + ' Fantasy Results',
                  message: s
                })
            })
            .catch(function (e) {
              console.log('Fetch error:', e)
            })
        )
      }
      function getNextWeekMatchups () {
        return (
          !!includeNextWeekMatchups &&
          !(tickerCompletedWeek + 1 > tickerEndWeek) &&
          fetch(
            `${baseURLDynamic}/${year}/weekly?L=${league_id}&W=${
              tickerCompletedWeek + 1
            }&PRINTER=1`
          )
            .then(function (e) {
              return e.text()
            })
            .then(function (e) {
              const t = parseHTML(e).querySelector('.scoresummary')
              if (!t) return
              const a = t.closest('table')
              if (!a) return
              const r = [],
                o = []
              let n = 0
              a.querySelectorAll('tr').forEach(function (e) {
                if (e.querySelector('th')) return
                let t = getAttr(e, 'td:first-child a', 'href')
                ;(t = t ? t.substr(t.indexOf('F=') + 2, 4) : 'BYE'),
                  isAllPlay
                    ? r.push({ fid: t })
                    : (n % 2 ? o.push({ fid: t }) : r.push({ fid: t }), n++)
              })
              let i = ''
              for (let e = 0; e < r.length; e++) {
                let t = '',
                  a = ''
                includeFranchiseIcons &&
                  ((t =
                    'BYE' === r[e].fid
                      ? 'BYE'
                      : 'AVG' === r[e].fid
                      ? 'AVG'
                      : getFranchiseIcon('', r[e].fid)),
                  !isAllPlay &&
                    o[e] &&
                    o[e].fid &&
                    (a =
                      'BYE' === o[e].fid
                        ? 'BYE'
                        : getFranchiseIcon('', o[e].fid))),
                  '' === t &&
                    (t =
                      'BYE' === r[e].fid
                        ? 'BYE'
                        : 'AVG' === r[e].fid
                        ? 'AVG'
                        : franchiseDatabase['fid_' + r[e].fid].name)
                let n = '',
                  s = ''
                if (
                  (isAllPlay ||
                    void 0 === reportStandingsFid_ar ||
                    (reportStandingsFid_ar.hasOwnProperty(r[e].fid) &&
                      reportStandingsFid_ar[r[e].fid].hasOwnProperty(
                        'record'
                      ) &&
                      (n =
                        '<span class="warning ticker-record fantasy-record">(' +
                        reportStandingsFid_ar[r[e].fid].record +
                        ')</span>'),
                    o[e] &&
                      o[e].fid &&
                      reportStandingsFid_ar.hasOwnProperty(o[e].fid) &&
                      reportStandingsFid_ar[o[e].fid].hasOwnProperty(
                        'record'
                      ) &&
                      (s =
                        '<span class="warning ticker-record fantasy-record">(' +
                        reportStandingsFid_ar[o[e].fid].record +
                        ')</span>')),
                  !isAllPlay)
                ) {
                  '' === a &&
                    o[e] &&
                    (a =
                      'BYE' === o[e].fid
                        ? 'BYE'
                        : 'AVG' === o[e].fid
                        ? 'AVG'
                        : franchiseDatabase['fid_' + o[e].fid].name)
                  i +=
                    '<span style="margin-right:' +
                    (e === r.length - 1 ? '0' : '3.75rem') +
                    '">' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
                    n +
                    '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
                    s +
                    '</span><span style="display:inline-block;visibility:hidden">.</span>' +
                    a +
                    '</span>'
                }
              }
              '' !== i &&
                (tickerNextWeekMatchups_ar[0] = {
                  header:
                    'Week ' + (tickerCompletedWeek + 1) + ' Fantasy Matchups',
                  message: i
                })
            })
            .catch(function (e) {
              console.error(e)
            })
        )
      }
      function getLastWeekNflResults () {
        if (0 === tickerCompletedWeek) return !1
        if (!includeLastWeekNflResults) return !1
        let e = ''
        const t =
            '//www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/',
          a = '.svg'
        let r = ''
        for (const e of Object.keys(tickerNflGameNext))
          tickerNflGameNext[e].isHome || (r = e)
        for (const o of Object.keys(tickerNflGameResults))
          if (!tickerNflGameResults[o].isHome) {
            const n = o,
              i = tickerNflGameResults[o].opponent,
              s =
                '<img src="' +
                t +
                n +
                a +
                '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                n +
                '" /><span style="display:inline-block;visibility:hidden">.</span>',
              l =
                '<img src="' +
                t +
                i +
                a +
                '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                i +
                '" /><span style="display:inline-block;visibility:hidden">.</span>',
              c =
                parseInt(tickerNflGameResults[n].score, 10) >
                parseInt(tickerNflGameResults[i].score, 10)
                  ? '<i class="fa-regular fa-caret-right" aria-hidden="true" style="margin-right:0.188rem;color:' +
                    controlsGreen +
                    '"></i>'
                  : '',
              d =
                parseInt(tickerNflGameResults[i].score, 10) >
                parseInt(tickerNflGameResults[n].score, 10)
                  ? '<i class="fa-regular fa-caret-left" aria-hidden="true" style="margin-left:0.188rem;color:' +
                    controlsGreen +
                    '"></i>'
                  : ''
            e +=
              '<span class="ticker_gameover" style="margin-right:' +
              (n === r ? '0' : '3.75rem') +
              '">' +
              s +
              '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
              c +
              tickerNflGameResults[n].score +
              '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
              tickerNflGameResults[i].score +
              d +
              '</span><span style="display:inline-block;visibility:hidden">.</span>' +
              l +
              '</span>'
          }
        '' !== e &&
          (tickerLastWeekNflResults_ar[0] = {
            header: 'Week ' + completedWeek + ' NFL Results',
            message: e
          })
      }
      function getNextWeekNflMatchups () {
        if (!includeNextWeekNflMatchups) return !1
        let e = ''
        const t =
            '//www.mflscripts.com/ImageDirectory/script-images/nflTeamsvg_2/',
          a = '.svg'
        let r = ''
        for (const e of Object.keys(tickerNflGameNext))
          tickerNflGameNext[e].isHome || (r = e)
        for (const o of Object.keys(tickerNflGameNext))
          if (!tickerNflGameNext[o].isHome) {
            const n = o,
              i = tickerNflGameNext[o].opponent,
              s =
                '<img src="' +
                t +
                n +
                a +
                '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                n +
                '" /><span style="display:inline-block;visibility:hidden">.</span>',
              l =
                '<img src="' +
                t +
                i +
                a +
                '" class="franchise_icon_ticker icon_ticker_nfl" alt="' +
                i +
                '" /><span style="display:inline-block;visibility:hidden">.</span>',
              c = tickerNflGameNext[n].clock
            e +=
              '<span class="ticker_gameover" style="margin-right:' +
              (n === r ? '0' : '3.75rem') +
              '">' +
              s +
              '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
              (parseFloat(tickerNflGameNext[n].spread, 10) < 0
                ? '<span class="warning" title="spread">' +
                  tickerNflGameNext[n].spread +
                  '</span>'
                : '') +
              '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
              (parseFloat(tickerNflGameNext[i].spread, 10) < 0
                ? '<span class="warning" title="spread">' +
                  tickerNflGameNext[i].spread +
                  '</span>'
                : '') +
              '</span><span style="display:inline-block;visibility:hidden">.</span>' +
              l +
              ' ' +
              c +
              '</span>'
          }
        '' !== e &&
          (tickerNextWeekNflMatchups_ar[0] = {
            header: 'Week ' + (completedWeek + 1) + ' NFL Games',
            message: e
          })
      }
      function getWaiverOrder () {
        if (!includeWaiverOrder) return !1
        const e = `${baseURLDynamic}/${year}/home/${league_id}?MODULE=WAIVER_ORDER`
        return fetch(e)
          .then(function (e) {
            if (!e.ok) throw new Error(`Error: ${e.status} ${e.statusText}`)
            return e.text()
          })
          .then(function (e) {
            const t = parseHTML(e).querySelector('#waiver_order')
            if (!t) return
            const a = []
            t.querySelectorAll('tr').forEach(function (e) {
              if (e.querySelector('th')) return
              const t = getAttr(e, 'td.franchisename a', 'href')
              if (t)
                try {
                  a.push({ fid: t.substr(t.indexOf('F=') + 2, 4) })
                } catch (e) {}
            })
            let r = ''
            for (let e = 0; e < a.length; e++) {
              let t = includeFranchiseIcons
                ? getFranchiseIcon('', a[e].fid)
                : ''
              '' === t && (t = franchiseDatabase['fid_' + a[e].fid].name),
                (r +=
                  '<span style="margin-right:' +
                  (e === a.length - 1 ? '0' : '3.75rem') +
                  '">' +
                  (e + 1) +
                  '.<span style="display:inline-block;visibility:hidden">.</span>' +
                  t +
                  '</span>')
            }
            '' !== r &&
              (tickerWaiverOrder_ar[0] = {
                header: 'Current Waiver Priority',
                message: r
              })
          })
          .catch(function (e) {
            throw (console.error('Error:', e), e)
          })
      }
      function getPowerRank (e) {
        const t = {
          0: includePowerRank
            ? `${baseURLDynamic}/${year}/options/?L=${league_id}&O=101&SORT=PWR&PRINTER=1`
            : null,
          1: includeAltPowerRank
            ? `${baseURLDynamic}/${year}/options/?L=${league_id}&O=101&SORT=ALTPWR&PRINTER=1`
            : null,
          2: includePointScoredTeam
            ? `${baseURLDynamic}/${year}/options/?L=${league_id}&O=101&SORT=PTS&PRINTER=1`
            : null,
          3: includeAllplayRecord
            ? `${baseURLDynamic}/${year}/options/?L=${league_id}&O=101&SORT=ALLPLAY&PRINTER=1`
            : null
        }[e]
        return (
          !!t &&
          fetch(t)
            .then(function (e) {
              if (!e.ok)
                throw new Error(
                  `Network response was not OK. Status: ${e.status}`
                )
              return e.text()
            })
            .then(function (t) {
              const a = parseHTML(t).querySelector('.power_rank')
              if (!a) return
              const r = a.closest('table')
              if (!r) return
              const o = []
              r.querySelectorAll('tr').forEach(function (t) {
                if (t.querySelector('th')) return
                let a = getAttr(t, 'td.franchisename a', 'href') || ''
                a = a.substr(a.indexOf('F=') + 2, 4)
                let r = ''
                0 === e
                  ? (r = getText(t, 'td.power_rank'))
                  : 1 === e
                  ? (r = getText(t, 'td.alt_power_rank'))
                  : 2 === e
                  ? (r = getText(t, 'td.total_points'))
                  : 3 === e &&
                    (r =
                      getText(t, 'td.all_play_w') +
                      '-' +
                      getText(t, 'td.all_play_l') +
                      '-' +
                      getText(t, 'td.all_play_t')),
                  o.push({ fid: a, rank: r })
              })
              let n = ''
              for (let e = 0; e < o.length; e++) {
                let t = includeFranchiseIcons
                  ? getFranchiseIcon('', o[e].fid)
                  : ''
                '' === t && (t = franchiseDatabase['fid_' + o[e].fid].name),
                  (n +=
                    '<span style="margin-right:' +
                    (e === o.length - 1 ? '0' : '3.75rem') +
                    '">' +
                    (e + 1) +
                    '.<span style="display:inline-block;visibility:hidden">.</span>' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span>' +
                    o[e].rank +
                    '</span>')
              }
              '' !== n &&
                (tickerRankOrder_ar[
                  {
                    0: 'power',
                    1: 'alt_power',
                    2: 'points_scored',
                    3: 'all_play_record'
                  }[e]
                ][0] = {
                  header: {
                    0: 'Power Ranking',
                    1: 'Alternate Power Ranking',
                    2: 'Franchise Leaders by Point Scored',
                    3: 'All Play Record'
                  }[e],
                  message: n
                })
            })
            .catch(function (e) {
              console.error('Error:', e)
            })
        )
      }
      function getTickerDraftResults (e) {
        if (!includeDraft) return !1
        const t = `${baseURLDynamic}/${year}/options?L=${league_id}&O=17&PRINTER=1`
        return fetch(t)
          .then(function (e) {
            return e.text()
          })
          .then(function (t) {
            const a = parseHTML(t).querySelector('.franchisename')
            if (!a) return
            const r = a.closest('table')
            if (!r) return
            let o = !1
            const n = []
            let i = -1
            const s = ['(R)', '(I)', '(S)', '(O)', '(D)', '(Q)', '(C)', '(H)']
            r.querySelectorAll('tr').forEach(function (e) {
              try {
                if (e.querySelector('th')) return void 0
                const t = getText(e, 'td:first-child')
                let a = getAttr(e, 'td.franchisename a', 'href') || ''
                a = a ? a.substr(a.indexOf('F=') + 2, 4) : ''
                let r = getText(e, 'td.player')
                '' !== r &&
                  s.forEach(function (e) {
                    r = r.replace(e, '').trim()
                  }),
                  '' !== r && i++
                const l = getAttr(e, 'td.player a', 'href')
                if (a && r && l) {
                  let e = l
                      .substring(l.indexOf('P=') + 2)
                      .replace('&PRINTER=1', ''),
                    o = '',
                    i = !1
                  ;(o = r.substr(-5)),
                    'Coach' === o && (i = !0),
                    i ||
                      ((o = r.substr(-4)),
                      [
                        'TMQB',
                        'TMRB',
                        'TMWR',
                        'TMTE',
                        'TMPK',
                        'TMPN',
                        'TMDL',
                        'TMLB',
                        'TMDB'
                      ].includes(o) && (i = !0)),
                    i ||
                      ((o = r.substr(-3)),
                      ('Off' !== o && 'Def' !== o) || (i = !0)),
                    i || (o = r.substr(-2).trim())
                  const s = r.replace(o, '').trim().substr(-3)
                  ;(r = r.substring(0, r.length - o.length).trim()),
                    (r = r.substring(0, r.length - s.length).trim()),
                    n.push({
                      pick: t,
                      fid: a,
                      pid: e,
                      first_name: r.substring(r.indexOf(',') + 2),
                      last_name: r.substring(0, r.indexOf(',')),
                      position: o,
                      team_abbrev: s
                    })
                } else (o = !0), a && n.push({ pick: t, fid: a, pid: '', first_name: '', last_name: '', position: '', team_abbrev: '' })
              } catch (e) {}
            })
            let l = 0,
              c = n.length
            draftShowEntire ||
              (parseInt(draftTopPicksOnly) > 0
                ? ((l = 0), (c = parseInt(draftTopPicksOnly)))
                : (-1 === i && (i = n.length),
                  (l = Math.max(0, i - draftShowPicksMade + 1)),
                  (c = Math.min(n.length, i + draftShowPicksPending + 1))))
            let d = ''
            for (let e = l; e < c; e++) {
              let t = ''
              includeFranchiseIcons &&
                n[e].hasOwnProperty('pid') &&
                n[e].hasOwnProperty('fid') &&
                (t = getFranchiseIcon(n[e].pid, n[e].fid)),
                '' === t && (t = franchiseDatabase['fid_' + n[e].fid].name)
              const a = 'margin-right:' + (e === c - 1 ? '0' : '3.75rem')
              '' === n[e].first_name
                ? (d +=
                    '<span style="' +
                    a +
                    '">' +
                    n[e].pick +
                    '<span style="display:inline-block;visibility:hidden">.</span>' +
                    t +
                    '</span>')
                : (d +=
                    '<span style="' +
                    a +
                    '">' +
                    n[e].pick +
                    '<span style="display:inline-block;visibility:hidden">.</span>' +
                    t +
                    '<span style="display:inline-block;visibility:hidden">.</span> ' +
                    n[e].first_name +
                    ' ' +
                    n[e].last_name +
                    ' ' +
                    n[e].team_abbrev +
                    ' ' +
                    n[e].position +
                    '</span>')
            }
            if (e)
              (liveUpdateScheduled = !0),
                (tickerIndexTracker.draftResults.message = d)
            else if ('' !== d) {
              let e = 'Fantasy Draft Latest And Pending Picks'
              draftShowEntire
                ? (e = 'Fantasy Draft')
                : parseInt(draftTopPicksOnly) > 0
                ? (e =
                    'Fantasy Draft Top ' +
                    parseInt(draftTopPicksOnly) +
                    ' Picks')
                : parseInt(draftShowPicksMade) > 0 &&
                  parseInt(draftShowPicksPending) < 1
                ? (e = 'Fantasy Draft Latest Picks')
                : parseInt(draftShowPicksMade) < 1 &&
                  parseInt(draftShowPicksPending) > 0 &&
                  (e = 'Fantasy Draft Pending Picks'),
                (tickerDraftResults_ar[0] = { header: e, message: d })
            }
          })
          .catch(function (e) {
            console.error('Error:', e)
          })
      }
      cogSpan &&
        cogSpan.addEventListener('click', function () {
          const e = qs('.marquee_settings_table')
          if (e) {
            slideToggle(e, 500), e.classList.add('mobile-wrap')
            const t = e.querySelector('table')
            t && t.classList.add('report'),
              qsa('.about_row,.global_row,.live_row,.button_row').forEach(
                function (e) {
                  e.style.display = 'none'
                }
              ),
              qsa('.displayToggleSet').forEach(function (e) {
                e.style.display = ''
              }),
              qsa('.cp_hidden').forEach(function (e) {
                e.style.display = 'none'
              })
          }
        })
      const tickerJSON_matchups = { matchup: [], franchise: [] },
        tickerJSON_projectedScores = []
      let ticker_players = {},
        ticker_player_fid_tracker = {},
        ticker_matchups = [],
        ticker_nflSchedule = {},
        ticker_nflOpponents = {},
        tickerShowMFLByeTeams = !1,
        tickerIsAllPlay = !1,
        tickerFirstKickoff = {},
        tickerFranchise = {},
        tickerPlayerProjected = {},
        tickerJSON_projectedScoresWeek = {}
      async function doTickerProjectedScores (e) {
        if (e) return !0
        try {
          const e = 'w_' + tickerLiveScoringWeek
          return (
            (tickerJSON_projectedScoresWeek[`w_${tickerLiveScoringWeek}`] =
              reportProjectedScores_ar[e]),
            reportProjectedScores_ar[e]
          )
        } catch (e) {}
      }
      async function doTickerFantasyWeek () {
        const e = { matchup: [], franchise: [] }
        let t
        try {
          t =
            'function' == typeof structuredClone
              ? structuredClone(liveScoringLiveWeek)
              : JSON.parse(JSON.stringify(liveScoringLiveWeek))
        } catch (t) {
          return (
            console.error(
              'doTickerFantasyWeek: failed to clone liveScoringLiveWeek',
              t
            ),
            e
          )
        }
        const a = t && t.liveScoring
        if (!a || 'object' != typeof a)
          return (
            t &&
              t.error &&
              t.error.$t &&
              console.warn('doTickerFantasyWeek:', t.error.$t),
            e
          )
        try {
          return (
            Object.prototype.hasOwnProperty.call(a, 'matchup') &&
              (Array.isArray(a.matchup)
                ? (e.matchup = a.matchup)
                : a.matchup &&
                  'object' == typeof a.matchup &&
                  (e.matchup = [a.matchup])),
            Object.prototype.hasOwnProperty.call(a, 'franchise') &&
              (Array.isArray(a.franchise)
                ? (e.franchise = a.franchise)
                : a.franchise &&
                  'object' == typeof a.franchise &&
                  (e.franchise = [a.franchise])),
            e
          )
        } catch (t) {
          return console.error('Error in doTickerFantasyWeek:', t), e
        }
      }
      function doTickerArrays (e) {
        function registerPlayer (e, t) {
          const a = 'pid_' + e.id,
            r = 'starter' === e.status ? '1' : '0'
          if (
            (void 0 === ticker_players[a]
              ? ((ticker_players[a] = {
                  id: e.id,
                  fid: t,
                  score: e.score,
                  gameSecondsRemaining: parseInt(e.gameSecondsRemaining),
                  isStarter: r
                }),
                (ticker_player_fid_tracker[e.id + '_' + t] = 1))
              : void 0 === ticker_player_fid_tracker[e.id + '_' + t] &&
                ((ticker_players[a].fid += ',' + t),
                (ticker_players[a].isStarter += ',' + r),
                (ticker_player_fid_tracker[e.id + '_' + t] = 1)),
            void 0 === tickerFranchise['fid_' + t] &&
              (tickerFranchise['fid_' + t] = {
                starter: {},
                bench: {},
                tiebreaker: []
              }),
            'starter' === e.status &&
              (tickerFranchise['fid_' + t].starter[e.id] = {
                score: e.score,
                gsr: e.gameSecondsRemaining
              }),
            'nonstarter' === e.status &&
              (tickerFranchise['fid_' + t].bench[e.id] = {
                score: e.score,
                gsr: e.gameSecondsRemaining
              }),
            '1' === r)
          )
            try {
              const a = t
              void 0 === tickerFirstKickoff[a]
                ? tickerNFLKickoff[playerDatabase['pid_' + e.id].team] > 0 &&
                  (tickerFirstKickoff[a] =
                    tickerNFLKickoff[playerDatabase['pid_' + e.id].team])
                : tickerNFLKickoff[playerDatabase['pid_' + e.id].team] > 0 &&
                  tickerNFLKickoff[playerDatabase['pid_' + e.id].team] <
                    tickerFirstKickoff[a] &&
                  (tickerFirstKickoff[a] =
                    tickerNFLKickoff[playerDatabase['pid_' + e.id].team])
            } catch (e) {}
        }
        function buildMatchupEntry (e, t, a, r) {
          return {
            roadId: e,
            homeId: t,
            roadScore: a.score,
            homeScore: r ? r.score : 0,
            roadProjected: 0,
            homeProjected: 0,
            roadYetToPlay: parseInt(a.playersYetToPlay),
            homeYetToPlay: r ? parseInt(r.playersYetToPlay) : 0,
            roadCurrentlyPlaying: parseInt(a.playersCurrentlyPlaying),
            homeCurrentlyPlaying: r ? parseInt(r.playersCurrentlyPlaying) : 0,
            roadPlayerMinutesRemaining: parseInt(
              parseInt(a.gameSecondsRemaining) / 60 + 0.99
            ),
            homePlayerMinutesRemaining: r
              ? parseInt(parseInt(r.gameSecondsRemaining) / 60 + 0.99)
              : 0,
            roadSpread: '',
            homeSpread: '',
            roadResult: '',
            homeResult: ''
          }
        }
        if (
          ((ticker_players = {}),
          (ticker_player_fid_tracker = {}),
          (ticker_matchups = []),
          (ticker_nflSchedule = {}),
          (ticker_nflOpponents = {}),
          (tickerIsAllPlay = !1),
          (tickerFranchise = {}),
          (tickerPlayerProjected = {}),
          tickerJSON_matchups.hasOwnProperty('matchup') &&
            tickerJSON_matchups.matchup.length > 0)
        ) {
          let e = []
          tickerJSON_matchups.matchup.hasOwnProperty('franchise')
            ? e.push(tickerJSON_matchups.matchup)
            : (e = tickerJSON_matchups.matchup)
          for (let t = 0; t < e.length; t++) {
            const a = e[t].franchise[0],
              r = e[t].franchise[1]
            ;(ticker_matchups[t] = buildMatchupEntry(a.id, r.id, a, r)),
              e[t].franchise[0].hasOwnProperty('players') &&
                e[t].franchise[0].players.hasOwnProperty('player') &&
                e[t].franchise[0].players.player.forEach(function (e) {
                  registerPlayer(e, a.id)
                }),
              e[t].franchise[1].hasOwnProperty('players') &&
                e[t].franchise[1].players.hasOwnProperty('player') &&
                e[t].franchise[1].players.player.forEach(function (e) {
                  registerPlayer(e, r.id)
                })
          }
        } else {
          tickerIsAllPlay = !0
          for (let e = 0; e < tickerJSON_matchups.franchise.length; e++) {
            const t = tickerJSON_matchups.franchise[e],
              a = buildMatchupEntry(t.id, 'BYE', t, null)
            ticker_matchups.push(a),
              t.hasOwnProperty('players') &&
                t.players.hasOwnProperty('player') &&
                t.players.player.forEach(function (e) {
                  registerPlayer(e, t.id)
                })
          }
          ticker_matchups.sort(function (e, t) {
            return parseFloat(e.roadScore) < parseFloat(t.roadScore)
              ? 1
              : parseFloat(e.roadScore) > parseFloat(t.roadScore)
              ? -1
              : 0
          })
        }
        if (
          !tickerIsAllPlay &&
          tickerShowMFLByeTeams &&
          tickerJSON_matchups.hasOwnProperty('franchise')
        ) {
          const e = Array.isArray(tickerJSON_matchups.franchise)
            ? tickerJSON_matchups.franchise
            : [tickerJSON_matchups.franchise]
          let t = ticker_matchups.length
          e.forEach(function (e) {
            const a = buildMatchupEntry(e.id, 'BYE', e, null)
            ;(ticker_matchups[t] = a),
              e.hasOwnProperty('players') &&
                e.players.hasOwnProperty('player') &&
                e.players.player.forEach(function (t) {
                  registerPlayer(t, e.id)
                }),
              t++
          })
        }
        let t = ''
        for (let e = 0; e < ticker_matchups.length; e++) {
          let a = '',
            r = ''
          includeFranchiseIcons &&
            ((a =
              'BYE' === ticker_matchups[e].roadId
                ? 'BYE'
                : 'AVG' === ticker_matchups[e].roadId
                ? 'AVG'
                : getFranchiseIcon('', ticker_matchups[e].roadId)),
            tickerIsAllPlay ||
              (r =
                'BYE' === ticker_matchups[e].homeId
                  ? 'BYE'
                  : 'AVG' === ticker_matchups[e].homeId
                  ? 'AVG'
                  : getFranchiseIcon('', ticker_matchups[e].homeId))),
            '' === a &&
              (a =
                'BYE' === ticker_matchups[e].roadId
                  ? 'BYE'
                  : 'AVG' === ticker_matchups[e].roadId
                  ? 'AVG'
                  : franchiseDatabase['fid_' + ticker_matchups[e].roadId].name),
            tickerIsAllPlay ||
              '' !== r ||
              (r =
                'BYE' === ticker_matchups[e].homeId
                  ? 'BYE'
                  : 'AVG' === ticker_matchups[e].homeId
                  ? 'AVG'
                  : franchiseDatabase['fid_' + ticker_matchups[e].homeId].name)
          let o = '',
            n = ''
          tickerIsAllPlay ||
            ticker_matchups[e].roadPlayerMinutesRemaining +
              ticker_matchups[e].homePlayerMinutesRemaining !==
              0 ||
            ((o =
              parseFloat(ticker_matchups[e].roadScore) >
              parseFloat(ticker_matchups[e].homeScore)
                ? '<i class="fa-regular fa-caret-right" aria-hidden="true" style="margin-right:0.188rem;color:' +
                  controlsGreen +
                  '"></i>'
                : ''),
            (n =
              parseFloat(ticker_matchups[e].homeScore) >
              parseFloat(ticker_matchups[e].roadScore)
                ? '<i class="fa-regular fa-caret-left" aria-hidden="true" style="margin-left:0.188rem;color:' +
                  controlsGreen +
                  '"></i>'
                : ''))
          const i = e === ticker_matchups.length - 1
          t += tickerIsAllPlay
            ? '<span class="ticker_gameover" style="margin-right:' +
              (i ? '0' : '3.75rem') +
              '">' +
              a +
              '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
              ticker_matchups[e].roadScore +
              '</span></span>'
            : '<span class="ticker_gameover" style="margin-right:' +
              (i ? '0' : '3.75rem') +
              '">' +
              a +
              '<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points left_team">' +
              o +
              ticker_matchups[e].roadScore +
              '</span><span style="display:inline-block;visibility:hidden">.</span>at<span style="display:inline-block;visibility:hidden">.</span><span class="ticker_points right_team">' +
              ticker_matchups[e].homeScore +
              n +
              '</span><span style="display:inline-block;visibility:hidden">.</span>' +
              r +
              '</span>'
        }
        return t
      }
      async function getFantasyMatchups (e) {
        if (!includeFantasyMatchups) return !1
        try {
          const t = await doTickerFantasyWeek()
          Object.assign(tickerJSON_matchups, t),
            await doTickerProjectedScores(e)
          const a = doTickerArrays(e)
          if (e)
            (liveUpdateScheduled = !0),
              (tickerIndexTracker.fantasyMatchups.message = a)
          else if ('' !== a) {
            const e = tickerIsAllPlay
              ? 'Week ' + (completedWeek + 1) + ' Fantasy Scores'
              : 'Week ' + (completedWeek + 1) + ' Fantasy Matchups'
            tickerFantasyMatchups_ar[0] = { header: e, message: a }
          }
        } catch (e) {
          console.error('getFantasyMatchups error:', e)
        }
      }
      function userResetDisplayOptions () {
        ;[
          'ticker_includeFranchiseIcons_',
          'ticker_tickerSize_',
          'ticker_tickerDelay_',
          'ticker_includeLatestArticles_',
          'ticker_includeTopPlayerStats_',
          'ticker_includeTopPlayerStatsIDP_',
          'ticker_includeTopPlayerPts_',
          'ticker_includePowerRank_',
          'ticker_includeAltPowerRank_',
          'ticker_includePointScoredTeam_',
          'ticker_includeAllplayRecord_',
          'ticker_includeLastWeekResults_',
          'ticker_includeNextWeekMatchups_',
          'ticker_includeLastWeekNflResults_',
          'ticker_includeNextWeekNflMatchups_',
          'ticker_includeWaiverOrder_',
          'ticker_includeDraft_',
          'ticker_draftShowEntire_',
          'ticker_draftTopPicksOnly_',
          'ticker_draftShowPicksMade_',
          'ticker_draftShowPicksPending_',
          'ticker_includeFantasyMatchups_',
          'ticker_includeLiveLeaders_',
          'ticker_includeLiveLeadersIDP_',
          'ticker_includeNflMatchups_',
          'ticker_includeNflMatchupLeaders_'
        ].forEach(function (e) {
          localStorage.removeItem(e + league_id)
        }),
          setTimeout(function () {
            location.reload()
          }, 500)
      }
      function userSetDisplayOptions () {
        for (const e of Object.keys(displayOptionsTracker))
          localStorage.setItem(e, displayOptionsTracker[e])
        setTimeout(function () {
          location.reload()
        }, 500)
      }
      function userCancelDisplayOptions () {
        const e = displayOptionsInitialSettings
        ;(includeFranchiseIcons = e.ticker_includeFranchiseIcons),
          (tickerSize = e.ticker_tickerSize),
          (tickerDelay = e.ticker_tickerDelay),
          (includeLatestArticles = e.ticker_includeLatestArticles),
          (includeTopPlayerStats = e.ticker_includeTopPlayerStats),
          (includeTopPlayerStatsIDP = e.ticker_includeTopPlayerStatsIDP),
          (includeTopPlayerPts = e.ticker_includeTopPlayerPts),
          (includePowerRank = e.ticker_includePowerRank),
          (includeAltPowerRank = e.ticker_includeAltPowerRank),
          (includePointScoredTeam = e.ticker_includePointScoredTeam),
          (includeAllplayRecord = e.ticker_includeAllplayRecord),
          (includeLastWeekResults = e.ticker_includeLastWeekResults),
          (includeNextWeekMatchups = e.ticker_includeNextWeekMatchups),
          (includeLastWeekNflResults = e.ticker_includeLastWeekNflResults),
          (includeNextWeekNflMatchups = e.ticker_includeNextWeekNflMatchups),
          (includeWaiverOrder = e.ticker_includeWaiverOrder),
          (includeDraft = e.ticker_includeDraft),
          (draftShowEntire = e.ticker_draftShowEntire),
          (draftTopPicksOnly = e.ticker_draftTopPicksOnly),
          (draftShowPicksMade = e.ticker_draftShowPicksMade),
          (draftShowPicksPending = e.ticker_draftShowPicksPending),
          (includeFantasyMatchups = e.ticker_includeFantasyMatchups),
          (includeLiveLeaders = e.ticker_includeLiveLeaders),
          (includeLiveLeadersIDP = e.ticker_includeLiveLeadersIDP),
          (includeNflMatchups = e.ticker_includeNflMatchups),
          (includeNflMatchupLeaders = e.ticker_includeNflMatchupLeaders),
          [
            'franchiseIcon',
            'tickerSize',
            'tickerDelay',
            'articles',
            'topPlayerStats',
            'topPlayerStatsIDP',
            'topPlayerPts',
            'powerRank',
            'altPowerRank',
            'pointScoredTeam',
            'allplayRecord',
            'lastWeekResults',
            'nextWeekMatchups',
            'lastWeekNflResults',
            'nextWeekNflMatchups',
            'waiverOrder',
            'draft',
            'draftShowEntire',
            'draftTopPicksOnly',
            'draftShowPicksMade',
            'draftShowPicksPending',
            'fantasyMatchups',
            'liveLeaders',
            'liveLeadersIDP',
            'nflMatchups',
            'nflMatchupLeaders'
          ].forEach(function (e) {
            userUpdateDisplayOptions(
              e,
              {
                franchiseIcon: includeFranchiseIcons,
                tickerSize: tickerSize,
                tickerDelay: tickerDelay,
                articles: includeLatestArticles,
                topPlayerStats: includeTopPlayerStats,
                topPlayerStatsIDP: includeTopPlayerStatsIDP,
                topPlayerPts: includeTopPlayerPts,
                powerRank: includePowerRank,
                altPowerRank: includeAltPowerRank,
                pointScoredTeam: includePointScoredTeam,
                allplayRecord: includeAllplayRecord,
                lastWeekResults: includeLastWeekResults,
                nextWeekMatchups: includeNextWeekMatchups,
                lastWeekNflResults: includeLastWeekNflResults,
                nextWeekNflMatchups: includeNextWeekNflMatchups,
                waiverOrder: includeWaiverOrder,
                draft: includeDraft,
                draftShowEntire: draftShowEntire,
                draftTopPicksOnly: draftTopPicksOnly,
                draftShowPicksMade: draftShowPicksMade,
                draftShowPicksPending: draftShowPicksPending,
                fantasyMatchups: includeFantasyMatchups,
                liveLeaders: includeLiveLeaders,
                liveLeadersIDP: includeLiveLeadersIDP,
                nflMatchups: includeNflMatchups,
                nflMatchupLeaders: includeNflMatchupLeaders
              }[e],
              !0
            )
          }),
          setTimeout(function () {
            const e = qs('.settings_cog_span')
            e && e.click()
          }, 1e3)
      }
      function _setCheckbox (e, t) {
        const a = document.getElementById(e)
        a && (a.checked = !!t)
      }
      function _setSelect (e, t) {
        const a = document.getElementById(e)
        a && (a.value = t)
      }
      function _setDisabled (e, t) {
        const a = document.getElementById(e)
        if (!a) return
        a.disabled = t
        const r = a.parentNode
        r &&
          (t
            ? r.classList.add('display-options-disabled')
            : r.classList.remove('display-options-disabled'))
      }
      function userUpdateDisplayOptions (e, t, a) {
        const r = void 0 !== a && a
        switch (e) {
          case 'franchiseIcon':
            ;(includeFranchiseIcons = !!t),
              (displayOptionsTracker[
                'ticker_includeFranchiseIcons_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeFranchiseIcons_checkbox', t)
            break
          case 'tickerSize':
            ;(tickerSize = t),
              (displayOptionsTracker['ticker_tickerSize_' + league_id] = t),
              r && _setSelect('tickerSize_select', t)
            break
          case 'tickerDelay':
            ;(tickerDelay = t),
              (displayOptionsTracker['ticker_tickerDelay_' + league_id] = t),
              r && _setSelect('tickerDelay_select', t)
            break
          case 'articles':
            ;(includeLatestArticles = parseInt(t)),
              (displayOptionsTracker[
                'ticker_includeLatestArticles_' + league_id
              ] = t),
              r && _setSelect('includeLatestArticles_select', t)
            break
          case 'topPlayerStats':
            ;(includeTopPlayerStats = parseInt(t)),
              (displayOptionsTracker[
                'ticker_includeTopPlayerStats_' + league_id
              ] = t),
              r && _setSelect('topPlayerStats_select', t),
              _setDisabled(
                'topPlayerStatsIDP_checkbox',
                0 === includeTopPlayerStats
              )
            break
          case 'topPlayerStatsIDP':
            ;(includeTopPlayerStatsIDP = !!t),
              (displayOptionsTracker[
                'ticker_includeTopPlayerStatsIDP_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('topPlayerStatsIDP_checkbox', t)
            break
          case 'topPlayerPts':
            ;(includeTopPlayerPts = parseInt(t)),
              (displayOptionsTracker[
                'ticker_includeTopPlayerPts_' + league_id
              ] = t),
              r && _setSelect('topPlayerPts_select', t)
            break
          case 'powerRank':
            ;(includePowerRank = !!t),
              (displayOptionsTracker['ticker_includePowerRank_' + league_id] = t
                ? 1
                : 0),
              r && _setCheckbox('includePowerRank_checkbox', t)
            break
          case 'altPowerRank':
            ;(includeAltPowerRank = !!t),
              (displayOptionsTracker[
                'ticker_includeAltPowerRank_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeAltPowerRank_checkbox', t)
            break
          case 'pointScoredTeam':
            ;(includePointScoredTeam = !!t),
              (displayOptionsTracker[
                'ticker_includePointScoredTeam_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includePointScoredTeam_checkbox', t)
            break
          case 'allplayRecord':
            ;(includeAllplayRecord = !!t),
              (displayOptionsTracker[
                'ticker_includeAllplayRecord_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeAllplayRecord_checkbox', t)
            break
          case 'lastWeekResults':
            ;(includeLastWeekResults = !!t),
              (displayOptionsTracker[
                'ticker_includeLastWeekResults_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeLastWeekResults_checkbox', t)
            break
          case 'nextWeekMatchups':
            ;(includeNextWeekMatchups = !!t),
              (displayOptionsTracker[
                'ticker_includeNextWeekMatchups_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeNextWeekMatchups_checkbox', t)
            break
          case 'lastWeekNflResults':
            ;(includeLastWeekNflResults = !!t),
              (displayOptionsTracker[
                'ticker_includeLastWeekNflResults_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeLastWeekNflResults_checkbox', t)
            break
          case 'nextWeekNflMatchups':
            ;(includeNextWeekNflMatchups = !!t),
              (displayOptionsTracker[
                'ticker_includeNextWeekNflMatchups_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeNextWeekNflMatchups_checkbox', t)
            break
          case 'waiverOrder':
            ;(includeWaiverOrder = !!t),
              (displayOptionsTracker['ticker_includeWaiverOrder_' + league_id] =
                t ? 1 : 0),
              r && _setCheckbox('includeWaiverOrder_checkbox', t)
            break
          case 'draft':
            ;(includeDraft = !!t),
              (displayOptionsTracker['ticker_includeDraft_' + league_id] = t
                ? 1
                : 0),
              r && _setCheckbox('includeDraft_checkbox', t)
            break
          case 'draftShowEntire':
            ;(draftShowEntire = !!t),
              (displayOptionsTracker['ticker_draftShowEntire_' + league_id] = t
                ? 1
                : 0),
              r && _setCheckbox('draftShowEntire_checkbox', t)
            break
          case 'draftTopPicksOnly':
            ;(draftTopPicksOnly = parseInt(t)),
              (displayOptionsTracker['ticker_draftTopPicksOnly_' + league_id] =
                t),
              r && _setSelect('draftTopPicksOnly_select', t)
            break
          case 'draftShowPicksMade':
            ;(draftShowPicksMade = parseInt(t)),
              (displayOptionsTracker['ticker_draftShowPicksMade_' + league_id] =
                t),
              r && _setSelect('draftShowPicksMade_select', t)
            break
          case 'draftShowPicksPending':
            ;(draftShowPicksPending = parseInt(t)),
              (displayOptionsTracker[
                'ticker_draftShowPicksPending_' + league_id
              ] = t),
              r && _setSelect('draftShowPicksPending_select', t)
            break
          case 'fantasyMatchups':
            ;(includeFantasyMatchups = !!t),
              (displayOptionsTracker[
                'ticker_includeFantasyMatchups_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeFantasyMatchups_checkbox', t)
            break
          case 'liveLeaders':
            ;(includeLiveLeaders = parseInt(t)),
              (displayOptionsTracker['ticker_includeLiveLeaders_' + league_id] =
                t),
              r && _setSelect('liveLeaders_select', t),
              _setDisabled('liveLeadersIDP_checkbox', 0 === includeLiveLeaders)
            break
          case 'liveLeadersIDP':
            ;(includeLiveLeadersIDP = !!t),
              (displayOptionsTracker[
                'ticker_includeLiveLeadersIDP_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('liveLeadersIDP_checkbox', t)
            break
          case 'nflMatchups':
            ;(includeNflMatchups = !!t),
              (displayOptionsTracker['ticker_includeNflMatchups_' + league_id] =
                t ? 1 : 0),
              r && _setCheckbox('includeNflMatchups_checkbox', t),
              _setDisabled(
                'includeNflMatchupLeaders_checkbox',
                !includeNflMatchups
              )
            break
          case 'nflMatchupLeaders':
            ;(includeNflMatchupLeaders = !!t),
              (displayOptionsTracker[
                'ticker_includeNflMatchupLeaders_' + league_id
              ] = t ? 1 : 0),
              r && _setCheckbox('includeNflMatchupLeaders_checkbox', t)
        }
      }
      function userPanelDisplay (e, t) {
        qsa(
          '.about_row,.global_row,.standard_row,.live_row,.button_row,.about_hide,.global_hide,.standard_hide,.live_hide'
        ).forEach(function (e) {
          e.style.display = 'none'
        }),
          qsa('.about_show,.global_show,.standard_show,.live_show').forEach(
            function (e) {
              e.style.display = ''
            }
          ),
          t
            ? (qsa('.' + e + '_row').forEach(function (e) {
                e.style.display = ''
              }),
              qsa('.' + e + '_show').forEach(function (e) {
                e.style.display = 'none'
              }),
              qsa('.' + e + '_hide').forEach(function (e) {
                e.style.display = ''
              }),
              'about' !== e &&
                qsa('.button_row').forEach(function (e) {
                  e.style.display = ''
                }))
            : (qsa('.' + e + '_show').forEach(function (e) {
                e.style.display = ''
              }),
              qsa('.' + e + '_hide').forEach(function (e) {
                e.style.display = 'none'
              }))
      }
      function _buildSelectOptions (e, t) {
        let a = ''
        for (let r = 0; r <= e; r++)
          a +=
            '<option value="' +
            r +
            '"' +
            (r === t ? ' selected="selected"' : '') +
            '>' +
            r +
            '</option>'
        return a
      }
      function buildDisplayOptions () {
        function getBool (e) {
          return localStorage.hasOwnProperty(e + league_id)
            ? '1' === localStorage.getItem(e + league_id)
            : null
        }
        function getInt (e) {
          return localStorage.hasOwnProperty(e + league_id)
            ? parseInt(localStorage.getItem(e + league_id))
            : null
        }
        function getStr (e) {
          return localStorage.hasOwnProperty(e + league_id)
            ? localStorage.getItem(e + league_id)
            : null
        }
        const boolMap = {
            ticker_includeFranchiseIcons_: 'includeFranchiseIcons',
            ticker_includeTopPlayerStatsIDP_: 'includeTopPlayerStatsIDP',
            ticker_includePowerRank_: 'includePowerRank',
            ticker_includeAltPowerRank_: 'includeAltPowerRank',
            ticker_includePointScoredTeam_: 'includePointScoredTeam',
            ticker_includeAllplayRecord_: 'includeAllplayRecord',
            ticker_includeLastWeekResults_: 'includeLastWeekResults',
            ticker_includeNextWeekMatchups_: 'includeNextWeekMatchups',
            ticker_includeLastWeekNflResults_: 'includeLastWeekNflResults',
            ticker_includeNextWeekNflMatchups_: 'includeNextWeekNflMatchups',
            ticker_includeWaiverOrder_: 'includeWaiverOrder',
            ticker_includeDraft_: 'includeDraft',
            ticker_draftShowEntire_: 'draftShowEntire',
            ticker_includeLiveLeadersIDP_: 'includeLiveLeadersIDP'
          },
          intMap = {
            ticker_includeLatestArticles_: 'includeLatestArticles',
            ticker_includeTopPlayerStats_: 'includeTopPlayerStats',
            ticker_includeTopPlayerPts_: 'includeTopPlayerPts',
            ticker_draftTopPicksOnly_: 'draftTopPicksOnly',
            ticker_draftShowPicksMade_: 'draftShowPicksMade',
            ticker_draftShowPicksPending_: 'draftShowPicksPending',
            ticker_includeFantasyMatchups_: 'includeFantasyMatchups',
            ticker_includeLiveLeaders_: 'includeLiveLeaders',
            ticker_includeNflMatchups_: 'includeNflMatchups',
            ticker_includeNflMatchupLeaders_: 'includeNflMatchupLeaders'
          }
        for (const key of Object.keys(boolMap)) {
          const v = getBool(key)
          null !== v && eval(boolMap[key] + ' = v')
        }
        for (const key of Object.keys(intMap)) {
          const v = getInt(key)
          null !== v && eval(intMap[key] + ' = v')
        }
        const tickerSizeVal = getStr('ticker_tickerSize_')
        null !== tickerSizeVal && (tickerSize = tickerSizeVal)
        const tickerDelayVal = getStr('ticker_tickerDelay_')
        null !== tickerDelayVal && (tickerDelay = tickerDelayVal),
          (displayOptionsInitialSettings = {
            ticker_includeFranchiseIcons: includeFranchiseIcons,
            ticker_tickerSize: tickerSize,
            ticker_tickerDelay: tickerDelay,
            ticker_includeLatestArticles: includeLatestArticles,
            ticker_includeTopPlayerStats: includeTopPlayerStats,
            ticker_includeTopPlayerStatsIDP: includeTopPlayerStatsIDP,
            ticker_includeTopPlayerPts: includeTopPlayerPts,
            ticker_includePowerRank: includePowerRank,
            ticker_includeAltPowerRank: includeAltPowerRank,
            ticker_includePointScoredTeam: includePointScoredTeam,
            ticker_includeAllplayRecord: includeAllplayRecord,
            ticker_includeLastWeekResults: includeLastWeekResults,
            ticker_includeNextWeekMatchups: includeNextWeekMatchups,
            ticker_includeLastWeekNflResults: includeLastWeekNflResults,
            ticker_includeNextWeekNflMatchups: includeNextWeekNflMatchups,
            ticker_includeWaiverOrder: includeWaiverOrder,
            ticker_includeDraft: includeDraft,
            ticker_draftShowEntire: draftShowEntire,
            ticker_draftTopPicksOnly: draftTopPicksOnly,
            ticker_draftShowPicksMade: draftShowPicksMade,
            ticker_includeFantasyMatchups: includeFantasyMatchups,
            ticker_draftShowPicksPending: draftShowPicksPending,
            ticker_includeLiveLeaders: includeLiveLeaders,
            ticker_includeLiveLeadersIDP: includeLiveLeadersIDP,
            ticker_includeNflMatchups: includeNflMatchups,
            ticker_includeNflMatchupLeaders: includeNflMatchupLeaders
          })
        let html = ''
        ;(html += '<tbody>'),
          (html +=
            '<tr><td colspan="3" style="width:24.625rem;text-align:center;position:relative;overflow:hidden" class="warning">ABOUT<span class="about_show displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'about\',true)"><i class="fa-regular fa-caret-down" aria-hidden="true"></i></span><span class="about_hide cp_hidden displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'about\',false)"><i class="fa-regular fa-caret-up" aria-hidden="true"></i></span></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody class="about_row" style="display:none">'),
          (html += '<tr class="oddtablerow"><td colspan="3">'),
          (html +=
            '<p>This marquee shows information about your fantasy league.</p>'),
          (html +=
            '<p>There are two separate displays for the marquee, <b>STANDARD</b> and <b>LIVE</b>, that are automatically toggled depending on the time of the fantasy week.  In a given week <b>before the first NFL game kicks off is the standard display</b>.  This display will show items that are enabled in the standard section below.  <b>Once the first game kicks off the marquee will change to live mode</b> and will only show items enabled in the live section below.  <b>Global items will always be shown</b>.</p>'),
          (html +=
            '<p>The commissioner has set up the default view for the marquee but you as a user can turn on or off any setting to your liking and the marquee will remember your selections the next time you visit the site. To customize open any of the three separate areas (Global, Standard and Live) set your preferences and hit apply. To revert back to commissioner view hit reset.</p>'),
          (html +=
            '<p>The settings are per device so changes made on your PC will not be applied to your mobile device and vice versa.</p>'),
          (html += '</td></tr></tbody>'),
          (html += '<tbody>'),
          (html +=
            '<tr><td colspan="3" style="width:24.625rem;text-align:center;position:relative;overflow:hidden" class="warning">GLOBAL DISPLAY<span class="global_show displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'global\',true)"><i class="fa-regular fa-caret-down" aria-hidden="true"></i></span><span class="global_hide cp_hidden displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'global\',false)"><i class="fa-regular fa-caret-up" aria-hidden="true"></i></span></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody class="global_row" style="display:none">'),
          (html +=
            '<tr class="oddtablerow"><td colspan="3"><div class="ticker_setting_ck display-options-disabled"><input name="commishMessages" type="checkbox" checked="checked" disabled="disabled" name="includeCommishMessages_checkbox" id="includeCommishMessages_checkbox" class="includeCommishMessages_checkbox"><label for="includeCommishMessages_checkbox">Commissioner Messages (if any)</label></div></td></tr>'),
          (html +=
            '<tr class="eventablerow"><td colspan="3"><div class="ticker_setting_ck"><input name="franchiseIcons" type="checkbox"' +
            (includeFranchiseIcons ? ' checked="checked"' : '') +
            ' name="includeFranchiseIcons_checkbox" id="includeFranchiseIcons_checkbox" class="includeFranchiseIcons_checkbox" onchange="userUpdateDisplayOptions(\'franchiseIcon\',this.checked)"><label for="includeFranchiseIcons_checkbox">Show Franchise Icons where applicable</label></div></td></tr>'),
          (html += '<tr class="oddtablerow"><td>'),
          (html +=
            '<select class="select-display-options" name="tickerSize_select" id="tickerSize_select" onchange="userUpdateDisplayOptions(\'tickerSize\',this.value)">'),
          (html +=
            '<option value="small"' +
            ('small' === tickerSize ? ' selected="selected"' : '') +
            '>Small</option>'),
          (html +=
            '<option value="medium"' +
            ('medium' === tickerSize ? ' selected="selected"' : '') +
            '>Medium</option>'),
          (html +=
            '<option value="large"' +
            ('large' === tickerSize ? ' selected="selected"' : '') +
            '>Large</option>'),
          (html += '</select> Ticker Size</td><td colspan="2">'),
          (html +=
            '<select class="select-display-options" name="tickerDelay_select" id="tickerDelay_select" onchange="userUpdateDisplayOptions(\'tickerDelay\',this.value)">')
        for (let e = 1; e <= 6; e++)
          html +=
            '<option value="' +
            e +
            '"' +
            (parseInt(tickerDelay) === e ? ' selected="selected"' : '') +
            '>' +
            e +
            '</option>'
        ;(html += '</select> Delay seconds before scroll</td></tr>'),
          (html +=
            '<tr class="eventablerow"><td colspan="3"><select class="select-display-options" name="includeLatestArticles_select" id="includeLatestArticles_select" onchange="userUpdateDisplayOptions(\'articles\',this.value)">' +
            _buildSelectOptions(20, includeLatestArticles) +
            '</select> # of Article Headlines</td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody>'),
          (html +=
            '<tr><td colspan="3" style="width:24.625rem;text-align:center;position:relative;overflow:hidden" class="warning">STANDARD DISPLAY<span class="standard_show displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'standard\',true)"><i class="fa-regular fa-caret-down" aria-hidden="true"></i></span><span class="standard_hide cp_hidden displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'standard\',false)"><i class="fa-regular fa-caret-up" aria-hidden="true"></i></span></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody class="standard_row" style="display:none">'),
          (html +=
            '<tr class="oddtablerow"><td colspan="2"><select class="select-display-options" name="topPlayerStats_select" id="topPlayerStats_select" onchange="userUpdateDisplayOptions(\'topPlayerStats\',this.value)">' +
            _buildSelectOptions(10, includeTopPlayerStats) +
            '</select> # Top by Stat Cat</td>'),
          (html += isLeagueIDP
            ? '<td><div class="ticker_setting_ck' +
              (0 === includeTopPlayerStats ? ' display-options-disabled' : '') +
              '"><input type="checkbox"' +
              (includeTopPlayerStatsIDP ? ' checked="checked"' : '') +
              (0 === includeTopPlayerStats ? ' disabled="disabled"' : '') +
              ' name="topPlayerStatsIDP_checkbox" id="topPlayerStatsIDP_checkbox" class="topPlayerStatsIDP_checkbox" onchange="userUpdateDisplayOptions(\'topPlayerStatsIDP\',this.checked)"><label for="topPlayerStatsIDP_checkbox">Include IDP</label></div></td>'
            : '<td> </td>'),
          (html += '</tr>'),
          (html +=
            '<tr class="eventablerow"><td colspan="3"><select class="select-display-options" name="topPlayerPts_select" id="topPlayerPts_select" onchange="userUpdateDisplayOptions(\'topPlayerPts\',this.value)">' +
            _buildSelectOptions(10, includeTopPlayerPts) +
            '</select> # Top Fantasy Pts by Position</td></tr>'),
          (html +=
            '<tr class="oddtablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includePowerRank ? ' checked="checked"' : '') +
            ' name="includePowerRank_checkbox" id="includePowerRank_checkbox" class="includePowerRank_checkbox" onchange="userUpdateDisplayOptions(\'powerRank\',this.checked)"><label for="includePowerRank_checkbox">Power Rank</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeAltPowerRank ? ' checked="checked"' : '') +
            ' name="includeAltPowerRank_checkbox" id="includeAltPowerRank_checkbox" class="includeAltPowerRank_checkbox" onchange="userUpdateDisplayOptions(\'altPowerRank\',this.checked)"><label for="includeAltPowerRank_checkbox">Alt Power Rank</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includePointScoredTeam ? ' checked="checked"' : '') +
            ' name="includePointScoredTeam_checkbox" id="includePointScoredTeam_checkbox" class="includePointScoredTeam_checkbox" onchange="userUpdateDisplayOptions(\'pointScoredTeam\',this.checked)"><label for="includePointScoredTeam_checkbox">Points Scored</label></div></td></tr>'),
          (html +=
            '<tr class="eventablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeAllplayRecord ? ' checked="checked"' : '') +
            ' name="includeAllplayRecord_checkbox" id="includeAllplayRecord_checkbox" class="includeAllplayRecord_checkbox" onchange="userUpdateDisplayOptions(\'allplayRecord\',this.checked)"><label for="includeAllplayRecord_checkbox">All Play Record</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeLastWeekResults ? ' checked="checked"' : '') +
            ' name="includeLastWeekResults_checkbox" id="includeLastWeekResults_checkbox" class="includeLastWeekResults_checkbox" onchange="userUpdateDisplayOptions(\'lastWeekResults\',this.checked)"><label for="includeLastWeekResults_checkbox">Last Week Results</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeNextWeekMatchups ? ' checked="checked"' : '') +
            ' name="includeNextWeekMatchups_checkbox" id="includeNextWeekMatchups_checkbox" class="includeNextWeekMatchups_checkbox" onchange="userUpdateDisplayOptions(\'nextWeekMatchups\',this.checked)"><label for="includeNextWeekMatchups_checkbox">Next Week Matchups</label></div></td></tr>'),
          (html +=
            '<tr class="oddtablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeLastWeekNflResults ? ' checked="checked"' : '') +
            ' name="includeLastWeekNflResults_checkbox" id="includeLastWeekNflResults_checkbox" class="includeLastWeekNflResults_checkbox" onchange="userUpdateDisplayOptions(\'lastWeekNflResults\',this.checked)"><label for="includeLastWeekNflResults_checkbox">NFL Results</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeNextWeekNflMatchups ? ' checked="checked"' : '') +
            ' name="includeNextWeekNflMatchups_checkbox" id="includeNextWeekNflMatchups_checkbox" class="includeNextWeekNflMatchups_checkbox" onchange="userUpdateDisplayOptions(\'nextWeekNflMatchups\',this.checked)"><label for="includeNextWeekNflMatchups_checkbox">NFL Matchups</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeWaiverOrder ? ' checked="checked"' : '') +
            ' name="includeWaiverOrder_checkbox" id="includeWaiverOrder_checkbox" class="includeWaiverOrder_checkbox" onchange="userUpdateDisplayOptions(\'waiverOrder\',this.checked)"><label for="includeWaiverOrder_checkbox">Waiver Order</label></div></td></tr>'),
          (html +=
            '<tr class="eventablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeDraft ? ' checked="checked"' : '') +
            ' name="includeDraft_checkbox" id="includeDraft_checkbox" class="includeDraft_checkbox" onchange="userUpdateDisplayOptions(\'draft\',this.checked)"><label for="includeDraft_checkbox">Draft</label></div></td>'),
          (html +=
            '<td><div class="ticker_setting_ck' +
            (includeDraft ? '' : ' display-options-disabled') +
            '"><input type="checkbox"' +
            (draftShowEntire ? ' checked="checked"' : '') +
            (includeDraft ? '' : ' disabled="disabled"') +
            ' name="draftShowEntire_checkbox" id="draftShowEntire_checkbox" class="draftShowEntire_checkbox" onchange="userUpdateDisplayOptions(\'draftShowEntire\',this.checked)"><label for="draftShowEntire_checkbox">Show Entire Draft</label></div></td>'),
          (html += '<td> </td></tr>'),
          (html +=
            '<tr class="oddtablerow"><td><select class="select-display-options" name="draftTopPicksOnly_select" id="draftTopPicksOnly_select" onchange="userUpdateDisplayOptions(\'draftTopPicksOnly\',this.value)">' +
            _buildSelectOptions(20, draftTopPicksOnly) +
            '</select> <span class="draftTopPicksOnly_text' +
            (draftShowEntire || !includeDraft
              ? ' display-options-disabled'
              : '') +
            '"># Top Picks Only</span></td>'),
          (html +=
            '<td><select class="select-display-options" name="draftShowPicksMade_select" id="draftShowPicksMade_select" onchange="userUpdateDisplayOptions(\'draftShowPicksMade\',this.value)">' +
            _buildSelectOptions(20, draftShowPicksMade) +
            '</select> <span class="draftShowPicksMade_text' +
            (parseInt(draftTopPicksOnly) > 0 || draftShowEntire || !includeDraft
              ? ' display-options-disabled'
              : '') +
            '"># Picks Made</span></td>'),
          (html +=
            '<td><select class="select-display-options" name="draftShowPicksPending_select" id="draftShowPicksPending_select" onchange="userUpdateDisplayOptions(\'draftShowPicksPending\',this.value)">' +
            _buildSelectOptions(20, draftShowPicksPending) +
            '</select> <span class="draftShowPicksPending_text' +
            (parseInt(draftTopPicksOnly) > 0 || draftShowEntire || !includeDraft
              ? ' display-options-disabled'
              : '') +
            '"># Picks Pending</span></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody>'),
          (html +=
            '<tr><td colspan="3" style="width:24.625rem;text-align:center;position:relative;overflow:hidden" class="warning">LIVE DISPLAY<span class="live_show displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'live\',true)"><i class="fa-regular fa-caret-down" aria-hidden="true"></i></span><span class="live_hide cp_hidden displayToggleSet" style="cursor:pointer;position:absolute;right:0.313rem" onclick="userPanelDisplay(\'live\',false)"><i class="fa-regular fa-caret-up" aria-hidden="true"></i></span></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody class="live_row" style="display:none">'),
          (html +=
            '<tr class="oddtablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeFantasyMatchups ? ' checked="checked"' : '') +
            ' name="includeFantasyMatchups_checkbox" id="includeFantasyMatchups_checkbox" class="includeFantasyMatchups_checkbox" onchange="userUpdateDisplayOptions(\'fantasyMatchups\',this.checked)"><label for="includeFantasyMatchups_checkbox">Fantasy ' +
            (isLeagueHeadToHead ? 'Matchups' : 'Scores') +
            '</label></div></td><td colspan="2"> </td></tr>'),
          (html +=
            '<tr class="eventablerow"><td colspan="2"><select class="select-display-options" name="liveLeaders_select" id="liveLeaders_select" onchange="userUpdateDisplayOptions(\'liveLeaders\',this.value)">' +
            _buildSelectOptions(10, includeLiveLeaders) +
            '</select> # Top Live by Cat</td>'),
          (html += isLeagueIDP
            ? '<td><div class="ticker_setting_ck' +
              (0 === includeLiveLeaders ? ' display-options-disabled' : '') +
              '"><input type="checkbox"' +
              (includeLiveLeadersIDP ? ' checked="checked"' : '') +
              (0 === includeLiveLeaders ? ' disabled="disabled"' : '') +
              ' name="liveLeadersIDP_checkbox" id="liveLeadersIDP_checkbox" class="liveLeadersIDP_checkbox" onchange="userUpdateDisplayOptions(\'liveLeadersIDP\',this.checked)"><label for="liveLeadersIDP_checkbox">Include IDP</label></div></td>'
            : '<td> </td>'),
          (html += '</tr>'),
          (html +=
            '<tr class="oddtablerow"><td><div class="ticker_setting_ck"><input type="checkbox"' +
            (includeNflMatchups ? ' checked="checked"' : '') +
            ' name="includeNflMatchups_checkbox" id="includeNflMatchups_checkbox" class="includeNflMatchups_checkbox" onchange="userUpdateDisplayOptions(\'nflMatchups\',this.checked)"><label for="includeNflMatchups_checkbox">NFL Matchups</label></div></td>'),
          (html +=
            '<td colspan="2"><div class="ticker_setting_ck' +
            (includeNflMatchups ? '' : ' display-options-disabled') +
            '"><input type="checkbox"' +
            (includeNflMatchupLeaders ? ' checked="checked"' : '') +
            (includeNflMatchups ? '' : ' disabled="disabled"') +
            ' name="includeNflMatchupLeaders_checkbox" id="includeNflMatchupLeaders_checkbox" class="includeNflMatchupLeaders_checkbox" onchange="userUpdateDisplayOptions(\'nflMatchupLeaders\',this.checked)"><label for="includeNflMatchupLeaders_checkbox">NFL Matchup Leaders</label></div></td></tr>'),
          (html += '</tbody>'),
          (html += '<tbody class="button_row" style="display:none">'),
          (html +=
            '<tr class="button_row"><td colspan="3" style="text-align:center">'),
          (html +=
            '<div><span class="form_buttons"><input type="button" value="apply" onclick="userSetDisplayOptions()" /></span><span class="form_buttons"><input type="button" value="reset" title="Reset to Commissioner View" onclick="userResetDisplayOptions()" /></span><span class="form_buttons"><input type="button" value="cancel" onclick="userCancelDisplayOptions()" /></span></div>'),
          (html += '<div class="form_buttons"></div>'),
          (html += '</td></tr>'),
          (html += '</tbody>')
        const tbodyEl = document.getElementById('tbody_display_settings')
        if (tbodyEl) {
          const e = tbodyEl.closest('table')
          Array.from(e.querySelectorAll('tbody'))
            .slice(1)
            .forEach(function (e) {
              e.remove()
            })
          const t = document.createElement('table')
          ;(t.innerHTML = html),
            Array.from(t.querySelectorAll('tbody')).forEach(function (t) {
              e.appendChild(t)
            })
        }
      }
      updateSpeedControl()
      let displayOptionsTracker = {},
        displayOptionsInitialSettings = {}
      const latestArticles_ar = [],
        topPlayerStats_ar = {
          Passers: [],
          Rushers: [],
          Receivers: [],
          Kickers: [],
          Defenders: []
        },
        topPlayerPts_ar = {
          regular: {
            QB: [],
            RB: [],
            WR: [],
            TE: [],
            PK: [],
            Def: [],
            DT: [],
            DE: [],
            LB: [],
            CB: [],
            S: [],
            Coach: []
          },
          playoff: {
            QB: [],
            RB: [],
            WR: [],
            TE: [],
            PK: [],
            Def: [],
            DT: [],
            DE: [],
            LB: [],
            CB: [],
            S: [],
            Coach: []
          }
        },
        tickerLastWeekResults_ar = [],
        tickerNextWeekMatchups_ar = [],
        tickerLastWeekNflResults_ar = [],
        tickerNextWeekNflMatchups_ar = [],
        tickerWaiverOrder_ar = [],
        tickerRankOrder_ar = {
          power: [],
          alt_power: [],
          points_scored: [],
          all_play_record: []
        },
        tickerDraftResults_ar = []
      let liveLeadersFound = !1
      const tickerLiveLeaders_ar = {
          Passing: [],
          Rushing: [],
          Receiving: [],
          Defenders: [],
          Matchups: []
        },
        tickerFantasyMatchups_ar = []
      async function triggerReportTicker () {
        !scrollingTriggered && tickerContent.length > 0 && updateTicker(!1),
          (tickerStartWeek = startWeek),
          (tickerEndWeek = endWeek),
          tickerCompletedWeek > tickerEndWeek &&
            (tickerCompletedWeek = tickerEndWeek),
          tickerLiveScoringWeek > tickerEndWeek &&
            (tickerLiveScoringWeek = tickerEndWeek),
          tickerLastPlayoffWeek > tickerEndWeek &&
            (tickerLastPlayoffWeek = tickerEndWeek)
        try {
          if (
            (initTickerNflSchedule(),
            await Promise.all([
              getLatestArticles(),
              getTopPlayerStats('Passers'),
              getTopPlayerStats('Rushers'),
              getTopPlayerStats('Receivers'),
              getTopPlayerStats('Kickers'),
              getTopPlayerStats('Defenders'),
              getTopPlayerPts(!0),
              getTopPlayerPts(!1),
              getLastWeekResults(),
              getNextWeekMatchups(),
              getLastWeekNflResults(),
              getNextWeekNflMatchups(),
              getWaiverOrder(),
              getTickerDraftResults(!1),
              getTickerLiveStats(!1),
              getFantasyMatchups(!1),
              getPowerRank(0),
              getPowerRank(1),
              getPowerRank(2),
              getPowerRank(3)
            ]),
            latestArticles_ar.length > 0)
          )
            for (let e = 0; e < latestArticles_ar.length; e++)
              addTickerContent(
                latestArticles_ar[e].header,
                latestArticles_ar[e].message
              )
          if (
            (liveLeadersFound &&
              (tickerFantasyMatchups_ar.length > 0 &&
                addTickerContent(
                  tickerFantasyMatchups_ar[0].header,
                  tickerFantasyMatchups_ar[0].message,
                  'fantasyMatchups'
                ),
              tickerFantasyMatchups_ar.length > 0 &&
                (fantasyMatchupsInterval = setInterval(function () {
                  getFantasyMatchups(!0)
                }, 45e3)),
              tickerLiveLeaders_ar.Passing.length > 0 &&
                addTickerContent(
                  tickerLiveLeaders_ar.Passing[0].header,
                  tickerLiveLeaders_ar.Passing[0].message,
                  'livePassers'
                ),
              tickerLiveLeaders_ar.Rushing.length > 0 &&
                addTickerContent(
                  tickerLiveLeaders_ar.Rushing[0].header,
                  tickerLiveLeaders_ar.Rushing[0].message,
                  'liveRushers'
                ),
              tickerLiveLeaders_ar.Receiving.length > 0 &&
                addTickerContent(
                  tickerLiveLeaders_ar.Receiving[0].header,
                  tickerLiveLeaders_ar.Receiving[0].message,
                  'liveReceivers'
                ),
              tickerLiveLeaders_ar.Defenders.length > 0 &&
                addTickerContent(
                  tickerLiveLeaders_ar.Defenders[0].header,
                  tickerLiveLeaders_ar.Defenders[0].message,
                  'liveDefenders'
                ),
              tickerLiveLeaders_ar.Matchups.length > 0 &&
                addTickerContent(
                  tickerLiveLeaders_ar.Matchups[0].header,
                  tickerLiveLeaders_ar.Matchups[0].message,
                  'liveMatchups'
                )),
            !liveLeadersFound)
          ) {
            for (const e of [
              'Passers',
              'Rushers',
              'Receivers',
              'Kickers',
              'Defenders'
            ])
              topPlayerStats_ar[e].length > 0 &&
                addTickerContent(
                  topPlayerStats_ar[e][0].header,
                  topPlayerStats_ar[e][0].message
                )
            for (const e of Object.keys(topPlayerPts_ar.regular))
              topPlayerPts_ar.regular[e].length > 0 &&
                addTickerContent(
                  topPlayerPts_ar.regular[e][0].header,
                  topPlayerPts_ar.regular[e][0].message
                )
            for (const e of Object.keys(topPlayerPts_ar.playoff))
              topPlayerPts_ar.playoff[e].length > 0 &&
                addTickerContent(
                  topPlayerPts_ar.playoff[e][0].header,
                  topPlayerPts_ar.playoff[e][0].message
                )
            tickerRankOrder_ar.power.length > 0 &&
              addTickerContent(
                tickerRankOrder_ar.power[0].header,
                tickerRankOrder_ar.power[0].message
              ),
              tickerRankOrder_ar.alt_power.length > 0 &&
                addTickerContent(
                  tickerRankOrder_ar.alt_power[0].header,
                  tickerRankOrder_ar.alt_power[0].message
                ),
              tickerRankOrder_ar.points_scored.length > 0 &&
                addTickerContent(
                  tickerRankOrder_ar.points_scored[0].header,
                  tickerRankOrder_ar.points_scored[0].message
                ),
              tickerRankOrder_ar.all_play_record.length > 0 &&
                addTickerContent(
                  tickerRankOrder_ar.all_play_record[0].header,
                  tickerRankOrder_ar.all_play_record[0].message
                ),
              tickerLastWeekResults_ar.length > 0 &&
                addTickerContent(
                  tickerLastWeekResults_ar[0].header,
                  tickerLastWeekResults_ar[0].message
                ),
              tickerNextWeekMatchups_ar.length > 0 &&
                addTickerContent(
                  tickerNextWeekMatchups_ar[0].header,
                  tickerNextWeekMatchups_ar[0].message
                ),
              tickerLastWeekNflResults_ar.length > 0 &&
                addTickerContent(
                  tickerLastWeekNflResults_ar[0].header,
                  tickerLastWeekNflResults_ar[0].message
                ),
              tickerNextWeekNflMatchups_ar.length > 0 &&
                addTickerContent(
                  tickerNextWeekNflMatchups_ar[0].header,
                  tickerNextWeekNflMatchups_ar[0].message
                ),
              tickerWaiverOrder_ar.length > 0 &&
                addTickerContent(
                  tickerWaiverOrder_ar[0].header,
                  tickerWaiverOrder_ar[0].message
                ),
              tickerDraftResults_ar.length > 0 &&
                (addTickerContent(
                  tickerDraftResults_ar[0].header,
                  tickerDraftResults_ar[0].message,
                  'draftResults'
                ),
                (draftResultsInterval = setInterval(function () {
                  getTickerDraftResults(!0)
                }, 45e3)))
          }
          scrollingTriggered || updateTicker(!1)
        } catch (e) {
          console.error(e)
        }
      }
      if (
        (buildDisplayOptions(),
        sessionStorage.hasOwnProperty('ticker_header_' + league_id) &&
          sessionStorage.hasOwnProperty('ticker_message_' + league_id))
      ) {
        const Se = document.getElementById('body_ajax_ls') ? 1e3 : 100
        setTimeout(function () {
          updateTicker(!0)
        }, Se)
      }
      window.MFLGlobalCache.onReady(() => {
        doTicker && triggerReportTicker()
      })
    }
  }
}
if (
  void 0 !== load_lineups_submit_scriptV3 &&
  load_lineups_submit_scriptV3 &&
  'lineup' === thisProgram &&
  'undefined' != typeof franchise_id
) {
  const Me = document.createElement('style')
  ;(Me.textContent = '#lineup form[action*="lineup"] { visibility: hidden; }'),
    document.head.appendChild(Me),
    void 0 === window.hideOptionalMsgV3 && (window.hideOptionalMsgV3 = !1),
    void 0 === window.lu_useDefaultAsPrimaryV3 &&
      (window.lu_useDefaultAsPrimaryV3 = !1),
    void 0 === window.lu_validateLineUpV3 && (window.lu_validateLineUpV3 = !0)
  const Fe = `luV3_useDefault_${league_id}_${franchise_id}`
  null === localStorage.getItem(Fe) && localStorage.setItem(Fe, 'true')
  let xe = !1,
    Te = !0,
    Ce = !1,
    Be = 0,
    Ae = !1,
    De = !1,
    Ee = 'qb',
    Ne = !1,
    Ie = !1,
    Re = [],
    $e = [],
    Oe = [],
    We = !1,
    je = !1,
    He = !1,
    Ue = [],
    qe = !1,
    Ge = 0
  const ze = new Set(['qb', 'rb', 'wr', 'te']),
    Ye = {
      Coach: !0,
      Off: !0,
      Def: !0,
      ST: !0,
      TMQB: !0,
      TMRB: !0,
      TMWR: !0,
      TMTE: !0,
      TMPK: !0,
      TMPN: !0,
      TMDL: !0,
      TMLB: !0,
      TMDB: !0
    },
    Qe = {
      total: { min: 0, max: 0 },
      idptotal: { min: 0, max: 0, useIDP: !1 },
      COACH: { min: 0, max: 0, usePosition: !1 },
      QB: { min: 0, max: 0, usePosition: !1 },
      TMQB: { min: 0, max: 0, usePosition: !1 },
      RB: { min: 0, max: 0, usePosition: !1 },
      TMRB: { min: 0, max: 0, usePosition: !1 },
      FB: { min: 0, max: 0, usePosition: !1 },
      WR: { min: 0, max: 0, usePosition: !1 },
      TMWR: { min: 0, max: 0, usePosition: !1 },
      TE: { min: 0, max: 0, usePosition: !1 },
      TMTE: { min: 0, max: 0, usePosition: !1 },
      'WR+TE': { min: 0, max: 0, usePosition: !1 },
      'RB+WR+TE': { min: 0, max: 0, usePosition: !1 },
      KR: { min: 0, max: 0, usePosition: !1 },
      PK: { min: 0, max: 0, usePosition: !1 },
      TMPK: { min: 0, max: 0, usePosition: !1 },
      PN: { min: 0, max: 0, usePosition: !1 },
      TMPN: { min: 0, max: 0, usePosition: !1 },
      OFF: { min: 0, max: 0, usePosition: !1 },
      DEF: { min: 0, max: 0, usePosition: !1 },
      ST: { min: 0, max: 0, usePosition: !1 },
      'DT+DE': { min: 0, max: 0, usePosition: !1 },
      DT: { min: 0, max: 0, usePosition: !1 },
      DE: { min: 0, max: 0, usePosition: !1 },
      TMDL: { min: 0, max: 0, usePosition: !1 },
      LB: { min: 0, max: 0, usePosition: !1 },
      TMLB: { min: 0, max: 0, usePosition: !1 },
      CB: { min: 0, max: 0, usePosition: !1 },
      'CB+S': { min: 0, max: 0, usePosition: !1 },
      S: { min: 0, max: 0, usePosition: !1 },
      TMDB: { min: 0, max: 0, usePosition: !1 }
    }
  async function lu_fetchSettingsHTML () {
    try {
      const e = await fetch(
        `${baseURLDynamic}/${year}/options?L=${league_id}&O=26&PRINTER=1`,
        { method: 'GET', headers: { Accept: 'text/html' } }
      )
      if (!e.ok) return console.error(`HTTP error! Status: ${e.status}`), !1
      const t = await e.text()
      if (!t.trim())
        return (
          console.error('Error: Empty response received from settings URL'), !1
        )
      const a = new DOMParser()
        .parseFromString(t, 'text/html')
        .querySelectorAll('table')
      return a.length
        ? (await Promise.all(
            [...a].map(async e => {
              for (const t of e.querySelectorAll('th')) {
                const a = t.textContent.trim()
                if (a.includes('Starting Lineup Setup'))
                  for (const t of e.querySelectorAll('tr')) {
                    const e = t.querySelectorAll('td')
                    if (e.length < 2) continue
                    const a = e[0].textContent.trim(),
                      r = e[1].textContent.trim().replace(/[oO]/g, '0')
                    if (a.startsWith('Number of Starting')) {
                      const e = a
                          .replace('Number of Starting ', '')
                          .replace(/s:$/, '')
                          .toUpperCase(),
                        [t, o] = r.includes('-')
                          ? r.split('-').map(e => parseInt(e, 10))
                          : [parseInt(r, 10), parseInt(r, 10)]
                      ;(Qe[e].usePosition = !0),
                        (Qe[e].min = t),
                        (Qe[e].max = o)
                    }
                    if (
                      ('Should owners be allowed to submit players on bye as starters?' ===
                        a && (je = 'YES' === r.toUpperCase()),
                      'Are Partial Lineups Allowed?' === a &&
                        (We = 'YES' === r.toUpperCase()),
                      a.startsWith(
                        'Total Number of Starting Individual Defensive'
                      ))
                    ) {
                      const e = Number(r)
                      ;(Qe.idptotal.useIDP = !0),
                        (Qe.idptotal.min = e),
                        (Qe.idptotal.max = e),
                        (xe = !0)
                    }
                    a.startsWith('Maximum Number of Starting') &&
                      ((qe = !0), (Ge = r))
                  }
                if (a.includes('Formations')) {
                  He = !0
                  const t = []
                  for (const a of e.querySelectorAll('tr')) {
                    const e = a.querySelectorAll('td')
                    if (e.length < 2) continue
                    const r = e[1].innerHTML.trim(),
                      o = {}
                    r.split('<br>').forEach(e => {
                      const t = e.match(/(\w+): (\d+)/)
                      t && (o[t[1].trim().toUpperCase()] = parseInt(t[2], 10))
                    }),
                      Object.keys(o).length > 0 && t.push(o)
                  }
                  const a = new Set(t.flatMap(e => Object.keys(e)))
                  Ue.push({ POSITIONS: [...a].join('+') }), (Ue = Ue.concat(t))
                }
              }
            })
          ),
          void 0 !== leagueAttributes?.MinStarters &&
            void 0 !== leagueAttributes?.MaxStarters &&
            ((Qe.total.min = leagueAttributes.MinStarters),
            (Qe.total.max = leagueAttributes.MaxStarters)),
          !0)
        : (console.error('Error: No tables found in settings HTML'), !1)
    } catch (e) {
      return console.error('Error fetching Settings HTML data:', e), !1
    }
  }
  const Ve = lu_fetchSettingsHTML()
  function getPositionCodeFromAnchor (e) {
    if (!e) return null
    const t = [...e.classList].find(e => /^position_/i.test(e))
    return t ? t.replace(/^position_/i, '').toLowerCase() : null
  }
  function rebuildPositionLink (e) {
    const t = e.getAttribute('href') || '',
      a = e.dataset?.playerId || '',
      r = e.querySelector('.playerLastName')?.textContent || '',
      o = e.querySelector('.playerFirstName')?.innerHTML || '',
      n = e.querySelector('.playerTeam')?.textContent || '',
      i = (
        e.dataset?.pos ||
        e.querySelector('.playerPosition')?.textContent ||
        ''
      ).trim()
    if (!(a && o && r && n && i)) return null
    const s = o.replace(/<[^>]+>/g, ''),
      l = s.includes('*'),
      c = l
        ? o
            .replace(/\*/g, '')
            .replace(/<span[^>]*>\s*\*\s*<\/span>/gi, '')
            .trim()
        : o.trim(),
      d = l ? `${i} *` : i,
      p = document.createElement('a')
    ;(p.href = t),
      (p.title = `${s.replace('*', '').trim()} ${r} (${n}) ${i}`),
      (p.className = `position_${i.toLowerCase()} player-lineup-link`),
      (p.innerHTML = `${r}, ${c} ${n} ${d}`)
    const u = e.closest('td')
    return 'hasinput' === u?.dataset.type && u.removeAttribute('data-type'), p
  }
  function createSubTable (e, t) {
    const {
        outerDataType: a,
        tableClass: r,
        theadRowClass: o,
        th: n,
        innerDataType: i,
        innerClass: s,
        innerRowClass: l,
        tdCells: c,
        selectCallback: d
      } = t,
      p = n.parentElement,
      u = document.createElement('tbody')
    u.dataset.type = a
    const m = document.createElement('table')
    ;(m.className = r), (m.style.cssText = 'width:100%;border-spacing:0;')
    const f = document.createElement('thead'),
      h = document.createElement('tr')
    if (
      ((h.className = o),
      n.setAttribute('colspan', '100'),
      h.appendChild(n),
      f.appendChild(h),
      m.appendChild(f),
      void 0 !== i)
    ) {
      const e = document.createElement('tbody')
      ;(e.dataset.type = i), s && e.classList.add(s)
      const t = document.createElement('tr')
      ;(t.className = l || ''),
        c?.forEach(e => t.appendChild(e)),
        d?.(t),
        e.appendChild(t),
        m.appendChild(e)
    }
    u.appendChild(m), e.appendChild(u), p?.remove()
  }
  function lu_load_script () {
    if (
      document.querySelector(
        '#lineup form[action="lineup"][name="SELECT_FRANCHISE"]'
      )
    )
      return void Me.remove()
    const e = Object.entries(Qe).reduce(
        (e, [t, a]) => (!0 === a.usePosition && (e[t.toLowerCase()] = a), e),
        {}
      ),
      t = document.createElement('style')
    ;(t.id = 'starterCSS'),
      (t.textContent =
        '.starter_count_sub,h3,.reportform,form[action*="lineup"],.mobile-wrap,.weekly-navbar-mobile,.weekly-navbar,.reportnavigation {visibility:hidden}'),
      document.head.appendChild(t),
      setTimeout(() => {
        document.getElementById('starterCSS') && redirectSubmissionPage_v3(!0)
      }, 5e3)
    const a = document.querySelector(
      '#lineup form[action*="lineup"] table.report'
    )
    if (a) {
      document
        .getElementById('body_lineup')
        .classList.add('custom_lineup_body'),
        document
          .querySelectorAll(
            '#body_lineup .franchiselogo, #body_lineup form[action*="lineup"] table caption span a'
          )
          .forEach(e => e.remove()),
        document.querySelectorAll('#lineup .reportnavigation').forEach(e => {
          e.querySelector('b') && e.remove()
        })
      const o = [...a.querySelectorAll('tr')],
        n = {},
        i = [],
        s = {},
        l = {}
      let c,
        d,
        p = null,
        u = 0
      for (const C in e) l[C] = 0
      xe && ((c = ['dt+de', 'dt', 'de', 'lb', 'cb+s', 'cb', 's']), (d = 0)),
        o.forEach((t, r) => {
          let o = t.querySelector('a[class*="position_"]')
          if (o) {
            if (
              (o.closest('td')?.classList.add('player'),
              o.querySelector('.playerImgTable'))
            ) {
              const e =
                o.querySelector('img.playerPhoto')?.getAttribute('src') || ''
              e && (t.dataset.playerPhoto = e)
              const a = rebuildPositionLink(o)
              a && o.replaceWith(a)
            }
            o = t.querySelector('td.player a[class*="position_"]')
          }
          t.classList.remove('oddtablerow', 'eventablerow', 'newposition'),
            0 === r &&
              t.querySelectorAll('th').forEach((e, t) => {
                let a = e.textContent.toLowerCase().replace(/ /g, '-')
                'rush' === a || 'pass' === a
                  ? (a += '-rank')
                  : 'opp-avgvs-pos' === a
                  ? (a = 'pass-rank')
                  : 'opp-rankvs-pos' === a
                  ? (a = 'rush-rank')
                  : a.includes('select-a')
                  ? (a = 'select-total-starters')
                  : a.includes('week-') && (a = 'weekly-opp'),
                  e.classList.add(a),
                  i.push(a)
              })
          const l = t.querySelector('input[type="checkbox"]')
          if (t.querySelector('td.player')) {
            if (!l) return
            l.style.display = 'none'
            const a = getPositionCodeFromAnchor(o)
            if (!a) return
            let r = null
            for (const t in e)
              if (t.split('+').includes(a.toLowerCase())) {
                r = t
                break
              }
            r &&
              (void 0 === s[r] &&
                (s[r] = {
                  lockedStarters: [],
                  currentStarters: [],
                  currentBench: [],
                  lockedBench: []
                }),
              l.checked && l.disabled
                ? (t.classList.add(
                    'locked_starter',
                    'player_row',
                    'previous_starter'
                  ),
                  (t.title = 'Game Has Started - Player Locked'),
                  s[r].lockedStarters.push(t))
                : l.checked
                ? (t.classList.add(
                    'current_starters_row',
                    'previous_starter',
                    'player_row'
                  ),
                  (t.title = 'Move To Bench'),
                  s[r].currentStarters.push(t))
                : l.disabled || l.checked
                ? l.disabled &&
                  !l.checked &&
                  (t.classList.add('locked_bench', 'player_row'),
                  (t.title = 'Game Has Started - Player Locked'),
                  s[r].lockedBench.push(t))
                : (t.classList.add('current_bench_row', 'player_row'),
                  (t.title = 'Move To Starting Lineup'),
                  s[r].currentBench.push(t)),
              l.checked &&
                (updateCheckedCount_v3(r, !0), u++, xe && c.includes(r) && d++),
              t.addEventListener('click', e => {
                ;(e.target.closest('.weekly-opp') &&
                  'A' === e.target.tagName) ||
                  e.target.closest('.player') ||
                  l.disabled ||
                  ((l.checked = !l.checked),
                  t.classList.contains('current_starters_row')
                    ? (moveRowBetweenGroups_v3(
                        t,
                        'currentStarters',
                        'currentBench',
                        r
                      ),
                      (t.title = 'Move To Starting Lineup'),
                      t.classList.replace(
                        'current_starters_row',
                        'current_bench_row'
                      ))
                    : t.classList.contains('current_bench_row') &&
                      (moveRowBetweenGroups_v3(
                        t,
                        'currentBench',
                        'currentStarters',
                        r
                      ),
                      (t.title = 'Move To Bench'),
                      t.classList.replace(
                        'current_bench_row',
                        'current_starters_row'
                      )),
                  updateCheckedCount_v3(r, l.checked),
                  (u += l.checked ? 1 : -1),
                  xe && c.includes(r) && (d += l.checked ? 1 : -1),
                  (function resortRows_v3 (e) {
                    const {
                        lockedStarters: t,
                        currentStarters: a,
                        currentBench: r,
                        lockedBench: o
                      } = s[e],
                      i = n[e]
                    ;(i.innerHTML = ''),
                      [...t, ...a, ...r, ...o].forEach((e, t) => {
                        e.classList.remove('oddtablerow', 'eventablerow'),
                          e.classList.add(
                            t % 2 == 0 ? 'oddtablerow' : 'eventablerow'
                          ),
                          i.appendChild(e)
                      })
                  })(r),
                  Te && (Ne && checkForMatches_v3(), updateStarterCounts_v3()))
              })),
              t.querySelectorAll(':scope > td').forEach((e, a) => {
                if (
                  (i[a + 1] && e.classList.add(i[a + 1]),
                  (e.classList.contains('inj') &&
                    (!e.innerHTML.trim() || '&nbsp;' === e.innerHTML.trim())) ||
                    e.classList.contains('nfl-news') ||
                    e.classList.contains('pass-rank'))
                )
                  e.remove()
                else {
                  if (
                    (e.classList.contains('pos-rank') &&
                      !e.textContent.trim() &&
                      (e.textContent = 'N/A'),
                    e.textContent.trim() || (e.textContent = '-'),
                    e.classList.contains('weekly-opp') &&
                      e.textContent.includes('Weather'))
                  ) {
                    let t
                    if (e.textContent.includes('@'))
                      t = e.textContent.substr(1, 3)
                    else {
                      const a = e.closest('tr').querySelector('td.player a'),
                        r = a?.textContent.split(' ') || []
                      t = r[r.length - 2]
                    }
                    const a = e.querySelector('a')
                    if (a) {
                      const e = a.getAttribute('href')
                      a.setAttribute(
                        'onclick',
                        `lu_v3_weatherPopup("${t}","${e}")`
                      ),
                        (a.title = 'View Weather'),
                        a.removeAttribute('target'),
                        a.removeAttribute('href')
                    }
                  }
                  if (e.classList.contains('player')) {
                    const a = e.querySelector('a')
                    if (!a) return
                    const r = a.getAttribute('href') || ''
                    let o = ''
                    if (r.includes('launch_player_modal')) {
                      o = (r.split(',')[1] || '')
                        .replace(/'/g, '')
                        .replace(');', '')
                        .trim()
                    } else
                      o =
                        new URLSearchParams(r.split('?')[1] || '').get('P') ||
                        ''
                    const n = a.textContent.trim().split(' '),
                      i = n[n.length - 1] || '',
                      s = n[n.length - 2] || '',
                      l = t.dataset.playerPhoto || '',
                      c =
                        l ||
                        (Ye[i]
                          ? `https://www.mflscripts.com/playerImages_96x96/mfl_${s}.svg`
                          : `https://www.mflscripts.com/playerImages_96x96/mfl_${o}.png`),
                      d = document.createElement('td')
                    d.classList.add('pphoto')
                    const p = document.createElement('img')
                    p.classList.add('headshot'),
                      (p.src = c),
                      p.addEventListener('error', () => {
                        p.src =
                          'https://www.mflscripts.com/playerImages_96x96/free_agent.png'
                      }),
                      d.appendChild(p),
                      e.parentNode.insertBefore(d, e),
                      e.parentNode.setAttribute('data-value', o)
                  }
                  if (
                    ((e.classList.contains('ytd-pts') ||
                      e.classList.contains('rush-rank')) &&
                      e.querySelector('a') &&
                      (e.textContent = e.querySelector('a').textContent),
                    t.classList.contains('player_row'))
                  ) {
                    const t = e.querySelector('a')
                    t && !t.textContent.trim() && t.remove(),
                      e.textContent.trim() || (e.textContent = '0')
                  }
                  e.classList.contains('weekly-opp') &&
                    e.querySelector('b.warning')?.textContent.includes('N/A') &&
                    e.querySelector('b.warning').classList.add('no_content'),
                    e.classList.contains('rush-rank') &&
                      e.textContent.includes('-') &&
                      e.classList.add('no_ranking')
                }
              })
            const ensureCell = (e, a = '0') => {
              if (!t.querySelector(`td.${e}`)) {
                const r = document.createElement('td')
                r.classList.add(e), (r.textContent = a), t.appendChild(r)
              }
            }
            if (
              (ensureCell('ytd-pts'),
              ensureCell('rush-rank'),
              ensureCell('avg-pts'),
              ensureCell('proj-pts'),
              !t.querySelector('.points_row'))
            ) {
              const e = t.querySelector('td.proj-pts')?.innerHTML || '0',
                a = t.querySelector('td.ytd-pts')?.innerHTML || '0',
                r = t.querySelector('td.avg-pts')?.innerHTML || '0',
                o = document.createElement('span')
              o.classList.add('points_row')
              const mk = (e, t, a) => {
                const r = document.createElement('span')
                return (
                  r.classList.add(e),
                  (r.innerHTML = `${t}:<span>${a}</span>`),
                  r
                )
              }
              o.appendChild(mk('avg-pts', 'Avg', r)),
                o.appendChild(mk('ytd-pts', 'YTD', a)),
                o.appendChild(mk('proj-pts', 'Proj', e)),
                t.appendChild(o)
            }
          }
          t.querySelectorAll('th').forEach(e => {
            const t = e.textContent.trim()
            if (
              !(
                t.includes('Select') ||
                t.includes('Optional') ||
                t.includes('Tiebreaker') ||
                t.includes('Backup')
              )
            )
              return void e.remove()
            if (t.includes('Select') && t.includes('Tie-Breaker')) {
              Ce = !0
              const e = t.match(/Select (\d+)/)
              if (
                ((Be = e ? parseInt(e[1], 10) : null),
                (Ae = Be > 1),
                t.includes('Non-Starter') && (Ne = !0),
                !t.includes('Player'))
              ) {
                De = !0
                const e = t.match(/Tie-Breaker (\w+)/)
                let a = e ? e[1].toLowerCase() : null
                Ae && a?.endsWith('s') && (a = a.slice(0, -1)), (Ee = a)
              }
            }
            if (t.includes('Select A Total Of')) {
              const t = e.parentElement
              e.classList.add('select-total-starters', 'starters_count_th')
              const r = document.createElement('tbody')
              r.dataset.type = 'startersCount'
              const o = document.createElement('table')
              ;(o.className = 'starters-table'),
                (o.style.cssText = 'width:100%;border-spacing:0;')
              const n = document.createElement('thead'),
                i = document.createElement('tr')
              i.classList.add('starters_count_row'),
                e.setAttribute('colspan', '100'),
                i.appendChild(e),
                n.appendChild(i),
                o.appendChild(n),
                r.appendChild(o),
                a.appendChild(r),
                t.remove()
            }
            if (
              (t.includes('Tiebreaker') &&
                Ce &&
                (e.classList.add('PrevTiebreaker_th'),
                createSubTable(a, {
                  outerDataType: 'PrevTiebreaker',
                  tableClass: 'PrevTiebreaker-table',
                  theadRowClass: 'PrevTiebreaker_row',
                  th: e,
                  innerDataType: 'PrevTiebreaker',
                  innerClass: 'PrevTiebreaker-tbody',
                  innerRowClass: 'oddtablerow PrevTiebreaker_row',
                  tdCells: [...e.parentElement.querySelectorAll('td')]
                })),
              t.includes('Tie-Breaker') && Ce)
            ) {
              e.classList.add('tiebreaker_th')
              const t = [...e.parentElement.querySelectorAll('td')]
              createSubTable(a, {
                outerDataType: 'tiesBody',
                tableClass: 'tieBreak-table',
                theadRowClass: 'tieBrea_row',
                th: e,
                innerDataType: 'tiebreakers',
                innerClass: 'tiebreakers-tbody',
                innerRowClass: 'oddtablerow tie_breakers_row',
                tdCells: t,
                selectCallback: e => {
                  e.querySelectorAll('select').forEach(e => {
                    ;[...e.options].forEach(e => {
                      e.value &&
                        e.selected &&
                        e.classList.add('selected-option')
                    })
                  })
                }
              })
            }
            t.includes('Select') &&
              t.includes('Backup') &&
              t.includes('Player') &&
              (e.classList.add('PrevTiebreaker_th'),
              createSubTable(a, {
                outerDataType: 'PrevTiebreaker',
                tableClass: 'PrevTiebreaker-table',
                theadRowClass: 'PrevTiebreaker_row',
                th: e,
                innerDataType: 'PrevTiebreaker',
                innerClass: 'PrevTiebreaker-tbody',
                innerRowClass: 'oddtablerow PrevTiebreaker_row',
                tdCells: [...e.parentElement.querySelectorAll('td')]
              }))
            const r = t.match(/Select (\d+)-?(\d*) ([\w+]+):/)
            if (r) {
              const t = r[3].toLowerCase(),
                o = document.createElement('tbody')
              o.dataset.type = t
              const i = document.createElement('table')
              ;(i.className = 'position-table'),
                (i.style.cssText = 'width:100%;border-spacing:0;')
              const s = document.createElement('thead'),
                l = document.createElement('tr')
              ;(l.className = `starters_pos_row player_head_row player_${t}`),
                e.setAttribute('colspan', '100%'),
                e.classList.add('starters_pos_th'),
                l.appendChild(e),
                s.appendChild(l),
                i.appendChild(s)
              const c = document.createElement('tbody')
              ;(c.dataset.type = 'positions'),
                i.appendChild(c),
                o.appendChild(i),
                (n[t] = c),
                a.appendChild(o),
                (p = t)
            }
            t.includes('Optional') &&
              (hideOptionalMsgV3
                ? e.parentElement.remove()
                : (e.classList.add('message_th'),
                  createSubTable(a, {
                    outerDataType: 'optionalMsg',
                    tableClass: 'optionMsg-table',
                    theadRowClass: 'message_row',
                    th: e,
                    innerDataType: 'messages',
                    innerClass: 'MSGinner-tbody',
                    innerRowClass: 'oddtablerow',
                    tdCells: [...e.parentElement.querySelectorAll('td')]
                  }))),
              a
                .querySelectorAll('tbody:not([data-type])')
                .forEach(e => e.remove())
          })
        })
      for (const B in s) {
        if (!n[B]) continue
        const {
          lockedStarters: A,
          currentStarters: D,
          currentBench: E,
          lockedBench: N
        } = s[B]
        ;[...A, ...D, ...E, ...N].forEach((e, t) => {
          e.classList.add(t % 2 == 0 ? 'oddtablerow' : 'eventablerow'),
            n[B].appendChild(e)
        })
      }
      const m = document.querySelectorAll('.player_row'),
        f = document.querySelectorAll('.tie_breakers_row select'),
        h = document.querySelectorAll(
          "input[value='Submit Lineup'], input[value='Submit Partial Lineup']"
        ),
        y = document.querySelector('.tie_breakers_row select'),
        _ = document.querySelectorAll('.tie_breakers_row input[type="hidden"]'),
        g = document.querySelector('.tiebreaker_th')
      let b = 0,
        w = ''
      Ce &&
        f.length &&
        m.forEach(e => {
          const t = e.getAttribute('data-value')
          ;(e.classList.contains('locked_bench') ||
            e.classList.contains('locked_starter') ||
            e.classList.contains('locked_bench_game_over') ||
            e.classList.contains('locked_starter_game_over')) &&
            f.forEach(e => {
              ;[...e.options].forEach(e => {
                e.value !== t || e.selected || e.remove()
              })
            })
        }),
        (y || _.length > 0) &&
          Ce &&
          (calculateSelectedCount_v3(),
          y?.addEventListener('change', () => {
            Ne ? checkForMatches_v3() : calculateSelectedCount_v3(),
              updateStarterCounts_v3()
          })),
        document.querySelectorAll('.reportnavigation a').forEach(e => {
          if (!e.textContent.includes('Fantasy')) return
          const t = e.parentElement
          t.classList.add('links_nav')
          const a = document.createElement('span')
          ;(a.className = 'thisSpan'), t.appendChild(a), a.appendChild(e)
        }),
        document
          .querySelectorAll('#lineup table.report.nocaption')
          .forEach(e => {
            if (!e.parentElement?.closest('table.report.nocaption'))
              if (e.querySelector('a[href*="O=18"]')) {
                if (!e.querySelector(':scope > caption')) {
                  const t = document.createElement('caption')
                  ;(t.innerHTML = '<span>Injured Reserve</span>'), e.prepend(t)
                }
              } else (e.closest('.mobile-wrap') || e).remove()
          })
      const k = a.querySelector('caption'),
        makeIconBtn = (e, t, a) => {
          const r = document.createElement('div')
          return (
            (r.id = e),
            (r.title = t),
            (r.style.cssText =
              'padding:0;text-indent:0;display:inline;cursor:pointer'),
            (r.innerHTML = `<i class="${a}" aria-hidden="true"></i>`),
            r
          )
        },
        L = document.createElement('div')
      if (
        ((L.className = 'lineup_filter'),
        (L.style.cssText = 'float:right;font-size:1.375rem;'),
        L.appendChild(
          makeIconBtn(
            'LineupReset',
            'Reset Starting Lineup',
            'fa-regular fa-arrows-rotate'
          )
        ),
        L.appendChild(
          makeIconBtn(
            'LineupClear',
            'Clear Starting Lineup',
            'fa-regular fa-eraser'
          )
        ),
        k.appendChild(L),
        '0000' !== franchise_id)
      ) {
        const I = document.querySelector(
            '#lineup form[action*="lineup"] input[name="WEEK"]'
          ),
          R = I?.value
        if (R && completedWeek >= R) {
          const O = document.getElementById('body_lineup')
          O.classList.add('week_over'),
            O.querySelectorAll('.current_starters_row').forEach(e =>
              e.classList.add('locked_starter_game_over')
            ),
            O.querySelectorAll('.current_bench_row').forEach(e =>
              e.classList.add('locked_bench_game_over')
            ),
            O.querySelectorAll('.player_row').forEach(e =>
              e.setAttribute('title', 'Game Over')
            )
          const W = document.createElement('style')
          ;(W.textContent =
            ".custom_lineup_body.week_over tr.locked_starter_game_over,.custom_lineup_body.week_over tr.locked_bench_game_over{pointer-events:none}.custom_lineup_body.week_over tr.locked_starter_game_over::after,.custom_lineup_body.week_over tr.locked_bench_game_over::after{content:'\\f30d'!important}.custom_lineup_body.week_over .lineup_filter,.custom_lineup_body.week_over input[type='submit']{pointer-events:none}.custom_lineup_body.week_over input[type='submit'],.custom_lineup_body.week_over .form_buttons::before{opacity:.5}.custom_lineup_body.week_over .starter_count,.custom_lineup_body.week_over .starter_count_sub{display:none!important}.custom_lineup_body.week_over tr.locked_starter_game_over td.player,.custom_lineup_body.week_over tr.locked_bench_game_over td.player{pointer-events:all}"),
            document.head.appendChild(W)
        }
      }
      const P = document.querySelector('#lineup form[action*="lineup"]')
      P.insertAdjacentHTML(
        'beforeend',
        '<p class="form_buttons default-btn"><input type="button" value="Use Default Submission Form" onclick="redirectSubmissionPage_v3(true)"></p>'
      )
      const S = document.querySelector('.reportnavigation.links_nav')
      if (S) {
        const j = S.querySelectorAll('.thisSpan')
        ;(S.innerHTML = `${j[0].innerHTML}<br>${j[1]?.innerHTML || ''}`),
          P.parentElement.insertAdjacentElement('beforebegin', S)
      }
      const M = document.createElement('div')
      M.classList.add('starter_count_sub'), (M.style.display = 'none')
      let F =
        '<div class="lineup_filter" style="float:right;font-size:1.375rem;"><div style="padding:0;text-indent:0;display:inline;margin-right:0.625rem;cursor:pointer" id="LineupReset" title="Reset Starting Lineup"><i class="fa-regular fa-arrows-rotate" aria-hidden="true"></i></div><div style="padding:0;text-indent:0;display:inline;cursor:pointer" id="LineupClear" title="Clear Starting Lineup"><i class="fa-regular fa-eraser" aria-hidden="true"></i></div></div><span class="starter_count_total_sub"></span>'
      function checkForMatches_v3 () {
        ;(Oe = []), (Ie = !1)
        const e = [...document.querySelectorAll('tr.current_starters_row')].map(
            e => e.getAttribute('data-value')
          ),
          t = [...document.querySelectorAll('select option')]
            .filter(e => e.selected)
            .map(e => e.value)
        let a = !1
        e.forEach(e => {
          t.includes(e) &&
            !a &&
            (Oe.push(
              'You have a starter selected as tie-breaker. Not allowed!'
            ),
            (Ie = !0),
            (a = !0))
        }),
          calculateSelectedCount_v3()
      }
      function addWarningMessage_v3 (e, t, a) {
        const r = document.createElement('span')
        r.classList.add('warning', t), (r.textContent = a), e.appendChild(r)
      }
      function updateStarterCounts_v3 () {
        Re = []
        const t = new Set()
        let a = 0
        He &&
          (function checkFormations_v3 () {
            const e = Ue.find(e => e.POSITIONS),
              t = e.POSITIONS.split('+').map(e => e.toLowerCase()),
              a = Object.fromEntries(t.map(e => [e, 0]))
            if (
              (document
                .querySelectorAll(
                  `#lineup form[action*="lineup"] table.report tbody[data-type="${e.POSITIONS.toLowerCase()}"] tr`
                )
                .forEach(e => {
                  if (
                    e.classList.contains('locked_starter') ||
                    e.classList.contains('current_starters_row')
                  ) {
                    const t = getPositionCodeFromAnchor(
                      e.querySelector('a[class*="position_"]')
                    )
                    t && t in a && a[t]++
                  }
                }),
              Ue.slice(1).some(e =>
                Object.keys(e).every(t => e[t] === a[t.toLowerCase()])
              ))
            )
              w = ''
            else if (lu_validateLineUpV3) {
              const e = Ue.slice(1).map(e =>
                Object.entries(e)
                  .map(([e, t]) => `${t} ${e}`)
                  .join(' + ')
              )
              Re.push(
                `Invalid Formation of ${Object.keys(a)
                  .map(e => e.toUpperCase())
                  .join(' + ')}<br>Valid formations are:<br>${e.join('<br>')}`
              ),
                (w = Object.keys(a).join('+'))
            } else w = ''
          })(),
          document.querySelectorAll('.starters_pos_row').forEach(r => {
            const o = [...r.classList].find(
              e => e.startsWith('player_') && 'player_head_row' !== e
            )
            if (!o) return
            const n = o.replace('player_', '').toLowerCase()
            t.add(n)
            const i = l[n] ?? 0,
              s = e[n] ?? { min: 0, max: 0 }
            qe && ze.has(n) && (a += i)
            const c = r.querySelector('.starters_pos_th')
            c.querySelectorAll('.starter_count').forEach(e => e.remove())
            const d = document.createElement('span')
            d.classList.add('starter_count', `starter_count_${n}`),
              (d.textContent = `(${i} Selected)`)
            let p = null,
              u = ''
            if (
              ('' !== w && n === w && !We && lu_validateLineUpV3
                ? ((p = ' !Invalid Formation'), (u = 'warning_minimum_error'))
                : i < s.min && !We && lu_validateLineUpV3
                ? (Re.push(
                    `Min ${s.min} ${n.toUpperCase()} Required (${i} selected)`
                  ),
                  (p = ' !Minimum Not Satisfied'),
                  (u = 'warning_minimum_error'))
                : i > s.max &&
                  !We &&
                  lu_validateLineUpV3 &&
                  (Re.push(
                    `Max ${s.max} ${n.toUpperCase()} Required (${i} selected)`
                  ),
                  (p = ' !Too Many'),
                  (u = 'warning_maximum_error')),
              p)
            ) {
              const e = document.createElement('span')
              e.classList.add('warning', u),
                (e.textContent = p),
                d.appendChild(e)
            }
            c.appendChild(d)
          }),
          qe &&
            lu_validateLineUpV3 &&
            Number(a) !== Number(Ge) &&
            Re.push(
              `Total starters for QB, RB, WR, TE must be exactly ${Ge}. Currently selected: ${a}`
            )
        for (const a in e)
          if (!t.has(a)) {
            const t = e[a]
            t.min > 0 &&
              lu_validateLineUpV3 &&
              Re.push(
                `League Requires a ${a.toUpperCase()}. Min-${t.min}, Max-${
                  t.max
                }`
              )
          }
        const r = Qe.total.max,
          o = document.querySelector('.select-total-starters')
        if (o) {
          o.querySelectorAll('.starter_count_total_wrapper').forEach(e =>
            e.remove()
          )
          const e = document.createElement('span')
          e.classList.add('starter_count_total_wrapper')
          const t = document.createElement('span')
          if (
            (t.classList.add('starter_count_total'),
            (t.textContent = `${u}/${r}`),
            e.appendChild(t),
            (document.querySelector(
              '.starter_count_total_sub'
            ).textContent = `Starters: ${u}/${r}`),
            xe)
          ) {
            const t = Qe.idptotal.max,
              a = document.createElement('span')
            a.classList.add('starter_count_total_idp'),
              (a.textContent = `${d}/${t}`),
              e.appendChild(a)
            const r = document.querySelector('.starter_count_total_idp_sub')
            r && (r.textContent = `IDP: ${d}/${t}`)
          }
          u < Qe.total.min &&
            lu_validateLineUpV3 &&
            Re.push(`Min ${Qe.total.min} Starters Required (${u} selected)`),
            u > r &&
              lu_validateLineUpV3 &&
              Re.push(`Max ${r} Starters Required (${u} selected)`),
            o.appendChild(e)
        }
        const n = Re.length > 0 || $e.length > 0 || Oe.length > 0
        We
          ? h.forEach(e => {
              e.value = n ? 'Submit Lineup' : 'Submit Partial Lineup'
            })
          : h.forEach(e => {
              '0000' !== franchise_id &&
                e.parentElement.classList.toggle('buttonDisabledContainer', n)
            })
        const i = document.querySelector('.starter_count_sub'),
          s = document.querySelector('.starter_count_reason_sub'),
          c = document.querySelector('.starter_count_reason_content'),
          p = document.querySelector('.starter_count_reason_more'),
          m = document.querySelector('.starter_count_reason_less')
        if (
          (We
            ? (s.style.display = 'none')
            : i.classList.toggle(
                'starter_count_sub_fail',
                n && lu_validateLineUpV3
              ),
          c &&
            lu_validateLineUpV3 &&
            (c.innerHTML = [...Re, ...$e, ...Oe].join('<br>')),
          n && lu_validateLineUpV3)
        ) {
          const e = 'block' === c.style.display
          ;(p.style.display = e ? 'none' : 'block'),
            (m.style.display = e ? 'block' : 'none')
        } else (p.style.display = 'none'), (m.style.display = 'none')
      }
      function calculateSelectedCount_v3 () {
        const e = y ? [...y.options].filter(e => e.selected).length : 0
        ;(b = e + (_?.length || 0)),
          (function updateStarterCountAndWarning_v3 (e) {
            if ((($e = []), !g)) return
            let t = g.querySelector('.starter_count_tieBreaker')
            t ||
              ((t = document.createElement('span')),
              t.classList.add('starter_count', 'starter_count_tieBreaker'),
              g.appendChild(t)),
              (t.innerHTML = ` (${e} Selected)`),
              t.querySelector('.warning')?.remove(),
              e > Be
                ? (addWarningMessage_v3(
                    t,
                    'warning_maximum_error',
                    Ie ? ' !Starter Selected As Tie-Breaker' : ' !Too Many'
                  ),
                  $e.push(
                    `Must Select ${Be} Tiebreak Players. (${e} selected)`
                  ))
                : e < Be
                ? (addWarningMessage_v3(
                    t,
                    'warning_minimum_error',
                    Ie
                      ? ' !Starter Selected As Tie-Breaker'
                      : ' !Minimum Not Satisfied'
                  ),
                  $e.push(
                    `Must Select ${Be} Tiebreak Players. (${e} selected)`
                  ))
                : e === Be &&
                  Ie &&
                  addWarningMessage_v3(
                    t,
                    'warning_minimum_error',
                    ' !Starter Selected As Tie-Breaker'
                  )
          })(b)
      }
      function moveRowBetweenGroups_v3 (e, t, a, r) {
        ;(s[r][t] = s[r][t].filter(t => t !== e)),
          'currentBench' === a ? s[r][a].unshift(e) : s[r][a].push(e)
      }
      function updateCheckedCount_v3 (e, t) {
        const a = e.toLowerCase()
        l[a] = (l[a] || 0) + (t ? 1 : -1)
      }
      xe && (F += '<span class="starter_count_total_idp_sub"></span>'),
        (F +=
          "<div class=\"starter_count_reason_sub\"><div style=\"display:none\" class=\"starter_count_reason_more\" onclick=\"document.querySelector('.starter_count_reason_more').style.display='none';document.querySelector('.starter_count_reason_content').style.display='block';document.querySelector('.starter_count_reason_less').style.display='block';\">more</div><div class=\"starter_count_reason_less\" style=\"display:none\" onclick=\"document.querySelector('.starter_count_reason_more').style.display='block';document.querySelector('.starter_count_reason_content').style.display='none';document.querySelector('.starter_count_reason_less').style.display='none';\">less</div><div class=\"starter_count_reason_content\" style=\"display:none\"></div></div>"),
        (M.innerHTML = F),
        P.parentNode.insertBefore(M, P),
        document.querySelectorAll('#LineupClear').forEach(e => {
          e.addEventListener('click', () => {
            ;(Te = !1),
              o.forEach(e => {
                e.classList.contains('current_starters_row') &&
                  !e.classList.contains('locked_starter') &&
                  e.click()
              })
            const e = document.querySelectorAll('.tie_breakers_row select')
            let t = !1
            e.forEach(e => {
              ;[...e.options].forEach(e => {
                e.value && e.selected && ((e.selected = !1), (t = !0))
              })
            }),
              t && e[0]
                ? e[0].dispatchEvent(new Event('change'))
                : updateStarterCounts_v3(),
              (Te = !0)
          }),
            Me.remove()
        }),
        document.querySelectorAll('#LineupReset').forEach(e => {
          e.addEventListener('click', () => {
            ;(Te = !1),
              o.forEach(e => {
                const t = e.classList.contains('previous_starter'),
                  a = e.classList.contains('current_starters_row')
                ;((t && !a) || (!t && a)) && e.click()
              })
            const e = document.querySelectorAll('.tie_breakers_row select')
            let t = !1
            e.forEach(e => {
              e.querySelectorAll('option').forEach(e => (e.selected = !1)),
                e.querySelectorAll('option.selected-option').forEach(e => {
                  ;(e.selected = !0), (t = !0)
                }),
                e.querySelectorAll('option.selected-option').length &&
                  e.dispatchEvent(new Event('change'))
            }),
              t || updateStarterCounts_v3(),
              (Te = !0)
          })
        })
      const x = document.querySelector('.starters_count_row'),
        T = document.querySelector('.starter_count_sub')
      if (x && T) {
        new IntersectionObserver(
          ([e]) => {
            e.isIntersecting
              ? ((T.style.opacity = '0'),
                setTimeout(() => (T.style.display = 'none'), 500))
              : ((T.style.display = 'block'),
                (T.style.opacity = '1'),
                (T.style.transition = 'opacity 0.5s'))
          },
          { threshold: 0 }
        ).observe(x)
      }
      updateStarterCounts_v3()
    } else {
      document
        .getElementById('body_lineup')
        .classList.add('custom_lineup_submission_body'),
        document
          .querySelectorAll('#body_lineup table caption span a')
          .forEach(e => e.remove())
      const H = document.querySelector('.custom_lineup_submission_body')
      H.querySelectorAll('table.report tr').forEach(e => {
        e.querySelector('th') && e.prepend(document.createElement('th'))
      }),
        H.querySelectorAll('table.report tr td.salary').forEach(e =>
          e.remove()
        ),
        H.querySelectorAll('table.report tr td[colspan="2"]').forEach(e =>
          e.setAttribute('colspan', '3')
        ),
        H.querySelectorAll('table.report tr').forEach(e => {
          e.querySelector('td.player') && e.classList.add('playerRow')
        }),
        H.querySelectorAll('table.report tr.playerRow').forEach(e => {
          const t = e.querySelector('td.player')
          if (!t) return
          let a = t.nextElementSibling
          if (!a) return
          if (
            (a.classList.contains('salary') && (a = a.nextElementSibling), !a)
          )
            return
          const r = document.createElement('span')
          r.classList.add('opponent'),
            (r.innerHTML = a.innerHTML),
            t.appendChild(r),
            a.remove()
        }),
        H.querySelectorAll('table.report tr').forEach(e => {
          const t = [...e.children][2]
          t && !t.closest('.playerImgTable') && t.remove()
        }),
        H.querySelectorAll('table.report span.opponent').forEach(e => {
          e.textContent.includes('Bye') && e.classList.add('byeWeek')
        }),
        H.querySelectorAll('tr').forEach(e => {
          e.querySelector('td') &&
            e.textContent.includes('players') &&
            !e.classList.contains('playerRow') &&
            e.classList.add('starter_totalsRow')
        }),
        H.querySelectorAll('tr.starter_totalsRow td').forEach(e => {
          e.classList.remove('starters'), e.setAttribute('colspan', '3')
        }),
        H.querySelectorAll('tr.starter_totalsRow td:last-child').forEach(e =>
          e.remove()
        ),
        H.querySelectorAll('table td.player').forEach(e => {
          let t = e.querySelector('a')
          if (!t) return
          let a = null
          if (t.querySelector('.playerImgTable')) {
            const r =
              t.querySelector('img.playerPhoto')?.getAttribute('src') || ''
            r && e.closest('tr')?.setAttribute('data-player-photo', r)
            const o = t.querySelector('.playerFirstName span.warning')
            o &&
              ((o.textContent = o.textContent.replace(/[()]/g, '').trim()),
              (a = o),
              a.remove())
            const n = rebuildPositionLink(t)
            if ((n && t.replaceWith(n), (t = e.querySelector('a')), !t)) return
          }
          const r = t.getAttribute('href') || ''
          let o
          o = r.includes('launch_player_modal')
            ? (r.split(',')[1] || '').replace(/'/g, '').replace(');', '')
            : r.substring(r.indexOf('P=') + 2)
          const n = t.textContent.trim().split(/\s+/),
            i = n[n.length - 1],
            s = n[n.length - 2],
            l = e.closest('tr')?.getAttribute('data-player-photo') || '',
            c =
              l ||
              (Ye[i]
                ? `https://www.mflscripts.com/playerImages_96x96/mfl_${s}.svg`
                : `https://www.mflscripts.com/playerImages_96x96/mfl_${o}.png`),
            d = e.parentNode
          let p =
            d.querySelector('td.pphoto') ||
            (() => {
              const t = document.createElement('td')
              return t.classList.add('pphoto'), d.insertBefore(t, e), t
            })()
          p.textContent = ''
          const u = document.createElement('img')
          u.classList.add('headshot'),
            (u.src = c),
            u.addEventListener('error', () => {
              u.src =
                'https://www.mflscripts.com/playerImages_96x96/free_agent.png'
            }),
            p.appendChild(u),
            a && (a.classList.add('moved-warning'), p.appendChild(a))
        })
    }
    const r = document.createElement('style')
    ;(r.textContent =
      '#body_lineup.custom_lineup_submission_body .moved-warning{font-size:0.625rem;font-weight:400;border-radius:50%;width:1rem;height:1rem;line-height:1rem;display:block;position:absolute;z-index:2;color:#fff;background:red;text-align:center;bottom:0.5em;right:0.2em}#body_lineup.custom_lineup_submission_body td.pphoto{position:relative}.custom_lineup_body form table + div,.custom_lineup_body form table ~ .reportnavigation,.custom_lineup_body form table ~ .alert,.team_lineup_table form table ~ span.reportnavigation{display:none;}#body_lineup.custom_lineup_body form span.points_row .avg-pts,#body_lineup.custom_lineup_body form span.points_row .ytd-pts,#body_lineup.custom_lineup_body form span.points_row .proj-pts {display:none;}#body_lineup.custom_lineup_body .franchiselogo {display:none !important;}#body_lineup.custom_lineup_body form table caption span a {display:none;}#body_lineup.custom_lineup_body form textarea[name*="MESSAGE"] {width:100%;}#body_lineup.custom_lineup_body table td.pphoto {text-align:center !important;border-radius:50%;width:3.438rem;height:90%;position:absolute;left:0.188rem;top:50%;transform:translateY(-50%);}#body_lineup.custom_lineup_body tr.previous_starter td.pphoto:before {content:"\\f05d";font-family:"Font Awesome 6 Pro";position:absolute;top:0;z-index:1;font-size:1rem;left:0;cursor:default;height:0.75rem;width:0.75rem;background:none;}#body_lineup.custom_lineup_body table td.pphoto img[src*="svg"] {padding:0.25rem;}#body_lineup.custom_lineup_body tr.player_row {position:relative;display:block;height:3.75rem;}#body_lineup.custom_lineup_body .player_row.eventablerow td,#body_lineup.custom_lineup_body .player_row.oddtablerow td,#body_lineup.custom_lineup_body tr.player_row td {padding:0 !important;margin:0 !important;border:0 !important;box-shadow:none !important;background:none !important;}#body_lineup.custom_lineup_body form td.player {left:4.063rem;font-size:1.125rem;position:absolute;z-index:2;top:30%;transform:translateY(-50%);cursor:pointer;white-space:nowrap;font-weight:700;}#body_lineup.custom_lineup_body form tr td.player img {margin-top:-0.25rem;}#body_lineup.custom_lineup_body form td.player input {display:none;}#body_lineup.custom_lineup_body form td.weekly-opp {left:4.375rem;top:70%;transform:translateY(-50%);font-size:0.875rem;position:absolute;z-index:2;pointer-events:auto;text-decoration:none;white-space:nowrap;}#body_lineup.custom_lineup_body form td.weekly-opp .warning {font-weight:400;}#body_lineup.custom_lineup_body form td.inj b.warning {font-size:0.625rem;font-weight:400;border-radius:50%;width:1rem;height:1rem;line-height:1rem;display:block;top:2.125rem;left:3.125rem;position:absolute;z-index:2;}#body_lineup.custom_lineup_body form th {font-size:1rem;}#body_lineup.custom_lineup_body form table tr td a {text-decoration:none;}tr.player_row {cursor:pointer;}#body_lineup.custom_lineup_body form th.select-total-starters {position:relative;display:block;}#body_lineup.custom_lineup_body tr.player_row:after {font-family:"Font Awesome 6 Pro";position:absolute;z-index:1;font-size:1.6rem;text-align:center;right:0;top:50%;transform:translateY(-50%);width:2.125rem;}#body_lineup.custom_lineup_body tr.current_starters_row:after {content:"\\f046";}#body_lineup.custom_lineup_body tr.current_bench_row:after {content:"\\f0aa";}#body_lineup.custom_lineup_body tr.locked_starter:after,#body_lineup.custom_lineup_body tr.locked_bench::after {content:"\\f30d";width:2.063rem;font-size:1.6rem;}#body_lineup.custom_lineup_body form td.pos-rank {font-size:0.625rem;position:absolute;text-align:center;width:3.063rem;z-index:1;pointer-events:none;text-decoration:none;left:0.375rem;bottom:0.125rem;border-radius:0.313rem;}#body_lineup.custom_lineup_body form tr td.pos-rank:before {content:attr(data-content) "\\00a0#";display:inline;padding-bottom:0.313rem;margin-top:-1.25rem;text-transform:uppercase;}#body_lineup.custom_lineup_body form td.weekly-opp .warning:before {content:"Player\\00a0";}#body_lineup.custom_lineup_body form td.weekly-opp .warning:after {content:"\\00a0Week";}#body_lineup.custom_lineup_body form td.weekly-opp .warning.no_content {font-size:0;}#body_lineup.custom_lineup_body form td.weekly-opp .warning.no_content:before {content:"";}#body_lineup.custom_lineup_body form td.weekly-opp .warning.no_content:after {content:"No Matchup Found";font-size:0.875rem;}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.rush-rank:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td[class*="-start"]:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td.proj-pts:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td.avg-pts:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td.ytd-pts:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td.bye:before {display:block;font-weight:700;text-decoration:underline;padding-bottom:0.313rem;margin-top:-1.25rem;}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.bye:before {content:"Bye";}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.ytd-pts:before {content:"YTD";}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.avg-pts:before {content:"AVG";}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.proj-pts:before {content:"Proj.";font-style:normal;}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.rush-rank:before {content:"Opp Rk";}#body_lineup.custom_lineup_body form table.position-table tr:first-child td[class*="-start"]:before {content:"Started";}#body_lineup.custom_lineup_body form tr td[class*="-start"]:after {content:"%";}#body_lineup.custom_lineup_body form td.proj-pts,#body_lineup.custom_lineup_body form td.ytd-pts,#body_lineup.custom_lineup_body form td.avg-pts,#body_lineup.custom_lineup_body form td[class*="-start"],#body_lineup.custom_lineup_body form td.rush-rank,#body_lineup.custom_lineup_body form tr td.bye {top:50%;transform:translateY(-50%);font-size:0.875rem;position:absolute;text-align:center;width:5rem;z-index:1;pointer-events:none;text-decoration:none;}#body_lineup.custom_lineup_body form td.proj-pts {font-style:italic;right:3.75rem;}#body_lineup.custom_lineup_body form td.ytd-pts {right:9.375rem;}#body_lineup.custom_lineup_body form td.avg-pts {right:15rem;}#body_lineup.custom_lineup_body form td[class*="-start"] {right:20.625rem;}#body_lineup.custom_lineup_body form td.rush-rank {right:26.25rem;}#body_lineup.custom_lineup_body form tr td.bye {right:31.875rem;}#body_lineup.custom_lineup_body form table caption {font-size:1.375rem;padding:0.5rem 0.313rem;line-height:100%;}#body_lineup.custom_lineup_body .starter_count {position:relative;}#body_lineup.custom_lineup_body .starter_count .warning_minimum_error,#body_lineup.custom_lineup_body .starter_count .warning_maximum_error {border-radius:0.313rem;padding:0.188rem 0.188rem;position:absolute;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:0.75rem;margin-left:0.25rem;font-weight:bold;font-family:monospace;}#body_lineup.custom_lineup_body .starter_count_total_wrapper {position:absolute;right:0.625rem;}#body_lineup.custom_lineup_body .starter_count_total_idp {margin-left:0.625rem;}.custom_lineup_submission_body td,.custom_lineup_submission_body th,.custom_lineup_submission_body td.player.opponent {text-align:left !important;}.custom_lineup_submission_body td.opponent:nth-child(1) {text-align:center !important;white-space:nowrap;width:0.188rem !important;max-width:0.188rem;float:left;}.custom_lineup_submission_body td.opponent[colspan="3"] {white-space:unset;float:none;width:auto !important;max-width:none !important;}.starter_count_sub .lineup_filter {float:none !important;position:absolute;right:0.313rem;}.starter_count_total_idp_sub {margin-left:0.625rem;}.starter_count_reason_content {cursor:default;font-size:0.75rem;}.starter_count_reason_more, .starter_count_reason_less {font-size: 0.85rem;cursor: pointer;border-radius: 0.188rem;text-transform: uppercase;width: 5rem;margin: .388rem auto;padding: .188rem;}.starter_count_sub {position:fixed;margin:auto;max-width:25rem;top:0;right:0;left:0;text-align:center;font-size:1.125rem;padding:0.625rem;border-bottom-left-radius:0.313rem;border-bottom-right-radius:0.313rem;z-index:10000000;border-top:0;}.starter_count_sub.starter_count_sub_fail:before {text-align:center;content:"!Invalid\\00a0Lineup";font-weight:700;position:absolute;left:0;top:0.313rem;margin:0 auto;right:0;width:9.375rem;border-radius:0.313rem;font-size:1rem;}.starter_count_sub.starter_count_sub_fail {padding-top:1.75rem;}#body_lineup.custom_lineup_body .reportnavigation br {display:none;}#body_lineup.custom_lineup_body .links_nav {padding-top:0.313rem;padding-bottom:0.5rem;}#body_lineup.custom_lineup_body .links_nav a {text-decoration:none;display:inline-block;margin:0.313rem;margin-top:0;border-radius:0.188rem;padding:0.313rem;}#body_lineup.custom_lineup_submission_body caption a {display:none;}#body_lineup.custom_lineup_submission_body caption {text-align:left !important;}.custom_lineup_submission_body .mobile-wrap,.custom_lineup_submission_body table.report {max-width:26.25rem;}.custom_lineup_submission_body td,.custom_lineup_submission_body th {text-align:left !important;}.custom_lineup_submission_body td.pphoto img[src*="svg"] {padding:0.313rem;}.custom_lineup_submission_body tr.starter_totalsRow td {text-align:center !important;font-weight:bold;font-size:1rem;text-align:center !important;text-transform:uppercase;}.custom_lineup_submission_body tr.starter_totalsRow td:after {content:"\\00a0Started";}#body_lineup table tr.playerRow td.pphoto img,#body_lineup table tr.player_row td.pphoto img {border-radius:50%;width:100%;height:100%;}#body_lineup table tr.playerRow td.pphoto img[src*="player_photos_"],#body_lineup table tr.player_row td.pphoto img[src*="player_photos_"] {object-fit:contain;}.custom_lineup_submission_body td.pphoto {width:3.438rem;min-width:3.438rem;height:3.438rem;min-height:3.438rem;}.custom_lineup_submission_body td.pphoto img {width:3.063rem !important;height:3.063rem !important;}@media only screen and (max-width:61em){#body_lineup.custom_lineup_body form td.proj-pts{right:3.75rem;}#body_lineup.custom_lineup_body form td.ytd-pts{right:7.5rem;}#body_lineup.custom_lineup_body form td.avg-pts{right:11.875rem;}#body_lineup.custom_lineup_body form td[class*="-start"]{right:16.875rem;}#body_lineup.custom_lineup_body form td.rush-rank{right:21.875rem;}#body_lineup.custom_lineup_body form tr td.bye{right:26.875rem;}}@media only screen and (max-width:56em){#body_lineup.custom_lineup_body form tr td.bye{display:none;}}@media only screen and (max-width:51em){#body_lineup.custom_lineup_body tr.player_row{height:4.625rem;}#body_lineup.custom_lineup_body form td.rush-rank{transform:none;font-size:0.813rem;width:5rem;left:5rem;right:auto;top:80%;transform:translateY(-50%);text-align:left;opacity:.9;}#body_lineup.custom_lineup_body form table.position-table tr:first-child td.rush-rank:before{content:"Opp Rk #";display:inline-block;font-weight:400;text-decoration:none;padding:0;margin:0;}#body_lineup.custom_lineup_body form tr td.rush-rank:before{content:"Opp Rk #";}#body_lineup.custom_lineup_body form tr td.rush-rank.no_ranking{font-size:0;}#body_lineup.custom_lineup_body form tr td.rush-rank.no_ranking:before,#body_lineup.custom_lineup_body form table.position-table tr:first-child td.rush-rank.no_ranking:before{content:"No Ranking";font-size:0.813rem;font-style:italic;}#body_lineup.custom_lineup_body table td.pphoto{width:4.063rem;}#body_lineup.custom_lineup_body form td.player{top:20%;transform:translateY(-50%);left:4.375rem;}#body_lineup.custom_lineup_body form td.weekly-opp{top:50%;transform:translateY(-50%);left:4.688rem;}#body_lineup.custom_lineup_body form td.pos-rank{font-size:0.688rem;left:0.563rem;bottom:0.188rem;width:3.313rem;}#body_lineup.custom_lineup_body form td.inj b.warning{top:2.813rem;left:3.438rem;}}@media only screen and (max-width:46em){#body_lineup.custom_lineup_body form tr td[class*="-start"]{transform:none;font-size:0.813rem;width:7.5rem;left:10rem;right:auto;top:80%;transform:translateY(-50%);text-align:left;opacity:.9;}#body_lineup.custom_lineup_body form table.position-table tr:first-child td[class*="-start"]:before{content:"Started By\\00a0";display:inline-block;font-weight:400;text-decoration:none;padding:0;margin:0;}#body_lineup.custom_lineup_body form tr td[class*="-start"]:before{content:"Started By\\00a0";}}@media only screen and (max-width:41em){#body_lineup.custom_lineup_body form td.avg-pts{right:11.25rem;}#body_lineup.custom_lineup_body form td.ytd-pts{right:6.875rem;}#body_lineup.custom_lineup_body form td.proj-pts{right:2.5rem;}}@media only screen and (max-width:40em){#body_lineup.custom_lineup_body form td.player{left:4.25rem;font-size:1rem;top:16%;transform:translateY(-50%);}#body_lineup.custom_lineup_body form td.weekly-opp{left:4.75rem;top:41%;transform:translateY(-50%);font-size:0.813rem;}#body_lineup.custom_lineup_body form td.rush-rank{font-size:0.75rem;left:5.25rem;}#body_lineup.custom_lineup_body form tr td[class*="-start"]{font-size:0.75rem;left:10rem;}#body_lineup.custom_lineup_body form td.rush-rank,#body_lineup.custom_lineup_body form tr td[class*="-start"]{top:65%;transform:translateY(-50%);}#body_lineup.custom_lineup_body form span.points_row{position:absolute;font-size:0.75rem;top:88%;transform:translateY(-50%);left:5.25rem;opacity:.9;}#body_lineup.custom_lineup_body form span.points_row span span{margin-left:0.313rem;}#body_lineup.custom_lineup_body form span.points_row .avg-pts{display:inline;}#body_lineup.custom_lineup_body td.avg-pts{display:none;}#body_lineup.custom_lineup_body form tr td.rush-rank.no_ranking:before{font-size:0.75rem;}}@media only screen and (max-width:34em){#body_lineup.custom_lineup_body form span.points_row .ytd-pts{display:inline;margin-left:0.625rem;}#body_lineup.custom_lineup_body td.ytd-pts{display:none;}}@media only screen and (max-width:32em){#body_lineup.custom_lineup_body .starter_count_total_wrapper{position:unset;right:auto;display:block;}#body_lineup.custom_lineup_body .starter_count .warning_minimum_error,#body_lineup.custom_lineup_body .starter_count .warning_maximum_error{position:relative;top:auto;transform:none;margin-left:0;display:table;margin:0 auto;margin-top:0.188rem;margin-bottom:0.125rem;}}@media only screen and (max-width:30em){#body_lineup.custom_lineup_body form span.points_row .proj-pts{display:inline;margin-left:0.625rem;}#body_lineup.custom_lineup_body form td.proj-pts{display:none;}}@media only screen and (max-width:26em){.starter_count_sub{margin:auto 0.313rem;}}@media only screen and (max-width:24em){#body_lineup.custom_lineup_body form td.player{left:4.125rem;}#body_lineup.custom_lineup_body form td.weekly-opp{left:4.5rem;}#body_lineup.custom_lineup_body form td.rush-rank{left:4.5rem;}#body_lineup.custom_lineup_body form tr td[class*="-start"]{left:9.375rem;}#body_lineup.custom_lineup_body form span.points_row{position:absolute;font-size:0.75rem;left:4.5rem;}#body_lineup.custom_lineup_body form span.points_row .proj-pts,#body_lineup.custom_lineup_body form span.points_row .ytd-pts{margin-left:0.375rem;}#body_lineup.custom_lineup_body form span.points_row span span{margin-left:0.188rem;}}@media only screen and (max-width:23em){#body_lineup.custom_lineup_body form td.player{font-size:0.875rem;}#body_lineup.custom_lineup_body form td.weekly-opp{font-size:0.75rem;}#body_lineup.custom_lineup_body form tr td[class*="-start"]{font-size:0.688rem;left:8.75rem;}#body_lineup.custom_lineup_body form td.rush-rank{font-size:0.688rem;left:4.5rem;}}@media only screen and (max-width:22em){.starter_count_sub{text-align:left;}.starter_count_reason_sub{text-align:center;}}@media only screen and (max-width:21em){#body_lineup.custom_lineup_body form tr td.rush-rank.no_ranking:before{font-size:0.688rem;}#body_lineup.custom_lineup_body form td.player{font-size:0.75rem;left:3.125rem;}#body_lineup.custom_lineup_body table td.pphoto{width:3.125rem;height:70%;left:0.188rem;}#body_lineup.custom_lineup_body table td.pphoto img{width:3.125rem;}#body_lineup.custom_lineup_body form td.pos-rank{left:0;bottom:0.313rem;}#body_lineup.custom_lineup_body form td.weekly-opp{font-size:0.688rem;left:3.438rem;}#body_lineup.custom_lineup_body form tr td[class*="-start"]{left:8.125rem;}#body_lineup.custom_lineup_body form td.rush-rank{left:3.625rem;}#body_lineup.custom_lineup_body form td.inj b.warning{top:2.5rem;left:2.5rem;}#body_lineup.custom_lineup_body form span.points_row{font-size:0.688rem;}#body_lineup.custom_lineup_body form span.points_row{left:3.625rem;}}'),
      document.head.appendChild(r),
      document.getElementById('starterCSS')?.remove()
  }
  document.addEventListener('DOMContentLoaded', async () => {
    if (await Ve) {
      const e = localStorage.getItem(Fe)
      if (
        (lu_useDefaultAsPrimaryV3 && 'false' === e) ||
        (!lu_useDefaultAsPrimaryV3 && 'true' === e)
      )
        lu_load_script()
      else {
        const e = document.querySelector('#lineup form[action*="lineup"]')
        e?.insertAdjacentHTML(
          'beforeend',
          '<p class="form_buttons default-btn"><input type="button" value="Use Custom Submission Form" onclick="redirectSubmissionPage_v3(false)"></p>'
        ),
          Me.remove()
      }
    } else
      redirectSubmissionPage_v3(!0),
        console.error('Failed to load settings, skipping lu_load_script.'),
        Me.remove()
  })
  let Ke = !1
  window.lu_v3_weatherPopup = function (e, t) {
    if (void 0 === weather) return !1
    if (!weather[e]?.location)
      return void alert('Weather for this game is not defined')
    if (!Ke) {
      const e = document.createElement('style')
      ;(e.textContent =
        '.current-conditions-wrapper{margin-bottom:0.625rem}.current-conditions-wrapper,.kickoff-conditions-wrapper{border:0.188rem solid #ccc;border-radius:0.313rem;padding:0.625rem}.current-conditions-text,.kickoff-conditions-text{font-size:1rem;font-weight:700}.current-conditions-localtime{display:block;font-size:0.688rem;font-style:italic}.current-conditions-temp,.kickoff-conditions-temp{font-size:2.25rem;display:inline-block;vertical-align:top;margin-top:0.25rem;font-weight:700}.current-conditions-extras-wrapper,.kickoff-conditions-extras-wrapper{display:inline-block;vertical-align:top;margin-top:0.625rem;margin-left:0.938rem}.current-conditions-wind-wrapper,.current-conditions-rain-wrapper,.current-conditions-snow-wrapper,.kickoff-conditions-wind-wrapper,.kickoff-conditions-rain-wrapper,.kickoff-conditions-snow-wrapper{display:block}.weather-more-link{text-align:center;margin-top:0.375rem;cursor:pointer}#popup-weather-wrapper.modal{width:100%;height:100%;position:fixed;left:0;top:0;z-index:111111111;background:rgba(0,0,0,.7);display:none}#popup-weather-container{background:#fff;z-index:99999;max-width:31.25rem;width:96%;margin:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);border:0 solid #000;box-shadow:#000 0 0 1.563rem;border-radius:0.188rem;padding:0.625rem;max-height:95%;overflow:auto}img.kickoff-conditions-icon,img.current-conditions-icon{height:3.125rem;width:auto}.weather_caption{line-height:1.875rem;height:1.875rem;position:relative;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;padding-right:1.438rem}.current-conditions-place{font-size:1.25rem;font-weight:700;max-width:0}.as_close_btn{position:absolute;z-index:1;cursor:pointer;border-radius:0.188rem;text-align:center;border:0.125rem solid transparent;font-weight:700;background:red;color:#fff;right:0;height:1.375rem;width:1.375rem;line-height:1.4;top:50%;transform:translateY(-50%)}.as_close_btn:hover{background:#000;color:#fff}'),
        document.head.appendChild(e),
        (Ke = !0)
    }
    const a = weather[e],
      r = a.forecast.forecastday[0].hour
    let o,
      n = 0,
      i = 0
    for (let e = 0; e < r.length; e++)
      if (r[e].time_epoch >= currentServerTime) {
        const t = 0 === e ? r[e] : r[e - 1]
        ;(n = t.chance_of_rain), (i = t.chance_of_snow)
        break
      }
    try {
      const e = a.kickoff_weather
      o = `\n        <div class="kickoff-conditions-detail">\n          <span class="kickoff-conditions-temp">${
        e.temp_f
      }&degF</span>\n          <span class="kickoff-conditions-icon-wrapper"><img class="kickoff-conditions-icon" src="${
        e.condition.icon
      }"/></span>\n          <span class="kickoff-conditions-extras-wrapper">\n            <span class="kickoff-conditions-wind-wrapper">Wind: <span class="kickoff-conditions-wind-speed">${
        e.wind_mph
      }mph</span> <span class="kickoff-conditions-wind-direction">${
        e.wind_dir
      }</span></span>\n            ${
        e.chance_of_rain > 0
          ? `<span class="kickoff-conditions-rain-wrapper">Rain: <span class="kickoff-conditions-chance-of-rain">${e.chance_of_rain}%</span></span>`
          : ''
      }\n            ${
        e.chance_of_snow > 0
          ? `<span class="kickoff-conditions-snow-wrapper">Snow: <span class="kickoff-conditions-chance-of-snow">${e.chance_of_snow}%</span></span>`
          : ''
      }\n          </span>\n          <div class="current-conditions-text">${
        e.condition.text
      }</div>\n        </div>`
    } catch {
      o =
        '<div class="kickoff-conditions-no-data-available" style="color:red">Future forecasts available 72 hours prior to kickoff</div>'
    }
    const s = `\n      <div id="weather-wrapper">\n        <div class="weather_caption">\n          <span class="current-conditions-place">${
        a.location.name
      }, ${
        a.location.region
      }</span>\n          <span class="as_close_btn">X</span>\n        </div>\n        <div class="current-conditions-wrapper">\n          <div class="current-conditions-header">\n            <span class="current-conditions-text">Current Conditions</span>\n            <span class="current-conditions-localtime"> last updated ${
        a.current.last_updated
      } local time</span>\n          </div>\n          <div class="current-conditions-detail">\n            <span class="current-conditions-temp">${
        a.current.temp_f
      }&degF</span>\n            <span class="current-conditions-icon-wrapper"><img class="current-conditions-icon" src="${
        a.current.condition.icon
      }"/></span>\n            <span class="current-conditions-extras-wrapper">\n              <span class="current-conditions-wind-wrapper">Wind: <span class="current-conditions-wind-speed">${
        a.current.wind_mph
      }mph</span> <span class="current-conditions-wind-direction">${
        a.current.wind_dir
      }</span></span>\n              ${
        n > 0
          ? `<span class="current-conditions-rain-wrapper">Rain: <span class="current-conditions-chance-of-rain">${n}%</span></span>`
          : ''
      }\n              ${
        i > 0
          ? `<span class="current-conditions-snow-wrapper">Snow: <span class="current-conditions-chance-of-snow">${i}%</span></span>`
          : ''
      }\n            </span>\n            <div class="current-conditions-text">${
        a.current.condition.text
      }</div>\n          </div>\n        </div>\n        <div class="kickoff-conditions-wrapper">\n          <div class="kickoff-conditions-header"><span class="kickoff-conditions-text">Expected Conditions at Kickoff</span></div>\n          ${o}\n        </div>\n        <div class="weather-more-link"><a onclick="window.open('${t}', '_blank')">More at Weather.com</a></div>\n      </div>`,
      l = document.createElement('div')
    ;(l.id = 'popup-weather-wrapper'), (l.className = 'modal')
    const c = document.createElement('div')
    ;(c.id = 'popup-weather-container'),
      (c.className = 'modal-content animate'),
      (c.innerHTML = s),
      l.appendChild(c),
      document.body.appendChild(l),
      (l.style.display = 'block'),
      (c.style.display = 'block')
    try {
      bodyScrollLock.disableBodyScroll(l)
    } catch {}
    l.addEventListener('click', e => {
      if (
        e.target === e.currentTarget ||
        e.target.classList.contains('as_close_btn')
      ) {
        l.remove(),
          document
            .querySelectorAll('.modal')
            .forEach(e => (e.style.display = 'none')),
          document
            .querySelectorAll('.modal-content')
            .forEach(e => (e.style.display = 'none'))
        try {
          bodyScrollLock.enableBodyScroll(l)
        } catch {}
      }
    })
  }
  const Je = document.createElement('style')
  function redirectSubmissionPage_v3 (e) {
    const t = window.location.href
    localStorage.setItem(Fe, lu_useDefaultAsPrimaryV3 ? e : !e),
      t.includes('?L=') ? (window.location.href = t) : window.location.reload()
  }
  ;(Je.textContent =
    '#body_lineup input[type="submit"] + .form_buttons.default-btn{display:none;}#body_lineup p.form_buttons{margin-left:-0.813rem!important;}#body_lineup p.form_buttons input[type="submit"]{padding-left:1.625rem!important;}#body_lineup p.form_buttons.default-btn{margin-left:0.813rem!important;}#body_lineup p.form_buttons.default-btn input{padding-right:1.625rem!important;}#body_lineup .form_buttons:before{font-family:"Font Awesome 6 Pro";position:relative;left:1.438rem;content:"\\f00c";z-index:1;font-size:1rem;}#body_lineup .form_buttons.default-btn:after{font-family:"Font Awesome 6 Pro";position:relative;right:1.438rem;content:"\\f0a9";z-index:1;font-size:1rem;}#body_lineup p.form_buttons.buttonDisabledContainer input[type="submit"]{opacity:0.5;pointer-events:none;}#body_lineup .form_buttons.buttonDisabledContainer:before{content:"\\f057";}#body_lineup .form_buttons.default-btn::before{display:none;}.custom_lineup_submission_body table.report span.opponent{font-weight:400;font-size:0.813rem;position:absolute;left:0.625rem;margin-top:1.563rem;}.custom_lineup_submission_body table.report span.byeWeek{color:red;}.custom_lineup_submission_body .mobile-wrap,.custom_lineup_submission_body table.report{max-width:26.25rem;}.custom_lineup_submission_body table.report td.player{font-weight:700;font-size:1rem;position:relative;padding-bottom:1.563rem;white-space:nowrap;}.custom_lineup_submission_body table.report .playerPopupIcon:first-of-type{display:inline-block;}.custom_lineup_submission_body table.report .playerPopupIcon{display:none;}.custom_lineup_submission_body table.report tr th:nth-child(3),.custom_lineup_submission_body table.report tr td:nth-child(3){display:none!important;}'),
    document.head.appendChild(Je)
}
if (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
) {
  var style = document.createElement('style')
  document.head.appendChild(style),
    style.sheet.insertRule('::-webkit-scrollbar{display:none}')
}
if (document.getElementById('body_ajax_ls')) {
  var ls_liveScoringWeekCheck = parseInt(
    location.href.substr(location.href.indexOf('W2=') + 3, 2)
  )
  ls_liveScoringWeekCheck > 0 &&
    ls_liveScoringWeekCheck < liveScoringWeek &&
    (liveScoringWeek = parseInt(
      location.href.substr(location.href.indexOf('W2=') + 3, 2)
    ))
}
