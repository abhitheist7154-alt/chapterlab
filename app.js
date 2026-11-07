(() => {
  "use strict";

  const SUBJECTS = [
    { name: "Physics", icon: "⚛", subtitle: "Mechanics, electricity & more" },
    { name: "Chemistry", icon: "⚗", subtitle: "Physical, organic & inorganic" },
    { name: "Mathematics", icon: "∑", subtitle: "Algebra, calculus & more" }
  ];
  const LETTERS = ["A", "B", "C", "D"];
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const bankFileInput = document.getElementById("bank-file-input");

  let questions = Array.isArray(window.CHAPTERLAB_QUESTIONS) ? window.CHAPTERLAB_QUESTIONS : [];
  let selectedChapters = new Set();
  let selectedTopics = new Set();
  let expandedChapters = new Set();
  let questionCount = 20;
  let durationMinutes = 60;
  let currentView = "home";
  let testQuestions = [];
  let answers = {};
  let markedForReview = new Set();
  let currentIndex = 0;
  let remainingSeconds = 0;
  let elapsedSeconds = 0;
  let timerHandle = null;
  let startedAt = null;
  let lastResults = null;
  let toastHandle = null;
  let importedBank = false;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    try { localStorage.setItem("chapterlab-theme", theme); } catch (_) { /* storage may be unavailable */ }
  }

  try {
    const savedTheme = localStorage.getItem("chapterlab-theme");
    setTheme(savedTheme === "dark" ? "dark" : "light");
  } catch (_) { setTheme("light"); }

  themeToggle.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.getElementById("brand-home").addEventListener("click", () => {
    if (currentView === "test" && !window.confirm("Leave this test? Your current answers will be lost.")) return;
    stopTimer();
    currentView = "home";
    renderHome();
    window.scrollTo({top: 0, behavior: "smooth"});
  });

  document.getElementById("import-bank-button").addEventListener("click", () => bankFileInput.click());
  bankFileInput.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.questions;
      const validated = validateQuestionBank(list);
      if (!validated.length) throw new Error("The file has no valid question records.");
      if (!window.confirm(`Load ${validated.length} questions for this browser session? This replaces the currently active question bank until you reload the page.`)) {
        bankFileInput.value = "";
        return;
      }
      questions = validated;
      selectedChapters.clear();
      selectedTopics.clear();
      expandedChapters.clear();
      importedBank = true;
      if (currentView === "test") stopTimer();
      currentView = "home";
      renderHome();
      showToast(`${validated.length} questions loaded in this browser.`);
    } catch (error) {
      showToast(error.message || "Could not read that question bank.");
    } finally {
      bankFileInput.value = "";
    }
  });

  function validateQuestionBank(list) {
    if (!Array.isArray(list)) throw new Error("Expected a JSON array or an object with a questions array.");
    const allowedSubjects = new Set(SUBJECTS.map(s => s.name));
    const clean = [];
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q || !allowedSubjects.has(q.subject) || !q.chapter || !q.topic || !q.question) continue;
      const type = q.type || "single";
      if (type === "single") {
        if (!Array.isArray(q.options) || q.options.length !== 4 ||
            q.options.some(option => typeof option !== "string" || !option.trim()) ||
            !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) continue;
      } else if (type === "numeric") {
        const hasAnswer = Number.isFinite(Number(q.answer)) ||
          (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0 && q.acceptedAnswers.every(value => Number.isFinite(Number(value))));
        if (!hasAnswer) continue;
      } else continue;
      clean.push({
        id: String(q.id || `import-${i + 1}`),
        subject: q.subject,
        chapter: String(q.chapter),
        topic: String(q.topic),
        type,
        question: String(q.question),
        options: type === "single" ? q.options.map(String) : [],
        answer: type === "numeric" ? Number(q.answer) : q.answer,
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(Number) : undefined,
        tolerance: Number.isFinite(Number(q.tolerance)) ? Math.max(0, Number(q.tolerance)) : 0.000001,
        explanation: String(q.explanation || "No explanation supplied."),
        source: String(q.source || "Imported question"),
        year: q.year ? String(q.year) : "",
        session: q.session ? String(q.session) : "",
        shift: q.shift ? String(q.shift) : "",
        sourcePage: q.sourcePage ? String(q.sourcePage) : "",
        questionNumber: q.questionNumber ? String(q.questionNumber) : ""
      });
    }
    return clean;
  }

  function chapterMap() {
    const map = new Map();
    questions.forEach(q => {
      if (!map.has(q.subject)) map.set(q.subject, new Map());
      const chapters = map.get(q.subject);
      if (!chapters.has(q.chapter)) chapters.set(q.chapter, new Set());
      chapters.get(q.chapter).add(q.topic);
    });
    return map;
  }

  function key(subject, chapter) { return `${subject}|||${chapter}`; }
  function topicKey(subject, chapter, topic) { return `${subject}|||${chapter}|||${topic}`; }

  function getSelectedPool() {
    return questions.filter(q => selectedChapters.has(key(q.subject, q.chapter)) || selectedTopics.has(topicKey(q.subject, q.chapter, q.topic)));
  }

  function getSelectionLabelCount() { return selectedChapters.size + selectedTopics.size; }

  function renderHome() {
    currentView = "home";
    const map = chapterMap();
    const totalQuestions = questions.length;
    const selectedPool = getSelectedPool();
    const selectedLabelCount = getSelectionLabelCount();

    const subjectCards = SUBJECTS.map(subject => {
      const chapters = map.get(subject.name) || new Map();
      const chapterEntries = [...chapters.entries()];
      if (!chapterEntries.length) return "";
      const subjectKeys = chapterEntries.map(([chapter]) => key(subject.name, chapter));
      const allSelected = subjectKeys.every(k => selectedChapters.has(k));
      const chapterMarkup = chapterEntries.map(([chapter, topicSet]) => {
        const topics = [...topicSet];
        const chapterKey = key(subject.name, chapter);
        const wholeSelected = selectedChapters.has(chapterKey);
        const expanded = expandedChapters.has(chapterKey);
        const selectedTopicCount = topics.filter(topic => selectedTopics.has(topicKey(subject.name, chapter, topic))).length;
        return `
          <div class="chapter-item">
            <div class="chapter-row">
              <label class="check-wrap">
                <input type="checkbox" data-action="chapter-toggle" data-subject="${esc(subject.name)}" data-chapter="${esc(chapter)}" ${wholeSelected ? "checked" : ""}>
                <span class="chapter-name">${esc(chapter)}</span>
              </label>
              <span class="chapter-meta">${wholeSelected ? "All" : selectedTopicCount ? `${selectedTopicCount} topic${selectedTopicCount === 1 ? "" : "s"}` : `${questions.filter(q => q.subject === subject.name && q.chapter === chapter).length} Q`}</span>
              <button class="expand-button" data-action="expand-chapter" data-subject="${esc(subject.name)}" data-chapter="${esc(chapter)}" aria-label="${expanded ? "Hide" : "Show"} topics">${expanded ? "⌃" : "⌄"}</button>
            </div>
            ${expanded ? `<div class="topic-panel">${topics.map(topic => `
              <label class="topic-chip">
                <input type="checkbox" data-action="topic-toggle" data-subject="${esc(subject.name)}" data-chapter="${esc(chapter)}" data-topic="${esc(topic)}" ${selectedTopics.has(topicKey(subject.name, chapter, topic)) ? "checked" : ""}>
                ${esc(topic)}
              </label>`).join("")}</div>` : ""}
          </div>`;
      }).join("");
      return `
        <section class="subject-card">
          <div class="subject-head">
            <div class="subject-icon" aria-hidden="true">${subject.icon}</div>
            <div><div class="subject-title">${esc(subject.name)}</div><div class="subject-subtitle">${esc(subject.subtitle)}</div></div>
            <button class="subject-select-all" data-action="subject-toggle" data-subject="${esc(subject.name)}">${allSelected ? "Clear all" : "Select all"}</button>
          </div>
          <div class="chapter-list">${chapterMarkup}</div>
        </section>`;
    }).join("");

    app.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">Your personal question bank</p>
          <h1>Practice,<br>your way.</h1>
          <p class="hero-copy">Build a test around what you're studying. Pick one chapter, mix topics across subjects, set your own timer, and get straight to practice.</p>
        </div>
        <aside class="hero-note"><strong>Made for flexible practice</strong>Choose any combination of chapters and topics. The test engine draws questions randomly from the combined selection, without forcing an equal split.</aside>
      </section>

      <section class="stats-row" aria-label="Question bank summary">
        <div class="stat-card"><div class="stat-value">03</div><div class="stat-label">JEE subjects</div></div>
        <div class="stat-card"><div class="stat-value">${totalQuestions}</div><div class="stat-label">Questions currently loaded</div></div>
        <div class="stat-card"><div class="stat-value">${selectedLabelCount}</div><div class="stat-label">Selected chapters / topics</div></div>
      </section>

      <section>
        <div class="section-heading"><div><h2>Choose your chapters</h2><p>Select a full chapter or open it to choose specific topics.</p></div><div class="selection-count">${selectedPool.length} available questions</div></div>
        <div class="subject-grid">${subjectCards || `<div class="empty-selection">No questions found in this bank.</div>`}</div>
      </section>

      <section class="builder-panel">
        <div class="builder-top"><div><h2>Build your test</h2><p>Decide how long you want to practise.</p></div><span class="pill pill-blue">Custom test</span></div>
        <div class="builder-fields">
          <div class="field"><label for="question-count">Number of questions</label><input id="question-count" type="number" min="1" max="${Math.max(1, selectedPool.length)}" value="${Math.min(questionCount, Math.max(1, selectedPool.length))}" ${selectedPool.length ? "" : "disabled"}><div class="field-hint">Maximum available: ${selectedPool.length}</div></div>
          <div class="field"><label for="duration">Duration (minutes)</label><input id="duration" type="number" min="0" max="300" step="5" value="${durationMinutes}"><div class="field-hint">Set 0 for no timer.</div></div>
          <div class="field"><label>Question distribution</label><div class="random-note"><span class="random-dot"></span> Random from the full selected pool</div><div class="field-hint">No fixed chapter-wise split.</div></div>
        </div>
        <div class="builder-actions"><div class="builder-status">${selectedPool.length ? `${selectedPool.length} questions available across your selection.` : "Select at least one chapter or topic to continue."}</div><button class="button" id="generate-test" ${selectedPool.length ? "" : "disabled"}>Generate test <span aria-hidden="true">→</span></button></div>
        <div class="notice"><strong>Question bank status:</strong> The built-in set includes original ChapterLab practice questions, not official PYQs. A Physics 2025 source index is recorded separately (31 chapters; 225 entries listed in its answer key), but the source question text and solutions have not been republished. Use <strong>Import bank</strong> for content you own or are authorised to publish.</div>
      </section>
      ${importedBank ? `<p class="field-hint" style="text-align:center;margin-top:12px">A custom bank is active in this browser session only. Reload the page to restore the built-in demo bank.</p>` : ""}
    `;

    app.querySelectorAll("[data-action]").forEach(element => {
      element.addEventListener("change", handleSelectionChange);
      element.addEventListener("click", handleSelectionClick);
    });
    document.getElementById("question-count")?.addEventListener("change", event => {
      questionCount = clampInt(event.target.value, 1, Math.max(1, selectedPool.length), 20);
      event.target.value = questionCount;
    });
    document.getElementById("duration")?.addEventListener("change", event => {
      durationMinutes = clampInt(event.target.value, 0, 300, 60);
      event.target.value = durationMinutes;
    });
    document.getElementById("generate-test")?.addEventListener("click", startTest);
  }

  function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function handleSelectionChange(event) {
    const element = event.currentTarget;
    if (element.dataset.action === "chapter-toggle") {
      const subject = element.dataset.subject;
      const chapter = element.dataset.chapter;
      const chapterKey = key(subject, chapter);
      if (element.checked) {
        selectedChapters.add(chapterKey);
        [...selectedTopics].filter(k => k.startsWith(`${subject}|||${chapter}|||`)).forEach(k => selectedTopics.delete(k));
      } else {
        selectedChapters.delete(chapterKey);
      }
      renderHome();
    } else if (element.dataset.action === "topic-toggle") {
      const {subject, chapter, topic} = element.dataset;
      const topicId = topicKey(subject, chapter, topic);
      if (element.checked) {
        selectedChapters.delete(key(subject, chapter));
        selectedTopics.add(topicId);
      } else {
        selectedTopics.delete(topicId);
      }
      renderHome();
    }
  }

  function handleSelectionClick(event) {
    const element = event.currentTarget;
    const action = element.dataset.action;
    if (action === "expand-chapter") {
      event.preventDefault();
      const chapterKey = key(element.dataset.subject, element.dataset.chapter);
      if (expandedChapters.has(chapterKey)) expandedChapters.delete(chapterKey);
      else expandedChapters.add(chapterKey);
      renderHome();
    } else if (action === "subject-toggle") {
      event.preventDefault();
      const subject = element.dataset.subject;
      const map = chapterMap().get(subject) || new Map();
      const keys = [...map.keys()].map(chapter => key(subject, chapter));
      const allSelected = keys.length > 0 && keys.every(k => selectedChapters.has(k));
      if (allSelected) {
        keys.forEach(k => selectedChapters.delete(k));
        [...selectedTopics].filter(k => k.startsWith(`${subject}|||`)).forEach(k => selectedTopics.delete(k));
      } else {
        keys.forEach(k => selectedChapters.add(k));
        [...selectedTopics].filter(k => k.startsWith(`${subject}|||`)).forEach(k => selectedTopics.delete(k));
      }
      renderHome();
    }
  }

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function startTest() {
    const pool = getSelectedPool();
    const countInput = document.getElementById("question-count");
    const durationInput = document.getElementById("duration");
    questionCount = clampInt(countInput?.value, 1, pool.length, Math.min(20, pool.length));
    durationMinutes = clampInt(durationInput?.value, 0, 300, 60);
    if (!pool.length) return showToast("Choose at least one chapter or topic first.");
    if (questionCount > pool.length) return showToast(`Only ${pool.length} questions are available in this selection.`);
    testQuestions = shuffle(pool).slice(0, questionCount);
    answers = {};
    markedForReview = new Set();
    currentIndex = 0;
    remainingSeconds = durationMinutes * 60;
    elapsedSeconds = 0;
    startedAt = Date.now();
    lastResults = null;
    currentView = "test";
    renderTest();
    startTimer();
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function startTimer() {
    stopTimer();
    if (durationMinutes === 0) return;
    timerHandle = setInterval(() => {
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      elapsedSeconds++;
      const timer = document.getElementById("timer-value");
      if (timer) {
        timer.textContent = formatTime(remainingSeconds);
        timer.classList.toggle("warning", remainingSeconds <= 300);
      }
      if (remainingSeconds <= 0) submitTest(true);
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function formatElapsed(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  }

  function renderTest() {
    currentView = "test";
    const q = testQuestions[currentIndex];
    if (!q) return;
    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / testQuestions.length) * 100;
    const palette = testQuestions.map((item, index) => {
      const classes = ["palette-button"];
      if (index === currentIndex) classes.push("current");
      if (Object.prototype.hasOwnProperty.call(answers, item.id)) classes.push("answered");
      if (markedForReview.has(item.id)) classes.push("marked");
      return `<button class="${classes.join(" ")}" data-question-index="${index}" aria-label="Go to question ${index + 1}">${index + 1}</button>`;
    }).join("");
    const responseMarkup = q.type === "numeric"
      ? `<div class="numeric-response"><label for="numeric-answer">Enter your numerical answer</label><input class="numeric-answer-input" id="numeric-answer" type="number" step="any" inputmode="decimal" placeholder="Enter answer" value="${esc(answers[q.id] ?? "")}"><p class="field-hint">You can enter an integer or decimal value.</p></div>`
      : `<div class="options-list">${q.options.map((option, index) => `
          <button class="option-button ${answers[q.id] === index ? "selected" : ""}" data-option-index="${index}" type="button">
            <span class="option-letter">${LETTERS[index]}</span><span>${esc(option)}</span>
          </button>`).join("")}</div>`;

    app.innerHTML = `
      <div class="test-topline">
        <div><div class="test-title">Custom practice test</div><div class="test-subtitle">${testQuestions.length} questions · +4 correct · −1 incorrect · 0 unattempted</div></div>
        <div class="timer-box"><div class="timer-label">${durationMinutes === 0 ? "Untimed" : "Time left"}</div><div class="timer-value ${remainingSeconds <= 300 && durationMinutes > 0 ? "warning" : ""}" id="timer-value">${durationMinutes === 0 ? "—" : formatTime(remainingSeconds)}</div></div>
      </div>
      <div class="test-progress"><div class="test-progress-fill" style="width:${progress}%"></div></div>
      <div class="test-layout">
        <section class="question-card">
          <div class="question-meta"><span class="pill pill-blue">${esc(q.subject)}</span><span class="pill">${esc(q.chapter)}</span><span class="pill">${esc(q.topic)}</span></div>
          <div class="question-number">QUESTION ${currentIndex + 1} OF ${testQuestions.length}</div>
          <div class="question-text">${esc(q.question)}</div>
          ${responseMarkup}
          <div class="question-controls">
            <div class="control-group"><button class="button button-secondary button-small" id="previous-question" ${currentIndex === 0 ? "disabled" : ""}>← Previous</button><button class="text-button ${markedForReview.has(q.id) ? "active" : ""}" id="mark-review">${markedForReview.has(q.id) ? "★ Marked for review" : "☆ Mark for review"}</button></div>
            <div class="control-group"><button class="button button-small" id="next-question">${currentIndex === testQuestions.length - 1 ? "Finish review" : "Next question →"}</button></div>
          </div>
        </section>
        <aside class="palette-card">
          <h3>Question palette</h3><p class="palette-hint">Jump to any question. Your answers are kept while this test is open.</p>
          <div class="palette-grid">${palette}</div>
          <div class="palette-legend"><div class="legend-item"><span class="legend-swatch done"></span>Answered</div><div class="legend-item"><span class="legend-swatch review"></span>Marked for review</div></div>
          <button class="button button-secondary submit-test" id="submit-test">Submit test</button>
        </aside>
      </div>`;

    app.querySelectorAll("[data-option-index]").forEach(button => button.addEventListener("click", () => {
      answers[q.id] = Number(button.dataset.optionIndex);
      updateQuestionInteractions();
    }));
    document.getElementById("numeric-answer")?.addEventListener("input", event => {
      const value = event.target.value.trim();
      if (value === "") delete answers[q.id];
      else answers[q.id] = value;
      updateQuestionInteractions();
    });
    app.querySelectorAll("[data-question-index]").forEach(button => button.addEventListener("click", () => {
      currentIndex = Number(button.dataset.questionIndex);
      renderTest();
    }));
    document.getElementById("previous-question").addEventListener("click", () => { if (currentIndex > 0) { currentIndex--; renderTest(); } });
    document.getElementById("next-question").addEventListener("click", () => { if (currentIndex < testQuestions.length - 1) { currentIndex++; renderTest(); } else { showSubmitModal(); } });
    document.getElementById("mark-review").addEventListener("click", () => {
      if (markedForReview.has(q.id)) markedForReview.delete(q.id); else markedForReview.add(q.id);
      renderTest();
    });
    document.getElementById("submit-test").addEventListener("click", showSubmitModal);
  }

  function updateQuestionInteractions() {
    const q = testQuestions[currentIndex];
    app.querySelectorAll("[data-option-index]").forEach(button => {
      const index = Number(button.dataset.optionIndex);
      button.classList.toggle("selected", answers[q.id] === index);
    });
    const answeredCount = Object.keys(answers).length;
    const progressFill = app.querySelector(".test-progress-fill");
    if (progressFill) progressFill.style.width = `${(answeredCount / testQuestions.length) * 100}%`;
    app.querySelectorAll("[data-question-index]").forEach(button => {
      const question = testQuestions[Number(button.dataset.questionIndex)];
      button.classList.toggle("answered", Object.prototype.hasOwnProperty.call(answers, question.id));
    });
  }

  function showSubmitModal() {
    const unanswered = testQuestions.length - Object.keys(answers).length;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title">
        <h2 id="submit-modal-title">Submit your test?</h2>
        <p>You have answered ${Object.keys(answers).length} of ${testQuestions.length} questions. ${unanswered ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered and will receive 0 marks.` : "All questions have an answer."}</p>
        <div class="modal-actions"><button class="button button-secondary button-small" id="cancel-submit">Go back</button><button class="button button-small" id="confirm-submit">Submit test</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#cancel-submit").addEventListener("click", () => backdrop.remove());
    backdrop.querySelector("#confirm-submit").addEventListener("click", () => { backdrop.remove(); submitTest(false); });
    backdrop.addEventListener("click", event => { if (event.target === backdrop) backdrop.remove(); });
  }

  function isResponseCorrect(q, response) {
    if (q.type !== "numeric") return Number(response) === Number(q.answer);
    const submitted = Number(response);
    if (!Number.isFinite(submitted)) return false;
    const accepted = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length
      ? q.acceptedAnswers : [q.answer];
    const tolerance = Number.isFinite(Number(q.tolerance)) ? Math.max(0, Number(q.tolerance)) : 0.000001;
    return accepted.some(value => Math.abs(submitted - Number(value)) <= tolerance);
  }

  function submitTest(autoSubmitted) {
    if (currentView !== "test") return;
    stopTimer();
    if (durationMinutes > 0 && startedAt) elapsedSeconds = Math.min(durationMinutes * 60, Math.floor((Date.now() - startedAt) / 1000));
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    testQuestions.forEach(q => {
      if (!Object.prototype.hasOwnProperty.call(answers, q.id)) unanswered++;
      else if (isResponseCorrect(q, answers[q.id])) correct++;
      else incorrect++;
    });
    lastResults = {
      correct, incorrect, unanswered,
      score: correct * 4 - incorrect,
      maximum: testQuestions.length * 4,
      accuracy: correct + incorrect ? (correct / (correct + incorrect)) * 100 : 0,
      autoSubmitted,
      elapsedSeconds
    };
    currentView = "results";
    renderResults();
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function renderResults() {
    const r = lastResults;
    const reviews = testQuestions.map((q, index) => {
      const answered = Object.prototype.hasOwnProperty.call(answers, q.id);
      const isCorrect = answered && isResponseCorrect(q, answers[q.id]);
      const status = !answered ? "Skipped" : isCorrect ? "Correct" : "Incorrect";
      const statusClass = !answered ? "skipped" : isCorrect ? "correct" : "incorrect";
      const selectedAnswer = !answered ? "Not attempted" : q.type === "numeric" ? String(answers[q.id]) : q.options[Number(answers[q.id])];
      const correctAnswer = q.type === "numeric" ? String(q.answer) : `${LETTERS[q.answer]}. ${q.options[q.answer]}`;
      const typeLabel = q.type === "numeric" ? "Numerical answer" : "Single-correct MCQ";
      return `
        <article class="review-item">
          <div class="review-head"><div class="review-q">Q${index + 1}. ${esc(q.question)}</div><div class="review-status ${statusClass}">${status}</div></div>
          <div class="review-answer"><span class="pill">${typeLabel}</span><br><strong>Your answer:</strong> ${esc(selectedAnswer)}<br><strong>Correct answer:</strong> ${esc(correctAnswer)}</div>
          <div class="review-explanation"><strong>Explanation:</strong> ${esc(q.explanation || "No explanation supplied.")}</div>
        </article>`;
    }).join("");
    app.innerHTML = `
      <section class="results-head"><div class="result-symbol">✓</div><h1>${r.autoSubmitted ? "Time is up" : "Test submitted"}</h1><p>${r.autoSubmitted ? "Your answers were submitted automatically." : "Here's how you did. Review every answer below."}</p></section>
      <section class="score-card"><div class="score-label">Your score</div><div class="score-value">${r.score}</div><div class="score-sub">out of ${r.maximum} · ${formatElapsed(r.elapsedSeconds)} spent</div></section>
      <section class="result-stats">
        <div class="result-stat"><strong style="color:var(--green)">${r.correct}</strong><span>Correct · +${r.correct * 4}</span></div>
        <div class="result-stat"><strong style="color:var(--red)">${r.incorrect}</strong><span>Incorrect · −${r.incorrect}</span></div>
        <div class="result-stat"><strong>${r.unanswered}</strong><span>Unattempted · 0</span></div>
        <div class="result-stat"><strong>${r.accuracy.toFixed(1)}%</strong><span>Accuracy</span></div>
      </section>
      <div class="result-actions"><button class="button" id="new-test">Create another test →</button><button class="button button-secondary" id="retry-test">Try a new random set</button></div>
      <section class="review-section"><h2>Answer review</h2>${reviews}</section>`;
    document.getElementById("new-test").addEventListener("click", () => { renderHome(); window.scrollTo({top: 0, behavior: "smooth"}); });
    document.getElementById("retry-test").addEventListener("click", () => {
      currentView = "home";
      // Keep the existing selection and settings, then generate a fresh shuffled set.
      renderHome();
      startTest();
    });
  }

  window.addEventListener("beforeunload", event => {
    if (currentView === "test") {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  // Basic integrity check: a malformed starter bank should fail loudly but not break the shell.
  const validAtStartup = validateQuestionBank(questions);
  questions = validAtStartup;
  renderHome();
})();
