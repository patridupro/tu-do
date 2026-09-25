const VIRTUES = [
  { id: 1, name: "Tiết độ", meaning: "Không ăn uống quá no, không say." },
  { id: 2, name: "Tiết kiệm", meaning: "Không tiêu tiền cho thứ không có ích cho mình hoặc người khác." },
  { id: 3, name: "Im lặng", meaning: "Chỉ nói điều có ích. Tránh tầm phào." },
  { id: 4, name: "Trật tự", meaning: "Mỗi thứ một chỗ. Mỗi việc một thời." },
  { id: 5, name: "Quyết tâm", meaning: "Làm điều đã quyết. Bỏ điều đã quyết bỏ." },
  { id: 6, name: "Cần mẫn", meaning: "Không mất thì giờ. Luôn làm việc hữu ích." },
  { id: 7, name: "Thành thật", meaning: "Không lừa. Nghĩ và nói trong sáng." },
  { id: 8, name: "Công bằng", meaning: "Không hại ai. Làm đúng phần việc của mình." },
  { id: 9, name: "Điều độ", meaning: "Tránh thái quá. Nhịn cơn giận." },
  { id: 10, name: "Sạch sẽ", meaning: "Thân, áo, chỗ ở không vết bẩn." },
  { id: 11, name: "Thanh thản", meaning: "Không bối rối vì chuyện nhỏ hoặc chuyện không tránh được." },
  { id: 12, name: "Trong sạch", meaning: "Giữ thân tâm trong sạch." },
  { id: 13, name: "Khiêm tốn", meaning: "Học Franklin: bắt chước Jesus và Socrates." },
];

const STORAGE_KEY = "tudo_v1";

function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: { name: "" },
    virtueOrder: VIRTUES.map((v) => v.id),
    currentWeek: null,
    dayLog: {},
    weekHistory: [],
    fund: { balance: 0, transactions: [] },
    recentVirtueIds: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let editingDate = null;
let openVirtueDetailId = null;

