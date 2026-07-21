const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const countdownOverlay = document.getElementById('countdown-overlay');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const frameOptions = document.querySelectorAll('.frame-option');

const canvases = [
  document.getElementById('canvas1'),
  document.getElementById('canvas2'),
  document.getElementById('canvas3'),
  document.getElementById('canvas4')
];

// 兩款專屬相框檔名 (請確保檔名與 GitHub 上上傳的 PNG 一致)
const frameSources = {
  warm: 'frame_warm.png',
  cool: 'frame_cool.png'
};

// 1. 初始化相機
navigator.mediaDevices.getUserMedia({ 
  video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" } 
})
.then(stream => { 
  webcam.srcObject = stream; 
})
.catch(err => { 
  alert("無法開啟相機，請確認瀏覽器已允許相機存取權限！"); 
});

// 2. 切換相框邏輯
frameOptions.forEach(option => {
  option.addEventListener('click', (e) => {
    document.querySelector('.frame-option.active').classList.remove('active');
    e.currentTarget.classList.add('active');

    const selectedFrame = e.currentTarget.getAttribute('data-frame');
    frameOverlay.src = frameSources[selectedFrame];
  });
});

// 3. 連拍邏輯
async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;

  for (let i = 0; i < 4; i++) {
    await countdown(3); // 倒數 3 秒
    takePhoto(canvases[i]);
  }

  startBtn.disabled = false;
  retakeBtn.disabled = false;
  downloadBtn.disabled = false;
}

function countdown(seconds) {
  return new Promise(resolve => {
    let count = seconds;
    countdownOverlay.innerText = count;
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownOverlay.innerText = count;
      } else {
        clearInterval(interval);
        countdownOverlay.innerText = '';
        resolve();
      }
    }, 1000);
  });
}

function takePhoto(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = webcam.videoWidth;
  canvas.height = webcam.videoHeight;
  
  // 水平翻轉以呈現鏡像
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
}

// 4. 重拍按鈕
retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  downloadBtn.disabled = true;
});

// 5. 下載作品
downloadBtn.addEventListener('click', () => {
  html2canvas(photoStrip, { 
    scale: 3, // 保持高解析度導出
    useCORS: true,
    backgroundColor: null
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `EXO_PhotoStrip_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});

startBtn.addEventListener('click', startPhotography);