// ============================================================
//  scripts/watermark-tab.js
//  Component tái sử dụng: Tab Xóa Logo / Watermark Độc Lập
//  Cho phép người dùng kéo thả hoặc tải ảnh bất kỳ từ máy,
//  gọi lại hàm removeWatermark() đã có để làm sạch và tải về.
// ============================================================

const WatermarkTab = (() => {
  let items = []; // [{ id, name, originalDataUrl, cleanDataUrl, status, sizeStr, error }]
  let isProcessing = false;
  let getOptionsFn = null;

  // DOM Elements
  const els = {
    dropZone: document.getElementById("wmDropZone"),
    fileInput: document.getElementById("wmFileInput"),
    browseBtn: document.getElementById("wmBrowseBtn"),
    toolbar: document.getElementById("wmToolbar"),
    count: document.getElementById("wmCount"),
    clearBtn: document.getElementById("wmClearBtn"),
    processBtn: document.getElementById("wmProcessBtn"),
    downloadAllBtn: document.getElementById("wmDownloadAllBtn"),
    progress: document.getElementById("wmProgress"),
    list: document.getElementById("wmList"),
  };

  function init({ getOptions }) {
    getOptionsFn = getOptions;
    bindEvents();
    render();
  }

  function bindEvents() {
    if (!els.dropZone) return;

    // Click chọn file
    els.browseBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      els.fileInput.click();
    });

    els.dropZone.addEventListener("click", () => {
      els.fileInput.click();
    });

    els.fileInput?.addEventListener("change", (e) => {
      handleFiles(Array.from(e.target.files || []));
      els.fileInput.value = ""; // Reset để có thể chọn lại cùng file
    });

    // Kéo thả (Drag & Drop)
    els.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    });

    els.dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    });

    els.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
      handleFiles(Array.from(e.dataTransfer.files || []));
    });

    // Nút Xóa hết danh sách
    els.clearBtn?.addEventListener("click", () => {
      if (isProcessing) return;
      items = [];
      render();
    });

    // Nút Bắt đầu xử lý
    els.processBtn?.addEventListener("click", processAll);

    // Nút Tải tất cả
    els.downloadAllBtn?.addEventListener("click", downloadAll);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  async function handleFiles(fileList) {
    const validFiles = fileList.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const dataUrl = await readFileAsDataUrl(file);
      items.push({
        id: "wm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        name: file.name,
        sizeStr: formatFileSize(file.size),
        originalDataUrl: dataUrl,
        cleanDataUrl: null,
        status: "ready", // ready | processing | done | error
        error: null,
      });
    }

    render();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function processAll() {
    if (isProcessing || items.length === 0) return;
    isProcessing = true;
    updateButtons();

    const options = typeof getOptionsFn === "function" ? getOptionsFn() : {};

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status === "done") continue;

      it.status = "processing";
      renderList();
      updateProgress();

      try {
        if (typeof removeWatermark === "function") {
          const cleanUrl = await removeWatermark(it.originalDataUrl, options);
          it.cleanDataUrl = cleanUrl || it.originalDataUrl;
          it.status = "done";
        } else {
          throw new Error("Hàm removeWatermark chưa được tải.");
        }
      } catch (err) {
        it.status = "error";
        it.error = err.message || "Xóa logo thất bại";
        console.error("[tool_flow] Lỗi xóa logo file", it.name, err);
      }

      renderList();
      updateProgress();
    }

    isProcessing = false;
    updateButtons();
  }

  function downloadItem(item) {
    if (!item.cleanDataUrl) return;
    const a = document.createElement("a");
    a.href = item.cleanDataUrl;
    const baseName = item.name.replace(/\.[^/.]+$/, "");
    a.download = `clean_${baseName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function downloadAll() {
    const doneItems = items.filter((it) => it.status === "done" && it.cleanDataUrl);
    for (let i = 0; i < doneItems.length; i++) {
      downloadItem(doneItems[i]);
      if (i < doneItems.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  function removeItem(id) {
    if (isProcessing) return;
    items = items.filter((it) => it.id !== id);
    render();
  }

  function updateButtons() {
    const hasItems = items.length > 0;
    const doneCount = items.filter((it) => it.status === "done").length;
    const hasPending = items.some((it) => it.status !== "done");

    if (els.toolbar) {
      els.toolbar.style.display = hasItems ? "flex" : "none";
    }
    if (els.count) {
      els.count.textContent = `${items.length} ảnh`;
    }

    if (els.processBtn) {
      els.processBtn.disabled = isProcessing || !hasItems || !hasPending;
      els.processBtn.innerHTML = isProcessing
        ? "<span>⏳ Đang xóa logo…</span>"
        : "<span>✨ Xóa Logo Watermark</span>";
    }

    if (els.downloadAllBtn) {
      els.downloadAllBtn.style.display = doneCount > 0 ? "inline-flex" : "none";
    }

    updateProgress();
  }

  function updateProgress() {
    if (!els.progress) return;
    if (items.length === 0) {
      els.progress.textContent = "—";
      return;
    }
    const done = items.filter((it) => it.status === "done").length;
    els.progress.textContent = `${done}/${items.length} xong`;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  function renderList() {
    if (!els.list) return;

    if (items.length === 0) {
      els.list.innerHTML = `<div class="wm-empty">Chưa có ảnh nào được tải lên. Kéo thả hoặc bấm nút ở trên để thêm ảnh.</div>`;
      return;
    }

    els.list.innerHTML = "";
    items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "wm-item";

      const thumbUrl = it.cleanDataUrl || it.originalDataUrl;
      const statusLabels = {
        ready: "Chờ xóa",
        processing: "Đang xóa…",
        done: "✓ Đã xóa sạch",
        error: "Lỗi",
      };

      const statusTag = `<span class="wm-tag wm-tag--${it.status}">${statusLabels[it.status] || it.status}</span>`;

      let actionHtml = "";
      if (it.status === "done" && it.cleanDataUrl) {
        actionHtml += `<button type="button" class="btn btn--ghost btn--sm wm-btn-dl" title="Tải ảnh sạch">⬇️ Tải về</button>`;
      }
      if (!isProcessing) {
        actionHtml += `<button type="button" class="btn btn--ghost btn--sm wm-btn-del" title="Xóa khỏi danh sách">✕</button>`;
      }

      div.innerHTML = `
        <img class="wm-thumb" src="${thumbUrl}" alt="thumb" />
        <div class="wm-details">
          <div class="wm-filename" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
          <div class="wm-status">
            ${statusTag}
            <span class="count">${escapeHtml(it.sizeStr)}</span>
          </div>
          ${it.error ? `<div class="qerror">${escapeHtml(it.error)}</div>` : ""}
        </div>
        <div class="wm-item-actions">${actionHtml}</div>
      `;

      // Gắn sự kiện nút bấm trong card
      div.querySelector(".wm-btn-dl")?.addEventListener("click", () => downloadItem(it));
      div.querySelector(".wm-btn-del")?.addEventListener("click", () => removeItem(it.id));

      els.list.appendChild(div);
    });
  }

  function render() {
    updateButtons();
    renderList();
  }

  return {
    init,
  };
})();
