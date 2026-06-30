import {
    runDeskPuzzle,
    runBoxPuzzle,
    runPosterPuzzle,
    runSynthPuzzle,
    runExitPuzzle
} from './puzzles.js';

const graph = {
    "Main": {
        options: [
            { id: "Bedroom", label: "Bedroom", video: "Main_to_Bedroom" },
            { id: "Elec_Lab", label: "Elec Lab", video: "Main_to_Elec_Lab" },
            { id: "Exit", label: "Exit", video: "Main_to_Exit" },
            { id: "Music", label: "Music", video: "Main_to_Music" }
        ],
        parent: null
    },
    "Bedroom": {
        options: [
            { id: "SHS", label: "SHS", video: "Bedroom_to_SHS" },
            { id: "ST_Poster", label: "ST Poster", video: "Bedroom_to_ST_Poster" }
        ],
        parent: { id: "Main", video: "Main_to_Bedroom" }
    },
    "Elec_Lab": {
        options: [
            { id: "Box", label: "Box", video: "Elec_Lab_to_Box_WithCable" },
            { id: "Desk", label: "Desk", video: "Elec_Lab_to_Desk_WithCable" }
        ],
        parent: { id: "Main", video: "Main_to_Elec_Lab" }
    },
    "Music": {
        options: [
            { id: "Donald", label: "Donald", video: "Music_to_Donald" },
            { id: "Synth", label: "Synth", video: "Music_to_Synth" }
        ],
        parent: { id: "Main", video: "Main_to_Music" }
    },
    "SHS": { options: [], parent: { id: "Bedroom", video: "Bedroom_to_SHS" } },
    "ST_Poster": { options: [], parent: { id: "Bedroom", video: "Bedroom_to_ST_Poster" } },
    "Box": { options: [], parent: { id: "Elec_Lab", video: "Elec_Lab_to_Box_WithCable" } },
    "Desk": { options: [], parent: { id: "Elec_Lab", video: "Elec_Lab_to_Desk_WithCable" } },
    "Exit": { options: [], parent: { id: "Main", video: "Main_to_Exit" } },
    "Donald": { options: [], parent: { id: "Music", video: "Music_to_Donald" } },
    "Synth": { options: [], parent: { id: "Music", video: "Music_to_Synth" } },
};

let currentNode = "Main";
let isAnimating = false;

// cable can be in one of three states: "box", "hand" or "desk"
// This is used to determine which video to play when the cable can be seen (Elec_Lab -> Box or Desk)
let cableState = "box";

const mainBg = document.getElementById('main-bg');
const optionsContainer = document.getElementById('options-container');
const btnBack = document.getElementById('btn-back');
const hotspotLayer = document.getElementById('hotspot-layer');
let imageMapsDoc = null;

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_VIEWBOX = '0 0 1920 1080';
const POLYGON_CORNER_RADIUS = 10;

// Double Buffering Setup
const player1 = document.getElementById('player-1');
const player2 = document.getElementById('player-2');
let activePlayer = player1; // The player currently visible holding the last frame

async function loadImageMaps() {
    const response = await fetch('image_maps.html');
    if (!response.ok) {
        throw new Error(`Could not load image_maps.html: ${response.status}`);
    }

    const html = await response.text();
    imageMapsDoc = new DOMParser().parseFromString(html, 'text/html');
}

function updateHotspotLayerBounds() {
    const containerRect = document.getElementById('view-container').getBoundingClientRect();
    const mediaWidth = mainBg.naturalWidth || 1920;
    const mediaHeight = mainBg.naturalHeight || 1080;
    const containerRatio = containerRect.width / containerRect.height;
    const mediaRatio = mediaWidth / mediaHeight;

    let renderedWidth;
    let renderedHeight;

    if (containerRatio > mediaRatio) {
        renderedHeight = containerRect.height;
        renderedWidth = renderedHeight * mediaRatio;
    } else {
        renderedWidth = containerRect.width;
        renderedHeight = renderedWidth / mediaRatio;
    }

    hotspotLayer.style.width = `${renderedWidth}px`;
    hotspotLayer.style.height = `${renderedHeight}px`;
    hotspotLayer.style.left = `${(containerRect.width - renderedWidth) / 2}px`;
    hotspotLayer.style.top = `${(containerRect.height - renderedHeight) / 2}px`;
}

