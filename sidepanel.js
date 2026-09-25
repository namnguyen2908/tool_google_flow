// ============================================================
//  Flow Batch — sidepanel.js
//  Điều phối: đọc prompt -> gửi từng cái cho content.js trên
//  tab Flow -> nhận ảnh -> tải về -> nghỉ ngẫu nhiên -> lặp.
// ============================================================

const $ = (id) => document.getElementById(id);
const els = {
  // Tabs
  tabRun: $("tabRun"),
  tabSettings: $("tabSettings"),
  paneRun: $("paneRun"),
  paneSettings: $("paneSettings"),

  // Chạy prompt
  prompts: $("prompts"),
  count: $("count"),
  loadTxt: $("loadTxt"),
  txtFile: $("txtFile"),
  start: $("start"),
  stop: $("stop"),
  resetQueue: $("resetQueue"),
  queue: $("queue"),
  progress: $("progress"),
  pfill: $("pfill"),
  conn: $("conn"),
  connText: $("connText"),

  // Cài đặt
  useReference: $("useReference"),
  removeWatermark: $("removeWatermark"),
  delayMin: $("delayMin"),
  delayMax: $("delayMax"),
  folder: $("folder"),
  serial: $("serial"),
  numFormat: $("numFormat"),
  filePrefix: $("filePrefix"),
  filenamePreview: $("filenamePreview"),
};

let running = false;
let items = []; // [{prompt, status, error}]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cancellableSleep(ms) {
  return new Promise((resolve) => {
    const end = Date.now() + ms;
    const interval = setInterval(() => {
      if (!running || Date.now() >= end) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function updateActionButtons() {
  if (running) {
    els.start.disabled = true;
    els.start.innerHTML = "<span>Đang chạy…</span>";
    els.stop.disabled = false;
    if (els.resetQueue) els.resetQueue.style.display = "none";
  } else {
    els.stop.disabled = true;
    els.start.disabled = false;

    const list = parsePrompts();
    const isSameList = items.length === list.length && items.every((it, idx) => it.prompt === list[idx]);
    const doneCount = items.filter((it) => it.status === "done").length;
    const hasRemaining = items.some((it) => it.status !== "done");

    if (isSameList && doneCount > 0 && hasRemaining) {
      els.start.innerHTML = "<span>Tiếp tục</span>";
      if (els.resetQueue) els.resetQueue.style.display = "inline-flex";
    } else {
      els.start.innerHTML = "<span>Bắt đầu</span>";
      if (els.resetQueue) els.resetQueue.style.display = "none";
    }
  }
}

// ---------- Điều khiển Tab ----------
function setTab(name) {
  if (name === "settings") {
    els.tabSettings.classList.add("tab-btn--active");
    els.tabRun.classList.remove("tab-btn--active");
    els.paneSettings.classList.add("tab-pane--active");
    els.paneRun.classList.remove("tab-pane--active");
  } else {
    els.tabRun.classList.add("tab-btn--active");
    els.tabSettings.classList.remove("tab-btn--active");
    els.paneRun.classList.add("tab-pane--active");
    els.paneSettings.classList.remove("tab-pane--active");
  }
}

// ---------- Lưu / khôi phục cài đặt ----------
function saveSettings() {
  chrome.storage.local.set({
    prompts: els.prompts.value,
    folder: els.folder.value,
    serial: els.serial.checked,
    numFormat: els.numFormat?.value || "1",
    useReference: els.useReference.checked,
    removeWatermark: els.removeWatermark ? els.removeWatermark.checked : true,
    delayMin: els.delayMin.value,
    delayMax: els.delayMax.value,
    filePrefix: els.filePrefix?.value != null ? els.filePrefix.value : "image",
  });
  updateFilenamePreview();
}

async function loadSettings() {
  const s = await chrome.storage.local.get();
  if (s.prompts != null) els.prompts.value = s.prompts;
  if (s.folder && !s.folder.startsWith("h2")) {
    els.folder.value = s.folder;
  } else {
    els.folder.value = "google_flow";
  }
  if (s.serial != null) els.serial.checked = s.serial;
  if (s.numFormat != null && els.numFormat) els.numFormat.value = s.numFormat;
  if (s.useReference != null) els.useReference.checked = s.useReference;
  if (s.removeWatermark != null && els.removeWatermark) els.removeWatermark.checked = s.removeWatermark;
  if (s.delayMin != null) els.delayMin.value = s.delayMin;
  if (s.delayMax != null) els.delayMax.value = s.delayMax;
  if (s.filePrefix != null && els.filePrefix) els.filePrefix.value = s.filePrefix;
  else if (els.filePrefix && !els.filePrefix.value) els.filePrefix.value = "image";
  refreshCount();
  updateFilenamePreview();
}

// ---------- Đếm prompt ----------
function parsePrompts() {
  return els.prompts.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
function refreshCount() {
  els.count.textContent = `${parsePrompts().length} prompt`;
}

// ---------- Tìm tab Google Flow ----------
async function getFlowTab() {
  const tabs = await chrome.tabs.query({ url: "https://flow.google.com/project/*" });
  return tabs[0] || null;
}

// ---------- Gửi tin nhắn tới content script ----------
function sendToTab(tabId, msg, quiet = false) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        if (!quiet) {
          console.warn("[tool_flow] Gửi lệnh tới Flow thất bại:", msg.type, error);
        }
        resolve({ ok: false, error });
      }
      else resolve(resp);
    });
  });
}

