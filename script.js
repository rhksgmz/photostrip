// 在 startPhotography 函式最上方加入自動播放 BGM 的邏輯：
async function startPhotography() {
  // 🎯 點擊開始連拍瞬間自動播放 YouTube 音樂
  if (player && typeof player.playVideo === 'function') {
    if (!isPlaying) {
      if (typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
      player.playVideo();
      musicBtn.classList.add('playing');
      musicIcon.innerText = '🔊';
      musicText.innerText = 'PLAYING';
      isPlaying = true;
    }
  }

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {}

  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadVideoBtn.disabled = true;
  finalResultImg.style.display = 'none';
  finalResultImg.classList.remove('printing-animation');
  hasShot = false;
  recordedChunks = [];

  canvases.forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));

  if (videoRecordCanvas.captureStream && window.MediaRecorder) {
    try {
      const recordStream = videoRecordCanvas.captureStream(30);
      let options = {};
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      }

      mediaRecorder = new MediaRecorder(recordStream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start(100);
      isRecordingActive = true;
    } catch (e) {
      console.log("錄影不支援：", e);
    }
  }

  // 4 張照片，每張拍攝/倒數時間為 5 秒
  for (let i = 0; i < 4; i++) {
    startRecordingLoop(i);

    await run5SecCountdown(5); // 每一格倒數 5 秒
    
    isRecordingActive = false;
    triggerFlash();
    takePhoto(canvases[i]); // 5秒結束瞬間拍照定格
    
    isRecordingActive = true;
  }

  isRecordingActive = false;
  await new Promise(r => setTimeout(r, 1000));

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.onstop = () => {
      const mime = mediaRecorder.mimeType || 'video/mp4';
      recordedVideoBlob = new Blob(recordedChunks, { type: mime });
      downloadVideoBtn.disabled = false;
    };
  }

  hasShot = true;
  generateFinalImage();

  startBtn.disabled = false;
  retakeBtn.disabled = false;
  downloadBtn.disabled = false;
}