function findAreaFor(nodeName, targetId) {
    if (imageMapsDoc === null) return null;

    const mapName = `image-map-${nodeName.toLowerCase()}`;
    const map = imageMapsDoc.querySelector(`map[name="${mapName}"]`);
    if (map === null) return null;

    return Array.from(map.querySelectorAll('area')).find(area => area.alt === targetId) ?? null;
}

function createSvgShapeFromArea(area) {
    const shape = area.getAttribute('shape');
    const coords = area.getAttribute('coords').split(',').map(Number);

    if (shape === 'rect') {
        const [x1, y1, x2, y2] = coords;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', Math.min(x1, x2));
        rect.setAttribute('y', Math.min(y1, y2));
        rect.setAttribute('width', Math.abs(x2 - x1));
        rect.setAttribute('height', Math.abs(y2 - y1));
        rect.setAttribute('rx', POLYGON_CORNER_RADIUS);
        rect.setAttribute('ry', POLYGON_CORNER_RADIUS);
        return rect;
    }

    if (shape === 'poly') {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', createRoundedPolygonPath(coords, POLYGON_CORNER_RADIUS));
        return path;
    }

    if (shape === 'circle') {
        const [cx, cy, r] = coords;
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        return circle;
    }

    throw new Error(`Unsupported image map shape: ${shape}`);
}

function createRoundedPolygonPath(coords, radius) {
    const points = [];
    for (let i = 0; i < coords.length; i += 2) {
        points.push({ x: coords[i], y: coords[i + 1] });
    }

    if (points.length < 3) return '';

    const commands = [];

    points.forEach((point, index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        const previousDistance = Math.hypot(previous.x - point.x, previous.y - point.y);
        const nextDistance = Math.hypot(next.x - point.x, next.y - point.y);
        const cornerRadius = Math.min(radius, previousDistance / 2, nextDistance / 2);

        const start = pointAlongLine(point, previous, cornerRadius);
        const end = pointAlongLine(point, next, cornerRadius);

        if (index === 0) {
            commands.push(`M ${start.x} ${start.y}`);
        } else {
            commands.push(`L ${start.x} ${start.y}`);
        }

        commands.push(`Q ${point.x} ${point.y} ${end.x} ${end.y}`);
    });

    commands.push('Z');
    return commands.join(' ');
}

function pointAlongLine(from, to, distance) {
    const totalDistance = Math.hypot(to.x - from.x, to.y - from.y);
    if (totalDistance === 0) return from;

    const ratio = distance / totalDistance;
    return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio
    };
}

function renderUI() {
    // Clear current options
    optionsContainer.innerHTML = '';
    optionsContainer.classList.add('hidden');
    hotspotLayer.innerHTML = '';
    hotspotLayer.setAttribute('viewBox', MAP_VIEWBOX);
    hotspotLayer.setAttribute('preserveAspectRatio', 'none');
    updateHotspotLayerBounds();
    
    // Render new options
    const nodeData = graph[currentNode];
    nodeData.options.forEach(opt => {
        const area = findAreaFor(currentNode, opt.id);
        if (area === null) {
            console.warn(`No image map area found for ${currentNode} -> ${opt.id}`);
            return;
        }

        const shape = createSvgShapeFromArea(area);

        shape.classList.add('hotspot');
        shape.setAttribute('tabindex', '0');
        shape.setAttribute('role', 'button');
        shape.setAttribute('aria-label', opt.label);
        shape.addEventListener('click', () => {
            playTransition(opt.video, opt.id, false);
        });
        shape.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                playTransition(opt.video, opt.id, false);
            }
        });

        hotspotLayer.appendChild(shape);
    });

    // Handle Back button visibility
    if (nodeData.parent !== null) {
        btnBack.classList.remove('hidden');
        btnBack.onclick = () => playTransition(nodeData.parent.video, nodeData.parent.id, true);
    } else {
        btnBack.classList.add('hidden');
    }
}

