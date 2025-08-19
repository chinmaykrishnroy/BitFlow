const socket = io('http://localhost:8888');
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

    const nameDiv = document.createElement('div');
    nameDiv.className = 'fileName';
    nameDiv.textContent = item.details.name;
    itemDiv.appendChild(nameDiv);

    if(item.type !== 'directory'){
      const typeDiv = document.createElement('div');
      typeDiv.className = 'fileType';
      typeDiv.textContent = item.details.extension || '';
      itemDiv.appendChild(typeDiv);
    }

    const modifiedDiv = document.createElement('div');
    modifiedDiv.className = 'fileModified';
    modifiedDiv.textContent = formatDate(item.details.modified);
    itemDiv.appendChild(modifiedDiv);

    if(item.type === 'file'){
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'fileActions';

      // download
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.onclick = e => {
        e.stopPropagation();
        window.open(`http://localhost:8888/download/file?path=${encodeURIComponent(item.path)}`, '_blank');
      };
      actionsDiv.appendChild(downloadBtn);

      // stream
      if(isStreamable(item.details.extension)){
        const streamBtn = document.createElement('button');
        streamBtn.textContent = 'Stream';
        streamBtn.onclick = e => {
          e.stopPropagation();
          const url = `http://localhost:8888/download/file?path=${encodeURIComponent(item.path)}`;
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
            source.src = url;
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
            source.src = url;
            source.type = item.details.filetype || 'video/mp4';
            video.appendChild(source);
            videoWindow.document.body.appendChild(video);

            const link = videoWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://vjs.zencdn.net/8.13.0/video-js.css';
            videoWindow.document.head.appendChild(link);

            const script = videoWindow.document.createElement('script');
            script.src = 'https://vjs.zencdn.net/8.13.0/video.min.js';
            script.onload = () => videoWindow.videojs('player');
            videoWindow.document.body.appendChild(script);
          }
        };
        actionsDiv.appendChild(streamBtn);
      }

      itemDiv.appendChild(actionsDiv);
    }

    itemDiv.onclick = () => {
      if(item.type === 'directory') requestPath(item.path);
    };

    fileListDiv.appendChild(itemDiv);
  });

  updateNavButtons();
});

requestPath('/');
