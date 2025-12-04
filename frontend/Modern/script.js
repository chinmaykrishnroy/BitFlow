"use strict";

const CONFIG = {
    host: window.location.hostname || "localhost",
    port: 8888,
    mediaExtensions: {
        image: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
        audio: [".mp3", ".wav", ".ogg", ".m4a"],
        video: [".mp4", ".webm", ".ogv", ".mov", ".mkv"],
        pdf: [".pdf"],
        web: [".html", ".htm", ".xhtml", ".php"],
        text: [".txt", ".md", ".js", ".json", ".css", ".xml", ".c", ".cpp", ".h", ".java", ".py", ".sh", ".bat", ".ini", ".log", ".yml", ".yaml", ".sql", ".ts", ".jsx", ".tsx"]
    }
};

const BASE_URL = `http://${CONFIG.host}:${CONFIG.port}`;
const socket = (typeof io !== 'undefined') ? io(BASE_URL) : { on:()=>{}, emit:()=>console.error("Socket not loaded") };

let appState = {
    currentPath: "/",
    backStack: [],
    forwardStack: [],
    currentFiles: [],
    currentFolderDetails: null,
    selectedItems: new Set(),
    isServerReachable: true
};

let UI = {};

function init() {
    console.log("Initializing BitFlow...");
    
    UI = {
        fileList: document.getElementById("fileList"),
        loading: document.getElementById("loading"),
        backBtn: document.getElementById("backBtn"),
        forwardBtn: document.getElementById("forwardBtn"),
        searchInput: document.getElementById("searchInput"),
        sortSelect: document.getElementById("sortSelect"),
        themeToggle: document.getElementById("themeToggle"),
        pathLabel: document.getElementById("pathLabel"),
        mobileSidebar: document.getElementById("mobileSidebar"),
        sidebarBackdrop: document.getElementById("sidebarBackdrop"),
        sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
        burgerBtn: document.getElementById("burgerBtn"),
        openFolderInfo: document.getElementById("openFolderInfo")
    };

    try { initTheme(); } catch(e) {}
    try { setupEventListeners(); } catch(e) {}
    try { setupSocketListeners(); } catch(e) {}
    
    [GalleryApp, VideoPlayerApp, AudioPlayerApp, TextEditorApp, WebModalApp, NotSupportedApp, FolderDetailsApp].forEach(app => {
        if(app && app.init) app.init();
    });
    
    requestPath("/");
}

function initTheme() {
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    toggleThemeClass(isDark);
}

function toggleThemeClass(isDark) {
    const html = document.documentElement;
    if (isDark) {
        html.classList.add('dark');
        localStorage.theme = 'dark';
    } else {
        html.classList.remove('dark');
        localStorage.theme = 'light';
    }
}

function requestPath(path, pushHistory = true) {
    appState.currentPath = path || "/";
    if(UI.pathLabel) UI.pathLabel.textContent = appState.currentPath;
    if(UI.loading) UI.loading.classList.remove("hidden");
    
    if(socket && socket.connected) {
        socket.emit("list_dir", { path: appState.currentPath });
    } else if (socket) {
        socket.emit("list_dir", { path: appState.currentPath });
    }

    if (pushHistory) {
        if (appState.backStack.length === 0 || appState.backStack[appState.backStack.length - 1] !== appState.currentPath) {
            appState.backStack.push(appState.currentPath);
        }
        appState.forwardStack = [];
        updateNavButtons();
    }
    
    closeSidebar();
    clearSelections();
}

function updateNavButtons() {
    if(UI.backBtn) UI.backBtn.disabled = appState.backStack.length <= 1;
    if(UI.forwardBtn) UI.forwardBtn.disabled = appState.forwardStack.length === 0;
}

function handleGoBack() {
    if (appState.backStack.length > 1) {
        appState.forwardStack.push(appState.backStack.pop());
        requestPath(appState.backStack[appState.backStack.length - 1], false);
        updateNavButtons();
    }
}

function handleGoForward() {
    if (appState.forwardStack.length > 0) {
        const nextPath = appState.forwardStack.pop();
        requestPath(nextPath, false);
        appState.backStack.push(nextPath);
        updateNavButtons();
    }
}

function getFileIcon(ext, type) {
    if (type === "directory") return '<i class="fa-solid fa-folder"></i>';
    let checkExt = (ext || "").toLowerCase();
    if (!checkExt.startsWith(".")) checkExt = "." + checkExt;

    if (CONFIG.mediaExtensions.video.includes(checkExt)) return '<i class="fa-solid fa-film text-purple-500"></i>';
    if (CONFIG.mediaExtensions.audio.includes(checkExt)) return '<i class="fa-solid fa-music text-pink-500"></i>';
    if (CONFIG.mediaExtensions.pdf.includes(checkExt)) return '<i class="fa-solid fa-file-lines text-red-500"></i>';
    if (CONFIG.mediaExtensions.image.includes(checkExt)) return '<i class="fa-solid fa-image text-green-500"></i>';
    if (CONFIG.mediaExtensions.text.includes(checkExt) || CONFIG.mediaExtensions.web.includes(checkExt)) return '<i class="fa-solid fa-file-code text-blue-500"></i>';
    if (['.zip', '.rar', '.7z'].includes(checkExt)) return '<i class="fa-solid fa-file-zipper text-yellow-600"></i>';
    
    return '<i class="fa-solid fa-file text-gray-500"></i>';
}

