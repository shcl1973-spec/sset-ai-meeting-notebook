const STORAGE_KEY = "sset-ai-meeting-notebook-v2";
const SYNC_SETTINGS_KEY = "sset-ai-sync-settings-v1";

const $ = (selector) => document.querySelector(selector);
const els = {
  storageState: $("#storageState"),
  newMeetingBtn: $("#newMeetingBtn"),
  mobileNewBtn: $("#mobileNewBtn"),
  searchInput: $("#searchInput"),
  meetingList: $("#meetingList"),
  meetingTitle: $("#meetingTitle"),
  meetingDate: $("#meetingDate"),
  meetingClient: $("#meetingClient"),
  meetingPlace: $("#meetingPlace"),
  meetingStage: $("#meetingStage"),
  decisionStatus: $("#decisionStatus"),
  dealValue: $("#dealValue"),
  nextContactDate: $("#nextContactDate"),
  priorityLevel: $("#priorityLevel"),
  printBtn: $("#printBtn"),
  duplicateBtn: $("#duplicateBtn"),
  deleteBtn: $("#deleteBtn"),
  aiHeadline: $("#aiHeadline"),
  aiHint: $("#aiHint"),
  attendeeCount: $("#attendeeCount"),
  cardCount: $("#cardCount"),
  taskCount: $("#taskCount"),
  lastSaved: $("#lastSaved"),
  penColor: $("#penColor"),
  penSize: $("#penSize"),
  eraserBtn: $("#eraserBtn"),
  clearCanvasBtn: $("#clearCanvasBtn"),
  sketchCanvas: $("#sketchCanvas"),
  recordBtn: $("#recordBtn"),
  stopRecordBtn: $("#stopRecordBtn"),
  backgroundRecordBtn: $("#backgroundRecordBtn"),
  downloadRecordingBtn: $("#downloadRecordingBtn"),
  summarizeBtn: $("#summarizeBtn"),
  recordDot: $("#recordDot"),
  recordStatus: $("#recordStatus"),
  recordStartText: $("#recordStartText"),
  recordEndText: $("#recordEndText"),
  recordFileName: $("#recordFileName"),
  transcriptPanel: $("#voice"),
  voiceBody: $("#voiceBody"),
  floatingRecorder: $("#floatingRecorder"),
  floatingRecordTitle: $("#floatingRecordTitle"),
  floatingRecordMeta: $("#floatingRecordMeta"),
  showVoiceBtn: $("#showVoiceBtn"),
  floatingStopBtn: $("#floatingStopBtn"),
  audioPlayback: $("#audioPlayback"),
  transcriptText: $("#transcriptText"),
  summaryText: $("#summaryText"),
  needsText: $("#needsText"),
  proposalText: $("#proposalText"),
  followupText: $("#followupText"),
  followupEmailText: $("#followupEmailText"),
  emailDraftBtn: $("#emailDraftBtn"),
  copyEmailBtn: $("#copyEmailBtn"),
  attendeeForm: $("#attendeeForm"),
  attendeeList: $("#attendeeList"),
  businessCardForm: $("#businessCardForm"),
  parseCardBtn: $("#parseCardBtn"),
  businessCardList: $("#businessCardList"),
  taskForm: $("#taskForm"),
  taskList: $("#taskList"),
  printCards: $("#printCards"),
  printSketch: $("#printSketch"),
  printTranscript: $("#printTranscript"),
  printEmail: $("#printEmail"),
  syncStatus: $("#syncStatus"),
  syncEndpoint: $("#syncEndpoint"),
  syncToken: $("#syncToken"),
  deviceName: $("#deviceName"),
  syncNowBtn: $("#syncNowBtn"),
  pushSyncBtn: $("#pushSyncBtn"),
  pullSyncBtn: $("#pullSyncBtn"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
  printView: $("#printView"),
  emptyMeetingTemplate: $("#emptyMeetingTemplate")
};

let state = loadState();
let syncSettings = loadSyncSettings();
let activeMeetingId = state.activeMeetingId;
let activeMeeting = getActiveMeeting();
let drawing = false;
let erasing = false;
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recognition = null;
let transcriptBase = "";
let saveTimer = null;
let currentRecordingBlob = null;
let recordingFinalized = false;

const ctx = els.sketchCanvas.getContext("2d");

function createMeeting(overrides = {}) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title: "新業務會議",
    date: toDatetimeLocal(now),
    client: "",
    place: "",
    stage: "",
    decisionStatus: "探索中",
    dealValue: "",
    nextContactDate: "",
    priorityLevel: "一般",
    transcript: "",
    summary: "",
    needs: "",
    proposal: "",
    followup: "",
    followupEmail: "",
    sketch: "",
    audio: "",
    audioFileName: "",
    recordingStartedAt: "",
    recordingEndedAt: "",
    attendees: [],
    cards: [],
    tasks: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.meetings) && parsed.meetings.length) return parsed;
    }
  } catch (error) {
    console.warn("Cannot load notebook", error);
  }

  const starter = createMeeting({
    title: "客戶拜訪會議",
    client: "範例客戶公司",
    place: "客戶會議室",
    needs: "了解客戶目前流程、預算、決策人與導入時程。",
    proposal: "整理可行方案、報價範圍與後續 Demo 安排。",
    followup: "會後 24 小時內寄送會議摘要與待確認事項。",
    attendees: [
      { id: crypto.randomUUID(), name: "王經理", company: "範例客戶公司", role: "決策窗口", phone: "" },
      { id: crypto.randomUUID(), name: "李業務", company: "SSET", role: "業務負責", phone: "" }
    ],
    tasks: [
      { id: crypto.randomUUID(), title: "寄送初步方案", owner: "李業務", due: "", done: false }
    ]
  });
  return { activeMeetingId: starter.id, meetings: [starter] };
}

function loadSyncSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || "{}");
    return {
      endpoint: saved.endpoint || `${location.origin}/api/sync`,
      token: saved.token || "",
      deviceName: saved.deviceName || defaultDeviceName()
    };
  } catch (error) {
    return { endpoint: `${location.origin}/api/sync`, token: "", deviceName: defaultDeviceName() };
  }
}

function saveSyncSettings() {
  syncSettings = {
    endpoint: els.syncEndpoint.value.trim() || `${location.origin}/api/sync`,
    token: els.syncToken.value,
    deviceName: els.deviceName.value.trim() || defaultDeviceName()
  };
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(syncSettings));
}

function defaultDeviceName() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile ? "手機裝置" : "電腦裝置";
}

function getActiveMeeting() {
  let meeting = state.meetings.find((item) => item.id === activeMeetingId);
  if (!meeting) {
    meeting = state.meetings[0] || createMeeting();
    if (!state.meetings.length) state.meetings.push(meeting);
    activeMeetingId = meeting.id;
  }
  return meeting;
}

function saveState() {
  activeMeeting.updatedAt = new Date().toISOString();
  state.activeMeetingId = activeMeetingId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.lastSaved.textContent = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  els.storageState.textContent = "已保存於本機";
  renderMeetingList();
  renderAiConsole();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 220);
}

function toDatetimeLocal(date) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function bindFields() {
  [
    ["meetingTitle", "title"],
    ["meetingDate", "date"],
    ["meetingClient", "client"],
    ["meetingPlace", "place"],
    ["meetingStage", "stage"],
    ["decisionStatus", "decisionStatus"],
    ["dealValue", "dealValue"],
    ["nextContactDate", "nextContactDate"],
    ["priorityLevel", "priorityLevel"],
    ["transcriptText", "transcript"],
    ["summaryText", "summary"],
    ["needsText", "needs"],
    ["proposalText", "proposal"],
    ["followupText", "followup"],
    ["followupEmailText", "followupEmail"]
  ].forEach(([elementKey, field]) => {
    els[elementKey].addEventListener("input", () => {
      activeMeeting[field] = els[elementKey].value;
      renderCounts();
      renderAiConsole();
      scheduleSave();
    });
  });
}

function renderMeeting() {
  activeMeeting = getActiveMeeting();
  els.meetingTitle.value = activeMeeting.title || "";
  els.meetingDate.value = activeMeeting.date || "";
  els.meetingClient.value = activeMeeting.client || "";
  els.meetingPlace.value = activeMeeting.place || "";
  els.meetingStage.value = activeMeeting.stage || "";
  els.decisionStatus.value = activeMeeting.decisionStatus || "探索中";
  els.dealValue.value = activeMeeting.dealValue || "";
  els.nextContactDate.value = activeMeeting.nextContactDate || "";
  els.priorityLevel.value = activeMeeting.priorityLevel || "一般";
  els.transcriptText.value = activeMeeting.transcript || "";
  els.summaryText.value = activeMeeting.summary || "";
  els.needsText.value = activeMeeting.needs || "";
  els.proposalText.value = activeMeeting.proposal || "";
  els.followupText.value = activeMeeting.followup || "";
  els.followupEmailText.value = activeMeeting.followupEmail || "";
  els.audioPlayback.src = activeMeeting.audio || "";
  els.recordStartText.textContent = `開始：${formatDateTime(activeMeeting.recordingStartedAt) || "--"}`;
  els.recordEndText.textContent = `結束：${formatDateTime(activeMeeting.recordingEndedAt) || "--"}`;
  els.recordFileName.textContent = `檔名：${activeMeeting.audioFileName || "--"}`;
  els.downloadRecordingBtn.disabled = !activeMeeting.audio;
  renderCanvasImage();
  renderMeetingList();
  renderAttendees();
  renderCards();
  renderTasks();
  renderCounts();
  renderAiConsole();
  renderSyncSettings();
}

