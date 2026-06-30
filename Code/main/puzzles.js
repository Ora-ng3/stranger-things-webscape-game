export function runDeskPuzzle(game) {

}

export function runBoxPuzzle(game) {
    // Shows the cable image map as a clickable shape
    // If this is clicked, it will change the cableState to "hand" 
    // and replace the current video (Elec_Lab_to_Box_WithCable.mp4) 
    // with the video (Elec_Lab_to_Box_WithoutCable.mp4)
    const area = game.findAreaFor("Box", "Cable");
    if (area === null) {
        console.warn(`No image map area found for Box -> Cable`);
        return;
    }

    const noCableVideoPath = "assets/animations/Elec_Lab_to_Box_NoCable_reverse.mp4";

    const shape = game.createSvgShapeFromArea(area);

    shape.classList.add('hotspot');
    shape.setAttribute('tabindex', '0');
    shape.setAttribute('role', 'button');
    shape.setAttribute('aria-label', "Cable");
    shape.addEventListener('click', () => {
        // Change the cableState to "hand" and replace the current video with the new video
        game.cableState = "hand";
        game.loadAndSwapVideo(noCableVideoPath);
    });
    shape.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            game.cableState = "hand";
            game.loadAndSwapVideo(noCableVideoPath);
        }
    });

    game.hotspotLayer.appendChild(shape);
}

export function runPosterPuzzle(game) {

}

export function runSynthPuzzle(game) {

}

export function runExitPuzzle(game) {

}