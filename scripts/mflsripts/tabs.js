let tabNumberSwipe, lastTabSwipe
void 0 === window.showTabsAllPages && (window.showTabsAllPages = !0),
  void 0 === window.changeMainTabName && (window.changeMainTabName = 'Home'),
  void 0 === window.swipeHPM && (window.swipeHPM = !1),
  void 0 === window.swipePosition && (window.swipePosition = 'content')
const firstTabSwipe = 0,
  thresholdTab = 50
let startTabX,
  distTabX,
  isScrolling = !1
const qs = (e, t = document) => t.querySelector(e),
  qsa = (e, t = document) => Array.from(t.querySelectorAll(e)),
  isHomePage = () =>
    !!qs('#body_home') &&
    qs('#body_home') &&
    !location.href.includes('MODULE=MESSAGE')
if (showTabsAllPages || isHomePage()) {
  const e = document.createElement('style')
  ;(e.textContent = [
    'div.myfantasyleague_tabmenu.main_tabmenu { display: none }',
    '.myfantasyleague_tabmenu.all_page #homepagetabs li a { text-decoration: none }',
    '.myfantasyleague_tabmenu.all_page li a { display: flex; flex-grow: 1; flex-shrink: 1; justify-content: center }'
  ].join('')),
    document.head.appendChild(e)
  const t = `\n      <div id="tabmenu-wrap" style="padding: 0 0.188rem">\n        <div class="myfantasyleague_tabmenu all_page" style="display: block">\n          <span id="tab_title"></span>\n          <input id="sub100" type="checkbox">\n          <label for="sub100"><span></span></label>\n          <ul id="homepagetabs" class="customhomepagetabs" style="font-size:0">\n            <li id="tab0" onclick="show_tab('0');" class="">\n              <a class="tab_link" href="${baseURLDynamic}/${year}/home/${league_id}#0">\n                Home\n                <input id="sub100" type="checkbox">\n                <label for="sub100"></label>\n              </a>\n            </li>\n          </ul>\n        </div>\n      </div>`
  document.currentScript.insertAdjacentHTML('beforebegin', t)
  const a = `mfl_tabs_${league_id}_${year}`,
    n = 216e5
  function getTabsCache () {
    try {
      const e = localStorage.getItem(a)
      if (!e) return null
      const { ts: t, tabNames: s } = JSON.parse(e)
      return Date.now() - t > n ? (localStorage.removeItem(a), null) : s
    } catch {
      return null
    }
  }
  function setTabsCache (e) {
    try {
      localStorage.setItem(a, JSON.stringify({ ts: Date.now(), tabNames: e }))
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
  const s = getTabsCache()
  ;(s
    ? Promise.resolve(s)
    : fetch(`${baseURLDynamic}/${year}/home/${league_id}?PRINTER=1`)
        .then(e => {
          if (!e.ok) throw new Error(`HTTP ${e.status}`)
          return e.text()
        })
        .then(e => {
          const t = extractTabNames(e)
          return setTabsCache(t), t
        })
  )
    .then(e => {
      '' !== changeMainTabName && (e[0] = changeMainTabName)
      let t = e
          .map(
            (e, t) =>
              `\n                <li id="tab${t}" onclick="show_tab('${t}');" class="">\n                  <a class="tab_link" href="${baseURLDynamic}/${year}/home/${league_id}#${t}">\n                    ${e}\n                    <input id="sub100" type="checkbox">\n                    <label for="sub100"></label>\n                  </a>\n                </li>`
          )
          .join(''),
        a = e.length
      for (const [e, { href: n, target: s }] of Object.entries(
        MFL_customTabs_FakeTabs
      ))
        (t += `\n                <li id="tab${a}" class="disable_sort">\n                  <a href="${n}#${a}" target="${s}">${e}</a>\n                </li>`),
          a++
      const n = qs('.customhomepagetabs')
      n && (n.innerHTML = t),
        qsa(
          '.myfantasyleague_tabmenu.all_page ul#homepagetabs li label'
        ).forEach(e => (e.style.display = 'none'))
      const s = qs(`#tab${location.hash.slice(1)}`)
      s && s.classList.add('currenttab'),
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
    })
    .catch(e => console.error('Tabs fetch error:', e))
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
        n = qsa('.tabs_scroll > .homepagetabcontent', e),
        s = qs('.tabName', t)
      qs('.tabLabel', t)?.addEventListener('click', () => {
        if (e.classList.contains('nested-tabs')) return
        const a = qs('input[type="checkbox"]', t)
        a && (a.checked = !a.checked)
      }),
        n.forEach(e => (e.style.display = 'none'))
      const o = qs('.currenttab', t)
      if (o) {
        const e = a.indexOf(o)
        e > -1 && n[e] && (n[e].style.display = 'block'),
          s && (s.textContent = o.textContent.trim())
      }
      n.forEach(e => initNestedTabs(e)),
        a.forEach((t, o) => {
          t.addEventListener('click', () => {
            e.classList.contains('nested-tabs') ||
              (a.forEach(e => e.classList.remove('currenttab')),
              t.classList.add('currenttab'),
              n.forEach(e => (e.style.display = 'none')),
              n[o] && ((n[o].style.display = 'block'), initNestedTabs(n[o])),
              s && (s.textContent = t.textContent.trim()),
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
        n = qsa('.homepagetabcontent', e),
        s = qs('.tabName', t)
      qs('.tabLabel', t)?.addEventListener('click', e => {
        e.stopPropagation()
        const a = qs('input[type="checkbox"]', t)
        a && (a.checked = !a.checked)
      }),
        n.forEach(e => (e.style.display = 'none'))
      const o = qs('.currenttab', t)
      if (o) {
        const e = a.indexOf(o)
        e > -1 && n[e] && (n[e].style.display = 'block')
      }
      a.forEach((e, t) => {
        e.addEventListener('click', o => {
          o.stopPropagation(),
            a.forEach(e => e.classList.remove('currenttab')),
            e.classList.add('currenttab'),
            n.forEach(e => (e.style.display = 'none')),
            n[t] && (n[t].style.display = 'block'),
            s && (s.textContent = e.textContent.trim()),
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
    tabNumberSwipe = parseInt(a.id.replace('tab', ''), 10)
    const e = t.at(-1)
    e && (lastTabSwipe = parseInt(e.id.replace('tab', ''), 10))
  }
  if (
    (t.forEach(e => {
      e.addEventListener('click', () => {
        tabNumberSwipe = parseInt(e.id.replace('tab', ''), 10)
        const a = t.at(-1)
        a && (lastTabSwipe = parseInt(a.id.replace('tab', ''), 10))
      })
    }),
    'content' === swipePosition)
  ) {
    const e = document.createElement('style')
    ;(e.textContent = '.swipeContent { min-height: 200px }'),
      document.head.appendChild(e),
      document.addEventListener('touchstart', e => {
        e.target.closest('.swipeContent') &&
          ((startTabX = e.changedTouches[0].pageX), (isScrolling = !1))
      }),
      document.addEventListener('touchmove', e => {
        const t = e.target.closest('.swipeContent')
        t &&
          t.scrollLeft > 0 &&
          t.scrollLeft < t.scrollWidth - t.clientWidth &&
          (isScrolling = !0)
      }),
      document.addEventListener('touchend', e => {
        !isScrolling &&
          e.target.closest('.swipeContent') &&
          ((distTabX = e.changedTouches[0].pageX - startTabX),
          Math.abs(distTabX) >= 50 &&
            ((tabNumberSwipe =
              distTabX > 0
                ? 0 === tabNumberSwipe
                  ? lastTabSwipe
                  : tabNumberSwipe - 1
                : tabNumberSwipe === lastTabSwipe
                ? 0
                : tabNumberSwipe + 1),
            show_tab(tabNumberSwipe)))
      })
  }
  if ('tabs' === swipePosition) {
    const e = qsa(
      '#home .myfantasyleague_tabmenu.swipeTabs li:not(.disable_sort)'
    ).map(e => parseInt(e.id.replace('tab', ''), 10))
    document.addEventListener('touchstart', e => {
      e.target.closest('#home .myfantasyleague_tabmenu.swipeTabs') &&
        (startTabX = e.changedTouches[0].pageX)
    }),
      document.addEventListener('touchend', t => {
        if (
          t.target.closest('#home .myfantasyleague_tabmenu.swipeTabs') &&
          ((distTabX = t.changedTouches[0].pageX - startTabX),
          Math.abs(distTabX) >= 50)
        ) {
          let t = e.indexOf(tabNumberSwipe)
          ;(t =
            distTabX > 0
              ? 0 === t
                ? e.length - 1
                : t - 1
              : t === e.length - 1
              ? 0
              : t + 1),
            (tabNumberSwipe = e[t]),
            show_tab(tabNumberSwipe)
        }
      })
  }
}
function show_custom_tab (e) {
  const t = parseInt(e),
    a = Math.pow(10, t.toString().length - 1),
    n = Math.floor(t / a) * a,
    s = 100 * Math.floor((t - n) / 100)
  let o = s + n
  for (;;) {
    const e = document.getElementById(`tabcontent${o}`),
      a = document.getElementById(`tab${o}`)
    if (!e || !a) break
    const i = o === t
    if (
      ((e.style.display = i ? '' : 'none'),
      (a.className = i ? 'currenttab' : ''),
      i)
    ) {
      const e = document.getElementById(`tab_title_${s + n}`)
      e && (e.innerHTML = a.firstChild?.text ?? '')
    }
    o++
  }
}
function show_tab (e) {
  let t = 0
  for (;;) {
    const a = document.getElementById(`tabcontent${t}`),
      n = document.getElementById(`tab${t}`)
    if (!a) break
    const s = t == e
    if (
      ((a.style.display = s ? '' : 'none'),
      n && (n.className = s ? 'currenttab' : ''),
      s)
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
