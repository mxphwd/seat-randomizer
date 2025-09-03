const TIMING = {
  countdownHold: 1000,
  quickHold: 550,
  quickFade: 250,
  revealStagger: 120,
  imgEaseDelay: 60,
};

const SEAT_COORDS = [
  { row: 1, cols: [1, 2, 4, 5, 7, 8] },
  { row: 2, cols: [1, 2, 4, 5, 7, 8] },
  { row: 3, cols: [1, 2, 4, 5] },
];

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function loadStudents() {
  const res = await fetch("students.json");
  if (!res.ok) throw new Error("Failed to load students.json");
  return res.json();
}

function shuffleArray(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomOrder(n) {
  const idx = Array.from({length:n}, (_,i)=>i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function buildGrid(root) {
  root.innerHTML = "";
  for (const r of SEAT_COORDS) {
    for (const c of r.cols) {
      const seat = document.createElement("div");
      seat.className = "seat";
      seat.style.gridRow = String(r.row);
      seat.style.gridColumn = String(c);
      seat.dataset.row = String(r.row);
      seat.dataset.col = String(c);
      root.appendChild(seat);
    }
  }
  requestAnimationFrame(() => root.classList.add("ready"));
}

function seatsSorted(root) {
  return Array.from(root.querySelectorAll(".seat")).sort((a, b) => {
    const ra = Number(a.dataset.row) || 0;
    const rb = Number(b.dataset.row) || 0;
    if (ra !== rb) return ra - rb;
    const ca = Number(a.dataset.col) || 0;
    const cb = Number(b.dataset.col) || 0;
    return ca - cb;
  });
}

function safeText(s) {
  return String(s ?? "").replace(/[<>&"]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]));
}

function setSeat(seatEl, student) {
  if (!student) { seatEl.innerHTML = ""; return; }
  const name = safeText(student.name);
  seatEl.innerHTML = `<div class="name">${name}</div>`;
}

function setDimState(overlay, grid, on){
  if (!overlay || !grid) return;
  overlay.classList.remove("flash");
  if (on) { overlay.classList.add("dim"); grid.classList.add("blurred"); }
  else    { overlay.classList.remove("dim"); grid.classList.remove("blurred"); }
}

function flashStage(overlay){
  if (!overlay) return;
  overlay.classList.remove("dim");
  overlay.classList.add("flash");
  setTimeout(() => overlay.classList.remove("flash"), 380);
}

async function countdown(el, bgm, overlay, grid) {
  if (!el) return;
  setDimState(overlay, grid, true);
  el.style.display = "block";
  try { bgm && await bgm.play(); } catch(_) {}
  for (let i = 5; i > 0; i--) {
    el.textContent = i;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
    await wait(TIMING.countdownHold);
  }
  el.style.display = "none";
}

async function quickShuffleShow(root, assign, overlay, grid) {
  const seats = seatsSorted(root);
  setDimState(overlay, grid, true);
  seats.forEach((seat, i) => {
    setSeat(seat, assign[i] || null);
    seat.style.opacity = 1;
    const name = seat.querySelector(".name");
    if (name) name.classList.add("show");
  });
  await wait(TIMING.quickHold);
  for (const seat of seats) seat.style.opacity = 0.0;
  await wait(TIMING.quickFade);
  for (const seat of seats) { seat.style.opacity = 1.0; seat.innerHTML = ""; seat.classList.remove("spotlit"); }
}

function instantReveal(root, assign, tada, overlay, grid) {
  const seats = seatsSorted(root);
  setDimState(overlay, grid, false);
  seats.forEach((seat, i) => {
    setSeat(seat, assign[i] || null);
    seat.style.opacity = 1;
    seat.classList.remove("spotlit");
    const name = seat.querySelector(".name");
    if (name) name.classList.add("show");
  });
  try { tada && (tada.currentTime = 0, tada.play()); } catch(_) {}
  flashStage(overlay);
}

async function finalReveal(root, assign, tada, overlay, grid, order) {
  const seats = seatsSorted(root);
  setDimState(overlay, grid, false);
  for (const s of seats) {
    s.style.transition = "all .25s cubic-bezier(0.4,0,0.2,1)";
    s.style.opacity = 0.35;
    s.classList.remove("spotlit");
  }
  const sequence = Array.isArray(order) && order.length === seats.length ? order : seats.map((_, i) => i);
  for (let k = 0; k < sequence.length; k++) {
    const i = sequence[k];
    const seat = seats[i];
    const stu  = assign[i];
    if (!stu) continue;

    seat.classList.add("spotlit");
    seat.style.opacity = 1;

    setSeat(seat, stu);
    const name = seat.querySelector(".name");
    if (name) { name.classList.remove("show"); }
    await wait(TIMING.imgEaseDelay);
    if (name) { name.classList.add("show"); }

    seat.classList.add("ripple");
    setTimeout(() => seat.classList.remove("ripple"), 650);

    if (k === sequence.length - 1) {
      try {
        seat.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }],
          { duration: 350, easing: "cubic-bezier(0.4,0,0.2,1)" }
        );
        if (tada) { tada.currentTime = 0; await tada.play(); }
        flashStage(overlay);
        root.classList.add("all-shift");
        setTimeout(() => root.classList.remove("all-shift"), 650);
      } catch(_) {}
    }
    await wait(TIMING.revealStagger);
  }
}

function fadeOutAudio(audio) {
  if (!audio || audio.paused) return;
  const step = 0.05;
  const id = setInterval(() => {
    const next = Math.max(0, audio.volume - step);
    audio.volume = next;
    if (next === 0) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      clearInterval(id);
    }
  }, 50);
}

async function main() {
  const overlay      = document.getElementById("overlay");
  const grid         = document.getElementById("grid");
  const countdownEl  = document.getElementById("countdown");
  const shuffleBtn   = document.getElementById("shuffleBtn");
  const shuffleValue = document.getElementById("shuffleValue");
  const slider       = document.getElementById("shuffleCount");
  const bgm          = document.getElementById("bgm");
  const tada         = document.getElementById("tada");

  if (!grid || !shuffleBtn || !slider || !shuffleValue) return;

  slider.addEventListener("input", () => { shuffleValue.textContent = slider.value; });
  shuffleValue.textContent = slider.value;

  buildGrid(grid);

  let students = [];
  try { students = await loadStudents(); }
  catch { alert("Couldn't load students.json. Make sure you’re on http://localhost:8000 and the file exists."); return; }

  const seatCount = seatsSorted(grid).length;
  if (students.length > seatCount) students = students.slice(0, seatCount);

  shuffleBtn.addEventListener("click", async (e) => {
    const cycles = Math.max(1, parseInt(slider.value, 10) || 1);
    const useInstant = e.altKey || e.metaKey;
    const useRandom  = e.shiftKey;

    if (useInstant) {
      const final = shuffleArray(students);
      instantReveal(grid, final, tada, overlay, grid);
      fadeOutAudio(bgm);
      return;
    }

    await countdown(countdownEl, bgm, overlay, grid);

    for (let k = 0; k < cycles - 1; k++) {
      await quickShuffleShow(grid, shuffleArray(students), overlay, grid);
    }

    const final = shuffleArray(students);
    const order = useRandom ? randomOrder(seatCount) : undefined;

    await finalReveal(grid, final, tada, overlay, grid, order);

    fadeOutAudio(bgm);
  });
}

main().catch(()=>{});