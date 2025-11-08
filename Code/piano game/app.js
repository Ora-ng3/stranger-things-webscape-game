// Simple keyboard UI and light audio feedback (up to keyboard UI)
// Assumption: two octaves from C3..B4 (24 notes). You asked "C3 to C5" but we use C3..B4 (24 keys).

(function(){
  const WHITE_ORDER = ['C','D','E','F','G','A','B'];
  const SEMITONES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Build note list for octaves C3..C5 inclusive (C3..B4 plus C5)
  const notes = [];
  [3,4].forEach(oct => {
    SEMITONES.forEach(name => notes.push({name: name + oct, base: name, octave: oct}));
  });
  // add C5
  notes.push({name: 'C5', base: 'C', octave: 5});

  const keyboard = document.getElementById('keyboard');

  // Create a wrapper to allow horizontal scroll if needed
  const wrapper = document.createElement('div');
  wrapper.className = 'keyboard-wrapper';
  keyboard.parentNode.replaceChild(wrapper, keyboard);
  wrapper.appendChild(keyboard);

  // Create white keys container and render white keys in order
  const whiteKeys = [];
  const blackKeys = [];
  let whiteIndex = 0;

  notes.forEach((note, i) => {
    if (note.base.includes('#')) {
      // black
      const bk = document.createElement('div');
      bk.className = 'black-key';
      bk.dataset.note = note.name;
      // add small keyboard shortcut label placeholder
      const kbl = document.createElement('div'); kbl.className = 'kbd-label'; kbl.textContent = '';
      bk.appendChild(kbl);
      blackKeys.push({el: bk, idxWhite: whiteIndex});
      keyboard.appendChild(bk);
    } else {
      // white
      const wk = document.createElement('div');
      wk.className = 'white-key';
      wk.dataset.note = note.name;
      const lbl = document.createElement('div'); lbl.className='label'; lbl.textContent = note.name;
      wk.appendChild(lbl);
      const kbl = document.createElement('div'); kbl.className = 'kbd-label'; kbl.textContent = '';
      wk.appendChild(kbl);
      keyboard.appendChild(wk);
      whiteKeys.push(wk);
      whiteIndex++;
    }
  });

  // Position black keys over the white keys approximately
  function layoutBlackKeys(){
    const whiteCount = whiteKeys.length;
    const whiteRect = whiteKeys[0].getBoundingClientRect();
    const wkWidth = whiteRect.width;
    // compute left for each black key using its index of adjacent white key
    blackKeys.forEach(bkObj => {
      const wk = whiteKeys[Math.max(0, Math.min(whiteKeys.length-1, bkObj.idxWhite-1))];
      // find left of that white key relative to keyboard
      const wkRect = wk.getBoundingClientRect();
      const kbRect = keyboard.getBoundingClientRect();
      // place black key slightly to the right of wk
      const left = (wkRect.left - kbRect.left) + wkRect.width * 0.66;
      bkObj.el.style.left = Math.round(left) + 'px';
    });
  }

  // Pointer handling for press visual feedback
  let activePointers = new Map();

  function onPress(el){
    el.classList.add('active');
  }
  function onRelease(el){
    el.classList.remove('active');
  }

  // Attach pointer handlers to keys
  function attachKeyHandlers(){
    const allKeys = Array.from(keyboard.querySelectorAll('.white-key, .black-key'));
    allKeys.forEach(k => {
      k.addEventListener('pointerdown', ev => {
        k.setPointerCapture(ev.pointerId);
        activePointers.set(ev.pointerId, k);
        onPress(k);
      });
      k.addEventListener('pointerup', ev => {
        const el = activePointers.get(ev.pointerId) || k;
        if (el) onRelease(el);
        activePointers.delete(ev.pointerId);
      });
      k.addEventListener('pointercancel', ev => {
        const el = activePointers.get(ev.pointerId) || k;
        if (el) onRelease(el);
        activePointers.delete(ev.pointerId);
      });
      k.addEventListener('pointerleave', ev => {
        // if pointer is down and leaves, keep it active until up; otherwise, ensure not stuck
        if (!activePointers.has(ev.pointerId)) onRelease(k);
      });
    });
  }

  // Sample-based audio engine (load sample or generate fallback)
  let audioCtx = null;
  function ensureAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

  function noteToFreq(note){
    const pitch = note.slice(0, note.length-1);
    const octave = parseInt(note.slice(-1),10);
    const semitoneIndex = SEMITONES.indexOf(pitch);
    if (semitoneIndex === -1) return 440;
    const midi = (octave + 1) * 12 + semitoneIndex;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // sample buffer handling
  let sampleBuffer = null; // AudioBuffer for reference sample (C4)
  const sampleRefNote = 'C4';
  function loadSample(url){
    ensureAudio();
    return fetch(url).then(r => {
      if (!r.ok) throw new Error('failed to fetch');
      return r.arrayBuffer();
    }).then(buf => audioCtx.decodeAudioData(buf)).then(decoded => { sampleBuffer = decoded; });
  }

  // generate a quick piano-like sample as a fallback (C4)
  function generateSampleBuffer(){
    ensureAudio();
    const sr = audioCtx.sampleRate;
    const length = sr * 2.2; // 2.2s
    const buf = audioCtx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);
    const baseFreq = noteToFreq('C4');
    for(let i=0;i<length;i++){
      const t = i/sr;
      // additive partials
      let s = 0;
      s += Math.sin(2*Math.PI*baseFreq*t) * 1.0;
      s += Math.sin(2*Math.PI*baseFreq*2*t) * 0.6;
      s += Math.sin(2*Math.PI*baseFreq*3*t) * 0.35;
      // gentle inharmonicity
      s += Math.sin(2*Math.PI*(baseFreq*4.02)*t) * 0.15;
      // envelope
      const env = Math.exp(-2.5 * t) + 0.0005*Math.random();
      data[i] = (s * 0.15) * env;
    }
    return buf;
  }

  // try loading an external sample (user can replace assets/C4v16.flac), otherwise generate fallback
  (function tryLoad(){
    loadSample('assets/C4v16.flac').catch(()=>{
      sampleBuffer = generateSampleBuffer();
    });
  })();

  const activeSources = new Map();
  function playNote(note){
    ensureAudio();
    const freq = noteToFreq(note);
    const refFreq = noteToFreq(sampleRefNote);
    const rate = freq / refFreq;
    const src = audioCtx.createBufferSource();
    src.buffer = sampleBuffer;
    src.playbackRate.value = rate;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.9, audioCtx.currentTime + 0.01);
    src.connect(g); g.connect(audioCtx.destination);
    src.start();
    activeSources.set(note, {src,g});
  }

  function stopNote(note){
    if (!audioCtx) return;
    const obj = activeSources.get(note);
    if (!obj) return;
    const now = audioCtx.currentTime;
    obj.g.gain.cancelScheduledValues(now);
    obj.g.gain.setValueAtTime(obj.g.gain.value, now);
    obj.g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    try{ obj.src.stop(now + 0.32); }catch(e){}
    activeSources.delete(note);
  }

  // Connect pointer press to sample playback start/stop
  function attachAudioToKeys(){
    const allKeys = Array.from(keyboard.querySelectorAll('.white-key, .black-key'));
    allKeys.forEach(k => {
      k.addEventListener('pointerdown', ev => {
        const note = k.dataset.note;
        try{ playNote(note); }catch(e){/*ignore*/}
      });
      k.addEventListener('pointerup', ev => {
        const note = k.dataset.note; stopNote(note);
      });
      k.addEventListener('pointercancel', ev => { const note=k.dataset.note; stopNote(note); });
    });
  }

  // --- Computer keyboard mapping for AZERTY layout per user request
  // White notes (C..B): q s d f g h j
  // Black notes: z e t y u
  // w selects lower octave (C3..), x selects upper octave (C4..). When upper octave is selected, k plays C5.
  const whiteMap = { 'q':'C', 's':'D', 'd':'E', 'f':'F', 'g':'G', 'h':'A', 'j':'B' };
  const blackMap = { 'z':'C#', 'e':'D#', 't':'F#', 'y':'G#', 'u':'A#' };
  let baseOctave = 3; // default lower octave (C3..)
  const heldKeys = new Set();

  function updateOctaveIndicator(){
    const title = document.getElementById('melody-title');
    title.textContent = `Piano Game — octave ${baseOctave}` + (baseOctave===4 ? ' (press k for C5)' : '');
    updateKeyShortcuts();
  }

  // Metronome tick for countdown
  function playMetronomeTick(){
    try{
      ensureAudio();
      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 1200;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.8, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + 0.1);
    }catch(e){/* ignore */}
  }

  // Update keyboard shortcut labels on the visible keys depending on baseOctave
  function updateKeyShortcuts(){
    // clear all labels then set those for current octave
    document.querySelectorAll('.kbd-label').forEach(el => el.textContent = '');
    // white keys
    Object.entries(whiteMap).forEach(([k,pitch]) => {
      const note = pitch + baseOctave;
      const el = keyboard.querySelector('[data-note="'+note+'"]');
      if (el){ const lbl = el.querySelector('.kbd-label'); if (lbl){ lbl.textContent = k; lbl.style.color = '#000'; }}
    });
    // black keys
    Object.entries(blackMap).forEach(([k,pitch]) => {
      const note = pitch + baseOctave;
      const el = keyboard.querySelector('[data-note="'+note+'"]');
      if (el){ const lbl = el.querySelector('.kbd-label'); if (lbl){ lbl.textContent = k; lbl.style.color = '#fff'; }}
    });
    // special C5 when upper octave selected
    if (baseOctave === 4){ const el = keyboard.querySelector('[data-note="C5"]'); if (el){ const lbl = el.querySelector('.kbd-label'); if (lbl){ lbl.textContent = 'k'; lbl.style.color = '#000'; } } }
  }

  function attachComputerKeyboard(){
    updateOctaveIndicator();
    window.addEventListener('keydown', ev => {
      const k = ev.key.toLowerCase();
      // octave select
      if (k === 'w') { baseOctave = 3; updateOctaveIndicator(); return; }
      if (k === 'x') { baseOctave = 4; updateOctaveIndicator(); return; }

      // special C5 when upper octave selected
      if (k === 'k' && baseOctave === 4){
        if (heldKeys.has(k)) return;
        ev.preventDefault();
        const note = 'C5';
        const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onPress(el);
        try{ playNote(note); }catch(e){}
        heldKeys.add(k);
        return;
      }

      // white or black maps
      const pitch = whiteMap[k] || blackMap[k];
      if (!pitch) return;
      if (heldKeys.has(k)) return;
      ev.preventDefault();
      const note = pitch + baseOctave;
      const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onPress(el);
      try{ playNote(note); }catch(e){}
      heldKeys.add(k);
    });

    window.addEventListener('keyup', ev => {
      const k = ev.key.toLowerCase();
      if (k === 'w' || k === 'x') return;
      if (k === 'k' && baseOctave === 4){
        const note = 'C5'; const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onRelease(el);
        try{ stopNote(note); }catch(e){}
        heldKeys.delete(k);
        return;
      }
      const pitch = whiteMap[k] || blackMap[k];
      if (!pitch) return;
      const note = pitch + baseOctave;
      const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onRelease(el);
      try{ stopNote(note); }catch(e){}
      heldKeys.delete(k);
    });
  }

  // ------------------ Melody data, sequencer, play/record logic ------------------
  // Melody format: { title, tempo, notes: [{note, start, duration}] }
  const melodies = [];

  function addMelody(title, tempo, noteSeq){
    // noteSeq: array of [pitch,duration] where duration in beats; consecutive notes placed sequentially
    let t = 0;
    const notesArr = [];
    noteSeq.forEach(([pitch, dur]) => {
      notesArr.push({note: pitch, start: t, duration: dur});
      t += dur;
    });
    melodies.push({title, tempo, notes: notesArr, lengthBeats: t});
  }

  // Add five short common melodies (simple phrases)
  addMelody('Twinkle Twinkle', 90, [ ['C4',1],['C4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',2] ]);
  addMelody('Mary Had a Little Lamb', 100, [ ['E4',1],['D4',1],['C4',1],['D4',1],['E4',1],['E4',1],['E4',2] ]);
  addMelody('Ode to Joy', 100, [ ['E4',1],['E4',1],['F4',1],['G4',1],['G4',1],['F4',1],['E4',1],['D4',1] ]);
  addMelody('Happy Birthday', 100, [ ['G4',1],['G4',0.5],['A4',1.5],['G4',1],['C5',1],['B4',2] ]);
  addMelody('Frere Jacques', 90, [ ['C4',1],['D4',1],['E4',1],['C4',1],['C4',1],['D4',1],['E4',1],['C4',1] ]);

  // UI elements
  const melodySelect = document.getElementById('melody-select');
  const melodyIndexLabel = document.getElementById('melody-index');
  const titleEl = document.getElementById('melody-title');
  const playBtn = document.getElementById('play');
  const recordBtn = document.getElementById('record');
  const sequencerTrack = document.getElementById('sequencer-track');
  const sequencerContainer = document.getElementById('sequencer');
  const playCursor = document.getElementById('play-cursor');
  const countdownEl = document.getElementById('countdown');
  const feedbackEl = document.getElementById('feedback');

  // initialize selector range
  melodySelect.max = Math.max(1, melodies.length);
  melodySelect.value = 1;
  melodyIndexLabel.textContent = `${melodySelect.value} / ${melodies.length}`;

  // current layout state (used for scrolling & playback)
  let currentPxPerBeat = 100;
  let currentTrackWidth = 800;
  let currentMel = null;

  function renderSequencer(idx){
    sequencerTrack.innerHTML = '';
    const mel = melodies[idx-1];
    currentMel = mel;
    if (!mel) return;
    titleEl.textContent = mel.title;
    const totalBeats = mel.lengthBeats;
    const pxPerBeat = Math.max(60, Math.min(140, 800/Math.max(1,totalBeats)));
    const totalWidth = Math.max(600, totalBeats * pxPerBeat);
    currentPxPerBeat = pxPerBeat; currentTrackWidth = totalWidth;
    sequencerTrack.style.width = totalWidth + 'px';
    // create note blocks
    mel.notes.forEach((n,i) => {
      const div = document.createElement('div');
      div.className = 'sequencer-note';
      div.dataset.index = i;
      const left = n.start * pxPerBeat;
      const w = Math.max(8, n.duration * pxPerBeat);
      div.style.left = left + 'px';
      div.style.width = w + 'px';
      div.title = `${n.note} @ ${n.start}`;
      sequencerTrack.appendChild(div);
    });
    // reset scroll/view
    sequencerContainer.scrollLeft = 0;
  }

  // wire selector
  melodySelect.addEventListener('input', e => {
    const v = parseInt(e.target.value,10);
    melodyIndexLabel.textContent = `${v} / ${melodies.length}`;
    renderSequencer(v);
    playBtn.disabled = false;
    recordBtn.disabled = false;
  });

  // initial render
  renderSequencer(1);
  playBtn.disabled = false; recordBtn.disabled = false;

  // scheduling helpers
  // scheduled sources and timeouts so playback can be stopped
  let scheduledNodes = [];
  let highlightTimeouts = [];
  function clearScheduled(){
    scheduledNodes.forEach(obj=>{
      try{ obj.src.stop(); }catch(e){}
    });
    scheduledNodes = [];
    highlightTimeouts.forEach(t => clearTimeout(t));
    highlightTimeouts = [];
  }

  function scheduleNoteAt(note, whenSec, durationSec){
    ensureAudio();
    const freq = noteToFreq(note);
    const refFreq = noteToFreq(sampleRefNote);
    const rate = freq / refFreq;
    const src = audioCtx.createBufferSource();
    src.buffer = sampleBuffer;
    src.playbackRate.value = rate;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, whenSec);
    g.gain.exponentialRampToValueAtTime(0.9, whenSec + 0.01);
    src.connect(g); g.connect(audioCtx.destination);
    try{ src.start(whenSec); }catch(e){ src.start(); }
    try{ src.stop(whenSec + durationSec + 0.3); }catch(e){}
    scheduledNodes.push({src,g,when:whenSec});
    // schedule key highlight via timeouts (relative to now)
    const now = audioCtx.currentTime;
    const msUntil = Math.max(0,(whenSec - now)*1000);
    const t1 = setTimeout(()=>{
      const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onPress(el);
    }, msUntil);
    const t2 = setTimeout(()=>{
      const el = keyboard.querySelector('[data-note="'+note+'"]'); if (el) onRelease(el);
    }, msUntil + Math.max(120, durationSec*1000));
    highlightTimeouts.push(t1, t2);
  }

  let playAnimationId = null;
  let playing = false;
  let playStartAt = 0;
  let playTotalSec = 0;
  let currentPlayingIdx = -1;
  function stopPlayback(){
    if (!playing) return;
    playing = false;
    clearScheduled();
    if (playAnimationId) cancelAnimationFrame(playAnimationId);
    playAnimationId = null;
    playCursor.hidden = true;
    // release any pressed visual keys
    document.querySelectorAll('.white-key.active, .black-key.active').forEach(k=>k.classList.remove('active'));
  }

  function playMelody(idx){
    if (!melodies[idx-1]) return;
    // if already playing this or another, stop first
    if (playing) { stopPlayback(); return; }
    const mel = melodies[idx-1];
    ensureAudio();
    clearScheduled();
    const startAt = audioCtx.currentTime + 0.05; // small scheduling offset
    const beatSec = 60 / mel.tempo;
    const totalSec = mel.lengthBeats * beatSec;
    playStartAt = startAt; playTotalSec = totalSec; currentPlayingIdx = idx;
    playing = true;
    playCursor.hidden = false;
    // animate by scrolling the sequencer so the fixed cursor (left edge) aligns with current playback
    function animate(){
      if (!playing) return;
      const now = audioCtx.currentTime;
      const elapsed = Math.max(0, now - playStartAt);
      const frac = Math.min(1, Math.max(0, elapsed / playTotalSec));
      const currentBeat = elapsed / beatSec;
      const currentPixel = currentBeat * currentPxPerBeat;
      // position cursor relative to visible area
      const visibleLeft = sequencerContainer.scrollLeft;
      const visibleRight = visibleLeft + sequencerContainer.clientWidth;
      // auto-scroll if cursor goes out of view (keep it roughly centered)
      if (currentPixel < visibleLeft + 40) {
        sequencerContainer.scrollLeft = Math.max(0, currentPixel - 40);
      } else if (currentPixel > visibleRight - 40) {
        const maxScroll = Math.max(0, currentTrackWidth - sequencerContainer.clientWidth);
        sequencerContainer.scrollLeft = Math.min(maxScroll, currentPixel - sequencerContainer.clientWidth/2);
      }
      playCursor.style.left = (currentPixel - sequencerContainer.scrollLeft) + 'px';
      if (frac < 1) playAnimationId = requestAnimationFrame(animate);
      else { stopPlayback(); }
    }
    playAnimationId = requestAnimationFrame(animate);
    // schedule notes
    mel.notes.forEach(n => {
      const when = startAt + n.start * beatSec;
      const dur = Math.max(0.08, n.duration * beatSec);
      scheduleNoteAt(n.note, when, dur);
    });
  }

  // Recording
  let recording = false;
  let recordStartTime = 0;
  let recordedEvents = []; // {note, timeMs}

  function recordNoteOn(note){
    if (!recording) return;
    const t = performance.now() - recordStartTime;
    recordedEvents.push({note, time: t});
  }

  // Hook record hooks into existing input handlers by wrapping playNote/stopNote calls in attach functions
  // We already call playNote/stopNote in pointer/key handlers; modify those handlers to call recordNoteOn as well.

  // To avoid rewriting earlier listeners, add a global pointer capture for document that logs pointerdown on keys
  document.addEventListener('pointerdown', ev => {
    const el = ev.target.closest('[data-note]');
    if (el && recording) recordNoteOn(el.dataset.note);
  });
  window.addEventListener('keydown', ev => {
    const k = ev.key.toLowerCase();
    // the AZERTY mapping uses baseOctave and maps pitch; if mapping yields a note and recording, log it
    const pitch = (whiteMap[k] || blackMap[k]);
    if (pitch){
      const note = pitch + baseOctave;
      if (recording) recordNoteOn(note);
    }
    if (k === 'k' && baseOctave === 4){ if (recording) recordNoteOn('C5'); }
  });

  function startRecording(idx){
    const mel = melodies[idx-1];
    if (!mel) return;
    // if currently playing, stop playback before recording
    stopPlayback();
    // countdown 3..1 with metronome ticks
    let count = 3;
    countdownEl.hidden = false; countdownEl.textContent = String(count);
    // play initial tick
    playMetronomeTick();
    const countdownInterval = setInterval(()=>{
      count--; if (count>0) { countdownEl.textContent = String(count); playMetronomeTick(); }
      else { clearInterval(countdownInterval); countdownEl.hidden = true; beginCapture(); }
    }, 700);

    function beginCapture(){
      recording = true; recordedEvents = [];
      recordStartTime = performance.now();
      // show fixed cursor and start scrolling during record
      playCursor.hidden = false;
      const beatSec = 60 / mel.tempo;
      // animate scroll during recording
      function animRec(){
        if (!recording) { playCursor.hidden = true; return; }
        const elapsed = (performance.now() - recordStartTime)/1000;
        const currentBeat = elapsed / beatSec;
        const currentPixel = currentBeat * currentPxPerBeat;
        // move cursor and auto-scroll to keep visible
        const visibleLeft = sequencerContainer.scrollLeft;
        const visibleRight = visibleLeft + sequencerContainer.clientWidth;
        if (currentPixel < visibleLeft + 40) {
          sequencerContainer.scrollLeft = Math.max(0, currentPixel - 40);
        } else if (currentPixel > visibleRight - 40) {
          const maxScroll = Math.max(0, currentTrackWidth - sequencerContainer.clientWidth);
          sequencerContainer.scrollLeft = Math.min(maxScroll, currentPixel - sequencerContainer.clientWidth/2);
        }
        playCursor.style.left = (currentPixel - sequencerContainer.scrollLeft) + 'px';
        requestAnimationFrame(animRec);
      }
      requestAnimationFrame(animRec);
      // auto-stop after melody length + 1s
      const totalMs = mel.lengthBeats * beatSec * 1000 + 1200;
      setTimeout(()=>{ if (recording) stopRecording(idx); }, totalMs);
    }
  }

  function stopRecording(idx){
    recording = false;
    // compare
    const result = comparePerformance(recordedEvents, melodies[idx-1]);
    showFeedback(result);
  }

  // Comparison algorithm: for each target note, find a recorded event with same note within [-200ms, +300ms]
  function comparePerformance(recorded, melody){
    const beatMs = 60000 / melody.tempo;
    const beforeTol = 200; // ms before start
    const afterTol = 300; // ms after start
    const recUsed = new Array(recorded.length).fill(false);
    let matches = 0;
    const perNote = melody.notes.map((tgt, i) => {
      const targetMs = tgt.start * beatMs;
      let matchedIndex = -1;
      for (let r=0;r<recorded.length;r++){
        if (recUsed[r]) continue;
        if (recorded[r].note === tgt.note){
          const dt = recorded[r].time - targetMs;
          if (dt >= -beforeTol && dt <= afterTol){ matchedIndex = r; recUsed[r]=true; break; }
        }
      }
      if (matchedIndex>=0) { matches++; return {ok:true, note:tgt.note, targetMs}; }
      return {ok:false, note:tgt.note, targetMs};
    });
    const score = Math.round(100 * matches / melody.notes.length);
    return {matches, total: melody.notes.length, score, perNote};
  }

  function showFeedback(result){
    feedbackEl.textContent = `Score: ${result.score}% — ${result.matches}/${result.total} notes correct`;
    // color sequencer notes
    const notesEls = Array.from(sequencerTrack.querySelectorAll('.sequencer-note'));
    notesEls.forEach((el,idx)=>{
      if (result.perNote[idx] && result.perNote[idx].ok) { el.classList.remove('muted'); el.style.background = '#4caf50'; }
      else { el.classList.add('muted'); el.style.background = '#884444'; }
    });
  }

  // wire play/record buttons
  playBtn.addEventListener('click', ()=>{
    const idx = parseInt(melodySelect.value,10);
    playMelody(idx);
  });
  recordBtn.addEventListener('click', ()=>{
    const idx = parseInt(melodySelect.value,10);
    if (!recording) startRecording(idx);
    else stopRecording(idx);
  });


  // Run layout after first paint
  window.addEventListener('load', ()=>{
    layoutBlackKeys();
    attachKeyHandlers();
    attachAudioToKeys();
    attachComputerKeyboard();
    // relayout on resize
    window.addEventListener('resize', () => setTimeout(layoutBlackKeys, 120));
  });

})();