function renderSyncSettings() {
  els.syncEndpoint.value = syncSettings.endpoint || `${location.origin}/api/sync`;
  els.syncToken.value = syncSettings.token || "";
  els.deviceName.value = syncSettings.deviceName || defaultDeviceName();
}

function renderMeetingList() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const meetings = state.meetings
    .filter((meeting) => `${meeting.title} ${meeting.client} ${meeting.place} ${meeting.stage}`.toLowerCase().includes(keyword))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  els.meetingList.innerHTML = "";
  meetings.forEach((meeting) => {
    const button = document.createElement("button");
    button.className = `meeting-item${meeting.id === activeMeetingId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(meeting.title || "未命名會議")}</strong><span>${escapeHtml(meeting.client || "未填客戶")} · ${escapeHtml(formatDateTime(meeting.date) || "未排日期")}</span>`;
    button.addEventListener("click", () => {
      captureCanvas();
      activeMeetingId = meeting.id;
      activeMeeting = getActiveMeeting();
      renderMeeting();
      saveState();
    });
    els.meetingList.appendChild(button);
  });
  if (!meetings.length) els.meetingList.appendChild(emptyNode());
}

function renderCounts() {
  els.attendeeCount.textContent = activeMeeting.attendees.length;
  els.cardCount.textContent = activeMeeting.cards.length;
  els.taskCount.textContent = activeMeeting.tasks.filter((task) => !task.done).length;
}

function renderAiConsole() {
  const openTasks = activeMeeting.tasks.filter((task) => !task.done);
  const next = activeMeeting.nextContactDate ? `下次聯繫：${activeMeeting.nextContactDate}` : "尚未安排下次聯繫";
  els.aiHeadline.textContent = `${activeMeeting.priorityLevel || "一般"}優先 · ${activeMeeting.decisionStatus || "探索中"}`;
  els.aiHint.textContent = `${next}。目前有 ${openTasks.length} 個待追蹤事項，${activeMeeting.cards.length} 張名片可列印到會議記錄。`;
}

function emptyNode() {
  return els.emptyMeetingTemplate.content.firstElementChild.cloneNode(true);
}

function renderAttendees() {
  els.attendeeList.innerHTML = "";
  activeMeeting.attendees.forEach((person) => {
    const row = document.createElement("div");
    row.className = "person-row";
    row.innerHTML = `<div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml([person.company, person.role, person.phone].filter(Boolean).join(" · "))}</span></div><button class="mini-delete" type="button">移除</button>`;
    row.querySelector("button").addEventListener("click", () => {
      activeMeeting.attendees = activeMeeting.attendees.filter((item) => item.id !== person.id);
      renderAttendees();
      renderCounts();
      scheduleSave();
    });
    els.attendeeList.appendChild(row);
  });
  if (!activeMeeting.attendees.length) els.attendeeList.appendChild(emptyNode());
}

