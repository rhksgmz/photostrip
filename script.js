const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const countdownOverlay = document.getElementById('countdown-overlay');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const frameOptions = document.querySelectorAll('.frame-option');
const filterBtns = document.querySelectorAll('.filter-btn');

const canvases = [
  document.getElementById('canvas1'),
  document.getElementById('canvas2'),
  document.getElementById('canvas3'),
  document.getElementById('canvas4')
];

const frameSources = {
  warm: 'frame_warm.png',
  cool: 'frame_cool.png'
};

// 濾鏡語法對照表 (直接給 Canvas 繪圖使用)
const filterCanvasMap = {
  'normal': 'none',
  'beauty': 'brightness(1.1) contrast(0.95) saturate(1.1)',
  'retro': 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(1.2)',
  'vintage': 'contrast(1.2) saturate(0.85) hue-rotate(-10deg)',
  'bw': 'grayscale(1) contrast(1.2)'
};

let currentFilterKey = 'normal';

// 1. 開啟鏡頭
navigator.mediaDevices.getUserMedia({ 
  video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" } 
})
.then(stream => { webcam.srcObject = stream; })
.catch(err => { alert("無法開啟相機，請確認已允許相機權限！"); });

// 2. 切換濾鏡 (同步更新 Webcam 與 Canvas)
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelector('.filter-btn.active').classList.remove('active');
    e.target.classList.add('active');

    currentFilterKey = e.target.getAttribute('data-filter');
    
    // 更新即時鏡頭預覽
    webcam.style.filter = filterCanvasMap[currentFilterKey];

    // 如果已經拍了照片，重新渲染濾鏡
    canvases.forEach(canvas => {
      canvas.style.filter = filterCanvasMap[currentFilterKey];
    });
  });
});

// 3. 相框切換
frameOptions.forEach(option => {
  option.addEventListener('click', (e) => {
    document.querySelector('.frame-option.active').classList.remove('active');
    e.currentTarget.classList.add('active');

    const selectedFrame = e.currentTarget.getAttribute('data-frame');
    frameOverlay.src = frameSources[selectedFrame];
  });
});

// 4. 連拍邏輯
async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;

  for (let i = 0; i < 4; i++) {
    await countdown(3);
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

// 精確將濾鏡「畫」進 Canvas 裡
function takePhoto(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = webcam.videoWidth;
  canvas.height = webcam.videoHeight;
  
  // 1. 將 Context 的濾鏡設為目前選取的濾鏡
  ctx.filter = filterCanvasMap[currentFilterKey];

  // 2. 水平鏡像翻轉繪製
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);

  // 3. 確保畫面預覽也帶有濾鏡效果
  canvas.style.filter = filterCanvasMap[currentFilterKey];
}

// 5. 重拍
retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  downloadBtn.disabled = true;
});

// 6. 下載拍貼作品
downloadBtn.addEventListener('click', () => {
  html2canvas(photoStrip, { 
    scale: 3, 
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