function renderFileList(files) {
    if(!UI.fileList) return;
    UI.fileList.innerHTML = "";
    
    if (!files || files.length === 0) {
        UI.fileList.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center opacity-50 mt-20 pointer-events-none">
                <i class="fa-regular fa-folder-open text-6xl mb-4"></i>
                <p class="font-display uppercase tracking-widest">Directory Empty</p>
            </div>`;
        return;
    }

    const sorted = sortFiles(files);

    sorted.forEach(item => {
        const isDir = item.type === "directory";
        const div = document.createElement("div");
        div.className = isDir ? "folderItem" : "fileItem";
        
        div.dataset.path = item.path;
        div.dataset.type = item.type;
        div.title = item.details.name;
        
        const sizeOrCount = isDir ? `${item.details.count || 0} ITEMS` : formatSize(item.details.size);

        const actionHtml = `
            <div class="card-actions">
               <button class="w-6 h-6 bg-mag-bg border border-red-500 flex items-center justify-center hover:bg-mag-red hover:text-white rounded-sm text-xs"
                 onclick="handleQuickDownload(event, '${item.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${item.type}')">
                 <i class="fa-solid fa-download"></i>
               </button>
            </div>`;

        div.innerHTML = `
            <div class="fileIcon">${getFileIcon(item.details.extension, item.type)}</div>
            <div class="fileContentWrapper">
                <span class="fileName">${item.details.name}</span>
                <span class="fileMeta">${sizeOrCount}</span>
            </div>
            ${actionHtml}
        `;
        attachItemInteractions(div, item);
        UI.fileList.appendChild(div);
    });
}

function attachItemInteractions(div, item) {
    let clickCount = 0;
    let singleClickTimer = null;

    div.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.target.closest("button") || e.target.closest(".card-actions")) return;

        clickCount++;

        if (clickCount === 1) {
            singleClickTimer = setTimeout(() => {
                clickCount = 0;
                if (item.type === "directory") {
                    requestPath(item.path);
                } else {
                    handleFileOpen(item);
                }
            }, 250);
        } else if (clickCount === 2) {
            clearTimeout(singleClickTimer);
            clickCount = 0;
            if (item.type === "directory") {
                div.classList.toggle('folder-download-visible');
            }
        }
    });
}

function clearSelections() {
    document.querySelectorAll('.folder-download-visible').forEach(el => el.classList.remove('folder-download-visible'));
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

// --- FILE OPENING DISPATCHER ---

function handleFileOpen(item) {
    let rawExt = item.details.extension || "";
    let ext = rawExt.trim().toLowerCase();
    if (ext.length > 0 && !ext.startsWith('.')) {
        ext = '.' + ext;
    }
    
    if (CONFIG.mediaExtensions.image.includes(ext)) {
        GalleryApp.open(item);
        return;
    }
    
    if (CONFIG.mediaExtensions.video.includes(ext)) {
        VideoPlayerApp.open(item);
        return;
    }

    if (CONFIG.mediaExtensions.audio.includes(ext)) {
        AudioPlayerApp.open(item);
        return;
    }
    
    if (CONFIG.mediaExtensions.text.includes(ext)) {
        TextEditorApp.open(item);
        return;
    }

    if (CONFIG.mediaExtensions.web.includes(ext)) {
        WebModalApp.open(item);
        return;
    }
    
    if (CONFIG.mediaExtensions.pdf.includes(ext)) {
        openBlobInNewTab(item.path, 'application/pdf');
        return;
    }

    NotSupportedApp.open(item);
}

function openBlobInNewTab(path, mimeType) {
    const rawUrl = `${BASE_URL}/download/file?path=${encodeURIComponent(path)}`;
    
    fetch(rawUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.blob();
        })
        .then(blob => {
            const fileBlob = new Blob([blob], {type: mimeType || 'text/html'});
            const blobUrl = URL.createObjectURL(fileBlob);
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        })
        .catch(err => {
            console.error("Blob open failed, falling back to direct link:", err);
            window.open(rawUrl, "_blank");
        });
}

// ==========================================
//  APP MODULE: AUDIO PLAYER
// ==========================================

const AudioPlayerApp = {
    state: {
        isOpen: false,
        isPip: false,
        playlist: [],
        currentIndex: 0
    },
    dom: {},
    init() {
        this.dom = {
            app: document.getElementById('audioPlayerApp'),
            audio: document.getElementById('apAudio'),
            fileName: document.getElementById('apFileName'),
            closeBtn: document.getElementById('apCloseBtn'),
            pipBtn: document.getElementById('apPipBtn'),
            playPauseBtn: document.getElementById('apPlayPauseBtn'),
            prevBtn: document.getElementById('apPrevBtn'),
            nextBtn: document.getElementById('apNextBtn'),
            seekBackBtn: document.getElementById('apSeekBackBtn'),
            seekFwdBtn: document.getElementById('apSeekFwdBtn'),
            muteBtn: document.getElementById('apMuteBtn'),
            volumeInput: document.getElementById('apVolumeInput'),
            speedInput: document.getElementById('apSpeedInput'),
            speedLabel: document.getElementById('apSpeedLabel'),
            seekInput: document.getElementById('apSeekInput'),
            progressBar: document.getElementById('apProgressBar'),
            seekThumb: document.getElementById('apSeekThumb'),
            timeCurrent: document.getElementById('apTimeCurrent'),
            timeRemaining: document.getElementById('apTimeRemaining'),
            visualizer: document.getElementById('apVisualizer'),
            
            // Mini Player DOM
            miniPlayer: document.getElementById('miniPlayer'),
            miniTitle: document.getElementById('miniPlayerTitle'),
            miniProgress: document.getElementById('miniPlayerProgress'),
            miniPlayPause: document.getElementById('miniPlayerPlayPause'),
            miniPrev: document.getElementById('miniPlayerPrev'),
            miniNext: document.getElementById('miniPlayerNext'),
            miniClose: document.getElementById('miniPlayerClose'),
            miniExpand: document.getElementById('miniPlayerExpand'),
            miniInfo: document.getElementById('miniPlayerInfo')
        };

        if(!this.dom.app) return;

        // --- Visualizer Setup ---
        for(let i=0; i<8; i++) {
            const bar = document.createElement('div');
            bar.className = 'visualizer-bar';
            bar.style.animationDelay = `${i * 0.1}s`;
            this.dom.visualizer.appendChild(bar);
        }

        // --- Events ---
        this.dom.closeBtn.onclick = () => this.close();
        this.dom.pipBtn.onclick = () => this.togglePip();
        this.dom.playPauseBtn.onclick = () => this.togglePlay();
        this.dom.seekBackBtn.onclick = () => { this.dom.audio.currentTime -= 10; };
        this.dom.seekFwdBtn.onclick = () => { this.dom.audio.currentTime += 10; };
        this.dom.prevBtn.onclick = () => this.prev();
        this.dom.nextBtn.onclick = () => this.next();
        
        this.dom.muteBtn.onclick = () => {
            this.dom.audio.muted = !this.dom.audio.muted;
            this.updateMuteIcon();
        };

        this.dom.volumeInput.oninput = (e) => {
            this.dom.audio.volume = e.target.value;
            this.dom.audio.muted = false;
            this.updateMuteIcon();
        };

        this.dom.speedInput.oninput = (e) => {
            const val = e.target.value;
            this.dom.audio.playbackRate = val;
            this.dom.speedLabel.textContent = val + 'x';
        };

        // Mini Player Events
        this.dom.miniPlayPause.onclick = (e) => { e.stopPropagation(); this.togglePlay(); };
        this.dom.miniPrev.onclick = (e) => { e.stopPropagation(); this.prev(); };
        this.dom.miniNext.onclick = (e) => { e.stopPropagation(); this.next(); };
        this.dom.miniClose.onclick = (e) => { e.stopPropagation(); this.close(); };
        this.dom.miniExpand.onclick = () => this.expand();
        this.dom.miniInfo.onclick = () => this.expand();

        // Progress
        this.dom.audio.ontimeupdate = () => {
            if(!this.dom.audio.duration) return;
            const pct = (this.dom.audio.currentTime / this.dom.audio.duration) * 100;
            this.dom.seekInput.value = pct;
            this.dom.progressBar.style.width = pct + '%';
            this.dom.seekThumb.style.left = pct + '%';
            this.dom.timeCurrent.textContent = this.formatTime(this.dom.audio.currentTime);
            this.dom.timeRemaining.textContent = "-" + this.formatTime(this.dom.audio.duration - this.dom.audio.currentTime);
            
            // Sync Mini Player
            if(this.dom.miniProgress) this.dom.miniProgress.style.width = pct + '%';
        };

        this.dom.seekInput.oninput = (e) => {
            const time = (e.target.value / 100) * this.dom.audio.duration;
            this.dom.audio.currentTime = time;
        };

        this.dom.audio.onended = () => this.next();

        // --- Draggable Mini Player Logic ---
        let isDragging = false;
        let dragStartX, dragStartY, initialLeft, initialTop;

        const handleDragStart = (e) => {
            // Prevent drag if clicking control buttons
            if(e.target.closest('button')) return;
            
            isDragging = true;
            // Get proper client coordinates for mouse or touch
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const rect = this.dom.miniPlayer.getBoundingClientRect();
            
            // Disable transition for instant response
            this.dom.miniPlayer.style.transition = 'none';
            // Switch from center-based css to top/left based positioning
            this.dom.miniPlayer.style.transform = 'none';
            this.dom.miniPlayer.style.bottom = 'auto';
            this.dom.miniPlayer.style.left = `${rect.left}px`;
            this.dom.miniPlayer.style.top = `${rect.top}px`;
            
            dragStartX = clientX;
            dragStartY = clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
        };

        const handleDragMove = (e) => {
            if(!isDragging) return;
            e.preventDefault(); // Prevent scrolling while dragging
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const dx = clientX - dragStartX;
            const dy = clientY - dragStartY;
            
            this.dom.miniPlayer.style.left = `${initialLeft + dx}px`;
            this.dom.miniPlayer.style.top = `${initialTop + dy}px`;
        };

        const handleDragEnd = () => {
            if(isDragging) {
                isDragging = false;
                this.dom.miniPlayer.style.transition = ''; // Re-enable transition
            }
        };

        // Attach drag listeners
        this.dom.miniPlayer.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);

        this.dom.miniPlayer.addEventListener('touchstart', handleDragStart, {passive: false});
        document.addEventListener('touchmove', handleDragMove, {passive: false});
        document.addEventListener('touchend', handleDragEnd);
    },

    togglePlay() {
        if(this.dom.audio.paused) {
            this.dom.audio.play();
            this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause text-2xl"></i>';
            this.dom.miniPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.dom.visualizer.style.opacity = '1';
        } else {
            this.dom.audio.pause();
            this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-play text-2xl ml-1"></i>';
            this.dom.miniPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.dom.visualizer.style.opacity = '0.3';
        }
    },

    updateMuteIcon() {
        if(this.dom.audio.muted || this.dom.audio.volume === 0) {
            this.dom.muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        } else {
            this.dom.muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        }
    },

    open(initialItem) {
        // Build Playlist from current directory files
        const audioFiles = appState.currentFiles.filter(f => {
            if (f.type !== 'file') return false;
            let ext = (f.details.extension || "").trim().toLowerCase();
            if (ext.length > 0 && !ext.startsWith('.')) ext = '.' + ext;
            return CONFIG.mediaExtensions.audio.includes(ext);
        });
        
        this.state.playlist = sortFiles(audioFiles);
        this.state.currentIndex = this.state.playlist.findIndex(f => f.path === initialItem.path);
        
        // Always reset PIP state when opening a new file
        this.expand();
        this.render();
    },

    render() {
        const item = this.state.playlist[this.state.currentIndex];
        if (!item) return;
        
        this.dom.fileName.textContent = item.details.name;
        if(this.dom.miniTitle) this.dom.miniTitle.textContent = item.details.name;
        
        this.dom.audio.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(item.path)}`;
        this.dom.audio.play();
        this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause text-2xl"></i>';
        if(this.dom.miniPlayPause) this.dom.miniPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
        this.dom.visualizer.style.opacity = '1';

        // Check bounds to disable buttons
        const isFirst = this.state.currentIndex === 0;
        const isLast = this.state.currentIndex === this.state.playlist.length - 1;

        // Main Player Buttons
        this.dom.prevBtn.style.opacity = isFirst ? '0.3' : '1';
        this.dom.prevBtn.style.pointerEvents = isFirst ? 'none' : 'auto';
        this.dom.nextBtn.style.opacity = isLast ? '0.3' : '1';
        this.dom.nextBtn.style.pointerEvents = isLast ? 'none' : 'auto';

        // Mini Player Buttons
        if(this.dom.miniPrev) {
            this.dom.miniPrev.style.opacity = isFirst ? '0.3' : '1';
            this.dom.miniPrev.style.pointerEvents = isFirst ? 'none' : 'auto';
        }
        if(this.dom.miniNext) {
            this.dom.miniNext.style.opacity = isLast ? '0.3' : '1';
            this.dom.miniNext.style.pointerEvents = isLast ? 'none' : 'auto';
        }
    },

    next() {
        if (this.state.currentIndex < this.state.playlist.length - 1) {
            this.state.currentIndex++;
            this.render();
        }
    },

    prev() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.render();
        }
    },

    togglePip() {
        this.state.isPip = true;
        
        // Hide Main Player
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        setTimeout(() => this.dom.app.classList.add('hidden'), 300);
        
        // Show Mini Player
        this.dom.miniPlayer.classList.remove('hidden');
        this.dom.miniPlayer.classList.add('flex');
    },

    expand() {
        this.state.isPip = false;
        
        // Hide Mini Player
        this.dom.miniPlayer.classList.add('hidden');
        this.dom.miniPlayer.classList.remove('flex');
        
        // Show Main Player
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
    },

    close() {
        this.dom.audio.pause();
        this.dom.audio.src = "";
        this.state.isPip = false;
        
        // Close Main
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        setTimeout(() => this.dom.app.classList.add('hidden'), 300);
        
        // Close Mini
        this.dom.miniPlayer.classList.add('hidden');
        this.dom.miniPlayer.classList.remove('flex');
    },

    formatTime(seconds) {
        if(!seconds) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
};