function renderCards() {
  els.businessCardList.innerHTML = "";
  activeMeeting.cards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "business-card";
    row.innerHTML = `
      ${card.image ? `<img alt="${escapeHtml(card.name)} 名片" src="${card.image}">` : `<div class="card-placeholder">名片</div>`}
      <div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml([card.company, card.title].filter(Boolean).join(" · "))}</span><span>${escapeHtml([card.phone, card.email].filter(Boolean).join(" · "))}</span></div>
      <button class="mini-delete" type="button">移除</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      activeMeeting.cards = activeMeeting.cards.filter((item) => item.id !== card.id);
      renderCards();
      renderCounts();
      scheduleSave();
    });
    els.businessCardList.appendChild(row);
  });
  if (!activeMeeting.cards.length) els.businessCardList.appendChild(emptyNode());
}

function renderTasks() {
  els.taskList.innerHTML = "";
  activeMeeting.tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "task-row";
    row.innerHTML = `<label><input type="checkbox" ${task.done ? "checked" : ""}><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml([task.owner, task.due].filter(Boolean).join(" · "))}</span></label><button class="mini-delete" type="button">移除</button>`;
    row.querySelector("input").addEventListener("change", (event) => {
      task.done = event.target.checked;
      renderCounts();
      renderAiConsole();
      scheduleSave();
    });
    row.querySelector("button").addEventListener("click", () => {
      activeMeeting.tasks = activeMeeting.tasks.filter((item) => item.id !== task.id);
      renderTasks();
      renderCounts();
      scheduleSave();
    });
    els.taskList.appendChild(row);
  });
  if (!activeMeeting.tasks.length) els.taskList.appendChild(emptyNode());
}

function setupForms() {
  els.attendeeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    activeMeeting.attendees.push({ id: crypto.randomUUID(), ...trimObject(Object.fromEntries(new FormData(els.attendeeForm))) });
    els.attendeeForm.reset();
    renderAttendees();
    renderCounts();
    scheduleSave();
  });

  els.businessCardForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(els.businessCardForm);
    const parsed = parseCardText(String(form.get("ocrText") || ""));
    const file = form.get("image");
    activeMeeting.cards.push({
      id: crypto.randomUUID(),
      name: String(form.get("name") || parsed.name || "").trim(),
      company: String(form.get("company") || parsed.company || "").trim(),
      title: String(form.get("title") || parsed.title || "").trim(),
      phone: String(form.get("phone") || parsed.phone || "").trim(),
      email: String(form.get("email") || parsed.email || "").trim(),
      ocrText: String(form.get("ocrText") || "").trim(),
      image: file && file.size ? await readFileAsDataUrl(file) : ""
    });
    els.businessCardForm.reset();
    renderCards();
    renderCounts();
    scheduleSave();
  });

  els.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    activeMeeting.tasks.push({ id: crypto.randomUUID(), done: false, ...trimObject(Object.fromEntries(new FormData(els.taskForm))) });
    els.taskForm.reset();
    renderTasks();
    renderCounts();
    scheduleSave();
  });
}

function parseCardText(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const joined = lines.join(" ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ") || "";
  const company = lines.find((line) => /(股份有限公司|有限公司|公司|企業|科技|實業|工程|國際|顧問|商行|Co\.|Ltd\.|Inc\.)/i.test(line)) || "";
  const title = lines.find((line) => /(經理|協理|副理|主任|總監|業務|工程師|執行長|負責人|代表|Manager|Director|Sales|Engineer|CEO)/i.test(line) && line !== company) || "";
  const name = lines.find((line) => line !== company && line !== title && !line.includes("@") && !/\d/.test(line) && line.length <= 12) || "";
  return { name, company, title, phone, email };
}

function parseCurrentCardText() {
  const form = els.businessCardForm;
  const parsed = parseCardText(form.elements.ocrText.value);
  Object.entries(parsed).forEach(([key, value]) => {
    if (value && form.elements[key] && !form.elements[key].value.trim()) form.elements[key].value = value;
  });
}

function setupCanvas() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  renderCanvasImage();
  els.sketchCanvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    els.sketchCanvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  });
  els.sketchCanvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = canvasPoint(event);
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = els.penColor.value;
    ctx.lineWidth = erasing ? Number(els.penSize.value) * 2.2 : Number(els.penSize.value);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
    els.sketchCanvas.addEventListener(name, () => {
      if (!drawing) return;
      drawing = false;
      ctx.globalCompositeOperation = "source-over";
      captureCanvas();
      scheduleSave();
    });
  });
}

function canvasPoint(event) {
  const rect = els.sketchCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * els.sketchCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * els.sketchCanvas.height
  };
}

function captureCanvas() {
  activeMeeting.sketch = els.sketchCanvas.toDataURL("image/png");
}

function renderCanvasImage() {
  ctx.clearRect(0, 0, els.sketchCanvas.width, els.sketchCanvas.height);
  if (!activeMeeting?.sketch) return;
  const image = new Image();
  image.onload = () => ctx.drawImage(image, 0, 0, els.sketchCanvas.width, els.sketchCanvas.height);
  image.src = activeMeeting.sketch;
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setRecordStatus("此瀏覽器不支援錄音");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    currentRecordingBlob = null;
    recordingFinalized = false;
    activeMeeting.recordingStartedAt = new Date().toISOString();
    activeMeeting.recordingEndedAt = "";
    activeMeeting.audioFileName = buildRecordingFileName();
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", async () => {
      await finalizeRecording(true);
    });
    mediaRecorder.start(1000);
    startSpeechRecognition();
    els.recordBtn.disabled = true;
    els.stopRecordBtn.disabled = false;
    els.downloadRecordingBtn.disabled = true;
    els.recordDot.classList.add("live");
    setRecordStatus("錄音中");
    renderRecordingMeta();
    updateFloatingRecorder(els.transcriptPanel.classList.contains("background-mode"));
    scheduleSave();
  } catch (error) {
    setRecordStatus("麥克風未啟用");
  }
}

function stopRecording(download = true) {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.requestData();
    } catch (error) {
      // Some browsers do not allow requestData during state transitions.
    }
    mediaRecorder.stop();
  } else {
    finalizeRecording(download);
  }
  if (recognition) recognition.stop();
  els.recordBtn.disabled = false;
  els.stopRecordBtn.disabled = true;
  els.recordDot.classList.remove("live");
  updateFloatingRecorder(false);
  setRecordStatus("正在保存錄音");
}

async function finalizeRecording(download) {
  if (recordingFinalized) return;
  recordingFinalized = true;
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  activeMeeting.recordingEndedAt = new Date().toISOString();
  activeMeeting.audioFileName = activeMeeting.audioFileName || buildRecordingFileName();
  const mimeType = mediaRecorder?.mimeType || "audio/webm";
  currentRecordingBlob = new Blob(audioChunks, { type: mimeType });
  if (currentRecordingBlob.size > 0) {
    activeMeeting.audio = await blobToDataUrl(currentRecordingBlob);
    els.audioPlayback.src = activeMeeting.audio;
    els.downloadRecordingBtn.disabled = false;
    if (download) downloadRecordingBlob(currentRecordingBlob);
  }
  mediaRecorder = null;
  renderRecordingMeta();
  setRecordStatus("已停止並保存");
  scheduleSave();
}

function renderRecordingMeta() {
  els.recordStartText.textContent = `開始：${formatDateTime(activeMeeting.recordingStartedAt) || "--"}`;
  els.recordEndText.textContent = `結束：${formatDateTime(activeMeeting.recordingEndedAt) || "--"}`;
  els.recordFileName.textContent = `檔名：${activeMeeting.audioFileName || "--"}`;
}

function buildRecordingFileName() {
  const client = activeMeeting.client || "未填客戶";
  const topic = activeMeeting.title || "拜訪議題";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${sanitizeFileName(client)}_${sanitizeFileName(topic)}_${stamp}.webm`;
}

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "meeting";
}

