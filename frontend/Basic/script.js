const socket = io('http://localhost:8888');
const tableBody = document.querySelector('#fileTable tbody');
const loadingDiv = document.getElementById('loading');
const currentPathSpan = document.getElementById('currentPath');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');

let currentPath = '/';
let history = [];
let forwardHistory = [];

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

function requestPath(path) {
  currentPath = path;
  currentPathSpan.textContent = path;
  tableBody.innerHTML = '';
  loadingDiv.textContent = 'Loading...';
  socket.emit('list_dir', { path });
}

backBtn.onclick = () => {
  if(history.length > 1){
    forwardHistory.push(history.pop());
    requestPath(history[history.length-1]);
  }
};

forwardBtn.onclick = () => {
  if(forwardHistory.length){
    const path = forwardHistory.pop();
    requestPath(path);
    history.push(path);
  }
};

socket.on('list_dir_status', (data) => {
  if(data.status === 'loading') loadingDiv.textContent = 'Loading ' + data.path + '...';
});

socket.on('list_dir_result', (res) => {
  loadingDiv.textContent = '';
  const data = res.data;

  history.push(currentPath);
  forwardHistory = [];

  if(!data.children || !data.children.length){
    tableBody.innerHTML = '<tr><td colspan="4">No files or folders</td></tr>';
    return;
  }

  // sort by modified descending by default
  data.children.sort((a,b) => new Date(b.details.modified) - new Date(a.details.modified));

  data.children.forEach(item => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = item.details.name;
    nameTd.classList.add(item.type === 'directory' ? 'folder' : 'file');
    nameTd.onclick = () => {
      if(item.type === 'directory') requestPath(item.path);
    };
    tr.appendChild(nameTd);

    const typeTd = document.createElement('td');
    typeTd.textContent = item.type === 'directory' ? '' : (item.details.extension || '');
    tr.appendChild(typeTd);

    const modifiedTd = document.createElement('td');
    modifiedTd.textContent = formatDate(item.details.modified);
    tr.appendChild(modifiedTd);

    const actionsTd = document.createElement('td');
    if(item.type === 'file'){
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.onclick = e => {
        e.stopPropagation();
        window.open(`http://localhost:8888/download/file?path=${encodeURIComponent(item.path)}`, '_blank');
      };
      actionsTd.appendChild(downloadBtn);

      if(isStreamable(item.details.extension)){
        const streamBtn = document.createElement('button');
        streamBtn.textContent = 'Stream';
        streamBtn.onclick = e => {
          e.stopPropagation();
          const url = 'http://localhost:8888/download/file?path=' + encodeURIComponent(item.path);
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
        actionsTd.appendChild(streamBtn);
      }
    }
    tr.appendChild(actionsTd);
    tableBody.appendChild(tr);
  });
});

requestPath('/');