// gửi cho background (nơi điều khiển chrome.debugger)
function sendToBg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        console.warn("[tool_flow] Gửi lệnh tới background thất bại:", msg.type, error);
        resolve({ ok: false, error });
      }
      else resolve(resp);
    });
  });
}

// ---------- Kiểm tra kết nối ----------
async function checkConnection() {
  const tab = await getFlowTab();
  if (!tab) return setConn(false, "Hãy mở một project Google Flow");

  // thử ping âm thầm trước (tránh báo đỏ rác console khi vừa reload extension)
  let resp = await sendToTab(tab.id, { type: "PING" }, true);

  // không thấy content script -> tự tiêm lại rồi ping lần nữa (tự chữa)
  if (!resp || !resp.ok) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await new Promise((r) => setTimeout(r, 400));
      resp = await sendToTab(tab.id, { type: "PING" }, false);
    } catch (e) {
      console.warn("[tool_flow] Không tiêm được content script:", e);
    }
  }

  if (!resp || !resp.ok) {
    return setConn(false, resp && resp.error ? resp.error : "Tải lại trang Flow (F5) rồi thử lại");
  }
  // PING ok => coi như đã kết nối (lúc chạy bot sẽ focus để ô prompt hiện ra)
  if (resp.hasInput) setConn(true, "Đã kết nối với Google Flow");
  else setConn(true, "Đã kết nối (ô prompt sẽ nhận diện khi chạy)");
  return tab;
}
function setConn(on, text) {
  els.conn.className = "conn " + (on ? "conn--on" : "conn--off");
  els.connText.textContent = text;
}