function downloadRecordingBlob(blob = currentRecordingBlob) {
  if (!blob && activeMeeting.audio) {
    downloadDataUrl(activeMeeting.audio, activeMeeting.audioFileName || buildRecordingFileName());
    return;
  }
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = activeMeeting.audioFileName || buildRecordingFileName();
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function downloadDataUrl(dataUrl, fileName) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.click();
}

function toggleBackgroundRecording(force) {
  const enabled = typeof force === "boolean" ? force : !els.transcriptPanel.classList.contains("background-mode");
  els.transcriptPanel.classList.toggle("background-mode", enabled);
  els.backgroundRecordBtn.textContent = enabled ? "顯示錄音區" : "背景錄音";
  updateFloatingRecorder(enabled && isRecording());
}

function isRecording() {
  return Boolean(mediaRecorder && mediaRecorder.state !== "inactive");
}

function updateFloatingRecorder(show) {
  els.floatingRecorder.hidden = !show;
  if (show) {
    els.floatingRecordTitle.textContent = activeMeeting.audioFileName || "背景錄音中";
    els.floatingRecordMeta.textContent = `${activeMeeting.client || "未填客戶"} · ${activeMeeting.title || "拜訪議題"}`;
  }
}

function startSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setRecordStatus("錄音中，瀏覽器未提供即時轉文字");
    return;
  }
  recognition = new Recognition();
  recognition.lang = "zh-TW";
  recognition.continuous = true;
  recognition.interimResults = true;
  transcriptBase = activeMeeting.transcript || "";
  recognition.onresult = (event) => {
    let interim = "";
    let finalText = transcriptBase;
    for (let index = 0; index < event.results.length; index += 1) {
      const text = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalText += `${text}\n`;
      else interim += text;
    }
    els.transcriptText.value = `${finalText}${interim ? `\n${interim}` : ""}`.trimStart();
    activeMeeting.transcript = els.transcriptText.value;
    scheduleSave();
  };
  recognition.onerror = () => setRecordStatus("錄音中，轉文字暫停");
  recognition.onend = () => {
    transcriptBase = els.transcriptText.value ? `${els.transcriptText.value}\n` : "";
  };
  recognition.start();
}

function setRecordStatus(message) {
  els.recordStatus.textContent = message;
}

function summarizeMeeting() {
  const lines = [
    ...splitUsefulLines(activeMeeting.needs),
    ...splitUsefulLines(activeMeeting.proposal),
    ...splitUsefulLines(activeMeeting.followup),
    ...splitUsefulLines(activeMeeting.transcript)
  ].slice(0, 6);
  const tasks = activeMeeting.tasks.filter((task) => !task.done);
  const participants = activeMeeting.attendees.map((person) => person.name).filter(Boolean).join("、");
  activeMeeting.summary = [
    `會議主題：${activeMeeting.title || "未命名會議"}`,
    activeMeeting.client ? `客戶/公司：${activeMeeting.client}` : "",
    participants ? `主要與會人：${participants}` : "",
    lines.length ? `重點：\n${lines.map((line) => `- ${line}`).join("\n")}` : "",
    tasks.length ? `待追蹤事項：\n${tasks.map((task) => `- ${task.title}${task.owner ? `（${task.owner}）` : ""}${task.due ? `，${task.due}` : ""}`).join("\n")}` : ""
  ].filter(Boolean).join("\n\n") || "尚無足夠內容可整理。";
  els.summaryText.value = activeMeeting.summary;
  generateFollowupEmail(false);
  scheduleSave();
}