function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayIndexSince(startDate, dateStr) {
  const a = new Date(startDate + "T00:00:00Z");
  const b = new Date(dateStr + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

function formatVNDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const weekday = new Date(dateStr + "T00:00:00Z").toLocaleDateString("vi-VN", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${d}/${m}/${y}`;
}

function formatVND(n) {
  return n.toLocaleString("vi-VN") + "đ";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function virtueById(id) {
  return VIRTUES.find((v) => v.id === id);
}

function countCleanDays(cw) {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDaysStr(cw.startDate, i);
    const rec = state.dayLog[d];
    if (rec && rec.marks[cw.virtueId]) count++;
  }
  return count;
}

function milestoneFor(daysClean) {
  if (daysClean >= 7) return 500000;
  if (daysClean >= 5) return 200000;
  if (daysClean === 4) return 100000;
  return 0;
}

function milestoneHint(count) {
  if (count >= 7) return "Đủ 7 ngày — mốc 500.000đ!";
  if (count >= 5) return `Đang ở mốc 200.000đ. Giữ thêm ${7 - count} ngày nữa để lên 500.000đ.`;
  if (count === 4) return `Đang ở mốc 100.000đ. Giữ thêm ${5 - count} ngày để lên 200.000đ.`;
  return `Giữ đủ 4 ngày để bắt đầu có thưởng (còn ${4 - count} ngày).`;
}

function suggestNextVirtue() {
  const recency = state.recentVirtueIds;
  if (recency.length === 0) return 1;
  if (recency.length === 1 && recency[0] === 1) return 2;
  let best = null, bestScore = Infinity;
  for (const id of state.virtueOrder) {
    const lastIdx = recency.lastIndexOf(id);
    const score = lastIdx === -1 ? -1 : lastIdx;
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}

function virtueStats(virtueId) {
  let kept = 0, total = 0;
  for (const d in state.dayLog) {
    const rec = state.dayLog[d];
    if (virtueId in rec.marks) { total++; if (rec.marks[virtueId]) kept++; }
  }
  return { kept, total };
}

function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText = "position:fixed;left:50%;bottom:76px;transform:translateX(-50%);background:#1c1916;color:#f4f1eb;padding:8px 16px;border-radius:999px;font-size:0.85rem;z-index:100;opacity:0;transition:opacity .2s;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.style.opacity = "0"; }, 1600);
}

function shell(content) {
  return `
    <header class="topbar">
      <img src="icon-192.png" class="topbar__logo" alt="">
      <span class="topbar__title">Tự Do</span>
      <span class="topbar__fund">${formatVND(state.fund.balance)}</span>
    </header>
    <main class="content">${content}</main>
    <nav class="bottomnav">
      <a href="#/today" data-nav="#/today">☀️<span>Hôm nay</span></a>
      <a href="#/week" data-nav="#/week">📅<span>Tuần</span></a>
      <a href="#/book" data-nav="#/book">📖<span>Sổ 13</span></a>
      <a href="#/fund" data-nav="#/fund">💰<span>Quỹ quà</span></a>
      <a href="#/settings" data-nav="#/settings">⚙️<span>Cài đặt</span></a>
    </nav>`;
}

function updateNavActive(hash) {
  const effective = hash === "#/close-week" ? "#/week" : hash;
  document.querySelectorAll(".bottomnav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === effective);
  });
}

function renderOnboarding() {
  return `
    <div class="onboarding">
      <img src="icon-512.png" alt="Benjamin Franklin" class="onboarding__portrait">
      <h1>Tự Do</h1>
      <p class="onboarding__tagline">Sổ rèn 13 phẩm hạnh, theo cách của Benjamin Franklin.</p>
      <ul class="onboarding__points">
        <li>Mỗi tuần (7 ngày liên tiếp) rèn một phẩm hạnh trong 13 phẩm.</li>
        <li>Mỗi ngày đánh dấu tất cả 13 phẩm để tự soi mình.</li>
        <li>Giữ đủ ngày sạch trong tuần, quỹ quà nhỏ sẽ được cộng.</li>
        <li>Không tài khoản, không server — dữ liệu chỉ nằm trên máy bạn.</li>
      </ul>
      <form data-action="start-onboarding">
        <input type="text" name="name" placeholder="Tên trong sổ (tuỳ chọn)">
        <button class="btn" type="submit">Bắt đầu tuần đầu tiên: Tiết độ</button>
      </form>
    </div>`;
}

function renderToday() {
  if (!state.currentWeek) {
    return `<section class="card"><p>Bạn chưa chọn phẩm hạnh cho tuần mới.</p><a class="btn" href="#/close-week">Chọn phẩm tuần mới</a></section>`;
  }
  const cw = state.currentWeek;
  const date = todayVN();
  const dayIdx = dayIndexSince(cw.startDate, date);
  if (dayIdx >= 7) {
    return `<section class="card"><h2>Tuần đã đủ 7 ngày</h2><p>Hãy chốt tuần để nhận quỹ và chọn phẩm hạnh tiếp theo.</p><a class="btn" href="#/close-week">Chốt tuần</a></section>`;
  }
  const virtue = virtueById(cw.virtueId);
  const dayData = state.dayLog[date] || { marks: {}, note: "" };
  const ordered = [virtue, ...state.virtueOrder.filter((id) => id !== virtue.id).map(virtueById)];

  const rows = ordered.map((v) => {
    const checked = !!dayData.marks[v.id];
    const isWeekly = v.id === virtue.id;
    return `
      <label class="virtue-row ${isWeekly ? "virtue-row--weekly" : ""}">
        <input type="checkbox" data-action="toggle-virtue-mark" data-date="${date}" data-virtue-id="${v.id}" ${checked ? "checked" : ""}>
        <span class="virtue-row__name">${v.name}${isWeekly ? " ⭑" : ""}</span>
        <span class="virtue-row__meaning">${v.meaning}</span>
      </label>`;
  }).join("");

  return `
    <section class="card">
      <p class="muted">${formatVNDate(date)} · Ngày ${dayIdx + 1}/7</p>
      <h2>Phẩm tuần: ${virtue.name}</h2>
      <div class="virtue-list">${rows}</div>
      <label class="note-label">Ghi chú (tùy chọn)
        <textarea data-action="save-note" data-date="${date}" placeholder="Hôm nay thế nào...">${escapeHtml(dayData.note || "")}</textarea>
      </label>
    </section>`;
}

function renderWeek() {
  if (!state.currentWeek) {
    return `<section class="card"><p>Bạn chưa chọn phẩm hạnh cho tuần mới.</p><a class="btn" href="#/close-week">Chọn phẩm tuần mới</a></section>`;
  }
  const cw = state.currentWeek;
  const virtue = virtueById(cw.virtueId);
  const today = todayVN();
  const dayIdx = dayIndexSince(cw.startDate, today);

  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysStr(cw.startDate, i);
    const rec = state.dayLog[d];
    const kept = rec ? !!rec.marks[virtue.id] : false;
    const hasData = !!rec;
    const isFuture = i > dayIdx;
    const isToday = i === dayIdx;
    const cls = isFuture ? "day-cell--empty" : kept ? "day-cell--kept" : hasData ? "day-cell--missed" : "day-cell--missed";
    cells.push(`
      <button type="button" class="day-cell ${cls} ${isToday ? "day-cell--today" : ""}"
        data-action="open-edit-day" data-date="${d}" ${isFuture ? "disabled" : ""}>
        <span class="day-cell__num">${i + 1}</span>
        <span class="day-cell__mark">${isFuture ? "·" : kept ? "✓" : "✗"}</span>
      </button>`);
  }

  const cleanCount = countCleanDays(cw);

  return `
    <section class="card">
      <h2>Phẩm tuần: ${virtue.name}</h2>
      <p class="muted">${virtue.meaning}</p>
      <div class="day-grid">${cells.join("")}</div>
      <p>Tiến độ: <strong>${cleanCount}/7</strong> ngày sạch</p>
      <p class="muted">${milestoneHint(cleanCount)}</p>
      ${dayIdx >= 7 ? `<a class="btn" href="#/close-week">Chốt tuần</a>` : ""}
    </section>
    ${editingDate ? renderEditDayPanel(editingDate) : ""}`;
}

function renderEditDayPanel(dateStr) {
  const cw = state.currentWeek;
  const virtue = virtueById(cw.virtueId);
  const dayData = state.dayLog[dateStr] || { marks: {}, note: "" };
  const ordered = [virtue, ...state.virtueOrder.filter((id) => id !== virtue.id).map(virtueById)];
  const rows = ordered.map((v) => {
    const checked = !!dayData.marks[v.id];
    return `
      <label class="virtue-row ${v.id === virtue.id ? "virtue-row--weekly" : ""}">
        <input type="checkbox" data-action="toggle-virtue-mark" data-date="${dateStr}" data-virtue-id="${v.id}" ${checked ? "checked" : ""}>
        <span class="virtue-row__name">${v.name}</span>
        <span class="virtue-row__meaning">${v.meaning}</span>
      </label>`;
  }).join("");
  return `
    <div class="edit-panel">
      <h3>Sửa ngày ${formatVNDate(dateStr)}</h3>
      <div class="virtue-list">${rows}</div>
      <label class="note-label">Ghi chú
        <textarea data-action="save-note" data-date="${dateStr}">${escapeHtml(dayData.note || "")}</textarea>
      </label>
      <button type="button" class="btn btn--ghost" data-action="close-edit-day">Đóng</button>
    </div>`;
}

function renderCloseWeek() {
  const cw = state.currentWeek;
  if (cw) {
    const dayIdx = dayIndexSince(cw.startDate, todayVN());
    if (dayIdx < 7) {
      return `<section class="card"><p>Tuần chưa đủ 7 ngày (mới tới ngày ${dayIdx + 1}/7).</p><a class="btn" href="#/today">Về Hôm nay</a></section>`;
    }
    const virtue = virtueById(cw.virtueId);
    const cleanCount = countCleanDays(cw);
    const milestone = milestoneFor(cleanCount);
    const dayRows = Array.from({ length: 7 }, (_, i) => {
      const d = addDaysStr(cw.startDate, i);
      const rec = state.dayLog[d];
      const kept = rec && rec.marks[cw.virtueId];
      return `<li>${formatVNDate(d)}: ${kept ? "✓ Giữ được" : "✗ Không giữ được"}</li>`;
    }).join("");
    return `
      <section class="card">
        <h2>Chốt tuần: ${virtue.name}</h2>
        <ul class="close-week-list">${dayRows}</ul>
        <p>Số ngày sạch: <strong>${cleanCount}/7</strong></p>
        <p>Quỹ được cộng: <strong>${formatVND(milestone)}</strong></p>
        <button type="button" class="btn" data-action="confirm-close-week">Xác nhận chốt tuần</button>
      </section>`;
  }

  const suggested = suggestNextVirtue();
  const options = state.virtueOrder.map((id) => {
    const v = virtueById(id);
    return `<option value="${id}" ${id === suggested ? "selected" : ""}>${v.name}</option>`;
  }).join("");
  return `
    <section class="card">
      <h2>Chọn phẩm hạnh tuần mới</h2>
      <p class="muted">Gợi ý: ${virtueById(suggested).name} (chưa rèn gần đây)</p>
      <select id="next-virtue-select">${options}</select>
      <button type="button" class="btn" data-action="start-next-week">Bắt đầu tuần mới</button>
    </section>`;
}

function renderBook() {
  const cards = state.virtueOrder.map((id) => {
    const v = virtueById(id);
    const stats = virtueStats(id);
    return `
      <button type="button" class="virtue-card" data-action="open-virtue-detail" data-virtue-id="${id}">
        <h3>${v.name}</h3>
        <p class="muted">${v.meaning}</p>
        <p class="virtue-card__stat">${stats.kept}/${stats.total} ngày giữ được</p>
      </button>`;
  }).join("");
  return `<section class="card-grid">${cards}</section>${openVirtueDetailId ? renderVirtueDetail(openVirtueDetailId) : ""}`;
}

function renderVirtueDetail(id) {
  const v = virtueById(id);
  const stats = virtueStats(id);
  const days = Object.keys(state.dayLog).sort().reverse().filter((d) => id in state.dayLog[d].marks).slice(0, 14);
  const rows = days.map((d) => `<li>${formatVNDate(d)}: ${state.dayLog[d].marks[id] ? "✓ Giữ được" : "✗ Không giữ được"}</li>`).join("");
  return `
    <div class="edit-panel">
      <h3>${v.name}</h3>
      <p class="muted">${v.meaning}</p>
      <p>${stats.kept}/${stats.total} ngày giữ được trên tổng số ngày đã ghi</p>
      <ul class="close-week-list">${rows || "<li class='muted'>Chưa có dữ liệu.</li>"}</ul>
      <button type="button" class="btn btn--ghost" data-action="close-virtue-detail">Đóng</button>
    </div>`;
}

function renderFund() {
  const f = state.fund;
  const rows = f.transactions.map((t) => `
    <li class="fund-row fund-row--${t.type}">
      <span>${formatVNDate(t.date)}</span>
      <span>${escapeHtml(t.note || (t.type === "add" ? "Cộng quỹ" : "Chi tiêu"))}</span>
      <span>${t.type === "add" ? "+" : "-"}${formatVND(t.amount)}</span>
    </li>`).join("") || `<li class="muted">Chưa có giao dịch nào.</li>`;
  return `
    <section class="card fund-balance">
      <p class="muted">Số dư quỹ quà</p>
      <p class="fund-balance__amount">${formatVND(f.balance)}</p>
    </section>
    <section class="card">
      <h3>Đã mua quà</h3>
      <form data-action="add-fund-spend">
        <input type="text" name="item" placeholder="Món quà" required>
        <input type="number" name="amount" placeholder="Số tiền" min="1" required>
        <input type="date" name="date" value="${todayVN()}">
        <button class="btn" type="submit">Ghi chi tiêu</button>
      </form>
    </section>
    <section class="card">
      <h3>Lịch sử quỹ</h3>
      <ul class="fund-list">${rows}</ul>
    </section>`;
}

function renderSettings() {
  const orderRows = state.virtueOrder.map((id, idx) => {
    const v = virtueById(id);
    return `
      <li class="order-row">
        <span>${idx + 1}. ${v.name}</span>
        <span class="order-row__btns">
          <button type="button" data-action="reorder-virtue" data-id="${id}" data-dir="up" ${idx === 0 ? "disabled" : ""}>▲</button>
          <button type="button" data-action="reorder-virtue" data-id="${id}" data-dir="down" ${idx === state.virtueOrder.length - 1 ? "disabled" : ""}>▼</button>
        </span>
      </li>`;
  }).join("");

  return `
    <section class="card">
      <h3>Tên trong sổ</h3>
      <form data-action="save-settings-name">
        <input type="text" name="name" value="${escapeHtml(state.profile.name || "")}" placeholder="Tên của bạn">
        <button class="btn" type="submit">Lưu</button>
      </form>
    </section>
    <section class="card">
      <h3>Thứ tự 13 phẩm hạnh</h3>
      <ul class="order-list">${orderRows}</ul>
    </section>
    <section class="card">
      <h3>Dữ liệu</h3>
      <button type="button" class="btn" data-action="export-json">Xuất sổ (JSON)</button>
      <label class="btn btn--ghost" style="margin-top:8px;">
        Nhập sổ (JSON)
        <input type="file" accept="application/json" data-action="import-json" style="display:none">
      </label>
    </section>
    <section class="card">
      <h3>Cài Tự Do vào Chrome (Samsung Galaxy)</h3>
      <ol class="guide-list">
        <li>Mở đúng địa chỉ trang này trong ứng dụng <strong>Chrome</strong> (không dùng Samsung Internet).</li>
        <li>Đợi trang tải xong, tải lại (reload) một lần để service worker nhận trang.</li>
        <li>Chạm menu <strong>⋮</strong> ở góc trên → chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Add to Home screen</strong>.</li>
        <li>Chọn <strong>Install</strong> (không chọn Create shortcut).</li>
        <li>Icon Franklin sẽ xuất hiện ở màn hình chính, mở lên không còn thanh địa chỉ.</li>
      </ol>
      <p class="muted">Nếu báo "This app cannot be installed": vào Chrome → Cài đặt → Riêng tư và bảo mật → Xóa dữ liệu duyệt web → chọn Toàn bộ thời gian → tick Cookie và dữ liệu trang web + Ảnh và tệp lưu trong bộ nhớ đệm → Xóa dữ liệu. Sau đó gỡ icon cũ trên màn hình chính, đóng hẳn Chrome rồi mở lại đúng địa chỉ.</p>
    </section>
    <section class="card">
      <h3>Luật chơi</h3>
      <p>Một tuần = 7 ngày liên tiếp kể từ lúc bấm Bắt đầu, theo giờ Việt Nam. Mỗi tuần rèn một phẩm hạnh. Mỗi ngày đánh dấu cả 13 phẩm; chỉ phẩm tuần tính vào quỹ. Ngày không ghi = chưa giữ được phẩm tuần hôm đó.</p>
      <table class="rules-table">
        <tr><th>Số ngày sạch / 7</th><th>Được chi</th></tr>
        <tr><td>0–3</td><td>0đ</td></tr>
        <tr><td>4</td><td>100.000đ</td></tr>
        <tr><td>5–6</td><td>200.000đ</td></tr>
        <tr><td>7</td><td>500.000đ</td></tr>
      </table>
      <p class="muted">Mốc không cộng dồn. App không chuyển tiền — bạn tự mua quà rồi ghi vào Quỹ quà.</p>
    </section>`;
}

const routes = {
  "#/today": renderToday,
  "#/week": renderWeek,
  "#/book": renderBook,
  "#/fund": renderFund,
  "#/settings": renderSettings,
  "#/close-week": renderCloseWeek,
};

function route() {
  const scrollY = window.scrollY;
  const app = document.getElementById("app");
  if (!state.onboarded) {
    app.innerHTML = renderOnboarding();
    return;
  }
  const hash = location.hash || "#/today";
  const renderer = routes[hash] || renderToday;
  app.innerHTML = shell(renderer());
  updateNavActive(hash);
  window.scrollTo(0, scrollY);
}

function startOnboarding(form) {
  state.profile.name = form.name.value.trim();
  state.onboarded = true;
  state.currentWeek = { virtueId: 1, startDate: todayVN() };
  state.recentVirtueIds = [1];
  saveState();
  location.hash = "#/today";
  route();
}

function toggleVirtueMark(date, virtueId) {
  if (!state.dayLog[date]) state.dayLog[date] = { marks: {}, note: "" };
  state.dayLog[date].marks[virtueId] = !state.dayLog[date].marks[virtueId];
  saveState();
  route();
}

function saveNote(date, text) {
  if (!state.dayLog[date]) state.dayLog[date] = { marks: {}, note: "" };
  state.dayLog[date].note = text;
  saveState();
}

function openEditDay(dateStr) {
  const isToday = dateStr === todayVN();
  if (!isToday) {
    const ok = confirm(`Bạn đang sửa dữ liệu ngày ${formatVNDate(dateStr)} (ngày đã qua). Xác nhận sửa?`);
    if (!ok) return;
  }
  editingDate = dateStr;
  route();
}

function closeEditDay() {
  editingDate = null;
  route();
}

function confirmCloseWeek() {
  const cw = state.currentWeek;
  const cleanCount = countCleanDays(cw);
  const milestone = milestoneFor(cleanCount);
  state.weekHistory.push({
    virtueId: cw.virtueId,
    startDate: cw.startDate,
    endDate: addDaysStr(cw.startDate, 6),
    daysClean: cleanCount,
    milestoneAmount: milestone,
    closedAt: todayVN(),
  });
  if (milestone > 0) {
    state.fund.transactions.unshift({
      id: crypto.randomUUID(),
      date: todayVN(),
      type: "add",
      amount: milestone,
      note: `Chốt tuần: ${virtueById(cw.virtueId).name}`,
    });
    state.fund.balance += milestone;
  }
  state.recentVirtueIds.push(cw.virtueId);
  state.currentWeek = null;
  saveState();
  showToast("Đã chốt tuần.");
  route();
}

function startNextWeek() {
  const sel = document.getElementById("next-virtue-select");
  const virtueId = Number(sel.value);
  state.currentWeek = { virtueId, startDate: todayVN() };
  saveState();
  location.hash = "#/today";
  route();
}

function openVirtueDetail(id) {
  openVirtueDetailId = id;
  route();
}

function closeVirtueDetail() {
  openVirtueDetailId = null;
  route();
}

function addFundSpend(form) {
  const item = form.item.value.trim();
  const amount = Number(form.amount.value);
  const date = form.date.value || todayVN();
  if (!item || !amount || amount <= 0) return;
  state.fund.transactions.unshift({ id: crypto.randomUUID(), date, type: "spend", amount, note: item });
  state.fund.balance -= amount;
  saveState();
  showToast("Đã ghi chi tiêu.");
  route();
}

function saveSettingsName(form) {
  state.profile.name = form.name.value.trim();
  saveState();
  showToast("Đã lưu.");
}

function reorderVirtue(id, dir) {
  const arr = state.virtueOrder;
  const i = arr.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  saveState();
  route();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tu-do-backup-${todayVN()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!confirm("Nhập sổ sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?")) return;
      state = { ...defaultState(), ...parsed };
      saveState();
      route();
      showToast("Đã nhập sổ.");
    } catch (e) {
      alert("File không hợp lệ.");
    }
  };
  reader.readAsText(file);
  fileInput.value = "";
}

function handleAction(action, el) {
  switch (action) {
    case "start-onboarding": startOnboarding(el); break;
    case "toggle-virtue-mark": toggleVirtueMark(el.dataset.date, Number(el.dataset.virtueId)); break;
    case "open-edit-day": openEditDay(el.dataset.date); break;
    case "close-edit-day": closeEditDay(); break;
    case "confirm-close-week": confirmCloseWeek(); break;
    case "start-next-week": startNextWeek(); break;
    case "open-virtue-detail": openVirtueDetail(Number(el.dataset.virtueId)); break;
    case "close-virtue-detail": closeVirtueDetail(); break;
    case "add-fund-spend": addFundSpend(el); break;
    case "save-settings-name": saveSettingsName(el); break;
    case "reorder-virtue": reorderVirtue(Number(el.dataset.id), el.dataset.dir); break;
    case "export-json": exportJson(); break;
    case "import-json": importJson(el); break;
  }
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.tagName === "FORM") return;
  if (el.tagName === "INPUT" && el.type === "file") return;
  handleAction(el.dataset.action, el);
});

document.addEventListener("submit", (e) => {
  const el = e.target.closest("form[data-action]");
  if (!el) return;
  e.preventDefault();
  handleAction(el.dataset.action, el);
});

document.addEventListener("change", (e) => {
  const el = e.target.closest("input[type=file][data-action]");
  if (!el) return;
  handleAction(el.dataset.action, el);
});

document.addEventListener("focusout", (e) => {
  const el = e.target.closest("[data-action='save-note']");
  if (!el) return;
  saveNote(el.dataset.date, el.value);
});

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = "#/today";
  route();
});