const puzzleContext = {
    findAreaFor,
    createSvgShapeFromArea,
    hotspotLayer,
    loadAndSwapVideo,
    get cableState() {
        return cableState;
    },
    set cableState(value) {
        cableState = value;
    },
    get currentNode() {
        return currentNode;
    },
};

function runPuzzle() {
    // We do a switch statement on currentNode to determine which puzzle to run
    switch (currentNode) {
        case "Desk":
            runDeskPuzzle(puzzleContext);
            break;
        case "Box":
            runBoxPuzzle(puzzleContext);
            break;
        case "ST_Poster":
            runPosterPuzzle(puzzleContext);
            break;
        case "Synth":
            runSynthPuzzle(puzzleContext);
            break;
        case "Exit":
            runExitPuzzle(puzzleContext);
            break;
        default:
            // No puzzle for this node
            break;
    }
}

async function loadAndSwapVideo(videoPath) {
    const nextPlayer = (activePlayer === player1) ? player2 : player1;

    // 3. Load the video into the hidden secondary player
    nextPlayer.src = videoPath;
    nextPlayer.load();

    // Wait for the next player to have enough data to visually project the first frame
    await new Promise(res => {
        if (nextPlayer.readyState >= 3) res(); // HAVE_FUTURE_DATA
        else nextPlayer.addEventListener('canplay', res, { once: true });
    });

    // 4. Overlap manipulation
    // The active player (holding the old frame) drops below
    activePlayer.style.zIndex = 1;
    // The new player goes above it
    nextPlayer.style.zIndex = 2;
    nextPlayer.style.display = 'block';
}

async function playTransition(videoName, targetNode, isReverse) {
    if (isAnimating) return;
    isAnimating = true;
    
    // Hide UI during transition
    optionsContainer.classList.add('hidden');
    hotspotLayer.classList.add('hidden');
    btnBack.classList.add('hidden');

    let videoPath = videoName; // Default video path

    // If the transition is from Elec_Lab to Box or Desk, we need to determine which video to play based on cableState
    if ((currentNode === "Elec_Lab" && targetNode === "Box") ||
        (currentNode === "Box" && targetNode === "Elec_Lab")) {
        if (cableState === "box") {
            videoPath = `Elec_Lab_to_Box_WithCable`;
        }
        else {
            videoPath = `Elec_Lab_to_Box_NoCable`;
        }
    }
    else if ((currentNode === "Elec_Lab" && targetNode === "Desk") ||
             (currentNode === "Desk" && targetNode === "Elec_Lab")) {
        if (cableState === "desk") {
            videoPath = `Elec_Lab_to_Desk_WithCable`;
        }
        else {
            videoPath = `Elec_Lab_to_Desk_NoCable`;
        }
    }

    // 1. Prepare target video path
    // For reverse, we load the "_reverse.mp4" file that ffmpeg baked for us
    videoPath = isReverse ? `assets/animations/${videoPath}_reverse.mp4` : `assets/animations/${videoPath}.mp4`;

    // 2. Select the secondary player
    const nextPlayer = (activePlayer === player1) ? player2 : player1;
    
    await loadAndSwapVideo(videoPath);

    // Once we're sure nextPlayer has painted to screen on next animation frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Start playing!
            nextPlayer.currentTime = 0;
            nextPlayer.play();
            
            // Hide the initial static image if it's still showing
            mainBg.style.display = 'none';

            nextPlayer.onended = () => {
                nextPlayer.onended = null;
                
                // We made it to the end, the new player is now the active holding frame
                // We safely hide the old player to free up GPU draw cycles
                activePlayer.style.display = 'none';
                activePlayer = nextPlayer;

                // State updates
                currentNode = targetNode;
                isAnimating = false;
                
                renderUI();
                runPuzzle();
                hotspotLayer.classList.remove('hidden');
            };
        });
    });
}

async function initialize() {
    try {
        await loadImageMaps();
        if (!mainBg.complete) {
            await new Promise(resolve => mainBg.addEventListener('load', resolve, { once: true }));
        }
        renderUI();
    } catch (error) {
        console.error(error);
    }
}

window.addEventListener('resize', () => {
    updateHotspotLayerBounds();
});

initialize();