function generateFollowupEmail(overwrite = true) {
  if (!overwrite && activeMeeting.followupEmail) return;
  const recipient = activeMeeting.attendees[0]?.name || activeMeeting.cards[0]?.name || "您好";
  const tasks = activeMeeting.tasks.filter((task) => !task.done);
  const taskLines = tasks.length
    ? tasks.map((task) => `- ${task.title}${task.due ? `（預計 ${task.due} 前）` : ""}`).join("\n")
    : "- 我們會依今天討論內容整理下一步建議";
  const nextContact = activeMeeting.nextContactDate ? `\n\n下次聯繫日：${activeMeeting.nextContactDate}` : "";
  activeMeeting.followupEmail = `${recipient} 您好，\n\n感謝今天撥冗討論「${activeMeeting.title || "本次會議"}」。以下整理今日重點，方便雙方後續追蹤。\n\n會議重點：\n${bulletize(activeMeeting.summary || activeMeeting.needs || activeMeeting.transcript)}\n\n後續事項：\n${taskLines}${nextContact}\n\n若上述內容有需要調整的地方，請隨時告訴我。我們會依確認後的方向準備後續資料。\n\n謝謝。`;
  els.followupEmailText.value = activeMeeting.followupEmail;
  scheduleSave();
}

function bulletize(text) {
  const lines = splitUsefulLines(text).slice(0, 5);
  return lines.length ? lines.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`).join("\n") : "- 今日會議內容待補充";
}

function splitUsefulLines(text) {
  return String(text || "").split(/\n|。|；|;/).map((line) => line.trim()).filter((line) => line.length > 4);
}

function buildPrintView() {
  captureCanvas();
  const meeting = activeMeeting;
  const rows = (items, columns) => items.map((item) => `<tr>${columns.map((col) => `<td>${escapeHtml(item[col] || "")}</td>`).join("")}</tr>`).join("");
  const tasks = meeting.tasks.map((task) => ({ title: `${task.done ? "[完成] " : ""}${task.title}`, owner: task.owner, due: task.due }));
  els.printView.innerHTML = `
    <article class="print-page">
      <header class="print-header">
        <div>
          <h1>${escapeHtml(meeting.title || "會議記錄")}</h1>
          <div class="print-meta">
            <div>日期：${escapeHtml(formatDateTime(meeting.date))}</div>
            <div>客戶/公司：${escapeHtml(meeting.client || "")}</div>
            <div>地點：${escapeHtml(meeting.place || "")}</div>
            <div>會議主題：${escapeHtml(meeting.stage || "")}</div>
            <div>決策狀態：${escapeHtml(meeting.decisionStatus || "")}</div>
            <div>預估金額：${escapeHtml(meeting.dealValue || "")}</div>
            <div>下次聯繫日：${escapeHtml(meeting.nextContactDate || "")}</div>
            <div>追蹤優先度：${escapeHtml(meeting.priorityLevel || "")}</div>
          </div>
        </div>
        <div>SSET AI Notebook</div>
      </header>
      <section class="print-section"><h2>與會人</h2><table class="print-table"><thead><tr><th>姓名</th><th>公司</th><th>角色</th><th>電話</th></tr></thead><tbody>${rows(meeting.attendees, ["name", "company", "role", "phone"]) || `<tr><td colspan="4">尚無資料</td></tr>`}</tbody></table></section>
      <section class="print-section"><h2>重點摘要</h2>${paragraphs(meeting.summary)}</section>
      <section class="print-section"><h2>需求與痛點</h2>${paragraphs(meeting.needs)}</section>
      <section class="print-section"><h2>提案與承諾</h2>${paragraphs(meeting.proposal)}</section>
      <section class="print-section"><h2>待辦追蹤</h2><table class="print-table"><thead><tr><th>事項</th><th>負責人</th><th>期限</th></tr></thead><tbody>${rows(tasks, ["title", "owner", "due"]) || `<tr><td colspan="3">尚無資料</td></tr>`}</tbody></table></section>
      ${els.printEmail.checked ? `<section class="print-section"><h2>會後追蹤信</h2>${paragraphs(meeting.followupEmail)}</section>` : ""}
      ${els.printCards.checked ? `<section class="print-section"><h2>名片</h2><div class="print-card-grid">${meeting.cards.map((card) => `<div class="print-card">${card.image ? `<img alt="${escapeHtml(card.name)} 名片" src="${card.image}">` : ""}<strong>${escapeHtml(card.name)}</strong><p>${escapeHtml([card.company, card.title].filter(Boolean).join(" · "))}<br>${escapeHtml([card.phone, card.email].filter(Boolean).join(" · "))}</p></div>`).join("") || "<p>尚無資料</p>"}</div></section>` : ""}
      ${els.printSketch.checked ? `<section class="print-section"><h2>手寫草稿</h2>${meeting.sketch ? `<img class="print-sketch" alt="手寫草稿" src="${meeting.sketch}">` : "<p>尚無草稿</p>"}</section>` : ""}
      ${els.printTranscript.checked ? `<section class="print-section"><h2>逐字稿</h2>${paragraphs(meeting.transcript)}</section>` : ""}
    </article>
  `;
}

function paragraphs(text) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>尚無資料</p>";
}

function exportData() {
  captureCanvas();
  saveState();
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `SSET-AI-meeting-notebook-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.meetings)) throw new Error("Invalid notebook data");
    state = imported;
    activeMeetingId = imported.activeMeetingId || imported.meetings[0]?.id;
    activeMeeting = getActiveMeeting();
    saveState();
    renderMeeting();
  } catch (error) {
    alert("匯入資料格式不正確。");
  } finally {
    event.target.value = "";
  }
}