// ==========================================
//  APP MODULE: VIDEO PLAYER
// ==========================================

const VideoPlayerApp = {
    state: { 
        isOpen: false, 
        playlist: [], 
        currentIndex: 0, 
        isLocked: false, 
        interfaceIdleTimer: null,
        
        // Settings
        volume: 1,
        brightness: 1,
        
        // Touch State
        touchStartY: 0,
        touchStartVal: 0,
        activeTouch: null // 'brightness' or 'volume'
    },
    dom: {},
    
    init() {
        this.dom = {
            app: document.getElementById('videoPlayerApp'),
            video: document.getElementById('vpVideo'),
            fileName: document.getElementById('vpFileName'),
            interface: document.getElementById('vpInterface'),
            
            // Buttons
            playPauseBtn: document.getElementById('vpPlayPauseBtn'),
            seekBackBtn: document.getElementById('vpSeekBackBtn'),
            seekFwdBtn: document.getElementById('vpSeekFwdBtn'),
            seekBackBtnPortrait: document.getElementById('vpSeekBackBtnPortrait'),
            seekFwdBtnPortrait: document.getElementById('vpSeekFwdBtnPortrait'),
            
            prevBtn: document.getElementById('vpPrevBtn'),
            nextBtn: document.getElementById('vpNextBtn'),
            closeBtn: document.getElementById('vpCloseBtn'),
            lockBtn: document.getElementById('vpLockBtn'),
            rotateBtn: document.getElementById('vpRotateBtn'),
            fullscreenBtn: document.getElementById('vpFullscreenBtn'),
            
            // Progress
            timeCurrent: document.getElementById('vpTimeCurrent'),
            timeRemaining: document.getElementById('vpTimeRemaining'),
            seekInput: document.getElementById('vpSeekInput'),
            progressBar: document.getElementById('vpProgressBar'),
            seekThumb: document.getElementById('vpSeekThumb'),
            
            // Touch Zones
            touchLeft: document.getElementById('vpTouchLeft'),
            touchRight: document.getElementById('vpTouchRight'),
            
            // Visual Feedback
            brightnessOverlay: document.getElementById('vpBrightnessOverlay'),
            brightnessBar: document.getElementById('vpBrightnessBar'),
            brightnessContainer: document.getElementById('vpBrightnessContainer'),
            brightnessIcon: document.getElementById('vpBrightnessIcon'),
            
            volumeBar: document.getElementById('vpVolumeBar'),
            volumeContainer: document.getElementById('vpVolumeContainer'),
            volumeIcon: document.getElementById('vpVolumeIcon'),
            
            // Speed
            speedBtn: document.getElementById('vpSpeedBtn'),
            speedMenu: document.getElementById('vpSpeedMenu')
        };
        
        if(!this.dom.app) return;

        // --- Event Listeners ---
        
        // Global Interface Idle Logic
        const resetIdle = () => this.resetInterfaceTimer();
        this.dom.app.addEventListener('mousemove', resetIdle);
        this.dom.app.addEventListener('touchstart', resetIdle);
        this.dom.app.addEventListener('click', resetIdle);
        
        // Orientation Change Listener
        window.addEventListener('resize', () => this.handleOrientationChange());
        
        // Play/Pause
        this.dom.playPauseBtn.onclick = (e) => this.togglePlay(e);
        this.dom.video.onclick = (e) => {
            if(this.dom.app.classList.contains('user-idle')) {
                resetIdle();
            } else {
                this.togglePlay(e);
            }
        };

        // Seeking (Center & Bottom)
        const seekBack = (e) => { e.stopPropagation(); if(!this.state.isLocked) this.dom.video.currentTime -= 10; resetIdle(); };
        const seekFwd = (e) => { e.stopPropagation(); if(!this.state.isLocked) this.dom.video.currentTime += 10; resetIdle(); };
        
        this.dom.seekBackBtn.onclick = seekBack;
        this.dom.seekFwdBtn.onclick = seekFwd;
        this.dom.seekBackBtnPortrait.onclick = seekBack;
        this.dom.seekFwdBtnPortrait.onclick = seekFwd;

        // Progress Update
        this.dom.video.ontimeupdate = () => {
            if(!this.dom.video.duration) return;
            const pct = (this.dom.video.currentTime / this.dom.video.duration) * 100;
            this.dom.seekInput.value = pct;
            this.dom.progressBar.style.width = pct + '%';
            this.dom.seekThumb.style.left = pct + '%';
            
            this.dom.timeCurrent.textContent = this.formatTime(this.dom.video.currentTime);
            this.dom.timeRemaining.textContent = "-" + this.formatTime(this.dom.video.duration - this.dom.video.currentTime);
        };

        // User Seeking (Scrubbing)
        this.dom.seekInput.oninput = (e) => {
            if(this.state.isLocked) return;
            resetIdle();
            const time = (e.target.value / 100) * this.dom.video.duration;
            this.dom.video.currentTime = time;
        };

        // --- SMART TOUCH ZONES (Brightness & Volume) ---
        // Handles both Touch (Mobile) and Mouse (Desktop/Click & Drag)
        
        const handleGestureStart = (e, type) => {
            if(this.state.isLocked) return;
            this.state.activeTouch = type;
            
            // Support both Touch and Mouse events
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.state.touchStartY = clientY;
            
            if (type === 'brightness') {
                this.state.touchStartVal = this.state.brightness;
                this.dom.brightnessContainer.style.opacity = '1';
                this.dom.brightnessIcon.style.opacity = '1';
            } else {
                this.state.touchStartVal = this.state.volume;
                this.dom.volumeContainer.style.opacity = '1';
                this.dom.volumeIcon.style.opacity = '1';
            }
        };
        
        const handleGestureMove = (e) => {
            if(this.state.isLocked || !this.state.activeTouch) return;
            e.preventDefault(); // Stop page scrolling
            
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = this.state.touchStartY - clientY;
            const screenHeight = window.innerHeight;
            const deltaVal = deltaY / (screenHeight * 0.5); // Sensitivity
            
            let newVal = Math.max(0, Math.min(1, this.state.touchStartVal + deltaVal));
            
            if (this.state.activeTouch === 'brightness') {
                this.updateBrightness(newVal);
            } else {
                this.updateVolume(newVal);
            }
        };
        
        const handleGestureEnd = () => {
            if (!this.state.activeTouch) return;
            this.state.activeTouch = null;
            // Fade out sliders after delay
            setTimeout(() => {
                if(!this.state.activeTouch) {
                    this.dom.brightnessContainer.style.opacity = '0';
                    this.dom.brightnessIcon.style.opacity = '0';
                    this.dom.volumeContainer.style.opacity = '0';
                    this.dom.volumeIcon.style.opacity = '0';
                }
            }, 1000);
        };
        
        // Touch Listeners
        this.dom.touchLeft.addEventListener('touchstart', (e) => handleGestureStart(e, 'brightness'), {passive: true});
        this.dom.touchRight.addEventListener('touchstart', (e) => handleGestureStart(e, 'volume'), {passive: true});
        this.dom.touchLeft.addEventListener('touchmove', handleGestureMove, {passive: false});
        this.dom.touchRight.addEventListener('touchmove', handleGestureMove, {passive: false});
        this.dom.touchLeft.addEventListener('touchend', handleGestureEnd);
        this.dom.touchRight.addEventListener('touchend', handleGestureEnd);

        // Mouse Listeners (Desktop Support)
        this.dom.touchLeft.addEventListener('mousedown', (e) => handleGestureStart(e, 'brightness'));
        this.dom.touchRight.addEventListener('mousedown', (e) => handleGestureStart(e, 'volume'));
        
        // Window listeners for mouse drag continuation outside zone
        window.addEventListener('mousemove', (e) => {
            if(this.state.activeTouch) handleGestureMove(e);
        });
        window.addEventListener('mouseup', handleGestureEnd);


        // --- Other Controls ---
        
        // Speed
        this.dom.speedBtn.onclick = (e) => {
            e.stopPropagation();
            if(this.state.isLocked) return;
            this.dom.speedMenu.classList.toggle('hidden');
        };
        this.dom.speedMenu.onclick = (e) => {
            if(e.target.tagName === 'BUTTON') {
                const speed = parseFloat(e.target.dataset.speed);
                this.dom.video.playbackRate = speed;
                this.dom.speedBtn.textContent = speed + 'x';
                // Reset styling
                Array.from(this.dom.speedMenu.children).forEach(btn => {
                    btn.classList.remove('text-mag-red', 'font-bold');
                    btn.classList.add('text-white/70');
                });
                e.target.classList.remove('text-white/70');
                e.target.classList.add('text-mag-red', 'font-bold');
                
                this.dom.speedMenu.classList.add('hidden');
            }
        };

        // Lock
        this.dom.lockBtn.onclick = (e) => { e.stopPropagation(); this.toggleLock(); };
        
        // Rotate
        this.dom.rotateBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleOrientation();
        };

        // Fullscreen Toggle
        this.dom.fullscreenBtn.onclick = (e) => {
            e.stopPropagation();
            if (document.fullscreenElement) {
                document.exitFullscreen();
                this.dom.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand text-xl"></i>';
            } else {
                this.dom.app.requestFullscreen();
                this.dom.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress text-xl"></i>';
            }
        };

        // Navigation
        this.dom.prevBtn.onclick = () => { if(!this.state.isLocked) this.prev(); };
        this.dom.nextBtn.onclick = () => { if(!this.state.isLocked) this.next(); };
        
        // Close
        this.dom.closeBtn.onclick = () => { if(!this.state.isLocked) this.close(); };
    },

    resetInterfaceTimer() {
        this.dom.app.classList.remove('user-idle');
        if(this.state.interfaceIdleTimer) clearTimeout(this.state.interfaceIdleTimer);
        
        // If playing, fade out after 3s. If paused, keep visible.
        if (!this.dom.video.paused) {
            this.state.interfaceIdleTimer = setTimeout(() => {
                this.dom.app.classList.add('user-idle');
            }, 3000);
        }
    },
    
    togglePlay(e) {
        if(e) e.stopPropagation();
        if(this.state.isLocked) return;
        
        if(this.dom.video.paused) {
            this.dom.video.play().catch(e => console.error("Playback error:", e));
            this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause text-4xl"></i>';
        } else {
            this.dom.video.pause();
            this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-play text-4xl ml-2"></i>';
        }
        this.resetInterfaceTimer();
    },

    updateBrightness(val) {
        this.state.brightness = val;
        // Darken overlay (1 - val) * 0.7 max opacity
        this.dom.brightnessOverlay.style.opacity = (1 - val) * 0.7;
        this.dom.brightnessBar.style.height = (val * 100) + '%';
        
        // Update Icon based on level
        if(val > 0.5) this.dom.brightnessIcon.className = "fa-solid fa-sun text-white text-xl absolute -bottom-8 left-1/2 -translate-x-1/2 drop-shadow-md opacity-100 transition-opacity duration-300";
        else this.dom.brightnessIcon.className = "fa-regular fa-sun text-white text-xl absolute -bottom-8 left-1/2 -translate-x-1/2 drop-shadow-md opacity-100 transition-opacity duration-300";
    },

    updateVolume(val) {
        this.state.volume = val;
        this.dom.video.volume = val;
        this.dom.volumeBar.style.height = (val * 100) + '%';
        
        // Update Icon
        let iconClass = "fa-volume-xmark";
        if(val > 0.5) iconClass = "fa-volume-high";
        else if(val > 0) iconClass = "fa-volume-low";
        
        this.dom.volumeIcon.className = `fa-solid ${iconClass} text-white text-xl absolute -bottom-8 left-1/2 -translate-x-1/2 drop-shadow-md opacity-100 transition-opacity duration-300`;
    },

    toggleLock() {
        this.state.isLocked = !this.state.isLocked;
        
        if (this.state.isLocked) {
            this.dom.app.classList.add('locked-mode');
            this.dom.lockBtn.innerHTML = '<i class="fa-solid fa-lock text-2xl text-mag-red drop-shadow-md"></i>';
            this.dom.lockBtn.parentElement.classList.add('scale-110');
        } else {
            this.dom.app.classList.remove('locked-mode');
            this.dom.lockBtn.innerHTML = '<i class="fa-solid fa-lock-open text-2xl drop-shadow-md"></i>';
            this.dom.lockBtn.parentElement.classList.remove('scale-110');
        }
        this.resetInterfaceTimer();
    },
    
    toggleOrientation() {
        if (screen.orientation && screen.orientation.type) {
            const isLandscape = screen.orientation.type.includes('landscape');
            // Try to flip
            const target = isLandscape ? "portrait-primary" : "landscape-primary";
            
            // API Lock
            if(screen.orientation.lock) {
                screen.orientation.lock(target).catch(e => {
                    console.log("Lock failed (OS restricted), swapping UI class manually");
                    this.dom.app.classList.toggle('portrait-mode');
                });
            } else {
                 // Manual Fallback for UI Layout Only
                 this.dom.app.classList.toggle('portrait-mode');
            }
        } else {
            // Fallback for desktops/old browsers
            this.dom.app.classList.toggle('portrait-mode');
        }
    },
    
    handleOrientationChange() {
        // Auto-detect layout
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        if (h > w) {
            this.dom.app.classList.add('portrait-mode');
        } else {
            this.dom.app.classList.remove('portrait-mode');
        }
    },

    open(initialItem) {
        // Filter videos
        const videos = appState.currentFiles.filter(f => {
            if (f.type !== 'file') return false;
            let ext = (f.details.extension || "").trim().toLowerCase();
            if (ext.length > 0 && !ext.startsWith('.')) ext = '.' + ext;
            return CONFIG.mediaExtensions.video.includes(ext);
        });
        
        this.state.playlist = sortFiles(videos);
        this.state.currentIndex = this.state.playlist.findIndex(f => f.path === initialItem.path);
        
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
        
        // Reset State
        this.state.isLocked = false;
        this.dom.app.classList.remove('locked-mode');
        this.dom.lockBtn.innerHTML = '<i class="fa-solid fa-lock-open text-2xl drop-shadow-md"></i>';
        this.dom.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress text-xl"></i>';

        this.dom.brightnessContainer.style.opacity = '0';
        this.dom.volumeContainer.style.opacity = '0';
        this.dom.brightnessIcon.style.opacity = '0';
        this.dom.volumeIcon.style.opacity = '0';

        // Auto Fullscreen & Landscape
        try {
            this.dom.app.requestFullscreen().catch(e => console.log("Fullscreen blocked"));
            if(screen.orientation && screen.orientation.lock) {
                screen.orientation.lock("landscape").catch(e => console.log("Orientation lock blocked"));
            }
        } catch(e) {}

        this.handleOrientationChange(); // Set initial layout
        this.render();
        this.resetInterfaceTimer();
    },

    render() {
        const item = this.state.playlist[this.state.currentIndex];
        if (!item) return;
        
        this.dom.fileName.textContent = item.details.name;
        this.dom.video.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(item.path)}`;
        this.dom.video.load();
        
        const playPromise = this.dom.video.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause text-4xl"></i>';
                this.resetInterfaceTimer();
            }).catch(error => {
                this.dom.playPauseBtn.innerHTML = '<i class="fa-solid fa-play text-4xl ml-2"></i>';
            });
        }
        
        this.dom.prevBtn.style.opacity = (this.state.currentIndex > 0) ? '1' : '0.3';
        this.dom.nextBtn.style.opacity = (this.state.currentIndex < this.state.playlist.length - 1) ? '1' : '0.3';
    },

    close() {
        this.dom.video.pause();
        this.dom.video.src = "";
        
        // Exit Fullscreen & Lock
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(e=>{});
        }
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }

        if(this.state.interfaceIdleTimer) clearTimeout(this.state.interfaceIdleTimer);
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto', 'user-idle', 'locked-mode');
        setTimeout(() => this.dom.app.classList.add('hidden'), 300);
    },

    next() {
        if (this.state.currentIndex < this.state.playlist.length - 1) {
            this.state.currentIndex++;
            this.render();
        }
    },

    prev() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.render();
        }
    },

    formatTime(seconds) {
        if(!seconds) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
};

// ==========================================
//  APP MODULES (Other)
// ==========================================

const GalleryApp = {
    state: { isOpen: false, playlist: [], currentIndex: 0, rotation: 0, zoom: 1, isLoop: false },
    dom: {},
    init() {
        this.dom = {
            app: document.getElementById('galleryApp'),
            img: document.getElementById('galleryImage'),
            filename: document.getElementById('galleryFileName'),
            prevBtn: document.getElementById('galleryPrevBtn'),
            nextBtn: document.getElementById('galleryNextBtn'),
            closeBtn: document.getElementById('galleryCloseBtn'),
            rotateBtn: document.getElementById('galleryRotateBtn'),
            loopBtn: document.getElementById('galleryLoopBtn'),
            fullscreenBtn: document.getElementById('galleryFullscreenBtn')
        };
        if(!this.dom.app) return;
        this.dom.closeBtn.onclick = () => this.close();
        this.dom.prevBtn.onclick = (e) => { e.stopPropagation(); this.prev(); };
        this.dom.nextBtn.onclick = (e) => { e.stopPropagation(); this.next(); };
        this.dom.rotateBtn.onclick = (e) => { e.stopPropagation(); this.rotate(); };
        this.dom.loopBtn.onclick = (e) => { e.stopPropagation(); this.toggleLoop(); };
        this.dom.fullscreenBtn.onclick = (e) => { e.stopPropagation(); this.toggleFullscreen(); };
        this.dom.app.addEventListener('wheel', (e) => {
            if (!this.state.isOpen) return;
            e.preventDefault();
            const delta = Math.sign(e.deltaY) * -0.1;
            this.state.zoom = Math.max(0.5, Math.min(5, this.state.zoom + delta));
            this.applyTransform();
        });
        document.addEventListener('keydown', (e) => {
            if (!this.state.isOpen) return;
            if (e.key === 'Escape') document.fullscreenElement ? document.exitFullscreen() : this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
    },
    open(initialItem) {
        const images = appState.currentFiles.filter(f => {
            if (f.type !== 'file') return false;
            let ext = (f.details.extension || "").trim().toLowerCase();
            if (ext.length > 0 && !ext.startsWith('.')) ext = '.' + ext;
            return CONFIG.mediaExtensions.image.includes(ext);
        });
        this.state.playlist = sortFiles(images);
        this.state.currentIndex = this.state.playlist.findIndex(f => f.path === initialItem.path);
        if (this.state.currentIndex === -1) {
            this.state.playlist = [initialItem];
            this.state.currentIndex = 0;
        }
        this.state.rotation = 0;
        this.state.zoom = 1;
        this.state.isOpen = true;
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
        this.render();
    },
    close() {
        this.state.isOpen = false;
        if (document.fullscreenElement) document.exitFullscreen();
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        setTimeout(() => this.dom.app.classList.add('hidden'), 300);
    },
    render() {
        const item = this.state.playlist[this.state.currentIndex];
        if (!item) return;
        const url = `${BASE_URL}/download/file?path=${encodeURIComponent(item.path)}`;
        this.dom.img.src = url;
        this.dom.filename.textContent = item.details.name;
        this.updateButtons();
        this.applyTransform();
    },
    next() {
        if (this.state.currentIndex < this.state.playlist.length - 1) { this.state.currentIndex++; this.render(); }
        else if (this.state.isLoop) { this.state.currentIndex = 0; this.render(); }
    },
    prev() {
        if (this.state.currentIndex > 0) { this.state.currentIndex--; this.render(); }
        else if (this.state.isLoop) { this.state.currentIndex = this.state.playlist.length - 1; this.render(); }
    },
    rotate() { this.state.rotation = (this.state.rotation + 90) % 360; this.applyTransform(); },
    toggleLoop() { this.state.isLoop = !this.state.isLoop; this.dom.loopBtn.classList.toggle('active', this.state.isLoop); this.updateButtons(); },
    toggleFullscreen() {
        if (!document.fullscreenElement) { this.dom.app.requestFullscreen().catch(e=>{}); this.dom.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress text-sm"></i>'; }
        else { document.exitFullscreen(); this.dom.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand text-sm"></i>'; }
    },
    updateButtons() {
        const isLast = this.state.currentIndex === this.state.playlist.length - 1;
        const isFirst = this.state.currentIndex === 0;
        if (!this.state.isLoop) {
            this.dom.nextBtn.style.opacity = isLast ? '0' : '1'; this.dom.nextBtn.style.pointerEvents = isLast ? 'none' : 'auto';
            this.dom.prevBtn.style.opacity = isFirst ? '0' : '1'; this.dom.prevBtn.style.pointerEvents = isFirst ? 'none' : 'auto';
        } else {
            this.dom.nextBtn.style.opacity = '1'; this.dom.nextBtn.style.pointerEvents = 'auto';
            this.dom.prevBtn.style.opacity = '1'; this.dom.prevBtn.style.pointerEvents = 'auto';
        }
        this.resetTransform();
    },
    applyTransform() { this.dom.img.style.transform = `rotate(${this.state.rotation}deg) scale(${this.state.zoom})`; },
    resetTransform() { this.state.rotation = 0; this.state.zoom = 1; this.applyTransform(); }
    };

const TextEditorApp = {
    dom: {},
    isOpen: false,
    init() {
        this.dom = {
            app: document.getElementById('textEditorApp'),
            content: document.getElementById('textEditorContent'),
            filename: document.getElementById('textEditorFileName'),
            closeBtn: document.getElementById('textEditorCloseBtn'),
            copyBtn: document.getElementById('textEditorCopyBtn')
        };
        if(!this.dom.app) return;
        this.dom.closeBtn.onclick = () => this.close();
        this.dom.copyBtn.onclick = () => this.copyToClipboard();
        document.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    },
    open(item) {
        this.isOpen = true;
        this.dom.filename.textContent = item.details.name;
        this.dom.content.innerHTML = "Loading content...";
        this.dom.content.className = "block font-mono text-sm text-gray-300 whitespace-pre outline-none";
        
        const url = `${BASE_URL}/download/file?path=${encodeURIComponent(item.path)}`;
        
        // Fetch as Blob first ("download in JS"), then read via FileReader
        fetch(url)
            .then(async res => {
                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsText(blob);
                });
            })
            .then(text => {
                this.dom.content.textContent = text;
                let ext = (item.details.extension || "").toLowerCase().trim();
                if(ext.startsWith('.')) ext = ext.substring(1);
                this.dom.content.className = `language-${ext}`;
                if (window.Prism) Prism.highlightElement(this.dom.content);
            })
            .catch(err => {
                this.dom.content.innerHTML = `
                    <div style="color: #ff0000; font-weight: bold; padding: 20px;">Error loading content: ${err.message}</div>
                    <div style="color: #888; font-size: 12px; padding: 0 20px;">
                        This file cannot be fetched via AJAX (CORS/Permissions).<br>
                        Use the button below to view it directly.
                    </div>
                    <div style="padding: 20px;">
                        <button onclick="window.open('${url}', '_blank')"
                            style="padding: 8px 16px; border: 1px solid #ff0000; color: #ff0000; background: transparent; text-transform: uppercase; cursor: pointer;">
                            Open in New Tab
                        </button>
                    </div>
                `;
            });
        
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
    },
    close() {
        this.isOpen = false;
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        setTimeout(() => { this.dom.app.classList.add('hidden'); this.dom.content.textContent = ""; }, 300);
    },
    copyToClipboard() {
        navigator.clipboard.writeText(this.dom.content.textContent);
        const originalText = this.dom.copyBtn.textContent;
        this.dom.copyBtn.textContent = "COPIED!";
        setTimeout(() => { this.dom.copyBtn.textContent = originalText; }, 2000);
    }
};

const WebModalApp = {
    dom: {},
    currentItem: null,
    init() {
        this.dom = {
            app: document.getElementById('webModalApp'),
            fileName: document.getElementById('webFileName'),
            closeBtn: document.getElementById('webCloseBtn'),
            openBtn: document.getElementById('webOpenBtn'),
            codeBtn: document.getElementById('webCodeBtn')
        };
        if(!this.dom.app) return;
        const closeHandler = () => this.close();
        this.dom.closeBtn.onclick = closeHandler;
        this.dom.app.onclick = (e) => { if(e.target === this.dom.app) closeHandler(); };
        this.dom.openBtn.onclick = () => {
            if(this.currentItem) {
                openBlobInNewTab(this.currentItem.path, 'text/html');
                this.close();
            }
        };
        this.dom.codeBtn.onclick = () => {
            if(this.currentItem) {
                this.close();
                setTimeout(() => TextEditorApp.open(this.currentItem), 100);
            }
        };
    },
    open(item) {
        this.currentItem = item;
        this.dom.fileName.textContent = item.details.name;
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100'); }
    },
    close() {
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.add('scale-95'); modalBox.classList.remove('scale-100'); }
        setTimeout(() => { this.dom.app.classList.add('hidden'); this.currentItem = null; }, 300);
    }
};

const FolderDetailsApp = {
    dom: {},
    init() {
        this.dom = {
            app: document.getElementById('folderDetailsApp'),
            content: document.getElementById('fdContent'),
            closeBtn: document.getElementById('fdCloseBtn'),
            downloadBtn: document.getElementById('fdDownloadBtn')
        };
        if(!this.dom.app) return;
        
        this.dom.closeBtn.onclick = () => this.close();
        this.dom.app.onclick = (e) => { if(e.target === this.dom.app) this.close(); };
        
        if(UI.openFolderInfo) UI.openFolderInfo.onclick = () => this.open();
        
        this.dom.downloadBtn.onclick = () => {
            const files = appState.currentFiles.filter(f => f.type === 'file');
            if (files.length === 0) { alert("No files to download."); return; }
            files.forEach(f => {
                const link = document.createElement('a');
                link.href = `${BASE_URL}/download/file?path=${encodeURIComponent(f.path)}`;
                link.download = f.details.name;
                link.target = "_blank";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            this.close();
        };
    },
    open() {
        const d = appState.currentFolderDetails || { name: 'Current Folder', count: appState.currentFiles.length, modified: new Date().toISOString() };
        this.dom.content.innerHTML = `
            <p><strong class="text-mag-red">Path:</strong> ${appState.currentPath}</p>
            <p><strong class="text-mag-red">Items:</strong> ${appState.currentFiles.length} (Visible)</p>
            <p><strong class="text-mag-red">Last Modified:</strong> ${d.modified ? formatDate(d.modified) : 'N/A'}</p>
        `;
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100'); }
    },
    close() {
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.add('scale-95'); modalBox.classList.remove('scale-100'); }
        setTimeout(() => { this.dom.app.classList.add('hidden'); }, 300);
    }
};

const NotSupportedApp = {
    dom: {},
    currentItem: null,
    init() {
        this.dom = {
            app: document.getElementById('notSupportedApp'),
            fileName: document.getElementById('nsFileName'),
            closeBtn: document.getElementById('nsCloseBtn'),
            downloadBtn: document.getElementById('nsDownloadBtn')
        };
        if(!this.dom.app) return;
        const closeHandler = () => this.close();
        this.dom.closeBtn.onclick = closeHandler;
        this.dom.app.onclick = (e) => { if(e.target === this.dom.app) closeHandler(); };
        this.dom.downloadBtn.onclick = () => {
            if(this.currentItem) {
                window.open(`${BASE_URL}/download/file?path=${encodeURIComponent(this.currentItem.path)}`, "_blank");
                this.close();
            }
        };
    },
    open(item) {
        this.currentItem = item;
        this.dom.fileName.textContent = item.details.name;
        this.dom.app.classList.remove('hidden');
        void this.dom.app.offsetWidth;
        this.dom.app.classList.add('open', 'opacity-100', 'pointer-events-auto');
        this.dom.app.classList.remove('opacity-0', 'pointer-events-none');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100'); }
    },
    close() {
        this.dom.app.classList.add('opacity-0', 'pointer-events-none');
        this.dom.app.classList.remove('open', 'opacity-100', 'pointer-events-auto');
        const modalBox = this.dom.app.querySelector('div');
        if(modalBox) { modalBox.classList.add('scale-95'); modalBox.classList.remove('scale-100'); }
        setTimeout(() => { this.dom.app.classList.add('hidden'); this.currentItem = null; }, 300);
    }
};

// --- Utils ---

window.handleQuickDownload = function(e, path, type) {
    if(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    if (type === 'directory') {
        alert("Use the Details button in footer to download folders.");
        return false;
    }
    
    const link = document.createElement('a');
    link.href = `${BASE_URL}/download/file?path=${encodeURIComponent(path)}`;
    link.download = path.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return false;
};

function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function sortFiles(files) {
    const criteria = UI.sortSelect ? UI.sortSelect.value : "name_asc";
    return files.sort((a, b) => {
        if (criteria === "name_asc") return a.details.name.localeCompare(b.details.name);
        if (criteria === "name_desc") return b.details.name.localeCompare(a.details.name);
        if (criteria === "size_desc") return (b.details.size || 0) - (a.details.size || 0);
        if (criteria === "size_asc") return (a.details.size || 0) - (b.details.size || 0);
        if (criteria === "modified_desc") return new Date(b.details.modified) - new Date(a.details.modified);
        if (criteria === "modified_asc") return new Date(a.details.modified) - new Date(b.details.modified);
        return 0;
    });
}

function setupEventListeners() {
    if(UI.backBtn) UI.backBtn.onclick = handleGoBack;
    if(UI.forwardBtn) UI.forwardBtn.onclick = handleGoForward;
    
    const handleSort = () => { if (appState.currentFiles.length) renderFileList(appState.currentFiles); };
    if(UI.sortSelect) UI.sortSelect.onchange = handleSort;
    if(UI.sortSelectMobile) UI.sortSelectMobile.onchange = handleSort;

    const handleTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        toggleThemeClass(!isDark);
    };
    if(UI.themeToggle) UI.themeToggle.onclick = handleTheme;
    if(UI.themeToggleMobile) UI.themeToggleMobile.onclick = handleTheme;

    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.fileItem, .folderItem');
        items.forEach(el => {
            const name = (el.querySelector('.fileName').textContent || "").toLowerCase();
            el.style.display = name.includes(term) ? "flex" : "none";
        });
    };
    if(UI.searchInput) UI.searchInput.oninput = handleSearch;
    if(UI.mobileSearch) UI.mobileSearch.oninput = handleSearch;

    if(UI.burgerBtn) UI.burgerBtn.onclick = () => {
        if(UI.mobileSidebar) UI.mobileSidebar.style.right = "0";
        if(UI.sidebarBackdrop) UI.sidebarBackdrop.classList.remove("hidden");
        setTimeout(() => UI.sidebarBackdrop.classList.remove("opacity-0"), 10);
    };

    const closeMenu = () => {
        if(UI.mobileSidebar) UI.mobileSidebar.style.right = "-100%";
        if(UI.sidebarBackdrop) {
            UI.sidebarBackdrop.classList.add("opacity-0");
            setTimeout(() => UI.sidebarBackdrop.classList.add("hidden"), 300);
        }
    };
    if(UI.sidebarCloseBtn) UI.sidebarCloseBtn.onclick = closeMenu;
    if(UI.sidebarBackdrop) UI.sidebarBackdrop.onclick = closeMenu;
}

function setupSocketListeners() {
    socket.on("connect", () => {
        console.log("Connected to backend");
        appState.isServerReachable = true;
    });

    socket.on("list_dir_result", (res) => {
        if(UI.loading) UI.loading.classList.add("hidden");
        if (res.status === "error") {
            if(UI.fileList) UI.fileList.innerHTML = `<div class="text-red-500 font-bold p-10 text-center">Error: ${res.message}</div>`;
            return;
        }

        appState.currentFiles = res.data.children || [];
        appState.currentFolderDetails = res.data.details;
        
        if (res.data.path) {
            appState.currentPath = res.data.path;
            if(UI.pathLabel) UI.pathLabel.textContent = appState.currentPath;
        }

        renderFileList(appState.currentFiles);
    });
}

function closeSidebar() {
    if (UI.mobileSidebar && UI.mobileSidebar.style.right === "0px") {
        if(UI.sidebarCloseBtn) UI.sidebarCloseBtn.click();
    }
}

document.addEventListener('DOMContentLoaded', init);