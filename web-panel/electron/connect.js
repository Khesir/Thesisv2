const uriInput = document.getElementById("uri-input");
const btnTest = document.getElementById("btn-test");
const btnConnect = document.getElementById("btn-connect");
const statusBanner = document.getElementById("status-banner");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

// Pre-fill saved URI on load
window.addEventListener("DOMContentLoaded", async () => {
  const savedUri = await window.electronAPI.getSavedUri();
  if (savedUri) {
    uriInput.value = savedUri;
  }
  uriInput.focus();
});

function showStatus(type, message) {
  statusBanner.className = `status-banner ${type}`;
  statusBanner.textContent = message;
}

function hideStatus() {
  statusBanner.className = "status-banner hidden";
}

function setLoading(show, text) {
  if (show) {
    loadingText.textContent = text || "Connecting...";
    loadingOverlay.classList.remove("hidden");
    btnTest.disabled = true;
    btnConnect.disabled = true;
  } else {
    loadingOverlay.classList.add("hidden");
    btnTest.disabled = false;
    btnConnect.disabled = false;
  }
}

btnTest.addEventListener("click", async () => {
  const uri = uriInput.value.trim();
  if (!uri) {
    showStatus("error", "Please enter a MongoDB URI.");
    return;
  }

  hideStatus();
  setLoading(true, "Testing connection...");

  const result = await window.electronAPI.testConnection(uri);
  setLoading(false);

  if (result.success) {
    showStatus("success", "Connection successful!");
  } else {
    showStatus("error", `Connection failed: ${result.error}`);
  }
});

btnConnect.addEventListener("click", async () => {
  const uri = uriInput.value.trim();
  if (!uri) {
    showStatus("error", "Please enter a MongoDB URI.");
    return;
  }

  hideStatus();
  setLoading(true, "Starting application...");

  const result = await window.electronAPI.connect(uri);

  if (!result.success) {
    setLoading(false);
    showStatus("error", `Failed to start: ${result.error}`);
  }
  // On success, this window will be closed by main process
});

// Enter key triggers connect
uriInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    btnConnect.click();
  }
});