function getNotebookUpdatedAt(notebook = state) {
  return notebook.meetings
    .map((meeting) => Date.parse(meeting.updatedAt || meeting.createdAt || ""))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0] || 0;
}

function mergeNotebook(localNotebook, remoteNotebook) {
  const byId = new Map();
  [...(remoteNotebook.meetings || []), ...(localNotebook.meetings || [])].forEach((meeting) => {
    const existing = byId.get(meeting.id);
    const incomingTime = Date.parse(meeting.updatedAt || meeting.createdAt || "") || 0;
    const existingTime = existing ? Date.parse(existing.updatedAt || existing.createdAt || "") || 0 : -1;
    if (!existing || incomingTime >= existingTime) byId.set(meeting.id, meeting);
  });
  const meetings = [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {
    ...localNotebook,
    ...remoteNotebook,
    activeMeetingId: localNotebook.activeMeetingId || remoteNotebook.activeMeetingId || meetings[0]?.id,
    meetings
  };
}

async function fetchRemoteNotebook() {
  saveSyncSettings();
  const url = new URL(syncSettings.endpoint);
  if (syncSettings.token) url.searchParams.set("token", syncSettings.token);
  const response = await fetch(url.href, {
    headers: syncSettings.token ? { "X-Sync-Token": syncSettings.token } : {}
  });
  if (!response.ok) throw new Error(`下載失敗：${response.status}`);
  return response.json();
}

async function pushNotebook() {
  saveSyncSettings();
  captureCanvas();
  saveState();
  setSyncStatus("上傳中");
  const response = await fetch(syncSettings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(syncSettings.token ? { "X-Sync-Token": syncSettings.token } : {})
    },
    body: JSON.stringify({
      token: syncSettings.token,
      deviceName: syncSettings.deviceName,
      clientUpdatedAt: new Date(getNotebookUpdatedAt()).toISOString(),
      data: state
    })
  });
  if (!response.ok) throw new Error(`上傳失敗：${response.status}`);
  const result = await response.json();
  setSyncStatus(`已上傳 ${formatShortTime(result.serverUpdatedAt)}`);
  return result;
}

async function pullNotebook() {
  setSyncStatus("下載中");
  const remote = await fetchRemoteNotebook();
  if (!remote.data?.meetings?.length) {
    setSyncStatus("雲端尚無資料");
    return null;
  }
  state = mergeNotebook(state, remote.data);
  activeMeetingId = state.activeMeetingId || state.meetings[0]?.id;
  activeMeeting = getActiveMeeting();
  saveState();
  renderMeeting();
  setSyncStatus(`已下載 ${formatShortTime(remote.serverUpdatedAt)}`);
  return remote;
}

async function smartSync() {
  try {
    setSyncStatus("同步中");
    const remote = await fetchRemoteNotebook();
    if (remote.data?.meetings?.length) {
      state = mergeNotebook(state, remote.data);
      activeMeetingId = state.activeMeetingId || state.meetings[0]?.id;
      activeMeeting = getActiveMeeting();
      saveState();
      renderMeeting();
    }
    await pushNotebook();
    setSyncStatus("同步完成");
  } catch (error) {
    setSyncStatus(error.message || "同步失敗");
  }
}

