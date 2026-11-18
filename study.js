/* Map reading study, Monash project 54284.

   The page asks every question of "54284-Userstudy questions - example" on two maps of the same
   data: the geographic choropleth and the necklace map (5 strands of dots). Both maps were exported
   from the Unravelling-Australia-Eng app into data/study_data.js.

   Part 1 shows the two maps as still pictures. Part 2 shows four interactive maps, each map type
   with Way 1 (point at one area or dot) and with Way 2 (a circle around the mouse with a list).

   All answers stay in this page. At the end the researcher saves them as one JSON file on the
   study computer. Nothing is sent over the network. */
(function () {
  'use strict';

  /* ---------- data, sizes and small helpers ---------- */

  const STUDY = window.STUDY_DATA;            // made by tools/bundle.mjs
  const SCENES = STUDY.scenes;                // the two maps: choropleth and necklace
  const CFG = STUDY.config;                    // marked areas, rings and screen order (data/config.json)
  const META = STUDY.meta;                    // colour key stops, dot size classes, app build
  const W = 940, H = 620;                     // map frame of the app, in map units
  const CENTRE = [470, 330];                  // rough centre of Australia in the map frame
  const LENS_R = CFG.lensRadius || 10;        // Way 2 circle radius, in map units
  const LIST_DELAY_MS = 120;                  // the Way 2 list updates after the mouse rests this long
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const params = new URLSearchParams(location.search);

  // Short way to get an element by its id.
  const $ = id => document.getElementById(id);

  // Make an SVG element with the given attributes and add it to a parent.
  const el = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  };

  // Escape text before it goes into HTML.
  const HTML_CHARS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = text => String(text).replace(/[&<>"]/g, c => HTML_CHARS[c]);

  // Milliseconds since the page opened, rounded.
  const now = () => Math.round(performance.now());

  /* ---------- question text, copied word for word from the question file ---------- */

  const T = {
    skip: 'You can skip any question.',
    s1: ['How old are you?',
      ['18 to 24', '25 to 34', '35 to 44', '45 or over', 'I prefer not to say']],
    s2: ['Have you had any training in making maps, or in GIS (computer mapping software)?',
      ['Yes', 'No']],
    s3: ['How often do you look at maps that show data, such as election maps or weather maps?',
      ['Often (daily to weekly)', 'Sometimes (monthly)', 'Rarely (a few times a year)', 'Never']],
    s4: ['How well do you know the map of Australia, for example where the states and the big cities are?',
      ['Very well', 'Quite well', 'A little', 'Not at all']],
    q1: ['Two areas are marked with the letters A and B. Which one has the higher rate?',
      ['A', 'B', 'About the same', 'I cannot tell']],
    q2: ['A ring is drawn around one big city. Look at the areas inside the ring. Can you see each one clearly?',
      ['Yes, all of them', 'Only some of them', 'No']],
    q3: ['Inside the ring, find the area with the highest rate. Put a cross on it.'],
    q4: ['Look at the whole map. Find the area with the highest rate in Australia. Put a cross on it.'],
    q5: ['Look at the whole map. Where are most of the areas with a rate above the Australian average?',
      ['In and around the big cities', 'Along the coast, away from the big cities', 'Far from the coast',
        'I cannot see a pattern']],
    q6: ['One place on the map is marked with the letter C. Where do you think the dot for this place is? '
      + 'Draw a ring around the dots that you think it is in. Keep the ring as small as you can.'],
    q7: ['One dot is marked with the letter D. Where on the map do you think this dot comes from? '
      + 'Draw a ring around the part of the map that you think it is in. Keep the ring as small as you can.'],
    q8: ['On this map it was easy to tell where each area is in Australia.',
      ['Strongly agree', 'Agree', 'Neither agree nor disagree', 'Disagree', 'Strongly disagree'],
      'After each map, tell us how much you agree with this:'],
    q9: ['Two areas are marked with the letters A and B. Which one has the higher rate?',
      ['A', 'B', 'About the same', 'I cannot tell']],
    q10: ['A ring is drawn around one big city. Find the area inside the ring with the highest rate and click on it.'],
    q11: ['One place on the map is marked with the letter C. Find the dot for this place and click on it.'],
    q12: ['One dot is marked with the letter D. Click on the place on the map that this dot belongs to.'],
    q13: ['Compared with the still maps in Part 1, how fast could you find the answers when you used the mouse?',
      ['Much faster', 'A bit faster', 'About the same', 'A bit slower', 'Much slower']],
    q14: ['Which way of using the mouse helped you more?',
      ['Way 1, pointing at one dot or area', 'Way 2, the circle around the mouse', 'Both helped the same',
        'Neither helped']],
    q15: ['Put the maps in order, from the one you like most to the one you like least.'],
    q16: ['Which map looks best to you?'],
    q17: ['Is there anything about the maps, or the two ways of using the mouse, that you want to tell us?']
  };

  const P1_INTRO = [
    'You will see the same data on two maps, one map at a time. Each map shows areas of Australia. '
      + 'The colour of an area shows if its cancer rate is higher or lower than the Australian average. '
      + 'We will not ask about your own health.',
    'In this part each map is a still picture. To answer, you pick one of the answers, or you draw on the map '
      + 'with the digital pen or the mouse. In Part 2 you will use four maps with the mouse.',
    'On some maps the small areas are also drawn as round dots outside the map. The colour of a dot shows the '
      + 'rate of its area. A bigger dot means more people live there. A letter or the ring can be on the dots. '
      + 'Then the question is about those dots.',
    'Please answer each question as correctly and as quickly as you can. The time for each question is '
      + 'recorded. If you need a break, take it between two questions.'
  ];
  const WAY1 = 'Way 1, point at one dot or area: when you point at a dot or an area, the map shows its name '
    + 'and its rate.';
  const WAY1_DOTS = 'On maps with dots, the dot and its place on the map get a red ring, and a line joins them.';
  const WAY2 = 'Way 2, a circle around the mouse: a circle moves with the mouse, and all the areas inside the '
    + 'circle are picked. A list next to the map shows these areas, with the highest rate first.';
  const WAY2_DOTS = 'On maps with dots, the dots of these areas stay bright and lines join them to their places.';
  const P2_INTRO = [
    'In this part you will use four maps with the mouse. Each map uses one of two ways to help you. '
      + 'Before each map we tell you which way it uses.',
    WAY1 + ' ' + WAY1_DOTS,
    WAY2 + ' ' + WAY2_DOTS,
    'To answer, you click on the map or pick one of the answers.'
  ];
  const MAP_NAME = { choropleth: 'Map with areas only', necklace: 'Map with dots around the coast' };
  const LENS_HINT = '<div class="lh">Move the mouse over the map. The areas inside the circle are listed here.</div>';

  /* ---------- the list of screens, built from config.json ---------- */

  const screens = [];
  const add = screen => { screens.push(screen); return screen; };

  // Letters A and B on two areas. They are drawn on the place (the area), never on a dot.
  const abMarks = set => [
    { letter: 'A', code: set.A, on: 'place', turn: -30 },
    { letter: 'B', code: set.B, on: 'place', turn: 30 }
  ];

  // Start screen and the four survey questions.
  add({
    id: 'start', part: 'Welcome', type: 'info', title: 'Map reading study',
    body: [
      'Thank you for taking part.',
      'In this study you look at maps of Australia and answer short questions. First there are four '
        + 'questions about you. Then Part 1 has still maps and Part 2 has maps you use with the mouse.',
      T.skip,
      'Press Next when you are ready.'
    ]
  });
  ['s1', 's2', 's3', 's4'].forEach((key, i) => add({
    id: key, part: 'Preliminary survey', qnum: 'Question ' + (i + 1) + ' of 4',
    type: 'choice', q: key, text: T[key][0], options: T[key][1]
  }));

  // Part 1: each still map gets questions 1 to 3 twice, then 4 and 5, then 6 and 7 if it has dots, then 8.
  const P1_PART = 'Part 1: Still maps';
  add({ id: 'p1-intro', part: P1_PART, type: 'info', title: P1_PART, body: P1_INTRO });
  const P1 = CFG.part1;
  P1.order.forEach((kind, mapIndex) => {
    const m = P1.maps[kind];
    const short = kind === 'choropleth' ? 'choro' : 'neck';
    const base = { part: P1_PART, map: kind, way: 0, mapTitle: 'Still map ' + (mapIndex + 1) + ' of ' + P1.order.length };
    m.sets.forEach((set, setIndex) => {
      const tag = 'ab'[setIndex];
      const ring = m.rings[setIndex];
      add({ ...base, id: `p1-${short}-q1${tag}`, q: 'q1', type: 'choice', text: T.q1[0], options: T.q1[1],
        marks: abMarks(set), truth: set.answer });
      add({ ...base, id: `p1-${short}-q2${tag}`, q: 'q2', type: 'choice', text: T.q2[0], options: T.q2[1], ring });
      add({ ...base, id: `p1-${short}-q3${tag}`, q: 'q3', type: 'draw', text: T.q3[0], ring, truth: ring.highest });
    });
    add({ ...base, id: `p1-${short}-q4`, q: 'q4', type: 'draw', text: T.q4[0] });
    add({ ...base, id: `p1-${short}-q5`, q: 'q5', type: 'choice', text: T.q5[0], options: T.q5[1] });
    if (kind === 'necklace') {
      add({ ...base, id: `p1-${short}-q6`, q: 'q6', type: 'draw', text: T.q6[0],
        marks: [{ letter: 'C', code: m.C, on: 'place', turn: 0 }], truth: m.C });
      add({ ...base, id: `p1-${short}-q7`, q: 'q7', type: 'draw', text: T.q7[0],
        marks: [{ letter: 'D', code: m.D, on: 'bead', turn: 0 }], truth: m.D });
    }
    add({ ...base, id: `p1-${short}-q8`, q: 'q8', type: 'scale', text: T.q8[0], options: T.q8[1] });
  });

  // Part 2: an intro screen per map that says which way it uses, then questions 9, 10, 11 and 12 (dots only), 8.
  const P2_PART = 'Part 2: Maps you use with the mouse';
  add({ id: 'p2-intro', part: P2_PART, type: 'info', title: P2_PART, body: P2_INTRO });
  const P2 = CFG.part2;
  P2.order.forEach((mapId, mapIndex) => {
    const m = P2.maps[mapId];
    const dots = m.kind === 'necklace';
    const mapLabel = `Map ${mapIndex + 1} of ${P2.order.length}`;
    const base = { part: P2_PART, map: m.kind, way: m.way, mapTitle: `${mapLabel}, Way ${m.way}` };
    const wayText = m.way === 1 ? [WAY1, dots ? WAY1_DOTS : null] : [WAY2, dots ? WAY2_DOTS : null];
    add({ ...base, id: `p2-${mapId}-intro`, type: 'info', title: `${mapLabel} uses Way ${m.way}`,
      body: [...wayText.filter(Boolean), 'Try it on the map now. Press Next when you are ready for the questions.'] });
    add({ ...base, id: `p2-${mapId}-q9`, q: 'q9', type: 'choice', text: T.q9[0], options: T.q9[1],
      marks: abMarks(m.set), truth: m.set.answer });
    add({ ...base, id: `p2-${mapId}-q10`, q: 'q10', type: 'click', want: 'any', text: T.q10[0],
      ring: m.ring, truth: m.ring.highest });
    if (dots) {
      add({ ...base, id: `p2-${mapId}-q11`, q: 'q11', type: 'click', want: 'bead', text: T.q11[0],
        marks: [{ letter: 'C', code: m.C, on: 'place', turn: 0 }], truth: m.C });
      add({ ...base, id: `p2-${mapId}-q12`, q: 'q12', type: 'click', want: 'place', text: T.q12[0],
        marks: [{ letter: 'D', code: m.D, on: 'bead', turn: 0 }], truth: m.D });
    }
    add({ ...base, id: `p2-${mapId}-q8`, q: 'q8', type: 'scale', text: T.q8[0], options: T.q8[1] });
  });

  // Questions asked once at the end, then the last screen.
  const END_PART = 'At the end';
  const mapKinds = P1.order;
  add({ id: 'end-q13', part: END_PART, q: 'q13', type: 'choice', text: T.q13[0], options: T.q13[1] });
  add({ id: 'end-q14', part: END_PART, q: 'q14', type: 'choice', text: T.q14[0], options: T.q14[1] });
  add({ id: 'end-q15', part: END_PART, q: 'q15', type: 'rank', text: T.q15[0], items: mapKinds });
  add({ id: 'end-q16', part: END_PART, q: 'q16', type: 'pickmap', text: T.q16[0], items: mapKinds });
  add({ id: 'end-q17', part: END_PART, q: 'q17', type: 'text', text: T.q17[0] });
  add({ id: 'done', part: 'Finished', type: 'done' });

  // Question number shown on screen and stored in the results, from the key used in T.
  const qNumber = {};
  for (let n = 1; n <= 17; n++) qNumber['q' + n] = n;

  /* ---------- the results record ---------- */

  const R = {
    study: '54284',
    participant: '',
    started: new Date().toISOString(),
    finished: null,
    page: { width: innerWidth, height: innerHeight, mapFrame: [W, H] },
    data: {
      appBuild: META.appBuild, exported: META.exported, strands: META.strands, lensRadius: LENS_R,
      config: JSON.parse(JSON.stringify(CFG))   // the exact markers used, so the answers can be scored later
    },
    order: screens.map(s => s.id),
    responses: {}
  };
  let cur = -1;          // index of the screen on show
  let shownAt = 0;       // time the current screen was shown
  let saved = false;     // true once the results file was saved

  // The response record of a screen, made the first time the screen is shown.
  const rec = s => R.responses[s.id] || (R.responses[s.id] = {
    id: s.id, part: s.part, map: s.map || null, way: s.way || 0,
    question: s.q ? qNumber[s.q] || s.q : null,
    answer: null, strokes: [], clicks: [], pointer: [], ms: 0, visits: 0
  });

  /* ---------- map drawing ---------- */

  const svg = $('map');
  const gBase = $('base');      // the map as the app drew it
  const gHi = $('hilite');      // Way 1 and Way 2 highlights
  const gMarks = $('marks');    // rings and letters
  const gInk = $('ink');        // what the participant draws or clicks
  const tip = $('tip');
  let scene = null, sceneKind = null;

  /* Put one of the two maps into the SVG. Nothing happens if it is already there.
     The necklace map comes from the app with pointer-events="none" on its land areas, so the mouse
     would never find an area there. That attribute is removed, so Way 1 and question 12 work on the land. */
  function drawScene(kind) {
    if (sceneKind === kind) return;
    sceneKind = kind;
    scene = SCENES[kind];
    gBase.innerHTML = scene.svg;
    gBase.querySelectorAll('path[data-area]').forEach(area => area.removeAttribute('pointer-events'));
  }

  // Mouse position on the page turned into map units.
  const toMap = ev => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [q.x, q.y];
  };
  const anchor = code => scene.areas[code].anchor;                          // centre of an area
  const beadXY = code => [scene.beads[code].x, scene.beads[code].y];        // centre of a dot
  const rateText = a => a.sir == null ? 'No data published for this area'
    : `Rate: ${a.sir.toFixed(2)} times the Australian average`;

  /* Code of the area under the mouse, or null. */
  function areaAt(ev) {
    for (const node of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      if (node.dataset && node.dataset.area) return node.dataset.code;
    }
    return null;
  }

  /* Code of the dot under a map point (with 2 units of slack), the nearest one if several, or null. */
  function beadAt(p) {
    if (!scene.beads || !Object.keys(scene.beads).length) return null;
    let best = null, bestDist = Infinity;
    for (const code in scene.beads) {
      const b = scene.beads[code];
      const d = Math.hypot(b.x - p[0], b.y - p[1]);
      if (d <= b.r + 2 && d < bestDist) { bestDist = d; best = code; }
    }
    return best;
  }

  /* Draw the ring and the letters (A, B, C, D) of a screen.
     Letters sit inland of a place and seaward of a dot, so they never cover the dots they point to.
     When a screen has two letters (A and B) they are pushed apart along the coast, the letter whose
     target lies further that way going that way, so the two pointer lines never cross. */
  function drawMarks(s) {
    gMarks.innerHTML = '';
    if (s.ring) {
      const r = s.ring;
      el('circle', { cx: r.cx, cy: r.cy, r: r.r, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, gMarks);
      el('circle', { cx: r.cx, cy: r.cy, r: r.r, fill: 'none', stroke: '#1f2328', 'stroke-width': 2 }, gMarks);
    }

    // For each letter: its target point, the direction away from it, and the direction along the coast.
    const marks = (s.marks || []).map(m => {
      const target = m.on === 'bead' ? beadXY(m.code) : anchor(m.code);
      let dx = target[0] - CENTRE[0], dy = target[1] - CENTRE[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const out = m.on === 'bead' ? 1 : -1;     // dots: push out to sea, places: push inland
      return { m, t: target, ux: dx * out, uy: dy * out, px: -dy, py: dx };
    });
    if (marks.length === 2) {
      const [a, b] = marks;
      const posA = a.t[0] * a.px + a.t[1] * a.py;
      const posB = b.t[0] * a.px + b.t[1] * a.py;
      a.side = posA >= posB ? 1 : -1;
      b.side = -a.side;
    }

    marks.forEach(({ m, t, ux, uy, px, py, side }) => {
      const reach = m.on === 'bead' ? 74 : 46;     // dots get the longer pointer so the letter clears all five strands
      const spread = side ? 24 : 0;
      let lx = t[0] + ux * reach + px * spread * (side || 0);
      let ly = t[1] + uy * reach + py * spread * (side || 0);
      lx = Math.max(14, Math.min(W - 14, lx));
      ly = Math.max(14, Math.min(H - 14, ly));

      const g = el('g', { 'data-mark': m.letter }, gMarks);
      // The pointer line starts at the edge of the letter box, not its centre.
      const d = Math.hypot(t[0] - lx, t[1] - ly) || 1;
      const ex = lx + (t[0] - lx) * (11 / d), ey = ly + (t[1] - ly) * (11 / d);
      el('line', { x1: ex, y1: ey, x2: t[0], y2: t[1], stroke: '#fff', 'stroke-width': 3 }, g);
      el('line', { x1: ex, y1: ey, x2: t[0], y2: t[1], stroke: '#1f2328', 'stroke-width': 1.2 }, g);
      if (m.on === 'bead') {
        const r = scene.beads[m.code].r + 2.5;
        el('circle', { cx: t[0], cy: t[1], r, fill: 'none', stroke: '#1f2328', 'stroke-width': 1.5 }, g);
      } else {
        el('circle', { cx: t[0], cy: t[1], r: 2.2, fill: '#1f2328', stroke: '#fff', 'stroke-width': 1 }, g);
      }
      el('rect', { x: lx - 10, y: ly - 10, width: 20, height: 20, rx: 3, fill: '#fff', stroke: '#1f2328',
        'stroke-width': 1.4 }, g);
      const label = el('text', { x: lx, y: ly + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700,
        fill: '#1f2328', 'font-family': 'Segoe UI, Arial, sans-serif' }, g);
      label.textContent = m.letter;
    });
  }

  /* Draw the colour key under the map, and the dot size key on the necklace map. */
  function drawKeys(kind) {
    const stops = META.colourStops;
    const lo = stops[0][0], hi = stops[stops.length - 1][0];
    const pct = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
    const gradient = 'linear-gradient(to right,' + stops.map(([v, c]) => `${c} ${pct(v)}`).join(',') + ')';
    let html = '<div class="ckey">'
      + '<div>Colour: cancer rate compared with the Australian average</div>'
      + `<div class="bar" style="background:${gradient}"></div>`
      + '<div class="ticks">'
      + `<span style="left:0;transform:none">${lo.toFixed(2)}</span>`
      + `<span style="left:${pct(1)}">1.00 = Australian average</span>`
      + `<span style="left:100%;transform:translateX(-100%)">${hi.toFixed(2)}</span>`
      + '</div>'
      + '<div class="ends"><span>Lower than average</span><span>Higher than average</span></div>'
      + `<div class="np"><i style="background:${META.npColour}"></i>No data published</div>`
      + '</div>';

    if (kind === 'necklace') {
      // Dots in the key are drawn at the same size as on the map, so scale them with the map.
      const scale = (svg.getBoundingClientRect().width || W) / W;
      const labels = ['up to 30,000 people', '30,000 to 50,000', '50,000 to 80,000', 'over 80,000'];
      let y = 0, rows = '';
      META.beadClasses.forEach((sizeClass, i) => {
        const r = sizeClass.r * scale;
        const rowHeight = Math.max(r * 2 + 6, 20);
        y += rowHeight;
        const mid = y - rowHeight / 2;
        rows += `<circle cx="14" cy="${mid}" r="${r}" fill="#e2e8f0" stroke="#475569"/>`
          + `<text x="32" y="${mid + 4}" font-size="13" fill="#475569">${labels[i]}</text>`;
      });
      html += `<div class="skey"><div>Dot size: number of people in the area</div><svg width="200" height="${y}">${rows}</svg></div>`;
    }
    $('keys').innerHTML = html;
  }

  /* ---------- Way 1 and Way 2 (Part 2) ---------- */

  let way = 0;              // 0 on still maps, 1 or 2 on the interactive maps
  let lastFocus = null;     // Way 1: code of the area or dot pointed at last
  let lastSample = 0;       // Way 2: time the circle position was last recorded
  let listTimer = null;     // Way 2: pending update of the list

  /* Remove every highlight and the tooltip, and make all dots bright again. */
  function clearHi() {
    gHi.innerHTML = '';
    tip.hidden = true;
    if (sceneKind === 'necklace') {
      gBase.querySelectorAll('circle[data-bead]').forEach(c => c.removeAttribute('style'));
    }
  }

  /* Show the name and rate of an area next to the mouse, kept inside the map box. */
  function showTip(ev, a) {
    tip.innerHTML = `<b>${esc(a.name)}</b>${esc(rateText(a))}`;
    tip.hidden = false;
    const box = $('mapWrap').getBoundingClientRect();
    let x = ev.clientX - box.left + 16, y = ev.clientY - box.top + 14;
    if (x + 270 > box.width) x = ev.clientX - box.left - 16 - tip.offsetWidth;
    if (y + 70 > box.height) y = ev.clientY - box.top - 14 - tip.offsetHeight;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  /* Way 1: point at one area or dot. On the necklace map the dot and its place get a red ring and
     a red line joins them. On the choropleth the area gets a red outline. */
  function way1(ev) {
    const p = toMap(ev);
    const code = (sceneKind === 'necklace' && beadAt(p)) || areaAt(ev);
    gHi.innerHTML = '';
    if (!code) { tip.hidden = true; noteFocus(null); return; }
    const a = scene.areas[code];
    if (sceneKind === 'necklace') {
      const b = scene.beads[code], t = a.anchor;
      el('line', { x1: b.x, y1: b.y, x2: t[0], y2: t[1], stroke: '#fff', 'stroke-width': 3.2 }, gHi);
      el('line', { x1: b.x, y1: b.y, x2: t[0], y2: t[1], stroke: '#c62828', 'stroke-width': 1.6, 'data-way1': 'line' }, gHi);
      el('circle', { cx: b.x, cy: b.y, r: b.r + 3, fill: 'none', stroke: '#c62828', 'stroke-width': 2.2, 'data-way1': 'ring' }, gHi);
      el('circle', { cx: t[0], cy: t[1], r: 7, fill: 'none', stroke: '#c62828', 'stroke-width': 2.2, 'data-way1': 'ring' }, gHi);
    } else {
      const src = gBase.querySelector(`path[data-area][data-code="${code}"]`);
      if (src) {
        const outline = el('path', { d: src.getAttribute('d'), fill: 'none', stroke: '#c62828', 'stroke-width': 2,
          'data-way1': 'outline' }, gHi);
        const transform = src.parentNode.getAttribute('transform');
        if (transform) outline.setAttribute('transform', transform);
      }
    }
    showTip(ev, a);
    noteFocus(code);
  }

  /* Way 1: record what the mouse points at, once each time it changes. */
  function noteFocus(code) {
    if (code === lastFocus) return;
    lastFocus = code;
    const s = screens[cur];
    if (s && s.way) rec(s).pointer.push([now() - shownAt, code]);
  }

  /* Way 2: a circle follows the mouse and picks every area whose centre is inside it.
     On the necklace map the dots of the picked areas stay bright and lines join them to their places.
     The circle position and how many areas it holds are recorded every 200 ms. */
  function way2(ev) {
    const p = toMap(ev);
    gHi.innerHTML = '';
    el('circle', { cx: p[0], cy: p[1], r: LENS_R, fill: 'rgba(15,23,42,0.04)', stroke: '#111827', 'stroke-width': 1.4,
      'stroke-dasharray': '4 3', 'data-way2': 'circle' }, gHi);

    // Areas in the circle, highest rate first, areas with no data last, ties by name.
    const rate = a => a.sir == null ? -1 : a.sir;
    const picked = Object.values(scene.areas)
      .filter(a => a.anchor && Math.hypot(a.anchor[0] - p[0], a.anchor[1] - p[1]) <= LENS_R)
      .sort((x, y) => rate(y) - rate(x) || x.name.localeCompare(y.name));

    if (sceneKind === 'necklace') {
      const pickedCodes = new Set(picked.map(a => a.code));
      gBase.querySelectorAll('circle[data-bead]').forEach(c => {
        c.style.opacity = pickedCodes.has(c.dataset.code) ? '1' : '0.15';
      });
      picked.forEach(a => {
        const b = scene.beads[a.code];
        el('line', { x1: b.x, y1: b.y, x2: a.anchor[0], y2: a.anchor[1], stroke: '#334155', 'stroke-width': 0.9,
          opacity: 0.8, 'data-way2': 'line' }, gHi);
      });
    }

    // The list waits until the mouse rests, so a quick move from the map to the list keeps it.
    clearTimeout(listTimer);
    listTimer = setTimeout(() => showLensList(picked), LIST_DELAY_MS);

    const t = now();
    if (t - lastSample > 200) {
      lastSample = t;
      const s = screens[cur];
      if (s && s.way) rec(s).pointer.push([t - shownAt, +p[0].toFixed(1), +p[1].toFixed(1), picked.length]);
    }
  }

  /* Write the Way 2 list: the areas in the circle, highest rate first. */
  function showLensList(picked) {
    const list = $('lensList');
    list.hidden = false;
    if (picked.length) {
      const plural = picked.length > 1 ? 's' : '';
      const rows = picked.map(a => `<li data-code="${a.code}"><i style="background:${a.fill}"></i>`
        + `<span>${esc(a.name)}</span><b>${a.sir == null ? 'no data' : a.sir.toFixed(2)}</b></li>`).join('');
      list.innerHTML = `<div class="lh">${picked.length} area${plural} in the circle, highest rate first</div><ol>${rows}</ol>`;
    } else if (list.querySelector('li')) {
      // The circle is empty (for example over the sea): keep the last list so it can still be read.
      keepLastList();
    } else {
      list.innerHTML = '<div class="lh">No area has its centre inside the circle. Move the circle over the map.</div>';
    }
  }

  /* Way 2 keeps its last list of areas when the circle becomes empty or the mouse leaves the map,
     so the participant can move to the list and scroll it. The heading says it is the last list. */
  function keepLastList() {
    const head = $('lensList').querySelector('.lh');
    const count = $('lensList').querySelectorAll('li').length;
    if (head && count) head.textContent = `Last areas in the circle: ${count}, highest rate first`;
  }

  /* The mouse left the map: remove the highlights, keep the Way 2 list. */
  function leaveMap() {
    clearHi();
    lastFocus = null;
    clearTimeout(listTimer);
    if (way === 2) keepLastList();
  }

  /* ---------- drawing on the still maps and clicking on the interactive maps ---------- */

  let stroke = null;      // the line being drawn, while the pen or mouse button is down

  // A map point rounded to 0.1 map units, as stored in the results.
  const roundPoint = p => [+p[0].toFixed(1), +p[1].toFixed(1)];

  /* Draw again the lines of the current screen, and a blue ring on its last click. */
  function inkRedraw(s) {
    gInk.innerHTML = '';
    rec(s).strokes.forEach(st => el('polyline', {
      points: st.points.map(p => p[0] + ',' + p[1]).join(' '),
      fill: 'none', stroke: '#1d4ed8', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, gInk));
    (rec(s).clicks || []).slice(-1).forEach(c => {
      el('circle', { cx: c.x, cy: c.y, r: 9, fill: 'none', stroke: '#1d4ed8', 'stroke-width': 2.4, 'data-click': '1' }, gInk);
      el('circle', { cx: c.x, cy: c.y, r: 2, fill: '#1d4ed8' }, gInk);
    });
  }

  // Pen or mouse down: start a line on a drawing screen, or record a click on a click screen.
  svg.addEventListener('pointerdown', ev => {
    const s = screens[cur];
    if (!s) return;
    if (s.type === 'draw') {
      svg.setPointerCapture(ev.pointerId);
      stroke = { t0: now() - shownAt, pointerType: ev.pointerType, points: [roundPoint(toMap(ev))] };
      rec(s).strokes.push(stroke);
      inkRedraw(s);
    } else if (s.type === 'click') {
      const p = toMap(ev);
      const bead = sceneKind === 'necklace' ? beadAt(p) : null;
      const area = areaAt(ev);
      rec(s).clicks.push({ t: now() - shownAt, x: +p[0].toFixed(1), y: +p[1].toFixed(1), bead, area });
      // q11 wants a dot, q12 wants a place, q10 takes either.
      rec(s).answer = s.want === 'bead' ? bead : s.want === 'place' ? area : (bead || area);
      inkRedraw(s);
    }
  });

  // Mouse move: extend the line being drawn, or run Way 1 or Way 2.
  svg.addEventListener('pointermove', ev => {
    const s = screens[cur];
    if (!s) return;
    if (stroke && s.type === 'draw') {
      stroke.points.push(roundPoint(toMap(ev)));
      inkRedraw(s);
      return;
    }
    if (way === 1) way1(ev);
    else if (way === 2) way2(ev);
  });

  const endStroke = () => { stroke = null; };
  svg.addEventListener('pointerup', endStroke);
  svg.addEventListener('pointercancel', endStroke);
  svg.addEventListener('pointerleave', () => { if (!stroke) leaveMap(); });

  $('undo').onclick = () => {
    const s = screens[cur];
    rec(s).strokes.pop();
    inkRedraw(s);
  };
  $('clear').onclick = () => {
    const s = screens[cur];
    rec(s).strokes.length = 0;
    inkRedraw(s);
  };

  /* ---------- question widgets ---------- */

  /* A small picture of one of the two maps, for questions 15 and 16. */
  function thumb(kind) {
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(MAP_NAME[kind])}">${SCENES[kind].svg}</svg>`;
  }

  /* Radio buttons for a choice question, or a row of five for the agreement scale. */
  function choiceHtml(s, r) {
    const radio = (option, i) => `<input type="radio" name="ans" value="${i}"${r.answer === option ? ' checked' : ''}>`;
    const open = '<fieldset class="choices"><legend class="hint" hidden>Answer</legend>';
    if (s.type === 'scale') {
      const cells = s.options.map((o, i) => `<label>${radio(o, i)}<span>${esc(o)}</span></label>`).join('');
      return open + '<div class="likert">' + cells + '</div></fieldset>';
    }
    const rows = s.options.map((o, i) => `<label class="choice">${radio(o, i)}<span>${esc(o)}</span></label>`).join('');
    return open + rows + '</fieldset>';
  }

  /* Question 15: the two maps in the participant's order, with buttons to move each one. */
  function rankHtml(order) {
    const items = order.map((kind, i) => {
      const upDisabled = i ? '' : 'disabled';
      const downDisabled = i < order.length - 1 ? '' : 'disabled';
      return `<li data-k="${kind}"><span class="pos">${i + 1}</span>${thumb(kind)}`
        + `<span><span class="cap">${esc(MAP_NAME[kind])}</span><span class="moves">`
        + `<button type="button" class="btn" data-up="${i}" ${upDisabled}>Move up</button>`
        + `<button type="button" class="btn" data-dn="${i}" ${downDisabled}>Move down</button>`
        + '</span></span></li>';
    }).join('');
    return '<p class="hint">Number 1 is the map you like most.</p><ol class="rank">' + items + '</ol>';
  }

  /* Question 16: pick one of the two map pictures. */
  function pickMapHtml(kinds, r) {
    const items = kinds.map(kind => `<label class="pick"><span class="frame">${thumb(kind)}</span>`
      + `<span class="row"><input type="radio" name="ans" value="${kind}"${r.answer === kind ? ' checked' : ''}>`
      + `<span class="cap">${esc(MAP_NAME[kind])}</span></span></label>`).join('');
    return '<div class="picks">' + items + '</div>';
  }

  /* Write the question side of a screen and connect its answer widgets to the results record. */
  function renderQ(s) {
    const body = $('qBody');
    const r = rec(s);

    if (s.type === 'info') {
      body.innerHTML = `<h2>${esc(s.title)}</h2>` + s.body.map(p => `<p>${esc(p)}</p>`).join('');
      return;
    }
    if (s.type === 'done') {
      body.innerHTML = '<h2>Thank you</h2><p>You have finished the study. Please tell the researcher.</p>'
        + '<p class="done hint">For the researcher: <a href="#" id="dl">Download results</a>. '
        + 'The file is saved on this computer only.</p>';
      $('dl').onclick = e => { e.preventDefault(); download(); };
      return;
    }

    let num = '';
    if (s.qnum) num = `<div class="qnum">${s.qnum}</div>`;
    else if (s.q && qNumber[s.q]) num = `<div class="qnum">Question ${qNumber[s.q]}</div>`;
    const lead = s.q && T[s.q][2] ? `<p>${esc(T[s.q][2])}</p>` : '';
    let html = num + lead + `<h2>${esc(s.text)}</h2>`;

    if (s.type === 'choice' || s.type === 'scale') {
      html += choiceHtml(s, r);
    } else if (s.type === 'draw') {
      html += '<p class="hint">Draw on the map with the pen or the mouse. You can undo or clear your lines.</p>';
    } else if (s.type === 'click') {
      html += '<p class="hint">Click on the map. You can click again to change your answer.</p>';
    } else if (s.type === 'text') {
      html += `<textarea id="free" aria-label="Your answer">${esc(r.answer || '')}</textarea>`;
    } else if (s.type === 'rank') {
      r.answer = r.answer || s.items.slice();
      html += rankHtml(r.answer);
    } else if (s.type === 'pickmap') {
      html += pickMapHtml(s.items, r);
    }
    body.innerHTML = html;

    // Store the answer as soon as it changes.
    body.querySelectorAll('input[name="ans"]').forEach(input => {
      input.onchange = () => { r.answer = s.type === 'pickmap' ? input.value : s.options[+input.value]; };
    });
    const swap = (i, j) => { [r.answer[i], r.answer[j]] = [r.answer[j], r.answer[i]]; renderQ(s); };
    body.querySelectorAll('[data-up]').forEach(btn => { btn.onclick = () => swap(+btn.dataset.up - 1, +btn.dataset.up); });
    body.querySelectorAll('[data-dn]').forEach(btn => { btn.onclick = () => swap(+btn.dataset.dn + 1, +btn.dataset.dn); });
    const freeText = $('free');
    if (freeText) freeText.oninput = () => { r.answer = freeText.value; };
  }

  /* ---------- moving between screens ---------- */

  /* Add the time spent on the current screen to its record. */
  function leave() {
    const s = screens[cur];
    if (!s) return;
    rec(s).ms += now() - shownAt;
    stroke = null;
  }

  /* Show screen number i: the map if the screen has one, its marks and keys, and the question. */
  function show(i) {
    leave();
    cur = Math.max(0, Math.min(screens.length - 1, i));
    const s = screens[cur];
    rec(s).visits += 1;
    shownAt = now();

    $('partName').textContent = s.part;
    $('progress').style.width = (100 * cur / (screens.length - 1)).toFixed(1) + '%';
    const hasMap = !!s.map;
    $('mapCol').hidden = !hasMap;
    $('screen').classList.toggle('wide', !hasMap);
    $('lensList').hidden = true;
    way = 0;
    clearHi();
    clearTimeout(listTimer);

    if (hasMap) {
      drawScene(s.map);
      $('mapTitle').textContent = s.mapTitle || '';
      drawMarks(s);
      drawKeys(s.map);
      way = s.way || 0;
      if (way === 2) {
        $('lensList').hidden = false;
        $('lensList').innerHTML = LENS_HINT;
      }
      inkRedraw(s);
    }
    svg.classList.toggle('drawing', s.type === 'draw');
    svg.classList.toggle('clicking', s.type === 'click');
    $('drawTools').hidden = s.type !== 'draw';
    renderQ(s);

    $('next').hidden = s.type === 'done';
    $('next').textContent = cur === screens.length - 2 ? 'Finish' : 'Next';
    $('jump').value = s.id;
    if (s.type === 'done' && !R.finished) R.finished = new Date().toISOString();
    window.scrollTo(0, 0);
  }
  $('next').onclick = () => show(cur + 1);

  /* Save the results as 54284_<participant code>_<date and time>.json on this computer. */
  function download() {
    leave();
    shownAt = now();
    R.participant = $('pcode').value.trim() || R.participant;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const name = `54284_${R.participant || 'nocode'}_${stamp}.json`;
    const blob = new Blob([JSON.stringify(R, null, 1)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    saved = true;
  }

  // Ask before closing the page if answers were given and not saved yet.
  window.addEventListener('beforeunload', e => {
    if (!saved && Object.keys(R.responses).length > 2 && !params.has('screen')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---------- researcher bar (?researcher=1) and preview line ---------- */

  const jump = $('jump');
  screens.forEach((s, i) => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${i + 1}. ${s.id}`;
    jump.appendChild(option);
  });
  jump.onchange = () => show(screens.findIndex(s => s.id === jump.value));
  $('pcode').oninput = () => { R.participant = $('pcode').value.trim(); };
  $('hideBar').onclick = () => { $('researcher').hidden = true; };
  if (params.get('researcher') === '1') $('researcher').hidden = false;

  // The study itself runs offline from the folder (file://). Opened from a web address it is the preview.
  if (location.protocol === 'http:' || location.protocol === 'https:') $('preview').hidden = false;

  /* ---------- start ---------- */

  // Used by tools/e2e_check.mjs and tools/shots.mjs to read the screens and jump to one.
  window.study = {
    screens,
    results: R,
    show: id => show(screens.findIndex(s => s.id === id)),
    current: () => screens[cur] && screens[cur].id
  };
  const start = params.get('screen');
  const startIndex = start ? screens.findIndex(s => s.id === start) : 0;
  show(startIndex >= 0 ? startIndex : 0);
})();