// ---------- Vẽ hàng đợi ----------
function renderQueue() {
  els.queue.innerHTML = "";
  items.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "qitem " + it.status;
    const error = it.error
      ? `<span class="qerror">${escapeHtml(it.error)}</span>`
      : "";
    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="txt">${escapeHtml(it.prompt)}${error}</span>
      <span class="tag ${it.status}">${statusLabel(it.status)}</span>`;
    els.queue.appendChild(li);
  });
  const done = items.filter((i) => i.status === "done").length;
  const finished = items.filter((i) =>
    ["done", "error", "timeout"].includes(i.status)
  ).length;
  els.progress.textContent = items.length ? `${done}/${items.length} xong` : "—";
  if (els.pfill) {
    els.pfill.style.width = items.length
      ? Math.round((finished / items.length) * 100) + "%"
      : "0%";
  }
}
function statusLabel(s) {
  return {
    pending: "Chờ",
    generating: "Đang tạo",
    done: "Xong",
    error: "Lỗi",
    timeout: "Quá giờ",
  }[s] || s;
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function markItemError(index, message, status = "error") {
  const error = String(message || "Không xác định được lỗi");
  items[index].status = status;
  items[index].error = error;
  console.error(`[tool_flow] Prompt ${index + 1} lỗi:`, error);
}

// ---------- Tên file & Xem trước ----------
function safeName(s) {
  return (s || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "");
}

function buildFilename(serial, prompt) {
  const folder = safeName(els.folder.value || "google_flow") || "google_flow";
  const rawRule = (els.filePrefix?.value || "").trim();
  const snippet = safeName(prompt) || "image";

  // Định dạng số thứ tự (ví dụ: 1, 01, 001)
  let numStr = "";
  if (els.serial && els.serial.checked) {
    const fmt = els.numFormat?.value || "1";
    if (fmt === "3") {
      numStr = String(serial).padStart(3, "0");
    } else if (fmt === "2") {
      numStr = String(serial).padStart(2, "0");
    } else {
      numStr = String(serial);
    }
  }

  let finalName = "";

  if (rawRule) {
    let templ = rawRule;

    // Hỗ trợ biến {prompt} nếu người dùng muốn chèn prompt
    if (templ.includes("{prompt}")) {
      templ = templ.replaceAll("{prompt}", snippet);
    }

    // Nếu trong quy tắc có sẵn {num} thì thay thế trực tiếp
    if (numStr && templ.includes("{num}")) {
      templ = templ.replaceAll("{num}", numStr);
      finalName = safeName(templ);
    } else {
      const cleanBase = safeName(templ);
      // Quy tắc chuẩn: nhập "image" & bật đánh số -> "image_1"
      if (numStr) {
        finalName = `${cleanBase}_${numStr}`;
      } else {
        finalName = cleanBase;
      }
    }
  } else {
    // Không nhập quy tắc -> mặc định lấy theo prompt
    if (numStr) {
      finalName = `${snippet}_${numStr}`;
    } else {
      finalName = snippet;
    }
  }

  finalName = finalName || "image";
  return `${folder}/${finalName}.png`;
}

function updateFilenamePreview() {
  if (!els.filenamePreview) return;
  const samplePrompt = "a-red-bicycle";
  els.filenamePreview.textContent = buildFilename(1, samplePrompt);
}

// Đảm bảo đổi src sang dataURL sạch để tránh lỗi tainted canvas và xóa watermark 100%
async function ensureDataUrl(src, tabId) {
  if (!src) return src;
  if (/^data:/i.test(src)) return src;

  // Cách 1: Fetch trực tiếp trong extension context (nhờ host_permissions: ["<all_urls>"])
  if (/^https?:/i.test(src)) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        if (dataUrl) {
          console.log("[tool_flow] ✓ Chuyển đổi https sang dataURL thành công (Extension fetch)");
          return dataUrl;
        }
      }
    } catch (e) {
      console.log("[tool_flow] Extension fetch thất bại, thử qua tab Flow:", e.message || e);
    }
  }

  // Cách 2: Gửi lệnh TODATAURL tới tab Flow (đọc blob hoặc trích xuất canvas DOM)
  if (tabId) {
    try {
      const r = await sendToTab(tabId, { type: "TODATAURL", src });
      if (r && r.ok && r.dataUrl) {
        console.log("[tool_flow] ✓ Chuyển đổi sang dataURL thành công qua tab Flow");
        return r.dataUrl;
      }
    } catch (e) {
      console.log("[tool_flow] Lệnh TODATAURL tới tab Flow thất bại:", e.message || e);
    }
  }

  // Cách 3: Load bằng thẻ Image trong sidepanel với crossOrigin = "anonymous"
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const cvs = document.createElement("canvas");
          cvs.width = img.naturalWidth || img.width;
          cvs.height = img.naturalHeight || img.height;
          const ctx = cvs.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(cvs.toDataURL("image/png"));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = src;
    });
    if (dataUrl) {
      console.log("[tool_flow] ✓ Chuyển đổi sang dataURL thành công qua anonymous Image canvas");
      return dataUrl;
    }
  } catch (e) {
    console.warn("[tool_flow] Fallback anonymous Image thất bại:", e.message || e);
  }

  return src;
}

// ---------- Tải ảnh ----------
async function downloadImage(src, serial, prompt, tabId) {
  let url = src;
  console.log("[tool_flow] Đang chuẩn bị tải ảnh...", src.slice(0, 80));

  // Bước 1: Đổi src sang dataURL sạch
  url = await ensureDataUrl(url, tabId);

  // Bước 2: Xóa watermark bằng Adaptive Seamless Texture Cloning nếu bật
  const shouldRemoveWatermark = !els.removeWatermark || els.removeWatermark.checked;
  if (shouldRemoveWatermark) {
    if (typeof removeWatermark === "function") {
      if (/^data:/i.test(url)) {
        console.log("[tool_flow] Đang tiến hành xóa watermark...");
        try {
          const cleanUrl = await removeWatermark(url);
          if (cleanUrl && cleanUrl !== url) {
            url = cleanUrl;
            console.log("[tool_flow] ✓ Xóa watermark thành công!");
          } else {
            console.warn("[tool_flow] removeWatermark không thay đổi ảnh.");
          }
        } catch (err) {
          console.warn("[tool_flow] Bỏ qua xóa watermark do lỗi:", err);
        }
      } else {
        console.warn("[tool_flow] Không convert được ảnh sang dataURL, tải ảnh gốc.");
      }
    } else {
      console.error("[tool_flow] Hàm removeWatermark không khả dụng.");
    }
  } else {
    console.log("[tool_flow] Tùy chọn xóa watermark đang TẮT trong Cài đặt, giữ nguyên logo.");
  }

  // Bước 3: Lưu file (hỗ trợ tạo folder con và đặt tên chuẩn qua Blob URL & onDeterminingFilename)
  const targetFilename = buildFilename(serial, prompt);
  console.log("[tool_flow] Chuẩn bị tải file:", targetFilename);

  // Đổi dataURL sang blobURL để Chrome nhận diện tên file và tạo thư mục con chuẩn 100%
  const downloadUrl = dataUrlToBlobUrl(url);

  // Đăng ký tên file với background service worker để onDeterminingFilename bảo vệ
  try {
    await sendToBg({
      type: "REGISTER_DOWNLOAD",
      url: downloadUrl,
      filename: targetFilename,
    });
  } catch (err) {
    console.warn("[tool_flow] Đăng ký download với background cảnh báo:", err);
  }

  const downloadId = await chrome.downloads.download({
    url: downloadUrl,
    filename: targetFilename,
    conflictAction: "uniquify",
    saveAs: false,
  });

  console.log(`[tool_flow] ✓ Đã bắt đầu tải (ID: ${downloadId}), file: ${targetFilename}`);

  // Dọn dẹp blobUrl sau 60 giây để tránh chiếm bộ nhớ
  if (downloadUrl !== url && /^blob:/i.test(downloadUrl)) {
    setTimeout(() => {
      try { URL.revokeObjectURL(downloadUrl); } catch (_) {}
    }, 60000);
  }
}

// Chuyển đổi dataURL (base64) sang Blob URL để Chrome download manager nhận diện đúng tên file và tạo thư mục con
function dataUrlToBlobUrl(url) {
  if (!/^data:/i.test(url)) return url;
  try {
    const parts = url.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("[tool_flow] dataUrlToBlobUrl thất bại:", e);
    return url;
  }
}

// ---------- Delay ngẫu nhiên ----------
function randDelay() {
  const a = Math.max(0, parseInt(els.delayMin.value) || 0);
  const b = Math.max(a, parseInt(els.delayMax.value) || 0);
  return (a + Math.random() * (b - a)) * 1000;
}

// ---------- Vòng lặp chính ----------
async function run() {
  const tab = await checkConnection();
  if (!tab) return;

  const list = parsePrompts();
  if (list.length === 0) {
    setConn(false, "Chưa có prompt nào");
    return;
  }

  // Kiểm tra xem có tiếp tục hàng đợi cũ hay tạo mới:
  const isSameList = items.length === list.length && items.every((it, idx) => it.prompt === list[idx]);
  const hasRemaining = items.some((it) => it.status !== "done");

  if (!isSameList || items.length === 0 || !hasRemaining) {
    // Tạo hàng đợi mới từ đầu
    items = list.map((p) => ({ prompt: p, status: "pending" }));
  } else {
    // Tiếp tục hàng đợi: chỉ khôi phục các mục chưa xong (error, timeout) thành pending để thử lại
    items.forEach((it) => {
      if (it.status !== "done") {
        it.status = "pending";
        delete it.error;
      }
    });
  }

  renderQueue();

  running = true;
  updateActionButtons();

  for (let i = 0; i < items.length; i++) {
    if (!running) break;

    // Bỏ qua các prompt đã hoàn thành (done) trước đó khi bấm Tiếp tục
    if (items[i].status === "done") {
      continue;
    }

    items[i].status = "generating";
    renderQueue();

    // 1) thêm lại ảnh tham chiếu cho từng prompt
    if (els.useReference.checked) {
      const reference = await sendToTab(tab.id, { type: "ADD_REFERENCE_IMAGE" });
      if (!running) { items[i].status = "pending"; break; }
      if (!reference || !reference.ok) {
        const error = reference && reference.error
          ? reference.error
          : "Không thêm được ảnh tham chiếu";
        markItemError(i, error);
        setConn(false, error);
        renderQueue();
        break;
      }
    }

    // 2) lấy toạ độ ô prompt từ content script (+ chụp baseline ảnh)
    const box = await sendToTab(tab.id, { type: "GET_BOX" });
    if (!running) { items[i].status = "pending"; break; }
    if (!box || !box.ok) {
      const error = box && box.error ? box.error : "Không lấy được vị trí ô prompt";
      markItemError(i, error);
      setConn(false, error);
      renderQueue();
      continue;
    }

    // 3) GÕ CHỮ THẬT + Enter qua background (chrome.debugger)
    const typed = await sendToBg({
      type: "DEBUG_SUBMIT",
      tabId: tab.id,
      x: box.x,
      y: box.y,
      prompt: items[i].prompt,
    });
    if (!running) { items[i].status = "pending"; break; }
    if (!typed || !typed.ok) {
      const error = typed && typed.error
        ? `Lỗi debugger: ${typed.error}`
        : "Không gõ được prompt qua debugger";
      markItemError(i, error);
      setConn(
        false,
        `${error} (đóng DevTools F12 trên tab Flow rồi thử lại)`
      );
      renderQueue();
      // không tiếp tục nếu debugger lỗi
      break;
    }

    // 4) chờ ảnh mới rồi tải
    const resp = await sendToTab(tab.id, { type: "WAIT_IMAGE" });
    if (!running) { items[i].status = "pending"; break; }

    if (resp && resp.ok && resp.src) {
      try {
        await downloadImage(resp.src, i + 1, items[i].prompt, tab.id);
        items[i].status = "done";
      } catch (e) {
        markItemError(i, `Tải ảnh thất bại: ${e.message || e}`);
      }
    } else if (resp && resp.timeout) {
      markItemError(i, "Quá thời gian chờ ảnh mới", "timeout");
    } else {
      markItemError(i, resp && resp.error ? resp.error : "Flow không trả về ảnh kết quả");
    }
    renderQueue();

    // nghỉ ngẫu nhiên trước prompt kế (chỉ nghỉ nếu còn prompt chưa xong phía sau)
    const hasMorePending = items.slice(i + 1).some((it) => it.status !== "done");
    if (hasMorePending && running) {
      await cancellableSleep(randDelay());
    }
  }

  // xong hàng đợi hoặc dừng -> tách debugger để thanh vàng biến mất
  await sendToBg({ type: "DEBUG_DETACH" });

  running = false;
  updateActionButtons();
}

async function stop() {
  running = false;
  els.stop.disabled = true;
  updateActionButtons();
  const tab = await getFlowTab();
  if (tab) await sendToTab(tab.id, { type: "STOP" });
  await sendToBg({ type: "DEBUG_DETACH" });
}

// ---------- Sự kiện ----------
els.tabRun.addEventListener("click", () => setTab("run"));
els.tabSettings.addEventListener("click", () => setTab("settings"));

els.prompts.addEventListener("input", () => {
  refreshCount();
  saveSettings();
  if (!running) {
    items = [];
    renderQueue();
    updateActionButtons();
  }
});

[
  els.folder,
  els.serial,
  els.numFormat,
  els.useReference,
  els.removeWatermark,
  els.delayMin,
  els.delayMax,
  els.filePrefix,
]
  .filter(Boolean)
  .forEach((el) => {
    el.addEventListener("change", saveSettings);
    el.addEventListener("input", saveSettings);
  });

els.loadTxt.addEventListener("click", () => els.txtFile.click());
els.txtFile.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    els.prompts.value = reader.result;
    refreshCount();
    saveSettings();
    if (!running) {
      items = [];
      renderQueue();
      updateActionButtons();
    }
  };
  reader.readAsText(f);
});

if (els.resetQueue) {
  els.resetQueue.addEventListener("click", () => {
    if (running) return;
    items = [];
    renderQueue();
    updateActionButtons();
    setConn(true, "Đã làm mới hàng đợi, sẵn sàng bắt đầu từ đầu.");
  });
}

els.start.addEventListener("click", run);
els.stop.addEventListener("click", stop);

// ---------- Khởi động ----------
loadSettings();
checkConnection();
setInterval(checkConnection, 5000); // tự kiểm tra kết nối mỗi 5s
