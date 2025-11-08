Piano Game
===========

Local escape-room piano enigma. The player listens to a melody and must replay it.

Files
- index.html — main UI
- styles.css — styles
- app.js — game logic, audio engine (sample-based with fallback), sequencer, recording and comparison
- assets/sample_C4.wav — optional sample (place here if you have one)

How to run
1. Open `piano game/index.html` in a modern browser (Chrome/Edge/Firefox).
2. Interact with the page (click or press a key) to enable audio on some browsers.

Controls
- Melody selector: range slider (1..5).
- Play: plays the melody and animates the sequencer.
- Record: after a short countdown, records your key presses and compares them to the melody.

Keyboard mapping (AZERTY)
- White notes (C..B): q s d f g h j
- Black notes: z e t y u
- Octave select: w = lower octave (C3..), x = upper octave (C4..)
- When upper octave is selected, k plays C5

Audio samples
- The app tries to load `assets/sample_C4.wav`. If absent, it generates a short synthesized piano-like buffer as fallback.
- You can replace or add `assets/sample_C4.wav` (a single C4 piano tone) for better realism.

Matching rules
- A recorded press is considered correct if it matches the target note (pitch) and occurs within ±200ms of the target note start.
- Score = percentage of matched notes.

Notes & next steps
- This is a single-page demo; accessibility and edge-case tuning are partially implemented.
- Optional: add high-quality piano sample(s), MIDI input, or tweak scoring tolerances.

Enjoy!