async function runSyncAction(action) {
  try {
    await action();
  } catch (error) {
    setSyncStatus(error.message || "同步失敗");
  }
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function formatShortTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function duplicateMeeting() {
  captureCanvas();
  const clone = JSON.parse(JSON.stringify(activeMeeting));
  clone.id = crypto.randomUUID();
  clone.title = `${clone.title || "未命名會議"} 複本`;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  clone.attendees = clone.attendees.map((item) => ({ ...item, id: crypto.randomUUID() }));
  clone.cards = clone.cards.map((item) => ({ ...item, id: crypto.randomUUID() }));
  clone.tasks = clone.tasks.map((item) => ({ ...item, id: crypto.randomUUID() }));
  state.meetings.unshift(clone);
  activeMeetingId = clone.id;
  activeMeeting = clone;
  saveState();
  renderMeeting();
}

function deleteMeeting() {
  if (state.meetings.length === 1) {
    alert("至少保留一筆會議。");
    return;
  }
  if (!confirm("確定刪除此會議？")) return;
  state.meetings = state.meetings.filter((meeting) => meeting.id !== activeMeetingId);
  activeMeetingId = state.meetings[0].id;
  activeMeeting = getActiveMeeting();
  saveState();
  renderMeeting();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function trimObject(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value || "").trim()]));
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setupEvents() {
  bindFields();
  setupCanvas();
  setupForms();
  els.searchInput.addEventListener("input", renderMeetingList);
  [els.newMeetingBtn, els.mobileNewBtn].forEach((button) => button.addEventListener("click", () => {
    captureCanvas();
    const meeting = createMeeting();
    state.meetings.unshift(meeting);
    activeMeetingId = meeting.id;
    activeMeeting = meeting;
    saveState();
    renderMeeting();
  }));
  els.eraserBtn.addEventListener("click", () => {
    erasing = !erasing;
    els.eraserBtn.classList.toggle("active", erasing);
    els.eraserBtn.textContent = erasing ? "畫筆" : "橡皮擦";
  });
  els.clearCanvasBtn.addEventListener("click", () => {
    if (!confirm("清除手寫草稿？")) return;
    ctx.clearRect(0, 0, els.sketchCanvas.width, els.sketchCanvas.height);
    activeMeeting.sketch = "";
    scheduleSave();
  });
  els.recordBtn.addEventListener("click", startRecording);
  els.stopRecordBtn.addEventListener("click", () => stopRecording(true));
  els.backgroundRecordBtn.addEventListener("click", () => toggleBackgroundRecording());
  els.showVoiceBtn.addEventListener("click", () => {
    toggleBackgroundRecording(false);
    document.querySelector("#voice").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.floatingStopBtn.addEventListener("click", () => stopRecording(true));
  els.downloadRecordingBtn.addEventListener("click", () => downloadRecordingBlob());
  els.summarizeBtn.addEventListener("click", summarizeMeeting);
  els.emailDraftBtn.addEventListener("click", () => generateFollowupEmail(true));
  els.copyEmailBtn.addEventListener("click", async () => {
    if (!activeMeeting.followupEmail) generateFollowupEmail(true);
    try {
      await navigator.clipboard.writeText(activeMeeting.followupEmail);
      els.copyEmailBtn.textContent = "已複製";
    } catch (error) {
      els.followupEmailText.focus();
      els.followupEmailText.select();
      els.copyEmailBtn.textContent = "請按 Ctrl+C";
    }
    setTimeout(() => { els.copyEmailBtn.textContent = "複製追蹤信"; }, 1400);
  });
  els.parseCardBtn.addEventListener("click", parseCurrentCardText);
  [els.syncEndpoint, els.syncToken, els.deviceName].forEach((input) => input.addEventListener("change", saveSyncSettings));
  els.syncNowBtn.addEventListener("click", smartSync);
  els.pushSyncBtn.addEventListener("click", () => runSyncAction(pushNotebook));
  els.pullSyncBtn.addEventListener("click", () => runSyncAction(pullNotebook));
  els.exportBtn.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
  els.printBtn.addEventListener("click", () => {
    buildPrintView();
    window.print();
  });
  els.duplicateBtn.addEventListener("click", duplicateMeeting);
  els.deleteBtn.addEventListener("click", deleteMeeting);
  window.addEventListener("beforeprint", buildPrintView);
  window.addEventListener("pagehide", () => {
    if (isRecording()) stopRecording(true);
  });
  window.addEventListener("beforeunload", (event) => {
    if (isRecording()) {
      stopRecording(true);
      event.preventDefault();
      event.returnValue = "錄音正在保存，請確認音檔已下載後再關閉。";
    }
    captureCanvas();
    saveState();
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

setupEvents();
renderMeeting();
saveState();
