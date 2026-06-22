/* =========================================================================
   Wirtschaftswachstum – Lernseite
   Alle Interaktionen. Kein Framework, kein Build, kein localStorage.
   Zustand lebt nur im Speicher (Variablen), ist also nach Reload weg.
   ========================================================================= */

(function () {
  "use strict";

  // Kleine Helfer ----------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Deutsche Prozentanzeige, z. B. 1.7358 -> "+1,7 %"
  function pct(value, withSign = true) {
    const rounded = Math.round(value * 10) / 10;
    const sign = withSign && rounded > 0 ? "+" : "";
    return sign + rounded.toFixed(1).replace(".", ",") + " %";
  }

  /* =======================================================================
     NAVIGATION: Fortschrittsbalken + aktiver Link
     ===================================================================== */
  function initNav() {
    const bar = $("#progressBar");
    const links = $$(".nav__links a");

    // Fortschrittsbalken beim Scrollen (passiver Listener, nur Breite ändern)
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const ratio = max > 0 ? h.scrollTop / max : 0;
      bar.style.width = (ratio * 100).toFixed(1) + "%";
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Aktiven Abschnitt im Menü markieren (IntersectionObserver)
    const map = new Map();
    links.forEach((a) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) map.set(target, a);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("is-active"));
            const link = map.get(e.target);
            if (link) link.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    map.forEach((_, section) => io.observe(section));
  }

  /* =======================================================================
     0) HERO: animierte Wachstumskurve (BIP nominal, Mrd. €)
     ===================================================================== */
  function initHeroChart() {
    const host = $("#heroChart");
    const hint = $("#heroChartHint");
    if (!host) return;

    const data = [
      [2009, 2446], [2010, 2564], [2011, 2694], [2012, 2745],
      [2013, 2811], [2014, 2927], [2015, 3026], [2016, 3135],
      [2017, 3267], [2018, 3368], [2019, 3473], [2020, 3368],
      [2021, 3571],
    ];

    // Zeichenfläche
    const W = 720, H = 360;
    const padL = 46, padR = 16, padT = 24, padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yMin = 2300, yMax = 3650;
    const n = data.length;

    const x = (i) => padL + (i / (n - 1)) * plotW;
    const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    // Pfade aufbauen
    const linePts = data.map((d, i) => `${x(i).toFixed(1)},${y(d[1]).toFixed(1)}`);
    const lineD = "M" + linePts.join(" L");
    const areaD =
      `M${x(0)},${y(yMin)} L` + linePts.join(" L") + ` L${x(n - 1)},${y(yMin)} Z`;

    // Y-Gitterlinien
    let grid = "";
    [2400, 2800, 3200, 3600].forEach((v) => {
      const yy = y(v).toFixed(1);
      grid += `<line class="chart-grid" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
      grid += `<text class="chart-axis" x="${padL - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    });

    // X-Jahre (nur jedes zweite, sonst zu eng auf dem Handy)
    let xaxis = "";
    data.forEach((d, i) => {
      if (i % 2 === 0 || i === n - 1) {
        xaxis += `<text class="chart-axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${d[0]}</text>`;
      }
    });

    // Datenpunkte (Corona-Jahr 2020 hervorgehoben)
    let dots = "";
    data.forEach((d, i) => {
      const corona = d[0] === 2020;
      dots += `<circle class="chart-dot${corona ? " chart-dot--corona" : ""}"
        cx="${x(i).toFixed(1)}" cy="${y(d[1]).toFixed(1)}" r="5"
        data-year="${d[0]}" data-val="${d[1]}"></circle>`;
    });

    // Corona-Anmerkung
    const ci = data.findIndex((d) => d[0] === 2020);
    const anno = `<text class="chart-anno" x="${x(ci).toFixed(1)}" y="${(y(3368) + 22).toFixed(1)}" text-anchor="middle">Corona</text>`;

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Liniendiagramm des nominalen BIP von 2009 bis 2021, mit einem Rückgang 2020 durch Corona.">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2d5bff" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#2d5bff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        <path class="chart-area" d="${areaD}"/>
        <path class="chart-line" d="${lineD}"/>
        ${dots}
        ${anno}
        ${xaxis}
      </svg>`;

    // Linie beim Laden zeichnen lassen
    const line = $(".chart-line", host);
    if (line && !reduceMotion) {
      const len = line.getTotalLength();
      line.style.setProperty("--len", len);
      line.classList.add("is-draw");
    }

    // Werte beim Überfahren/Antippen der Punkte zeigen
    $$(".chart-dot", host).forEach((dot) => {
      const show = () => {
        $$(".chart-dot", host).forEach((d) => d.classList.remove("is-hot"));
        dot.classList.add("is-hot");
        const yr = dot.getAttribute("data-year");
        const val = dot.getAttribute("data-val");
        hint.textContent = `${yr}: ${val} Mrd. € ${yr === "2020" ? "· Corona-Rückgang" : ""}`;
      };
      dot.addEventListener("pointerenter", show);
      dot.addEventListener("pointerdown", show);
    });
  }

  /* =======================================================================
     1) Wachstumsraten-Rechner
     ===================================================================== */
  function initCalc() {
    const prev = $("#calcPrev");
    const curr = $("#calcCurr");
    const out = $("#calcResult");
    const status = $("#calcStatus");
    if (!prev || !curr || !out) return;

    function update() {
      const p = parseFloat(prev.value);
      const c = parseFloat(curr.value);
      if (!isFinite(p) || !isFinite(c) || p === 0) {
        out.textContent = "–";
        out.classList.remove("is-neg");
        if (status) { status.textContent = "Bitte beide Werte eingeben."; status.className = "calc__status"; }
        return;
      }
      const rate = ((c - p) / p) * 100;
      out.textContent = pct(rate);
      out.classList.toggle("is-neg", rate < 0);

      // Klartext: wächst, schrumpft oder unverändert
      if (status) {
        if (rate > 0.05) { status.textContent = "Die Wirtschaft wächst."; status.className = "calc__status is-up"; }
        else if (rate < -0.05) { status.textContent = "Die Wirtschaft schrumpft (Rezession)."; status.className = "calc__status is-down"; }
        else { status.textContent = "Praktisch keine Veränderung."; status.className = "calc__status"; }
      }
    }

    prev.addEventListener("input", update);
    curr.addEventListener("input", update);

    // Beispiel-Buttons füllen die Felder mit echten BIP-Zahlen
    $$(".exbtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        prev.value = btn.dataset.prev;
        curr.value = btn.dataset.curr;
        update();
      });
    });

    update();
  }

  /* =======================================================================
     2) Wertschöpfungskette
     ===================================================================== */
  function initChain() {
    const wrap = $("#chain");
    const detail = $("#chainDetail");
    const sumBox = $("#chainSum");
    if (!wrap) return;

    const steps = [
      { name: "Forstbetrieb", sub: "verkauft Holz", vor: 0, preis: 60, ws: 60 },
      { name: "Sägewerk", sub: "sägt Bretter", vor: 60, preis: 100, ws: 40 },
      { name: "Möbelhersteller", sub: "baut den Schreibtisch", vor: 100, preis: 220, ws: 120 },
      { name: "Möbelgeschäft", sub: "verkauft an Kundschaft", vor: 220, preis: 300, ws: 80 },
    ];
    const visited = new Set();

    // Stufen + Pfeil-Verbinder rendern (echte Kette statt Liste)
    const arrow = `<span class="chain__arrow" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </span>`;
    wrap.innerHTML = steps
      .map(
        (s, i) => `
        <button class="chain__step" type="button" data-i="${i}">
          <span class="chain__num">${i + 1}</span>
          <span class="chain__name">${s.name}</span>
          <span class="chain__sub">${s.sub}</span>
        </button>`
      )
      .join(arrow);

    function select(i) {
      const s = steps[i];
      $$(".chain__step", wrap).forEach((b) =>
        b.classList.toggle("is-active", +b.dataset.i === i)
      );
      detail.innerHTML = `
        <div class="detailbox">
          <h4>${s.name}</h4>
          <dl>
            <dt>Vorleistung (eingekauft)</dt><dd>${s.vor} €</dd>
            <dt>Verkaufspreis (Leistung)</dt><dd>${s.preis} €</dd>
            <dt class="ws">Wertschöpfung = Leistung − Vorleistung</dt>
            <dd class="ws">${s.preis} − ${s.vor} = ${s.ws} €</dd>
          </dl>
        </div>`;
      visited.add(i);
      // Pointe einblenden, sobald alle Stufen einmal angesehen wurden
      if (visited.size === steps.length) {
        sumBox.hidden = false;
        sumBox.innerHTML =
          `Summe aller Wertschöpfungen: <span class="mono">60 + 40 + 120 + 80 = 300 €</span> – genau der Endpreis. Doppelt zählen ausgeschlossen.`;
      }
    }

    $$(".chain__step", wrap).forEach((b) =>
      b.addEventListener("click", () => select(+b.dataset.i))
    );
  }

  /* =======================================================================
     3) Drei Berechnungsarten (Akkordeon)
     ===================================================================== */
  function initMethods() {
    const wrap = $("#methods");
    if (!wrap) return;

    const methods = [
      {
        tag: "Entstehung",
        name: "Wo wird es erarbeitet?",
        color: "var(--entstehung)",
        formula: [
          "Produktionswert",
          "− Vorleistungen",
          "= Bruttowertschöpfung",
          "+ Gütersteuern",
          "− Gütersubventionen",
          "= Bruttoinlandsprodukt",
        ],
      },
      {
        tag: "Verwendung",
        name: "Wofür wird es genutzt?",
        color: "var(--verwendung)",
        formula: [
          "Private Konsumausgaben",
          "+ Konsumausgaben des Staates",
          "+ Investitionen",
          "+ Exporte",
          "− Importe",
          "= Bruttoinlandsprodukt",
        ],
      },
      {
        tag: "Verteilung",
        name: "Wie wird es verteilt?",
        color: "var(--verteilung)",
        formula: [
          "Löhne und Gehälter",
          "+ Unternehmens- und Vermögenseinkommen",
          "+ indirekte Steuern",
          "− Subventionen",
          "+ Abschreibungen",
          "− Saldo der Einkommen aus dem Ausland",
          "= Bruttoinlandsprodukt",
        ],
      },
    ];

    wrap.innerHTML = methods
      .map(
        (m, i) => `
        <div class="method" style="--m-color:${m.color}">
          <button class="method__btn" type="button" aria-expanded="false" aria-controls="m-body-${i}">
            <span class="method__tag">${m.tag}</span>
            <span class="method__name">${m.name}</span>
            <svg class="method__chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div class="method__body" id="m-body-${i}">
            <div class="method__formula">${m.formula.join("<br />")}</div>
          </div>
        </div>`
      )
      .join("");

    $$(".method__btn", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        const method = btn.closest(".method");
        const open = method.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  /* =======================================================================
     4) Nominal vs. real (Slider + Balken)
     ===================================================================== */
  function initSim() {
    const nom = $("#nomSlider");
    const inf = $("#infSlider");
    if (!nom || !inf) return;

    const nomVal = $("#nomVal");
    const infVal = $("#infVal");
    const barNom = $("#barNom");
    const barReal = $("#barReal");
    const barNomLabel = $("#barNomLabel");
    const barRealLabel = $("#barRealLabel");
    const MAX = 12; // Skala der Balken

    function fmt(v) {
      return (Math.round(v * 10) / 10).toFixed(1).replace(".", ",") + " %";
    }

    function update() {
      const n = parseFloat(nom.value);
      const i = parseFloat(inf.value);
      const real = n - i; // Faustregel

      nomVal.textContent = fmt(n);
      infVal.textContent = fmt(i);

      barNom.style.width = Math.max(0, (n / MAX) * 100) + "%";
      barNomLabel.textContent = fmt(n);

      barReal.style.width = Math.max(0, Math.min(100, (real / MAX) * 100)) + "%";
      barReal.classList.toggle("is-neg", real < 0);
      barRealLabel.textContent = fmt(real);
    }
    nom.addEventListener("input", update);
    inf.addEventListener("input", update);
    update();
  }

  /* =======================================================================
     5) Szenario-Karten "Gut fürs BIP?"
     ===================================================================== */
  function initScenarios() {
    const wrap = $("#scenarios");
    if (!wrap) return;

    // dir: "up" | "down" | "flat"
    const data = [
      { q: "Autounfall", bip: "up", well: "down",
        exp: "Reparatur, Arzt, Versicherung und Abschleppdienst kosten Geld – das BIP steigt, obwohl es allen Beteiligten schlechter geht." },
      { q: "Epidemie & Pharma-Umsatz", bip: "up", well: "down",
        exp: "Es werden mehr Medikamente verkauft, das BIP steigt. Gesünder oder zufriedener ist dadurch aber niemand." },
      { q: "Angehörige zuhause pflegen", bip: "flat", well: "up",
        exp: "Unbezahlte Pflege taucht im BIP gar nicht auf – obwohl sie für die Menschen extrem wertvoll ist." },
      { q: "Wegwerfprodukte / geplanter Verschleiß", bip: "up", well: "down",
        exp: "Geht etwas schnell kaputt, wird mehr neu gekauft. Das BIP steigt – Ressourcen und Umwelt zahlen drauf." },
      { q: "Mehr in Bildung investieren", bip: "up", well: "up",
        exp: "Bildung kostet, also steigt das BIP – und langfristig profitieren alle. Das nennt man qualitatives Wachstum." },
    ];

    const tag = (label, dir) => {
      const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "–";
      const cls = dir === "up" ? "tag--up" : dir === "down" ? "tag--down" : "tag";
      const style = dir === "flat" ? ' style="background:var(--bg);color:var(--muted)"' : "";
      return `<span class="tag ${cls}"${style}>${label} ${arrow}</span>`;
    };

    wrap.innerHTML = data
      .map(
        (s, i) => `
        <button class="scenario" type="button" aria-expanded="false" aria-controls="sc-${i}">
          <span class="scenario__q">${s.q}</span>
          <span class="scenario__result" id="sc-${i}">
            <span class="tags">${tag("BIP", s.bip)}${tag("Wohlstand", s.well)}</span>
            <span class="scenario__exp">${s.exp}</span>
          </span>
        </button>`
      )
      .join("");

    $$(".scenario", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        const open = btn.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  /* =======================================================================
     6) Mini-Quiz
     ===================================================================== */
  function initQuiz() {
    const wrap = $("#quizList");
    const scoreEl = $("#quizScore");
    const resetBtn = $("#quizReset");
    if (!wrap) return;

    const questions = [
      {
        q: "Woran lässt sich Wirtschaftswachstum messen?",
        options: [
          "An der Veränderung des realen Bruttonationaleinkommens.",
          "An der Höhe der Staatsverschuldung.",
          "An der Zahl neu gegründeter Unternehmen.",
          "Am nominalen BIP, ganz ohne Preisbereinigung.",
        ],
        correct: 0,
        exp: "Real – weil die Preissteigerung herausgerechnet wird. Sonst misst man nur höhere Preise, nicht mehr Leistung.",
      },
      {
        q: "Welches Ziel gehört zum Magischen Viereck?",
        options: [
          "Stetiges und angemessenes Wirtschaftswachstum.",
          "Möglichst hohe Steuereinnahmen.",
          "Eine gerechte Einkommensverteilung.",
          "Eine niedrige Staatsverschuldung.",
        ],
        correct: 0,
        exp: "Das Magische Viereck: Preisstabilität, hoher Beschäftigungsstand, außenwirtschaftliches Gleichgewicht und stetiges, angemessenes Wachstum.",
      },
      {
        q: "Welche Aussage zum BIP stimmt?",
        options: [
          "Das BIP ist die Summe aller Güter und Dienstleistungen, die in einem Jahr in einer Volkswirtschaft erbracht werden – in Geldeinheiten.",
          "Das BIP misst nur die exportierten Güter.",
          "Das BIP zählt auch Hausarbeit und Ehrenamt mit.",
          "Das BIP ist die Summe aller Ersparnisse der Haushalte.",
        ],
        correct: 0,
        exp: "Genau: alles Produzierte, in Geld bewertet. Hausarbeit und Ehrenamt fehlen übrigens komplett.",
      },
      {
        q: "Das BIP steigt um 9 %, das Preisniveau um 4 %. Wie hoch ist das reale Wachstum?",
        options: ["ca. 5 %", "ca. 13 %", "ca. 9 %", "ca. 4 %"],
        correct: 0,
        exp: "Faustregel: real ≈ nominal − Inflation = 9 − 4 = 5 %.",
      },
      {
        q: "Was erhöht das Bruttonationaleinkommen?",
        options: [
          "Ein inländischer Autohersteller produziert 10.000 PKW mehr als im Vorjahr.",
          "Die Brotpreise steigen um 5 %.",
          "Ein ausländischer Konzern produziert mehr in seinem Heimatland.",
          "Der Staat erhöht die Mehrwertsteuer.",
        ],
        correct: 0,
        exp: "Mehr echte Produktion durch Inländer erhöht das BNE. Reine Preissteigerungen zählen real nicht.",
      },
      {
        q: "Wo liegt ein wirtschaftspolitischer Zielkonflikt vor?",
        options: [
          "Bei steigender Beschäftigung erhöht sich das Preisniveau.",
          "Mehr Wachstum führt zu mehr Beschäftigung.",
          "Stabile Preise und hohe Beschäftigung treten gemeinsam auf.",
          "Sinkende Inflation senkt die Arbeitslosigkeit.",
        ],
        correct: 0,
        exp: "Klassischer Konflikt: mehr Beschäftigung kann die Preise steigen lassen – Beschäftigung gegen Preisstabilität.",
      },
    ];

    let score = 0;
    let answered = 0;

    // Optionen mischen, damit die richtige Antwort nicht immer an gleicher Stelle steht
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function render() {
      score = 0;
      answered = 0;
      updateScore();

      wrap.innerHTML = questions
        .map((q, qi) => {
          const correctText = q.options[q.correct];
          const opts = shuffle(q.options);
          const buttons = opts
            .map(
              (text) =>
                `<button class="opt" type="button" data-correct="${text === correctText}">
                  <span class="opt__mark" aria-hidden="true"></span>${text}
                </button>`
            )
            .join("");
          return `
            <div class="q" data-exp="${encodeURIComponent(q.exp)}">
              <div class="q__num">Frage ${qi + 1} von ${questions.length}</div>
              <p class="q__text">${q.q}</p>
              <div class="q__options">${buttons}</div>
              <p class="q__feedback" aria-live="polite"></p>
            </div>`;
        })
        .join("");

      // Klick-Logik pro Frage
      $$(".q", wrap).forEach((qEl) => {
        const fb = $(".q__feedback", qEl);
        const exp = decodeURIComponent(qEl.dataset.exp);
        $$(".opt", qEl).forEach((opt) => {
          opt.addEventListener("click", () => {
            if (qEl.dataset.done) return; // Frage schon beantwortet
            qEl.dataset.done = "1";
            const isCorrect = opt.dataset.correct === "true";

            // alle Optionen sperren und markieren
            $$(".opt", qEl).forEach((o) => {
              o.disabled = true;
              if (o.dataset.correct === "true") {
                o.classList.add("is-correct");
                $(".opt__mark", o).textContent = "✓ ";
              }
            });
            if (!isCorrect) {
              opt.classList.add("is-wrong");
              $(".opt__mark", opt).textContent = "✗ ";
            }

            fb.textContent = (isCorrect ? "Richtig. " : "Nicht ganz. ") + exp;
            fb.classList.add("show", isCorrect ? "ok" : "no");

            if (isCorrect) score++;
            answered++;
            updateScore();
          });
        });
      });
    }

    function updateScore() {
      const total = questions.length;
      if (answered < total) {
        scoreEl.textContent = `${score} von ${total} richtig`;
        scoreEl.classList.remove("is-done");
        return;
      }
      // Alle Fragen beantwortet: motivierende Auswertung
      let msg;
      if (score === total) msg = "Perfekt – sitzt alles!";
      else if (score >= 4) msg = "Stark, das meiste sitzt.";
      else if (score >= 2) msg = "Solide Basis. Schau dir die Erklärungen oben nochmal an.";
      else msg = "Kein Stress – geh die Abschnitte nochmal durch und probier es erneut.";
      scoreEl.textContent = `${score} von ${total} richtig. ${msg}`;
      scoreEl.classList.add("is-done");
    }

    resetBtn.addEventListener("click", () => {
      render();
      wrap.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });

    render();
  }

  /* =======================================================================
     7) Glossar-Chips
     ===================================================================== */
  function initGlossary() {
    const wrap = $("#chips");
    const def = $("#chipDef");
    if (!wrap) return;

    const terms = [
      { term: "BIP", def: "Bruttoinlandsprodukt: der Wert aller Güter und Dienstleistungen, die in einem Jahr im Inland erzeugt werden (Inlandskonzept)." },
      { term: "BNE", def: "Bruttonationaleinkommen: der Wert aller Güter und Dienstleistungen, die von Inländern erzeugt werden – im In- und Ausland (Inländerkonzept). Früher: Bruttosozialprodukt." },
      { term: "nominal", def: "Zu aktuellen Marktpreisen gerechnet. Preissteigerungen sind enthalten." },
      { term: "real", def: "Preisbereinigt, zu den Preisen eines Basisjahres. Die Inflation ist herausgerechnet – deshalb aussagekräftiger." },
      { term: "Wertschöpfung", def: "Leistung minus Vorleistung: der Mehrwert, der auf einer Produktionsstufe neu geschaffen wird." },
      { term: "Vorleistung", def: "Eingekaufte Güter und Dienste, die im Produktionsprozess verbraucht werden." },
      { term: "Magisches Viereck", def: "Vier gleichzeitig angestrebte Ziele der Wirtschaftspolitik: Preisstabilität, hoher Beschäftigungsstand, außenwirtschaftliches Gleichgewicht und stetiges, angemessenes Wachstum. Magisch heißt es, weil schwer alle zugleich erreichbar sind." },
    ];

    wrap.innerHTML = terms
      .map((t, i) => `<button class="chip" type="button" data-i="${i}" aria-controls="chipDef">${t.term}</button>`)
      .join("");

    $$(".chip", wrap).forEach((chip) => {
      chip.addEventListener("click", () => {
        const i = +chip.dataset.i;
        const active = chip.classList.contains("is-active");
        $$(".chip", wrap).forEach((c) => c.classList.remove("is-active"));
        if (active) {
          def.hidden = true; // gleicher Chip nochmal -> zuklappen
          return;
        }
        chip.classList.add("is-active");
        def.hidden = false;
        def.innerHTML = `<b>${terms[i].term}:</b> ${terms[i].def}`;
      });
    });
  }

  /* =======================================================================
     Start
     ===================================================================== */
  initNav();
  initHeroChart();
  initCalc();
  initChain();
  initMethods();
  initSim();
  initScenarios();
  initQuiz();
  initGlossary();
})();
