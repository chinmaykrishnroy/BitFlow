const HOST = "10.27.220.107";
const PORT = 8888;
const BASE_URL = `http://${HOST}:${PORT}`;

// Use BASE_URL in socket connection
const socket = io(BASE_URL);

const fileListDiv = document.getElementById('fileList');
const loadingDiv = document.getElementById('loading');
const currentPathSpan = document.getElementById('currentPath');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const searchInput = document.getElementById('searchInput');

let currentPath = '/';
let backStack = [];
let forwardStack = [];

const mediaExtensions = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a'],
  video: ['.mp4', '.webm', '.ogv', '.mov', '.mkv']
};

function isStreamable(ext) {
  ext = ext?.toLowerCase() || '';
  return mediaExtensions.image.includes(ext) ||
         mediaExtensions.audio.includes(ext) ||
         mediaExtensions.video.includes(ext);
}

function formatDate(dtStr) {
  const dt = new Date(dtStr);
  return dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) +
         ' ' + dt.toLocaleDateString();
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

function getFileIcon(ext, type) {
  if (type === "directory") return "📁";
  ext = ext?.toLowerCase() || '';
  if (mediaExtensions.video.includes(ext)) return "🎬";
  if (mediaExtensions.audio.includes(ext)) return "🎵";
  if (mediaExtensions.image.includes(ext)) return "🖼️";
  return "📄";
}

function updateNavButtons() {
  backBtn.disabled = backStack.length <= 0;
  forwardBtn.disabled = forwardStack.length <= 0;
}

function requestPath(path, pushHistory=true) {
  currentPath = path;
  currentPathSpan.textContent = path;
  fileListDiv.innerHTML = '';
  loadingDiv.textContent = 'Loading...';
  socket.emit('list_dir', { path });

  if(pushHistory){
    if(backStack.length === 0 || backStack[backStack.length-1] !== path) backStack.push(path);
    forwardStack = [];
    updateNavButtons();
  }
}

backBtn.onclick = () => {
  if(backStack.length > 1){
    forwardStack.push(backStack.pop());
    const prevPath = backStack[backStack.length-1];
    requestPath(prevPath, false);
    updateNavButtons();
  }
};

forwardBtn.onclick = () => {
  if(forwardStack.length > 0){
    const nextPath = forwardStack.pop();
    requestPath(nextPath, false);
    backStack.push(nextPath);
    updateNavButtons();
  }
};

searchInput.oninput = () => {
  const search = searchInput.value.toLowerCase();
  document.querySelectorAll('.fileItem, .folderItem').forEach(el => {
    const name = el.dataset.name.toLowerCase();
    el.style.display = name.includes(search) ? 'flex' : 'none';
  });
};

socket.on('list_dir_status', (data) => {
  if(data.status === 'loading') loadingDiv.textContent = 'Loading ' + data.path + '...';
});

socket.on('list_dir_result', (res) => {
  loadingDiv.textContent = '';
  const data = res.data;
  if(!data.children || !data.children.length){
    fileListDiv.innerHTML = '<div>No files or folders</div>';
    return;
  }

  // sort by modified descending
  data.children.sort((a,b) => new Date(b.details.modified) - new Date(a.details.modified));

  data.children.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = item.type === 'directory' ? 'folderItem' : 'fileItem';
    itemDiv.dataset.name = item.details.name;

    // icon
    const iconDiv = document.createElement('div');
    iconDiv.className = "fileIcon";
    iconDiv.textContent = getFileIcon(item.details.extension, item.type);
    itemDiv.appendChild(iconDiv);


    // name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'fileName';
    nameDiv.textContent = item.details.name;
    itemDiv.appendChild(nameDiv);

    // folder count OR file size
    if(item.type === 'directory'){
      const countDiv = document.createElement('div');
      countDiv.className = 'fileType';
      countDiv.textContent = `${item.details.count} items`;
      itemDiv.appendChild(countDiv);
    } else {
      const sizeDiv = document.createElement('div');
      sizeDiv.className = 'fileType';
      sizeDiv.textContent = formatSize(item.details.size);
      itemDiv.appendChild(sizeDiv);
    }

    // modified
    const modifiedDiv = document.createElement('div');
    modifiedDiv.className = 'fileModified';
    modifiedDiv.textContent = formatDate(item.details.modified);
    itemDiv.appendChild(modifiedDiv);

    // actions (for files)
    if(item.type === 'file'){
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'fileActions';

      // download
      const downloadBtn = document.createElement('button');
      downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
      downloadBtn.title = "Download this file";
      downloadBtn.onclick = e => {
        e.stopPropagation();
        window.open(`${BASE_URL}/download/file?path=${encodeURIComponent(item.path)}`, '_blank');
      };
      actionsDiv.appendChild(downloadBtn);

      // stream
      if(isStreamable(item.details.extension)){
        const streamBtn = document.createElement('button');
        streamBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        streamBtn.title = "Stream this file";
        streamBtn.onclick = e => {
          e.stopPropagation();
          const url = `${BASE_URL}/download/file?path=${encodeURIComponent(item.path)}`;
          const ext = item.details.extension.toLowerCase();

          if(mediaExtensions.image.includes(ext)){
            const imgWindow = window.open('', '_blank');
            const img = imgWindow.document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            imgWindow.document.body.appendChild(img);
          } else if(mediaExtensions.audio.includes(ext)){
            const audioWindow = window.open('', '_blank');
            const audio = audioWindow.document.createElement('audio');
            audio.controls = true;
            audio.autoplay = true;
            audio.style.width = '100%';
            const source = audioWindow.document.createElement('source');
            source.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(item.path)}`;
            source.type = item.details.filetype || 'audio/mpeg';
            audio.appendChild(source);
            audioWindow.document.body.appendChild(audio);
          } else if(mediaExtensions.video.includes(ext)){
            const videoWindow = window.open('', '_blank');
            const video = videoWindow.document.createElement('video');
            video.id = 'player';
            video.className = 'video-js vjs-big-play-centered';
            video.controls = true;
            video.preload = 'auto';
            video.width = videoWindow.innerWidth;
            video.height = videoWindow.innerHeight;

            const source = videoWindow.document.createElement('source');
            source.src = `${BASE_URL}/stream/file?path=${encodeURIComponent(item.path)}`;
            source.type = 'video/mp4';
            video.appendChild(source);
            videoWindow.document.body.appendChild(video);

            const link = videoWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://vjs.zencdn.net/8.13.0/video-js.css';
            videoWindow.document.head.appendChild(link);

            const script = videoWindow.document.createElement('script');
            script.src = 'https://vjs.zencdn.net/8.13.0/video.min.js';
            script.onload = () => {
              const player = videoWindow.videojs('player');
              player.ready(() => {
                player.requestFullscreen();
              });
            };
            videoWindow.document.body.appendChild(script);
          }
        };
        actionsDiv.appendChild(streamBtn);
      }

      itemDiv.appendChild(actionsDiv);
    }

    // click to enter folder
    itemDiv.onclick = () => {
      if(item.type === 'directory') requestPath(item.path);
    };

    fileListDiv.appendChild(itemDiv);
  });

  updateNavButtons();
});

requestPath('/');
