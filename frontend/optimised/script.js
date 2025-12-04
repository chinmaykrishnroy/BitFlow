"use strict";

const App = (() => {
    // --- Config & State ---
    const CONFIG = {
        host: window.location.hostname || "localhost",
        port: 8888,
        ext: {
            img: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
            audio: [".mp3", ".wav", ".ogg", ".m4a"],
            video: [".mp4", ".webm", ".ogv", ".mov", ".mkv"],
            pdf: [".pdf"],
            web: [".html", ".htm", ".xhtml", ".php"],
            text: [".txt", ".md", ".js", ".json", ".css", ".xml", ".c", ".cpp", ".h", ".java", ".py", ".sh", ".bat", ".ini", ".log", ".yml", ".sql", ".ts"]
        }
    };
    
    const BASE_URL = `http://${CONFIG.host}:${CONFIG.port}`;
    let socket;
    
    const state = {
        path: "/",
        history: { back: [], fwd: [] },
        files: [],
        details: null,
        selections: new Set(),
        serverUp: true
    };

    // --- Utilities ---
    const Utils = {
        debounce: (fn, delay) => {
            let id;
            return (...args) => {
                clearTimeout(id);
                id = setTimeout(() => fn(...args), delay);
            };
        },
        fmtBytes: (bytes) => {
            if (bytes === 0) return "0 B";
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + " " + ["B", "KB", "MB", "GB", "TB"][i];
        },
        fmtTime: (s) => {
            if (!s) return "00:00";
            const m = Math.floor(s / 60);
            const sc = Math.floor(s % 60);
            return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
        },
        download: (path, name) => {
            const a = document.createElement('a');
            a.href = `${BASE_URL}/download/file?path=${encodeURIComponent(path)}`;
            a.download = name || path.split('/').pop();
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },
        getExt: (name) => {
            const ext = name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
            return ext ? `.${ext}` : "";
        },
        getType: (ext) => {
            if (CONFIG.ext.img.includes(ext)) return 'image';
            if (CONFIG.ext.video.includes(ext)) return 'video';
            if (CONFIG.ext.audio.includes(ext)) return 'audio';
            if (CONFIG.ext.text.includes(ext)) return 'text';
            if (CONFIG.ext.web.includes(ext)) return 'web';
            if (CONFIG.ext.pdf.includes(ext)) return 'pdf';
            return 'unknown';
        }
    };

    // --- Core Logic ---
    const Core = {
        init() {
            UI.init();
            this.setupSocket();
            this.nav("/");
            this.setupEvents();
        },
        setupSocket() {
            socket = (typeof io !== 'undefined') ? io(BASE_URL) : { on:()=>{}, emit:()=>console.warn("Socket Missing") };
            socket.on("connect", () => state.serverUp = true);
            socket.on("list_dir_result", (res) => {
                UI.toggleLoader(false);
                if (res.status === "error") return UI.showError(res.message);
                state.files = res.data.children || [];
                state.details = res.data.details;
                if (res.data.path) {
                    state.path = res.data.path;
                    document.getElementById("pathLabel").textContent = state.path;
                }
                UI.renderList(state.files);
            });
        },
        nav(path, push = true) {
            state.path = path || "/";
            UI.toggleLoader(true);
            socket.emit("list_dir", { path: state.path });
            if (push) {
                if (!state.history.back.length || state.history.back[state.history.back.length - 1] !== state.path) {
                    state.history.back.push(state.path);
                }
                state.history.fwd = [];
                UI.updateNav();
            }
        },
        goBack() {
            if (state.history.back.length > 1) {
                state.history.fwd.push(state.history.back.pop());
                this.nav(state.history.back[state.history.back.length - 1], false);
                UI.updateNav();
            }
        },
        goFwd() {
            if (state.history.fwd.length > 0) {
                const p = state.history.fwd.pop();
                this.nav(p, false);
                state.history.back.push(p);
                UI.updateNav();
            }
        },
        setupEvents() {
            document.getElementById("backBtn").onclick = () => this.goBack();
            document.getElementById("forwardBtn").onclick = () => this.goFwd();
            document.getElementById("themeToggle").onclick = UI.toggleTheme;
            document.getElementById("themeToggleMobile").onclick = UI.toggleTheme;
            document.getElementById("burgerBtn").onclick = UI.toggleSidebar;
            document.getElementById("sidebarCloseBtn").onclick = UI.toggleSidebar;
            document.getElementById("sidebarBackdrop").onclick = UI.toggleSidebar;
            
            const searchHandler = Utils.debounce((e) => UI.filter(e.target.value), 300);
            document.getElementById("searchInput").oninput = searchHandler;
            document.getElementById("searchInputMobile").oninput = searchHandler;
            
            const sortHandler = () => UI.renderList(state.files);
            document.getElementById("sortSelect").onchange = sortHandler;
            document.getElementById("sortSelectMobile").onchange = sortHandler;

            // Event Delegation for File List (Optimization)
            document.getElementById("fileList").addEventListener("click", (e) => {
                const card = e.target.closest(".fileItem, .folderItem");
                if (!card) return;
                
                // Handle Download Button
                if (e.target.closest("button")) {
                    e.stopPropagation();
                    return Utils.download(card.dataset.path, card.title);
                }

                // Handle Navigation / Open
                const type = card.dataset.type;
                if (type === "directory") {
                    this.nav(card.dataset.path);
                } else {
                    this.openFile({
                        path: card.dataset.path,
                        details: { name: card.title, extension: Utils.getExt(card.title) }
                    });
                }
            });
        },
        openFile(item) {
            const ext = item.details.extension;
            const type = Utils.getType(ext);
            
            switch(type) {
                case 'image': Gallery.open(item); break;
                case 'video': VideoPlayer.open(item); break;
                case 'audio': AudioPlayer.open(item); break;
                case 'text': TextEditor.open(item); break;
                case 'web': GeneralModal.showWeb(item); break;
                case 'pdf': 
                case 'unknown':
                    GeneralModal.showUnsupported(item); break;
            }
        }
    };

    // --- UI Logic ---
    const UI = {
        init() {
            const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (isDark) document.documentElement.classList.add('dark');
        },
        toggleTheme() {
            const html = document.documentElement;
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
        },
        toggleLoader(show) {
            document.getElementById("loading").classList.toggle("hidden", !show);
        },
        toggleSidebar() {
            const sb = document.getElementById("mobileSidebar");
            const bd = document.getElementById("sidebarBackdrop");
            const isOpen = sb.style.right === "0px";
            sb.style.right = isOpen ? "-100%" : "0px";
            if (!isOpen) {
                bd.classList.remove("hidden");
                setTimeout(() => bd.classList.remove("opacity-0"), 10);
            } else {
                bd.classList.add("opacity-0");
                setTimeout(() => bd.classList.add("hidden"), 300);
            }
        },
        updateNav() {
            document.getElementById("backBtn").disabled = state.history.back.length <= 1;
            document.getElementById("forwardBtn").disabled = state.history.fwd.length === 0;
        },
        getIcon(ext, type) {
            if (type === "directory") return '<i class="fa-solid fa-folder"></i>';
            const t = Utils.getType(ext);
            const map = {
                image: '<i class="fa-solid fa-image text-green-500"></i>',
                video: '<i class="fa-solid fa-film text-purple-500"></i>',
                audio: '<i class="fa-solid fa-music text-pink-500"></i>',
                pdf: '<i class="fa-solid fa-file-lines text-red-500"></i>',
                text: '<i class="fa-solid fa-file-code text-blue-500"></i>',
                web: '<i class="fa-solid fa-globe text-blue-400"></i>',
            };
            return map[t] || '<i class="fa-solid fa-file text-gray-500"></i>';
        },
        renderList(files) {
            const container = document.getElementById("fileList");
            container.innerHTML = "";
            if (!files.length) {
                container.innerHTML = `<div class="col-span-full flex flex-col items-center opacity-50 mt-20"><i class="fa-regular fa-folder-open text-6xl mb-4"></i><p>EMPTY</p></div>`;
                return;
            }

            const sortKey = (document.getElementById("sortSelect").value || "name_asc").split('_');
            const sorted = [...files].sort((a, b) => {
                let valA = a.details[sortKey[0] === 'modified' ? 'modified' : (sortKey[0] === 'size' ? 'size' : 'name')];
                let valB = b.details[sortKey[0] === 'modified' ? 'modified' : (sortKey[0] === 'size' ? 'size' : 'name')];
                if (sortKey[0] === 'name') return sortKey[1] === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                return sortKey[1] === 'asc' ? valA - valB : valB - valA;
            });

            // Fragment for performance
            const frag = document.createDocumentFragment();
            sorted.forEach(item => {
                const el = document.createElement("div");
                const isDir = item.type === "directory";
                el.className = isDir ? "folderItem" : "fileItem";
                el.dataset.path = item.path;
                el.dataset.type = item.type;
                el.title = item.details.name;
                
                const meta = isDir ? `${item.details.count || 0} ITEMS` : Utils.fmtBytes(item.details.size);
                
                el.innerHTML = `
                    <div class="fileIcon text-5xl mt-2 transition-transform duration-200">${this.getIcon(item.details.extension, item.type)}</div>
                    <div class="w-full text-center flex-grow flex flex-col justify-center overflow-hidden">
                        <span class="fileName font-display font-medium uppercase tracking-wide text-sm truncate w-full block mt-2">${item.details.name}</span>
                        <span class="text-[0.7rem] opacity-60 font-body uppercase tracking-wider mt-1">${meta}</span>
                    </div>
                    <div class="card-actions">
                         <button class="w-6 h-6 bg-mag-bg border border-red-500 flex items-center justify-center hover:bg-mag-red hover:text-white rounded-sm text-xs"><i class="fa-solid fa-download"></i></button>
                    </div>
                `;
                frag.appendChild(el);
            });
            container.appendChild(frag);
        },
        filter(term) {
            const items = document.querySelectorAll('.fileItem, .folderItem');
            const t = term.toLowerCase();
            items.forEach(el => el.style.display = el.title.toLowerCase().includes(t) ? "flex" : "none");
        }
    };

    // --- Sub-Applications ---
    
    const ModalBase = {
        toggle(id, show) {
            const el = document.getElementById(id);
            if(show) {
                el.classList.remove('hidden');
                void el.offsetWidth; // Reflow
                el.classList.add('open', 'opacity-100', 'pointer-events-auto');
                el.classList.remove('opacity-0', 'pointer-events-none');
            } else {
                el.classList.add('opacity-0', 'pointer-events-none');
                el.classList.remove('open', 'opacity-100', 'pointer-events-auto');
                setTimeout(() => el.classList.add('hidden'), 300);
            }
        },
        setupIdle(elId) {
            const el = document.getElementById(elId);
            let timer;
            const reset = () => {
                el.classList.remove('user-idle');
                clearTimeout(timer);
                timer = setTimeout(() => el.classList.add('user-idle'), 3000);
            };
            el.addEventListener('mousemove', reset);
            el.addEventListener('click', reset);
            el.addEventListener('touchstart', reset);
        }
    };

    const Gallery = {
        dom: {}, state: { idx: 0, list: [], zoom: 1, rot: 0, x: 0, y: 0 },
        init() {
            this.dom = {
                app: document.getElementById('galleryApp'),
                img: document.getElementById('galleryImage'),
                cont: document.getElementById('galleryImageContainer')
            };
            
            document.getElementById('galleryCloseBtn').onclick = () => ModalBase.toggle('galleryApp', false);
            document.getElementById('galleryNextBtn').onclick = (e) => { e.stopPropagation(); this.nav(1); };
            document.getElementById('galleryPrevBtn').onclick = (e) => { e.stopPropagation(); this.nav(-1); };
            document.getElementById('galleryRotateBtn').onclick = (e) => { e.stopPropagation(); this.state.rot += 90; this.updateTransform(); };
            document.getElementById('galleryDownloadBtn').onclick = (e) => { e.stopPropagation(); Utils.download(this.state.list[this.state.idx].path); };
            document.getElementById('galleryFullscreenBtn').onclick = (e) => { 
                e.stopPropagation(); 
                document.fullscreenElement ? document.exitFullscreen() : this.dom.app.requestFullscreen(); 
            };
            
            // Pan/Zoom Logic
            this.dom.app.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.state.zoom = Math.max(0.5, Math.min(5, this.state.zoom + (e.deltaY * -0.001)));
                this.updateTransform();
            });
            
            ModalBase.setupIdle('galleryApp');
            this.setupDrag();
        },
        open(item) {
            this.state.list = state.files.filter(f => Utils.getType(f.details.extension) === 'image');
            this.state.idx = this.state.list.findIndex(f => f.path === item.path);
            this.state.zoom = 1; this.state.rot = 0; this.state.x = 0; this.state.y = 0;
            ModalBase.toggle('galleryApp', true);
            this.render();
        },
        render() {
            const file = this.state.list[this.state.idx];
            this.dom.img.src = `${BASE_URL}/download/file?path=${encodeURIComponent(file.path)}`;
            document.getElementById('galleryFileName').textContent = file.details.name;
            this.updateTransform();
        },
        nav(dir) {
            this.state.idx = (this.state.idx + dir + this.state.list.length) % this.state.list.length;
            this.state.zoom = 1; this.state.rot = 0; this.state.x = 0; this.state.y = 0;
            this.render();
        },
        updateTransform() {
            this.dom.img.style.transform = `translate(${this.state.x}px, ${this.state.y}px) rotate(${this.state.rot}deg) scale(${this.state.zoom})`;
        },
        setupDrag() {
            let isDown = false, startX, startY;
            const start = (x, y) => { if(this.state.zoom > 1) { isDown = true; startX = x - this.state.x; startY = y - this.state.y; this.dom.cont.classList.add('cursor-grabbing'); } };
            const move = (x, y) => { if(!isDown) return; this.state.x = x - startX; this.state.y = y - startY; this.updateTransform(); };
            const end = () => { isDown = false; this.dom.cont.classList.remove('cursor-grabbing'); };
            
            this.dom.cont.onmousedown = e => { e.preventDefault(); start(e.clientX, e.clientY); };
            window.onmousemove = e => move(e.clientX, e.clientY);
            window.onmouseup = end;
            this.dom.cont.ontouchstart = e => start(e.touches[0].clientX, e.touches[0].clientY);
            window.ontouchmove = e => move(e.touches[0].clientX, e.touches[0].clientY);
            window.ontouchend = end;
        }
    };

    const VideoPlayer = {
        dom: {}, state: { list: [], idx: 0, locked: false },
        init() {
            this.dom = {
                v: document.getElementById('vpVideo'),
                app: document.getElementById('videoPlayerApp')
            };
            
            // Basic Controls
            document.getElementById('vpCloseBtn').onclick = () => this.close();
            document.getElementById('vpPlayPauseBtn').onclick = (e) => { e.stopPropagation(); this.togglePlay(); };
            this.dom.v.onclick = () => this.togglePlay();
            document.getElementById('vpLockBtn').onclick = (e) => { e.stopPropagation(); this.toggleLock(); };
            document.getElementById('vpSeekBackBtn').onclick = (e) => { e.stopPropagation(); this.dom.v.currentTime -= 10; };
            document.getElementById('vpSeekFwdBtn').onclick = (e) => { e.stopPropagation(); this.dom.v.currentTime += 10; };
            document.getElementById('vpNextBtn').onclick = () => this.nav(1);
            document.getElementById('vpPrevBtn').onclick = () => this.nav(-1);
            document.getElementById('vpFullscreenBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : this.dom.app.requestFullscreen();
            document.getElementById('vpRotateBtn').onclick = () => this.dom.app.classList.toggle('portrait-mode');
            
            // Time Update
            this.dom.v.ontimeupdate = () => {
                const pct = (this.dom.v.currentTime / this.dom.v.duration) * 100 || 0;
                document.getElementById('vpProgressBar').style.width = pct + '%';
                document.getElementById('vpSeekThumb').style.left = pct + '%';
                document.getElementById('vpTimeCurrent').textContent = Utils.fmtTime(this.dom.v.currentTime);
                document.getElementById('vpTimeRemaining').textContent = "-" + Utils.fmtTime(this.dom.v.duration - this.dom.v.currentTime);
            };
            
            document.getElementById('vpSeekInput').oninput = (e) => {
                this.dom.v.currentTime = (e.target.value / 100) * this.dom.v.duration;
            };

            // Touch Gestures (Volume/Brightness)
            this.setupGestures();
            ModalBase.setupIdle('videoPlayerApp');
        },
        open(item) {
            this.state.list = state.files.filter(f => Utils.getType(f.details.extension) === 'video');
            this.state.idx = this.state.list.findIndex(f => f.path === item.path);
            ModalBase.toggle('videoPlayerApp', true);
            this.render();
        },
        render() {
            const file = this.state.list[this.state.idx];
            document.getElementById('vpFileName').textContent = file.details.name;
            this.dom.v.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(file.path)}`;
            this.dom.v.play().catch(()=>{});
            this.updateIcon(true);
        },
        close() {
            this.dom.v.pause();
            this.dom.v.src = "";
            ModalBase.toggle('videoPlayerApp', false);
            if(document.fullscreenElement) document.exitFullscreen();
        },
        togglePlay() {
            if (this.state.locked) return;
            this.dom.v.paused ? this.dom.v.play() : this.dom.v.pause();
            this.updateIcon(!this.dom.v.paused);
        },
        updateIcon(isPlaying) {
            document.getElementById('vpPlayPauseBtn').innerHTML = isPlaying ? '<i class="fa-solid fa-pause text-4xl"></i>' : '<i class="fa-solid fa-play text-5xl ml-2"></i>';
        },
        toggleLock() {
            this.state.locked = !this.state.locked;
            this.dom.app.classList.toggle('locked-mode', this.state.locked);
            document.getElementById('vpLockBtn').innerHTML = this.state.locked ? '<i class="fa-solid fa-lock text-2xl text-mag-red"></i>' : '<i class="fa-solid fa-lock-open text-2xl"></i>';
        },
        nav(dir) {
            if (this.state.locked) return;
            this.state.idx = (this.state.idx + dir + this.state.list.length) % this.state.list.length;
            this.render();
        },
        setupGestures() {
            // Simplified Gesture logic merging mouse/touch
            const handle = (el, callback) => {
                let startY, startVal;
                const start = (y) => { 
                    if(this.state.locked) return; 
                    startY = y; 
                    startVal = callback.get(); 
                    el.style.opacity = 1; 
                };
                const move = (y) => { 
                    if(startY === undefined) return; 
                    const delta = (startY - y) / window.innerHeight * 2; 
                    callback.set(Math.max(0, Math.min(1, startVal + delta))); 
                };
                const end = () => { 
                    startY = undefined; 
                    setTimeout(() => el.style.opacity = 0, 1000); 
                };
                
                const touchZone = document.getElementById(callback.zone);
                touchZone.ontouchstart = e => start(e.touches[0].clientY);
                touchZone.ontouchmove = e => { e.preventDefault(); move(e.touches[0].clientY); };
                touchZone.ontouchend = end;
            };

            handle(document.getElementById('vpBrightnessContainer'), {
                zone: 'vpTouchLeft',
                get: () => 1 - (parseFloat(document.getElementById('vpBrightnessOverlay').style.opacity) || 0),
                set: (v) => {
                    document.getElementById('vpBrightnessOverlay').style.opacity = (1 - v) * 0.8;
                    document.getElementById('vpBrightnessBar').style.height = (v * 100) + '%';
                    document.getElementById('vpBrightnessIcon').style.opacity = 1;
                }
            });

            handle(document.getElementById('vpVolumeContainer'), {
                zone: 'vpTouchRight',
                get: () => this.dom.v.volume,
                set: (v) => {
                    this.dom.v.volume = v;
                    document.getElementById('vpVolumeBar').style.height = (v * 100) + '%';
                    document.getElementById('vpVolumeIcon').style.opacity = 1;
                }
            });
        }
    };

    const AudioPlayer = {
        dom: {}, state: { list: [], idx: 0 },
        init() {
            this.dom = { a: document.getElementById('apAudio'), mini: document.getElementById('miniPlayer') };
            
            // Visualizer bars
            const viz = document.getElementById('apVisualizer');
            for(let i=0; i<8; i++) {
                const b = document.createElement('div');
                b.className = 'visualizer-bar'; b.style.animationDelay = `${i*0.1}s`;
                viz.appendChild(b);
            }

            // Controls
            const toggle = () => this.dom.a.paused ? this.dom.a.play() : this.dom.a.pause();
            document.getElementById('apPlayPauseBtn').onclick = toggle;
            document.getElementById('miniPlayerPlayPause').onclick = (e) => { e.stopPropagation(); toggle(); };
            document.getElementById('apCloseBtn').onclick = () => this.close();
            document.getElementById('miniPlayerClose').onclick = (e) => { e.stopPropagation(); this.close(); };
            document.getElementById('apNextBtn').onclick = () => this.nav(1);
            document.getElementById('miniPlayerNext').onclick = (e) => { e.stopPropagation(); this.nav(1); };
            document.getElementById('apPrevBtn').onclick = () => this.nav(-1);
            document.getElementById('miniPlayerPrev').onclick = (e) => { e.stopPropagation(); this.nav(-1); };
            
            // Minimize/Pip
            document.getElementById('apPipBtn').onclick = () => {
                ModalBase.toggle('audioPlayerApp', false);
                this.dom.mini.classList.remove('hidden');
                this.dom.mini.classList.add('flex');
            };
            document.getElementById('miniPlayerExpand').onclick = () => {
                ModalBase.toggle('audioPlayerApp', true);
                this.dom.mini.classList.add('hidden');
                this.dom.mini.classList.remove('flex');
            };

            // Updates
            this.dom.a.ontimeupdate = () => {
                const pct = (this.dom.a.currentTime / this.dom.a.duration) * 100 || 0;
                document.getElementById('apProgressBar').style.width = pct + '%';
                document.getElementById('miniPlayerProgress').style.width = pct + '%';
                document.getElementById('apTimeCurrent').textContent = Utils.fmtTime(this.dom.a.currentTime);
                document.getElementById('apTimeRemaining').textContent = "-" + Utils.fmtTime(this.dom.a.duration - this.dom.a.currentTime);
                
                const icon = this.dom.a.paused ? 'play' : 'pause';
                document.getElementById('apPlayPauseBtn').innerHTML = `<i class="fa-solid fa-${icon} text-2xl ${icon==='play'?'ml-1':''}"></i>`;
                document.getElementById('miniPlayerPlayPause').innerHTML = `<i class="fa-solid fa-${icon}"></i>`;
            };
            
            document.getElementById('apSeekInput').oninput = (e) => this.dom.a.currentTime = (e.target.value/100)*this.dom.a.duration;
            this.dom.a.onended = () => this.nav(1);
        },
        open(item) {
            this.state.list = state.files.filter(f => Utils.getType(f.details.extension) === 'audio');
            this.state.idx = this.state.list.findIndex(f => f.path === item.path);
            ModalBase.toggle('audioPlayerApp', true);
            this.render();
        },
        render() {
            const file = this.state.list[this.state.idx];
            const name = file.details.name;
            document.getElementById('apFileName').textContent = name;
            document.getElementById('miniPlayerTitle').textContent = name;
            this.dom.a.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(file.path)}`;
            this.dom.a.play();
        },
        nav(dir) {
            this.state.idx = (this.state.idx + dir + this.state.list.length) % this.state.list.length;
            this.render();
        },
        close() {
            this.dom.a.pause();
            this.dom.a.src = "";
            ModalBase.toggle('audioPlayerApp', false);
            this.dom.mini.classList.add('hidden');
            this.dom.mini.classList.remove('flex');
        }
    };

    const TextEditor = {
        open(item) {
            const el = document.getElementById('textEditorContent');
            el.textContent = "Loading...";
            ModalBase.toggle('textEditorApp', true);
            document.getElementById('textEditorFileName').textContent = item.details.name;
            
            fetch(`${BASE_URL}/download/file?path=${encodeURIComponent(item.path)}`)
                .then(r => r.text())
                .then(txt => {
                    el.textContent = txt;
                    const ext = Utils.getExt(item.details.name).replace('.', '');
                    el.className = `language-${ext}`;
                    if(window.Prism) Prism.highlightElement(el);
                });
                
            document.getElementById('textEditorCloseBtn').onclick = () => ModalBase.toggle('textEditorApp', false);
        }
    };

    const GeneralModal = {
        dom: { 
            el: document.getElementById('generalModal'), 
            title: document.getElementById('gmTitle'), 
            icon: document.getElementById('gmIcon'), 
            content: document.getElementById('gmContent'),
            actions: document.getElementById('gmActions'),
            close: document.getElementById('gmCloseBtn')
        },
        init() {
            this.dom.close.onclick = () => ModalBase.toggle('generalModal', false);
        },
        showWeb(item) {
            this.setup("Open Web File", "fa-globe", `How to open <b>${item.details.name}</b>?`);
            this.addAction("New Tab", "bg-mag-red text-white", () => {
                Utils.download(item.path);
                ModalBase.toggle('generalModal', false);
            });
            this.addAction("Code", "border border-mag-red text-mag-text", () => {
                ModalBase.toggle('generalModal', false);
                TextEditor.open(item);
            });
            ModalBase.toggle('generalModal', true);
        },
        showUnsupported(item) {
            this.setup("Unsupported", "fa-triangle-exclamation", `Cannot preview <b>${item.details.name}</b>.`);
            this.addAction("Download", "bg-mag-red text-white", () => {
                 Utils.download(item.path);
                 ModalBase.toggle('generalModal', false);
            });
            ModalBase.toggle('generalModal', true);
        },
        setup(title, iconClass, htmlContent) {
            this.dom.title.textContent = title;
            this.dom.icon.className = `fa-solid ${iconClass} text-3xl text-mag-red`;
            this.dom.content.innerHTML = htmlContent;
            this.dom.actions.innerHTML = "";
        },
        addAction(text, classes, handler) {
            const btn = document.createElement('button');
            btn.className = `py-2 px-6 font-display uppercase tracking-wider text-xs shadow-md active:translate-y-1 transition-all ${classes}`;
            btn.textContent = text;
            btn.onclick = handler;
            this.dom.actions.appendChild(btn);
        }
    };

    // Initialize Submodules
    Gallery.init();
    VideoPlayer.init();
    AudioPlayer.init();
    GeneralModal.init();

    // Start App
    Core.init();
})();