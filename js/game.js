// Clear the Sector! - Game Logic

const GameState = {
    shields: 5,
    maxShields: 5,
    parts: 0,
    isAlive: true,
    board: [], // Will hold cell data including enemies
    playerHexIndex: null, // Current hex index where player is located
    clearedHexes: new Set(), // Track hexes that have been cleared of entities
    totalHexesWithEntities: 0, // Total number of hexes that contain entities (for win condition)
    totalHexes: 0, // Total number of hexes on the board
    repairCount: 0, // Track number of repairs for upgrade system
    damageMarkers: {}, // Track damage markers: hexIndex -> damage number
    shieldSurgeCount: 0, // Track shield surge items in inventory
    movementQueue: [], // Queue of hex indices to move to
    isMoving: false // Flag to track if player is currently moving
};

// Game data loaded from JSON
const GameData = {
    entities: [], // Array of entity objects loaded from JSON
    images: {}, // Cache of loaded images by sprite name
    markerSvg: null // Cached right-click marker SVG
};

// DOM Elements
const shieldsDisplay = document.getElementById('shields-value');
const partsDisplay = document.getElementById('parts-value');
const clearedDisplay = document.getElementById('cleared-value');
const boardContainer = document.getElementById('board-container');

// Initialize the game
async function init() {
    // Hide game container initially
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.style.display = 'none';
    }
    
    // Set up title screen
    setupTitleScreen();
}

// Set up title screen and button handlers
function setupTitleScreen() {
    const titleScreen = document.getElementById('title-screen');
    const btnC = document.getElementById('btn-c');
    const btnL = document.getElementById('btn-l');
    const btnLnA = document.getElementById('btn-lna');
    const btnS = document.getElementById('btn-s');
    
    if (!titleScreen) return;
    
    // Handle C, L, and LnA buttons - start the game
    const startGameButtons = [btnC, btnL, btnLnA];
    startGameButtons.forEach(button => {
        if (button) {
            addTouchAndClickHandler(button, () => {
                startGame();
            });
        }
    });
    
    // Handle S button (if needed for settings or other functionality)
    if (btnS) {
        addTouchAndClickHandler(btnS, () => {
            // Add S button functionality here if needed
            console.log('S button clicked');
        });
    }
}

// Start the game - hide title screen and show game board
async function startGame() {
    const titleScreen = document.getElementById('title-screen');
    const gameContainer = document.getElementById('game-container');
    
    if (!titleScreen || !gameContainer) return;
    
    // Add hiding class to trigger exit animations
    titleScreen.classList.add('hiding');
    
    // Wait for animations to complete, then hide title screen and show game
    setTimeout(async () => {
        titleScreen.classList.add('hidden');
        gameContainer.style.display = 'flex'; // Match the CSS flex display
        
        // Initialize the game
        try {
            await loadJSONData();
            await preloadImages();
            await loadMarkerSVG();
            await loadPartsIcon();
            await loadGameBoard();
            setupShieldRepair();
            updateDisplays();
            console.log('Game initialized successfully');
            console.log(`Loaded ${GameData.entities.length} entities from JSON`);
        } catch (error) {
            console.error('Error initializing game:', error);
            boardContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center;">Error loading game data</p>';
        }
    }, 800); // Match animation duration
}

// Load the right-click marker SVG
async function loadMarkerSVG() {
    try {
        const response = await fetch('img/right_click.svg');
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        GameData.markerSvg = svgDoc.documentElement;
        console.log('Marker SVG loaded');
    } catch (error) {
        console.error('Error loading marker SVG:', error);
    }
}

// Load and style the parts icon SVG
async function loadPartsIcon() {
    try {
        const partsIconContainer = document.querySelector('.status-item.parts .status-icon');
        if (!partsIconContainer) {
            console.warn('Parts icon container not found');
            return;
        }
        
        const response = await fetch('img/parts.svg');
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        
        // Get the accent orange color from CSS
        const style = getComputedStyle(document.documentElement);
        const accentOrange = style.getPropertyValue('--accent-orange').trim();
        
        // Apply the accent color to all path elements (they don't have fill attributes by default)
        const pathElements = svgElement.querySelectorAll('path');
        pathElements.forEach(path => {
            // Explicitly set fill to accent orange
            path.setAttribute('fill', accentOrange);
        });
        
        // Also apply to other shape elements (circle, rect, polygon, etc.)
        const shapeElements = svgElement.querySelectorAll('circle, rect, polygon, ellipse, line');
        shapeElements.forEach(shape => {
            const currentFill = shape.getAttribute('fill');
            if (currentFill !== 'none') {
                shape.setAttribute('fill', accentOrange);
            }
        });
        
        // Apply to all other elements that might have fill
        const allElements = svgElement.querySelectorAll('*');
        allElements.forEach(element => {
            // Skip if fill is explicitly 'none'
            const currentFill = element.getAttribute('fill');
            if (currentFill && currentFill !== 'none') {
                element.setAttribute('fill', accentOrange);
            }
        });
        
        // Ensure SVG fits the container (32x32px)
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.style.display = 'block';
        
        // Clear the container and append the styled SVG
        partsIconContainer.innerHTML = '';
        partsIconContainer.appendChild(svgElement);
        
        console.log('Parts icon SVG loaded and styled');
    } catch (error) {
        console.error('Error loading parts icon SVG:', error);
    }
}

// Helper function to add both click and touch event handlers
function addTouchAndClickHandler(element, handler, options = {}) {
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    
    // Click handler
    element.addEventListener('click', (e) => {
        if (!touchMoved) {
            handler(e);
        }
    });
    
    // Touch handlers
    element.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        touchMoved = false;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        e.preventDefault(); // Prevent default touch behavior
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
        const touchEndTime = Date.now();
        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        const deltaTime = touchEndTime - touchStartTime;
        
        // Only trigger if touch didn't move much and was quick (tap, not drag)
        if (!touchMoved && deltaX < 10 && deltaY < 10 && deltaTime < 300) {
            // Create a synthetic event object
            const syntheticEvent = {
                target: e.target,
                currentTarget: e.currentTarget,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            };
            handler(syntheticEvent);
        }
        e.preventDefault();
    }, { passive: false });
    
    element.addEventListener('touchmove', () => {
        touchMoved = true;
    });
}

// Helper function for touch and hold (right-click equivalent)
function addTouchAndHoldHandler(element, handler, holdDuration = 500) {
    let holdTimer = null;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    
    element.addEventListener('touchstart', (e) => {
        touchMoved = false;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        holdTimer = setTimeout(() => {
            if (!touchMoved) {
                const syntheticEvent = {
                    target: e.target,
                    currentTarget: e.currentTarget,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                };
                handler(syntheticEvent);
            }
        }, holdDuration);
    });
    
    element.addEventListener('touchend', () => {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
    });
    
    element.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        if (deltaX > 10 || deltaY > 10) {
            touchMoved = true;
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        }
    });
    
    element.addEventListener('touchcancel', () => {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
    });
}

// Helper function for touch hover (touchstart/touchend for zoom)
function addTouchHoverHandler(element, enterHandler, leaveHandler) {
    let hoverTimer = null;
    
    element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            enterHandler();
        }, 100);
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        leaveHandler();
    }, { passive: false });
    
    element.addEventListener('touchcancel', () => {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        leaveHandler();
    });
}

// Set up shield recharge click handler
function setupShieldRepair() {
    if (!shieldsDisplay) return;
    
    addTouchAndClickHandler(shieldsDisplay, rechargeShields);
    shieldsDisplay.style.cursor = 'pointer';
    shieldsDisplay.title = 'Click or tap to recharge shields (costs parts based on recharge level)';
}

// Load JSON data file
async function loadJSONData() {
    try {
        const response = await fetch('data/data.json');
        if (!response.ok) {
            throw new Error(`Failed to load JSON: ${response.statusText}`);
        }
        const jsonData = await response.json();
        GameData.entities = jsonData;
        console.log('JSON data loaded:', GameData.entities);
    } catch (error) {
        console.error('Error loading JSON data:', error);
        throw error;
    }
}

// Preload all images referenced in the JSON data
async function preloadImages() {
    const imagePromises = [];
    const uniqueSprites = new Set();
    
    // Collect all unique sprite names from entities
    GameData.entities.forEach(entity => {
        if (entity.sprite_name) {
            uniqueSprites.add(entity.sprite_name);
        }
    });
    
    // Create image loading promises
    uniqueSprites.forEach(spriteName => {
        const img = new Image();
        const promise = new Promise((resolve, reject) => {
            img.onload = () => {
                GameData.images[spriteName] = img;
                console.log(`Loaded image: ${spriteName}`);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${spriteName}`);
                reject(new Error(`Failed to load image: ${spriteName}`));
            };
            img.src = `img/${spriteName}`;
        });
        imagePromises.push(promise);
    });
    
    // Wait for all images to load
    await Promise.allSettled(imagePromises);
    console.log(`Preloaded ${Object.keys(GameData.images).length} images`);
}

// Load the SVG game board
async function loadGameBoard() {
    try {
        const response = await fetch('img/sector_cleared.svg');
        const svgText = await response.text();
        boardContainer.innerHTML = svgText;
        
        // Get the SVG element and set up interactions
        const svg = boardContainer.querySelector('svg');
        if (svg) {
            // Add background image to SVG
            const defs = svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            if (!svg.querySelector('defs')) {
                svg.insertBefore(defs, svg.firstChild);
            }
            
            // Create pattern for background image
            let pattern = defs.querySelector('pattern#background-pattern');
            if (!pattern) {
                pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
                pattern.setAttribute('id', 'background-pattern');
                pattern.setAttribute('patternUnits', 'userSpaceOnUse');
                pattern.setAttribute('width', '100%');
                pattern.setAttribute('height', '100%');
                
                const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/Space-Bkgd.jpg');
                image.setAttribute('x', '0');
                image.setAttribute('y', '0');
                image.setAttribute('width', '100%');
                image.setAttribute('height', '100%');
                image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                
                pattern.appendChild(image);
                defs.appendChild(pattern);
            }
            
            // Apply background pattern to SVG
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', '0');
                rect.setAttribute('y', '0');
                rect.setAttribute('width', '100%');
                rect.setAttribute('height', '100%');
                rect.setAttribute('fill', 'url(#background-pattern)');
                svg.insertBefore(rect, svg.firstChild.nextSibling); // Insert after defs
            }
            
            // Set up the leader image in the zoom hex with clipping mask
            setupLeaderImage(svg, defs);
            
            setupBoardInteractions(svg);
        }
    } catch (error) {
        console.error('Error loading game board:', error);
        boardContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center;">Error loading game board</p>';
    }
}

// Track alert timeout for cleanup
let alertTimeout = null;

// Set up the leader image in the zoom hex with clipping mask
function setupLeaderImage(svg, defs) {
    // Get the zoom hex polygon
    const zoomHex = svg.querySelector('#zoom');
    if (!zoomHex) {
        console.warn('Zoom hex not found');
        return;
    }
    
    // Get the points attribute from the zoom hex
    const pointsAttr = zoomHex.getAttribute('points');
    if (!pointsAttr) {
        console.warn('Zoom hex has no points attribute');
        return;
    }
    
    // Create a clipPath element using the zoom hex shape
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', 'zoom-hex-clip');
    
    // Create a polygon inside the clipPath with the same shape as the zoom hex
    const clipPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    clipPolygon.setAttribute('points', pointsAttr);
    clipPath.appendChild(clipPolygon);
    
    // Add the clipPath to defs
    defs.appendChild(clipPath);
    
    // Get the bounding box of the zoom hex
    const bbox = zoomHex.getBBox();
    
    // Create an image element for the leader
    const leaderImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    leaderImage.setAttribute('id', 'leader-image');
    leaderImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/leader_off.png');
    
    // Position the image to cover the entire zoom hex
    // Use the bounding box to center and size the image
    leaderImage.setAttribute('x', bbox.x.toString());
    leaderImage.setAttribute('y', bbox.y.toString());
    leaderImage.setAttribute('width', bbox.width.toString());
    leaderImage.setAttribute('height', bbox.height.toString());
    leaderImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    
    // Apply the clip path to the image
    leaderImage.setAttribute('clip-path', 'url(#zoom-hex-clip)');
    
    // Insert the image after the zoom hex so it appears on top of the hex fill
    // but the hex polygon provides the visual boundary via clipping
    zoomHex.parentNode.insertBefore(leaderImage, zoomHex.nextSibling);
    
    console.log('Leader image set up with hex clipping mask');
}

// Show leader alert with text message
function showLeaderAlert(alertText) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Clear any existing timeout
    if (alertTimeout) {
        clearTimeout(alertTimeout);
        alertTimeout = null;
    }
    
    // Swap leader image to chat gif
    const leaderImage = svg.querySelector('#leader-image');
    if (leaderImage) {
        leaderImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/leader_chat.gif');
        console.log('Leader image swapped to chat gif');
    } else {
        console.warn('Leader image element not found');
    }
    
    // Get the text rectangle for positioning
    const textRect = svg.querySelector('#text');
    if (!textRect) {
        console.warn('Text rectangle not found');
        return;
    }
    
    const rectBBox = textRect.getBBox();
    
    // Remove any existing alert text
    const existingText = svg.querySelector('#alert-text-group');
    if (existingText) {
        existingText.remove();
    }
    
    // Create a group for the alert text
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('id', 'alert-text-group');
    
    // Create foreignObject to allow text wrapping
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', (rectBBox.x + 15).toString());
    foreignObject.setAttribute('y', (rectBBox.y + 10).toString());
    foreignObject.setAttribute('width', (rectBBox.width - 30).toString());
    foreignObject.setAttribute('height', (rectBBox.height - 20).toString());
    
    // Create a div inside foreignObject for the text (using XHTML namespace)
    const textDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    textDiv.style.width = '100%';
    textDiv.style.height = '100%';
    textDiv.style.display = 'flex';
    textDiv.style.alignItems = 'center';
    textDiv.style.justifyContent = 'center';
    textDiv.style.textAlign = 'center';
    textDiv.style.color = '#00d4ff';
    textDiv.style.fontSize = '24px';
    textDiv.style.fontFamily = 'Arial, sans-serif';
    textDiv.style.fontWeight = 'bold';
    textDiv.style.lineHeight = '1.3';
    textDiv.style.padding = '5px';
    textDiv.style.boxSizing = 'border-box';
    textDiv.style.overflow = 'hidden';
    textDiv.textContent = alertText;
    
    foreignObject.appendChild(textDiv);
    textGroup.appendChild(foreignObject);
    svg.appendChild(textGroup);
    
    console.log('Alert text group added to SVG, leader image swapped');
    
    console.log('Leader alert shown:', alertText);
    
    // Set timeout to hide alert after 5 seconds
    alertTimeout = setTimeout(() => {
        hideLeaderAlert();
    }, 5000);
}

// Hide leader alert and restore default state
function hideLeaderAlert() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Clear timeout if it exists
    if (alertTimeout) {
        clearTimeout(alertTimeout);
        alertTimeout = null;
    }
    
    // Swap leader image back to off state
    const leaderImage = svg.querySelector('#leader-image');
    if (leaderImage) {
        leaderImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/leader_off.png');
    }
    
    // Remove alert text
    const textGroup = svg.querySelector('#alert-text-group');
    if (textGroup) {
        textGroup.remove();
    }
    
    console.log('Leader alert hidden');
}

// Hex coordinate system - stores hex coordinates for each index
const HexCoordinates = {
    indexToCoords: {}, // index -> {q, r, s}
    coordsToIndex: {}  // "q,r,s" -> index
};

// Parse hex coordinates from SVG path ID
function parseHexCoords(pathId) {
    if (!pathId) return null;
    
    // Decode hex-encoded characters: _x2C_ = comma, _x2D_ = minus, _x30_-_x39_ = 0-9
    let decoded = pathId
        .replace(/_x2C_/g, ',')
        .replace(/_x2D_/g, '-')
        .replace(/_x([0-9A-F]{2})_/g, (match, hex) => {
            const charCode = parseInt(hex, 16);
            return String.fromCharCode(charCode);
        });
    
    // Extract numbers (handles formats like "0,-6,6" or "0 -6 6")
    const numbers = decoded.match(/-?\d+/g);
    if (numbers && numbers.length >= 3) {
        return {
            q: parseInt(numbers[0], 10),
            r: parseInt(numbers[1], 10),
            s: parseInt(numbers[2], 10)
        };
    }
    return null;
}

// Get neighbor coordinates for a hex (cube coordinates)
function getHexNeighbors(q, r, s) {
    return [
        {q: q + 1, r: r - 1, s: s},     // NE
        {q: q + 1, r: r, s: s - 1},     // E
        {q: q, r: r + 1, s: s - 1},     // SE
        {q: q - 1, r: r + 1, s: s},     // SW
        {q: q - 1, r: r, s: s + 1},     // W
        {q: q, r: r - 1, s: s + 1}      // NW
    ];
}

// Build coordinate mapping from SVG polygons
function buildHexCoordinateMap(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    hexPolygons.forEach((polygon, index) => {
        const coords = parseHexCoords(polygon.id);
        if (coords) {
            HexCoordinates.indexToCoords[index] = coords;
            const coordKey = `${coords.q},${coords.r},${coords.s}`;
            HexCoordinates.coordsToIndex[coordKey] = index;
        }
    });
    
    console.log(`Built coordinate map for ${Object.keys(HexCoordinates.indexToCoords).length} hexes`);
}

// Get neighbor indices for a given hex index
function getNeighborIndices(hexIndex) {
    const coords = HexCoordinates.indexToCoords[hexIndex];
    
    // If we have coordinates, use them
    if (coords) {
        const neighbors = getHexNeighbors(coords.q, coords.r, coords.s);
        const neighborIndices = [];
        
        neighbors.forEach(neighbor => {
            const coordKey = `${neighbor.q},${neighbor.r},${neighbor.s}`;
            const neighborIndex = HexCoordinates.coordsToIndex[coordKey];
            if (neighborIndex !== undefined) {
                neighborIndices.push(neighborIndex);
            }
        });
        
        if (neighborIndices.length > 0) {
            return neighborIndices;
        }
    }
    
    // Fallback: use geometric proximity (find closest hexes by center distance)
    const svg = boardContainer.querySelector('svg');
    if (!svg) return [];
    
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const targetPolygon = hexPolygons[hexIndex];
    if (!targetPolygon) return [];
    
    const targetBBox = targetPolygon.getBBox();
    const targetCenterX = targetBBox.x + targetBBox.width / 2;
    const targetCenterY = targetBBox.y + targetBBox.height / 2;
    
    // Calculate distances to all other hexes
    const distances = [];
    hexPolygons.forEach((polygon, index) => {
        if (index === hexIndex) return;
        
        const bbox = polygon.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        
        const dx = centerX - targetCenterX;
        const dy = centerY - targetCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Hex width is approximately 94 pixels for the new larger hexes, so neighbors should be around 100-110 pixels away
        if (distance < 120) {
            distances.push({ index, distance });
        }
    });
    
    // Sort by distance and take the 6 closest (hexes have 6 neighbors)
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, 6).map(d => d.index);
}

// Find entity by ID in JSON data
function findEntityById(entityId) {
    return GameData.entities.find(entity => {
        // Check if the first column (ID) matches
        // The JSON data should have stored this, but let's check the raw data
        // Actually, looking at the JSON, the id field contains the entity ID (E01, E11, etc.)
        // We need to check the entity structure
        return entity.name && entity.name.toLowerCase().includes(entityId.toLowerCase());
    });
}

// Place an entity on a hex cell
function placeEntityOnHex(hexIndex, entity) {
    if (!GameState.board[hexIndex]) {
        GameState.board[hexIndex] = {
            revealed: false,
            enemy: null,
            entity: null
        };
    }
    
    // Store entity data
    GameState.board[hexIndex].entity = entity;
    GameState.board[hexIndex].enemy = entity; // For now, treat as enemy
    
    // Render entity visually (for fine-tuning - make visible)
    const svg = boardContainer.querySelector('svg');
    if (svg) {
        const boardGroup = svg.querySelector('#board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
        const hexPolygon = hexPolygons[hexIndex];
        
        if (hexPolygon && entity.sprite_name) {
            // Get bounding box of the hex polygon
            const bbox = hexPolygon.getBBox();
            
            // Check if image already exists for this hex
            const existingImage = svg.querySelector(`image[data-hex-index="${hexIndex}"]`);
            if (existingImage) {
                existingImage.remove(); // Remove old image if exists
            }
            
            // Check if damage text already exists for this hex
            const existingText = svg.querySelector(`text[data-hex-index="${hexIndex}"]`);
            if (existingText) {
                existingText.remove(); // Remove old text if exists
            }
            
            // Create image element
            const imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imageElement.setAttribute('data-hex-index', hexIndex.toString());
            
            // Center the image on the hex (scaled up for larger hexes)
            const imageSize = 50;
            const imageX = bbox.x + bbox.width / 2 - imageSize / 2;
            const imageY = bbox.y + bbox.height / 2 - imageSize / 2;
            
            imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `img/${entity.sprite_name}`);
            imageElement.setAttribute('x', imageX.toString());
            imageElement.setAttribute('y', imageY.toString());
            imageElement.setAttribute('width', imageSize.toString());
            imageElement.setAttribute('height', imageSize.toString());
            imageElement.setAttribute('opacity', '1'); // Visible for fine-tuning
            imageElement.setAttribute('pointer-events', 'none'); // Don't block clicks
            
            // Append image to SVG
            svg.appendChild(imageElement);
            
            // Add damage text if entity has damage > 0
            if (entity.damage !== undefined && entity.damage !== null && entity.damage > 0) {
                const damageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                damageText.setAttribute('data-hex-index', hexIndex.toString());
                damageText.setAttribute('x', (imageX - 10).toString()); // Lower left of sprite (more offset)
                damageText.setAttribute('y', (imageY + imageSize + 10).toString());
                damageText.setAttribute('fill', '#ff0000'); // Red color
                damageText.setAttribute('font-size', '28');
                damageText.setAttribute('font-weight', 'bold');
                damageText.setAttribute('font-family', 'Arial, sans-serif');
                damageText.setAttribute('pointer-events', 'none'); // Don't block clicks
                damageText.textContent = entity.damage.toString();
                
                // Append text to SVG
                svg.appendChild(damageText);
            }
        }
    }
}

// Set up board with initial placements
function setupBoardPlacements(svg) {
    // Find E11 (Local Warlord) by ID
    const e11 = GameData.entities.find(e => e.id && e.id.trim() === 'E11');
    if (!e11) {
        console.warn('E11 (Local Warlord) not found in JSON data');
        console.log('Available entities:', GameData.entities.map(e => e.id));
        console.log('All entities:', GameData.entities);
        return;
    }
    
    // Find E12 (Dominion Fighter Ship) by ID
    const e12 = GameData.entities.find(e => e.id && e.id.trim() === 'E12');
    if (!e12) {
        console.warn('E12 (Dominion Fighter Ship) not found in JSON data');
        console.log('Available entities:', GameData.entities.map(e => e.id));
        console.log('All entities:', GameData.entities);
        return;
    }
    
    // Get all hex indices
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const totalHexes = hexPolygons.length;
    
    // Track occupied hexes
    const occupiedHexes = new Set();
    
    // Place E11 at a random location
    const randomIndex = Math.floor(Math.random() * totalHexes);
    console.log(`Placing E11 at hex index ${randomIndex}`);
    placeEntityOnHex(randomIndex, e11);
    occupiedHexes.add(randomIndex);
    
    // Get all neighbors of E11's location
    const neighborIndices = getNeighborIndices(randomIndex);
    console.log(`Found ${neighborIndices.length} neighbors for E11`);
    
    // Place E12 ships at all connecting hexes
    neighborIndices.forEach(neighborIndex => {
        placeEntityOnHex(neighborIndex, e12);
        occupiedHexes.add(neighborIndex);
    });
    
    console.log(`Placed E11 and ${neighborIndices.length} E12 ships`);
    
    // Get all remaining entities (excluding E11 and E12)
    const remainingEntities = GameData.entities.filter(e => e.id !== 'E11' && e.id !== 'E12');
    
    // Create a list of all hex indices that are available
    const availableHexes = [];
    for (let i = 0; i < totalHexes; i++) {
        if (!occupiedHexes.has(i)) {
            availableHexes.push(i);
        }
    }
    
    // Shuffle available hexes for random distribution
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    const shuffledHexes = shuffleArray(availableHexes);
    let hexIndex = 0;
    
    // Place remaining entities based on their COUNT
    remainingEntities.forEach(entity => {
        const count = entity.count || 0;
        console.log(`Placing ${count} of ${entity.id} (${entity.name})`);
        
        for (let i = 0; i < count && hexIndex < shuffledHexes.length; i++) {
            const targetHex = shuffledHexes[hexIndex];
            placeEntityOnHex(targetHex, entity);
            occupiedHexes.add(targetHex);
            hexIndex++;
        }
    });
    
    console.log(`Placed all entities. Total occupied hexes: ${occupiedHexes.size}`);
    console.log(`Remaining empty hexes: ${totalHexes - occupiedHexes.size}`);
    
    // Track total hexes with entities for win condition
    GameState.totalHexesWithEntities = occupiedHexes.size;
    
    // Store total hexes count
    GameState.totalHexes = totalHexes;
    
    // Add neighbor damage sums to all hexes
    addNeighborDamageSums(svg);
    
    // Place player on a random empty hex
    placePlayer(svg);
    
    // Cover all hexes with entities to hide their contents
    coverHexes(svg);
    
    // Reveal all hexes connected to the player's starting position
    revealPlayerNeighbors(svg);
}

// Reveal all hexes connected to the player's starting position
function revealPlayerNeighbors(svg) {
    if (GameState.playerHexIndex === null || GameState.playerHexIndex === undefined) {
        console.warn('Player hex index not set, cannot reveal neighbors');
        return;
    }
    
    // Get all neighbors of the player's hex
    const neighborIndices = getNeighborIndices(GameState.playerHexIndex);
    
    console.log(`Revealing ${neighborIndices.length} neighbors of player's starting hex`);
    
    // Reveal each neighbor
    neighborIndices.forEach(neighborIndex => {
        const cell = GameState.board[neighborIndex];
        if (!cell) {
            // Initialize cell if it doesn't exist
            GameState.board[neighborIndex] = {
                revealed: false,
                enemy: null,
                entity: null
            };
        }
        
        // Mark as revealed
        cell.revealed = true;
        
        // Get the original polygon to update its data attribute
        const boardGroup = svg.querySelector('#board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
        const hexPolygon = hexPolygons[neighborIndex];
        if (hexPolygon) {
            hexPolygon.dataset.revealed = 'true';
        }
        
        // Remove cover and show contents
        removeHexCover(neighborIndex);
        revealHexContents(neighborIndex);
    });
    
    console.log('Player starting area revealed');
}

// Check if a hex is on the outer ring (has fewer than 6 neighbors)
function isOuterRingHex(hexIndex) {
    const neighbors = getNeighborIndices(hexIndex);
    return neighbors.length < 6;
}

// Place the player sprite on a random empty hex (not on outer ring)
function placePlayer(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const totalHexes = hexPolygons.length;
    
    // Find all empty hexes (hexes without entities) that are NOT on the outer ring
    const emptyHexes = [];
    for (let i = 0; i < totalHexes; i++) {
        const cell = GameState.board[i];
        if (!cell || !cell.entity) {
            // Check if this hex is NOT on the outer ring
            if (!isOuterRingHex(i)) {
                emptyHexes.push(i);
            }
        }
    }
    
    if (emptyHexes.length === 0) {
        console.warn('No empty hexes available for player placement (excluding outer ring)');
        // Fallback: allow outer ring placement if no inner hexes available
        for (let i = 0; i < totalHexes; i++) {
            const cell = GameState.board[i];
            if (!cell || !cell.entity) {
                emptyHexes.push(i);
            }
        }
        if (emptyHexes.length === 0) {
            console.error('No empty hexes available for player placement at all');
            return;
        }
    }
    
    // Pick a random empty hex (preferring inner hexes)
    const randomIndex = Math.floor(Math.random() * emptyHexes.length);
    const playerHexIndex = emptyHexes[randomIndex];
    
    console.log(`Placing player at hex index ${playerHexIndex}`);
    
    // Get the hex polygon
    const hexPolygon = hexPolygons[playerHexIndex];
    if (!hexPolygon) return;
    
    // Get bounding box of the hex
    const bbox = hexPolygon.getBBox();
    
    // Check if player image/group already exists
    const existingPlayerGroup = svg.querySelector('g[data-player-group="true"]');
    if (existingPlayerGroup) {
        existingPlayerGroup.remove();
    }
    const existingPlayerImage = svg.querySelector('image[data-player="true"]');
    if (existingPlayerImage) {
        existingPlayerImage.remove();
    }
    
    // Create player group and image
    const imageSize = 50;
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2 + 18;
    
    const playerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    playerGroup.setAttribute('data-player-group', 'true');
    playerGroup.setAttribute('transform', `translate(${centerX}, ${centerY}) rotate(0)`);
    
    const playerImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    playerImage.setAttribute('data-player', 'true');
    playerImage.setAttribute('data-hex-index', playerHexIndex.toString());
    playerImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player.png');
    playerImage.setAttribute('x', (-imageSize / 2).toString());
    playerImage.setAttribute('y', (-imageSize / 2).toString());
    playerImage.setAttribute('width', imageSize.toString());
    playerImage.setAttribute('height', imageSize.toString());
    playerImage.setAttribute('opacity', '1');
    playerImage.setAttribute('pointer-events', 'none');
    
    playerGroup.appendChild(playerImage);
    svg.appendChild(playerGroup);
    
    // Apply critical glow if shields are at 0
    if (GameState.shields <= 0) {
        playerImage.classList.add('shields-critical');
    }
    
    // Make the player's starting hex transparent
    hexPolygon.setAttribute('fill-opacity', '0');
    hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
    
    // Mark the player's starting hex as revealed
    const cell = GameState.board[playerHexIndex];
    if (!cell) {
        GameState.board[playerHexIndex] = {
            revealed: true,
            enemy: null,
            entity: null
        };
    } else {
        cell.revealed = true;
    }
    
    // Store player position in game state
    GameState.playerHexIndex = playerHexIndex;
    
    // Update damage sum for player's hex now that playerHexIndex is set
    // This ensures the damage sum is positioned correctly (moved up)
    updateSingleHexDamageSum(svg, playerHexIndex);
    
    // Place a shield surge (B03) in one of the player's adjacent hexes
    placeShieldSurgeNearPlayer(svg, playerHexIndex);
    
    console.log('Player placed successfully');
}

// Place a shield surge (B03) in one of the player's adjacent hexes
function placeShieldSurgeNearPlayer(svg, playerHexIndex) {
    // Find B03 entity
    const b03 = GameData.entities.find(e => e.id === 'B03');
    if (!b03) {
        console.warn('B03 (Shield Surge) not found in JSON data');
        return;
    }
    
    // Get all neighbors of the player's hex
    const neighborIndices = getNeighborIndices(playerHexIndex);
    
    if (neighborIndices.length === 0) {
        console.warn('No neighbors found for player hex, cannot place shield surge');
        return;
    }
    
    // Filter to only empty neighbors
    const emptyNeighbors = neighborIndices.filter(hexIndex => {
        const cell = GameState.board[hexIndex];
        return !cell || !cell.entity;
    });
    
    if (emptyNeighbors.length === 0) {
        console.warn('No empty neighbors for player hex, cannot place shield surge');
        return;
    }
    
    // Pick a random empty neighbor
    const randomNeighborIndex = Math.floor(Math.random() * emptyNeighbors.length);
    const surgeHexIndex = emptyNeighbors[randomNeighborIndex];
    
    // Place B03 shield surge entity
    placeEntityOnHex(surgeHexIndex, b03);
    
    console.log(`Placed shield surge (B03) at hex index ${surgeHexIndex} (adjacent to player)`);
}

// Cover all hexes to hide their contents (except player's starting hex)
function coverHexes(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    // Create a group for covers to ensure they're on top
    let coverGroup = svg.querySelector('g.hex-covers');
    if (coverGroup) {
        coverGroup.remove(); // Remove existing group if present
    }
    coverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    coverGroup.setAttribute('class', 'hex-covers');
    
    hexPolygons.forEach((hexPolygon, hexIndex) => {
        const cell = GameState.board[hexIndex];
        
        // Skip player's starting hex - it should be visible
        if (hexIndex === GameState.playerHexIndex) {
            return;
        }
        
        // Hide images and text for this hex initially (if they exist)
        const images = svg.querySelectorAll(`image[data-hex-index="${hexIndex}"]`);
        images.forEach(img => {
            if (!img.hasAttribute('data-player')) {
                img.setAttribute('opacity', '0');
            }
        });
        
        const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
        damageTexts.forEach(text => {
            text.setAttribute('opacity', '0');
        });
        
        const sumTexts = svg.querySelectorAll(`text[data-hex-sum-index="${hexIndex}"]`);
        sumTexts.forEach(text => {
            text.setAttribute('opacity', '0');
        });
        
        // Get the polygon's 'points' attribute to recreate it
        const pointsData = hexPolygon.getAttribute('points');
        if (!pointsData) return;
        
        // Create a new cover polygon (don't clone to avoid inheriting unwanted attributes)
        const coverPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        coverPolygon.setAttribute('points', pointsData);
        coverPolygon.setAttribute('data-hex-cover', hexIndex.toString());
        coverPolygon.setAttribute('data-hex-index', hexIndex.toString());
        coverPolygon.setAttribute('class', 'hex-cover');
        coverPolygon.setAttribute('fill', '#1a2332'); // Dark fill to cover contents
        coverPolygon.setAttribute('stroke', '#0d1117'); // Dark stroke
        coverPolygon.setAttribute('stroke-width', '1');
        coverPolygon.setAttribute('opacity', '1');
        coverPolygon.setAttribute('pointer-events', 'all');
        coverPolygon.style.cursor = 'pointer';
        
        // Add click and touch handler to cover so it can be clicked to reveal
        addTouchAndClickHandler(coverPolygon, handleHexClick);
        
        // Add right-click handler for damage markers (only on hidden hexes)
        coverPolygon.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            handleRightClick(e, hexIndex);
        });
        
        // Add touch and hold handler for damage markers (mobile equivalent of right-click)
        addTouchAndHoldHandler(coverPolygon, (e) => {
            handleRightClick(e, hexIndex);
        });
        
        // Don't add hover handlers to covers - hover only works on revealed hexes
        
        // Append cover to the group
        coverGroup.appendChild(coverPolygon);
    });
    
    // Append the cover group LAST to ensure it renders on top of everything
    svg.appendChild(coverGroup);
    
    // Restore any existing damage markers
    Object.keys(GameState.damageMarkers).forEach(hexIndex => {
        const damage = GameState.damageMarkers[hexIndex];
        const cell = GameState.board[hexIndex];
        // Only restore markers on hidden hexes
        if (cell && !cell.revealed && damage > 0) {
            placeDamageMarker(parseInt(hexIndex, 10), damage);
        }
    });
    
    console.log('Covered all hexes (except player starting hex)');
}

// Remove cover from a hex when revealed
function removeHexCover(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const cover = svg.querySelector(`polygon[data-hex-cover="${hexIndex}"]`);
    if (cover) {
        cover.remove();
    }
    
    // Remove damage marker when hex is revealed
    removeDamageMarker(hexIndex);
    delete GameState.damageMarkers[hexIndex];
}

// Handle right-click on hidden hex to show damage marker menu
function handleRightClick(event, hexIndex) {
    if (!GameState.isAlive) {
        return;
    }
    
    const cell = GameState.board[hexIndex];
    if (!cell || cell.revealed) {
        return; // Don't allow markers on revealed hexes
    }
    
    event.preventDefault();
    
    // Check if there's already a marker - if so, remove it on right-click
    if (GameState.damageMarkers[hexIndex]) {
        removeDamageMarker(hexIndex);
        delete GameState.damageMarkers[hexIndex];
        return;
    }
    
    // Show number selection menu
    showDamageMarkerMenu(event, hexIndex);
}

// Show damage marker selection menu
function showDamageMarkerMenu(event, hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg || !GameData.markerSvg) return;
    
    // Remove any existing menu
    hideDamageMarkerMenu();
    
    // Get hex polygon to position menu
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const hexPolygon = hexPolygons[hexIndex];
    if (!hexPolygon) return;
    
    const bbox = hexPolygon.getBBox();
    const hexCenterX = bbox.x + bbox.width / 2;
    const hexCenterY = bbox.y + bbox.height / 2;
    
    // Create menu container group
    const menuGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    menuGroup.setAttribute('id', 'damage-marker-menu');
    menuGroup.setAttribute('data-menu-hex', hexIndex.toString());
    
    // Get viewBox dimensions
    const markerViewBox = GameData.markerSvg.getAttribute('viewBox');
    let markerWidth = 127.9;
    let markerHeight = 146.5;
    
    if (markerViewBox) {
        const viewBoxValues = markerViewBox.split(' ').map(v => parseFloat(v));
        markerWidth = viewBoxValues[2] || 127.9;
        markerHeight = viewBoxValues[3] || 146.5;
    }
    
    // Scale should be 1.5
    const menuScale = .15;
    
    // Clone the entire marker SVG
    const clonedSvg = GameData.markerSvg.cloneNode(true);
    
    // Change all stroke colors to yellow and text fills to yellow
    const allPaths = clonedSvg.querySelectorAll('path, polygon');
    allPaths.forEach(element => {
        // Set stroke to yellow
        const currentStroke = element.getAttribute('stroke');
        if (currentStroke) {
            element.setAttribute('stroke', '#ffff00'); // Yellow stroke
        } else {
            element.setAttribute('stroke', '#ffff00'); // Add yellow stroke if missing
        }
        // Change fill to yellow for text elements (white fills become yellow)
        const currentFill = element.getAttribute('fill');
        if (currentFill === '#fff' || currentFill === '#ffffff') {
            element.setAttribute('fill', '#ffff00'); // Yellow fill for text
        }
    });
    
    // Calculate marker center in its coordinate system (viewBox starts at 0,0)
    const markerCenterX = markerWidth / 2;
    const markerCenterY = markerHeight / 2;
    
    // Center the menu on the hex, with adjustments to move left and up
    // Adjustments: move left by 20% of scaled width, move up by 20% of scaled height
    const offsetX = markerWidth * menuScale;
    const offsetY = markerHeight * menuScale;
    
    const menuX = hexCenterX - (markerCenterX * menuScale) - offsetX - 80;
    const menuY = hexCenterY - (markerCenterY * menuScale) - offsetY - 48;
    
    // Set transform: translate to position, then scale
    menuGroup.setAttribute('transform', `translate(${menuX}, ${menuY}) scale(${menuScale})`);
    
    // Group ID map for click handling
    // Note: _x31_00 visually displays "10" (one-zero-zero) but should map to 100 for the marker
    const groupIdMap = {
        '_x31_': 1,
        '_x32_': 2,
        '_x33_': 3,
        '_x34_': 4,
        '_x35_': 5,
        '_x36_': 6,
        '_x37_': 7,
        '_x38_': 8,
        '_x39_': 9,
        '_x31_0': 10,
        '_x31_1': 11,
        '_x31_00': 100 // Maps to 100 (visually "10" but represents 100)
    };
    
    // Make each number group clickable
    // Process in reverse order to handle longer IDs first (e.g., _x31_1 before _x31_0)
    const sortedGroupIds = Object.keys(groupIdMap).sort((a, b) => b.length - a.length);
    
    sortedGroupIds.forEach(groupId => {
        const numberGroup = clonedSvg.querySelector(`g#${groupId}`);
        if (numberGroup) {
            numberGroup.style.cursor = 'pointer';
            const clickHandler = (e) => {
                e.stopPropagation();
                // Use currentTarget to get the group the listener is attached to
                // This ensures we get the correct group even if clicking on child elements
                const clickedGroup = e.currentTarget;
                if (clickedGroup && clickedGroup.id === groupId) {
                    const damage = groupIdMap[groupId];
                    selectDamageMarker(hexIndex, damage);
                    hideDamageMarkerMenu();
                }
            };
            addTouchAndClickHandler(numberGroup, clickHandler);
        }
    });
    
    // Append cloned SVG to menu group
    menuGroup.appendChild(clonedSvg);
    
    // Add to SVG
    svg.appendChild(menuGroup);
    
    // Add click handler to close menu when clicking outside (on hex covers)
    const closeHandler = (e) => {
        // Check if click is on a cover polygon (outside menu)
        if (e.target && e.target.hasAttribute('data-hex-cover')) {
            hideDamageMarkerMenu();
        }
    };
    
    // Listen for clicks and touches on covers to close menu
    setTimeout(() => {
        const covers = svg.querySelectorAll('polygon[data-hex-cover]');
        covers.forEach(cover => {
            addTouchAndClickHandler(cover, closeHandler);
        });
    }, 100);
}

// Hide damage marker menu
function hideDamageMarkerMenu() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const menu = svg.querySelector('g#damage-marker-menu');
    if (menu) {
        menu.remove();
    }
}

// Select a damage marker number
function selectDamageMarker(hexIndex, damage) {
    if (damage === 0) {
        // Remove marker
        removeDamageMarker(hexIndex);
        delete GameState.damageMarkers[hexIndex];
    } else {
        // Place/update marker - display as yellow text centered on hex
        GameState.damageMarkers[hexIndex] = damage;
        placeDamageMarkerText(hexIndex, damage);
    }
}

// Place a damage marker as yellow text on a hex
function placeDamageMarkerText(hexIndex, damage) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Remove existing marker if present
    removeDamageMarker(hexIndex);
    
    // Get hex polygon to center marker
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const hexPolygon = hexPolygons[hexIndex];
    if (!hexPolygon) return;
    
    const bbox = hexPolygon.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const topY = bbox.y + 80; // Top of hex (adjusted for larger hexes)
    
    // Create text element for the damage number
    const damageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    damageText.setAttribute('data-marker-hex', hexIndex.toString());
    damageText.setAttribute('data-marker-damage', damage.toString());
    damageText.setAttribute('x', centerX.toString());
    damageText.setAttribute('y', (topY - 12).toString()); // Slightly above the hex
    damageText.setAttribute('fill', '#00ffff'); // Cyan color
    damageText.setAttribute('font-size', '38');
    damageText.setAttribute('font-weight', 'bold');
    damageText.setAttribute('font-family', 'Arial, sans-serif');
    damageText.setAttribute('text-anchor', 'middle'); // Center align
    damageText.setAttribute('pointer-events', 'none'); // Don't block clicks
    // Ensure text is not clipped - use a wider bounding box if needed
    damageText.setAttribute('overflow', 'visible');
    damageText.textContent = damage.toString();
    
    // Append to SVG (after covers so it's visible on top)
    svg.appendChild(damageText);
}

// Remove damage marker from a hex
function removeDamageMarker(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Remove both group markers (old SVG-based) and text markers (new text-based)
    const markerGroup = svg.querySelector(`g[data-marker-hex="${hexIndex}"]`);
    if (markerGroup) {
        markerGroup.remove();
    }
    
    const markerText = svg.querySelector(`text[data-marker-hex="${hexIndex}"]`);
    if (markerText) {
        markerText.remove();
    }
}

// Show hex contents when revealed
function revealHexContents(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const cell = GameState.board[hexIndex];
    
    // Show images for this hex
    const images = svg.querySelectorAll(`image[data-hex-index="${hexIndex}"]`);
    images.forEach(img => {
        img.setAttribute('opacity', '1');
    });
    
    // Show damage text for this hex (if entity exists and has damage > 0)
    if (cell && cell.entity && cell.entity.damage > 0) {
        const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
        damageTexts.forEach(text => {
            // Only show damage text, not sum text or markers
            if (!text.hasAttribute('data-hex-sum-index') && !text.hasAttribute('data-marker-hex')) {
                text.setAttribute('opacity', '1');
            }
        });
    }
    
    // Update damage sum display for this hex when revealed
    // This ensures the damage sum is properly positioned and visible
    updateSingleHexDamageSum(svg, hexIndex);
    
    // Update cleared display if this hex is empty
    if (cell && !cell.entity && !cell.enemy) {
        updateDisplays();
    }
    
    // Make all revealed hexes transparent
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const hexPolygon = hexPolygons[hexIndex];
    if (hexPolygon) {
        hexPolygon.setAttribute('fill-opacity', '0');
        hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
    }
}

// Calculate and display the sum of damage from surrounding hexes
function addNeighborDamageSums(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    hexPolygons.forEach((hexPolygon, hexIndex) => {
        // Get neighbors of this hex
        const neighborIndices = getNeighborIndices(hexIndex);
        
        // Sum up damage from all neighbors
        let totalDamage = 0;
        neighborIndices.forEach(neighborIndex => {
            const neighborCell = GameState.board[neighborIndex];
            if (neighborCell && neighborCell.entity && neighborCell.entity.damage !== undefined) {
                totalDamage += neighborCell.entity.damage || 0;
            }
        });
        
        // Only show text if there's damage > 0 (don't show 0 for empty hexes)
        if (totalDamage > 0) {
            // Get bounding box of the hex
            const bbox = hexPolygon.getBBox();
            
            // Check if this hex is empty (no entity)
            const cell = GameState.board[hexIndex];
            const isEmpty = !cell || !cell.entity;
            
            // Create text element
            const damageSumText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            damageSumText.setAttribute('data-hex-sum-index', hexIndex.toString());
            
            if (isEmpty) {
                // Center the text for empty hexes
                // Check if this is the player's hex and adjust position
                const isPlayerHex = hexIndex === GameState.playerHexIndex;
                damageSumText.setAttribute('x', (bbox.x + bbox.width / 2).toString());
                // Move text up if it's the player's hex to avoid overlap
                const yOffset = isPlayerHex ? -12 : 12;
                damageSumText.setAttribute('y', (yOffset + bbox.y + bbox.height / 2).toString());
                damageSumText.setAttribute('text-anchor', 'middle'); // Center-align text
                damageSumText.setAttribute('font-size', '36'); // Scaled up for larger hexes
            } else {
                // Upper right corner for hexes with entities
                damageSumText.setAttribute('x', (bbox.x + bbox.width - 18).toString());
                damageSumText.setAttribute('y', (bbox.y + 35).toString());
                damageSumText.setAttribute('text-anchor', 'end'); // Right-align text
                damageSumText.setAttribute('font-size', '24');
            }
            
            damageSumText.setAttribute('fill', '#66ccff'); // Light blue color
            damageSumText.setAttribute('font-weight', 'bold');
            damageSumText.setAttribute('font-family', 'Arial, sans-serif');
            damageSumText.setAttribute('pointer-events', 'none'); // Don't block clicks
            damageSumText.textContent = totalDamage.toString();
            
            // Append text to SVG
            svg.appendChild(damageSumText);
        }
        
        // Make all revealed hexes transparent (will be set when revealed)
        // This is handled in revealHexContents function
    });
    
    console.log('Added neighbor damage sums to all hexes');
}

// Update neighbor damage sum for a specific hex and its neighbors
function updateNeighborDamageSums(clearedHexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Get all neighbors of the cleared hex
    const neighborIndices = getNeighborIndices(clearedHexIndex);
    
    // Also update the cleared hex itself (in case it becomes empty)
    const hexesToUpdate = [...neighborIndices, clearedHexIndex];
    
    hexesToUpdate.forEach(hexIndex => {
        updateSingleHexDamageSum(svg, hexIndex);
    });
}

// Update the damage sum display for a single hex
function updateSingleHexDamageSum(svg, hexIndex) {
    // Get neighbors of this hex
    const neighborIndices = getNeighborIndices(hexIndex);
    
    // Sum up damage from all neighbors
    let totalDamage = 0;
    neighborIndices.forEach(neighborIndex => {
        const neighborCell = GameState.board[neighborIndex];
        if (neighborCell && neighborCell.entity && neighborCell.entity.damage !== undefined) {
            totalDamage += neighborCell.entity.damage || 0;
        }
    });
    
    // Remove ALL existing sum texts for this hex (there might be duplicates)
    const existingSumTexts = svg.querySelectorAll(`text[data-hex-sum-index="${hexIndex}"]`);
    existingSumTexts.forEach(text => {
        text.remove();
    });
    
    // Only show text if there's damage to display (don't show 0 for empty hexes)
    const cell = GameState.board[hexIndex];
    const isEmpty = !cell || !cell.entity;
    
    // Don't show damage sum for revealed hexes that contain entities
    // Only show for: unrevealed hexes OR revealed empty hexes
    const shouldShowSum = totalDamage > 0 && (!cell || !cell.revealed || isEmpty);
    
    if (shouldShowSum) {
        const boardGroup = svg.querySelector('#board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
        const hexPolygon = hexPolygons[hexIndex];
        if (!hexPolygon) return;
        
        const bbox = hexPolygon.getBBox();
        
        // Create text element
        const damageSumText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        damageSumText.setAttribute('data-hex-sum-index', hexIndex.toString());
        
        if (isEmpty) {
            // Center the text for empty hexes
            // Check if this is the player's hex and adjust position
            const isPlayerHex = hexIndex === GameState.playerHexIndex;
            damageSumText.setAttribute('x', (bbox.x + bbox.width / 2).toString());
            // Move text up if it's the player's hex to avoid overlap
            const yOffset = isPlayerHex ? -12 : 12;
            damageSumText.setAttribute('y', (yOffset + bbox.y + bbox.height / 2).toString());
            damageSumText.setAttribute('text-anchor', 'middle'); // Center-align text
            damageSumText.setAttribute('font-size', '36');
        } else {
            // Upper right corner for hexes with entities (only shown when not revealed)
            damageSumText.setAttribute('x', (bbox.x + bbox.width - 18).toString());
            damageSumText.setAttribute('y', (bbox.y + 35).toString());
            damageSumText.setAttribute('text-anchor', 'end'); // Right-align text
            damageSumText.setAttribute('font-size', '24');
        }
        
        damageSumText.setAttribute('fill', '#66ccff'); // Light blue color
        damageSumText.setAttribute('font-weight', 'bold');
        damageSumText.setAttribute('font-family', 'Arial, sans-serif');
        damageSumText.setAttribute('pointer-events', 'none'); // Don't block clicks
        damageSumText.textContent = totalDamage.toString();
        
        // Show opacity based on reveal state
        // Revealed empty hexes: show (opacity 1)
        // Unrevealed hexes: hide (opacity 0) - will be shown when revealed if empty
        if (cell && cell.revealed && isEmpty) {
            damageSumText.setAttribute('opacity', '1');
        } else {
            damageSumText.setAttribute('opacity', '0');
        }
        
        // Append text to SVG
        svg.appendChild(damageSumText);
    }
    
    // Make all revealed hexes transparent
    if (cell && cell.revealed) {
        const boardGroup = svg.querySelector('#board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
        const hexPolygon = hexPolygons[hexIndex];
        if (hexPolygon) {
            hexPolygon.setAttribute('fill-opacity', '0');
            hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
        }
    }
}

// Set up click handlers for hex cells
function setupBoardInteractions(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    // Build coordinate map first
    buildHexCoordinateMap(svg);
    
    hexPolygons.forEach((polygon, index) => {
        polygon.dataset.hexIndex = index;
        polygon.dataset.revealed = 'false';
        addTouchAndClickHandler(polygon, handleHexClick);
        
        // Initialize board cell data
        GameState.board[index] = {
            revealed: false,
            enemy: null // Will be populated when board is set up
        };
    });
    
    console.log(`Game board loaded with ${hexPolygons.length} hex cells`);
    
    // Set up initial board placements
    setupBoardPlacements(svg);
}

// Handle clicking on a hex cell - now handles movement with queue
function handleHexClick(event) {
    if (!GameState.isAlive) {
        console.log('Game over - cannot interact');
        return;
    }
    
    const hex = event.target;
    const index = parseInt(hex.dataset.hexIndex);
    const cell = GameState.board[index];
    
    // Don't allow moving to the same hex
    if (index === GameState.playerHexIndex) {
        console.log('Already at this hex');
        return;
    }
    
    // Don't add duplicate destinations to queue
    const lastInQueue = GameState.movementQueue[GameState.movementQueue.length - 1];
    if (lastInQueue === index) {
        console.log('Hex already queued');
        return;
    }
    
    // Visual feedback - flash the hex
    applyHexClickEffect(index);
    
    // Add hex to movement queue
    GameState.movementQueue.push(index);
    console.log(`Added hex ${index} to movement queue. Queue length: ${GameState.movementQueue.length}`);
    
    // If not currently moving, start processing the queue
    if (!GameState.isMoving) {
        processMovementQueue();
    }
}

// Apply visual click feedback to a hex
function applyHexClickEffect(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Try to find the hex cover first (for unrevealed hexes)
    let targetHex = svg.querySelector(`polygon[data-hex-cover="${hexIndex}"]`);
    
    // If no cover, find the original hex polygon
    if (!targetHex) {
        const boardGroup = svg.querySelector('#board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
        targetHex = hexPolygons[hexIndex];
    }
    
    if (targetHex) {
        // Remove class first in case it's already animating
        targetHex.classList.remove('hex-clicked');
        
        // Force reflow to restart animation
        void targetHex.offsetWidth;
        
        // Add the click animation class
        targetHex.classList.add('hex-clicked');
        
        // Remove class after animation completes
        setTimeout(() => {
            targetHex.classList.remove('hex-clicked');
        }, 300);
    }
}

// Process the next movement in the queue
function processMovementQueue() {
    // Check if there are moves to process
    if (GameState.movementQueue.length === 0) {
        GameState.isMoving = false;
        return;
    }
    
    // Check if game is still active
    if (!GameState.isAlive) {
        GameState.movementQueue = [];
        GameState.isMoving = false;
        return;
    }
    
    // Get the next hex from the queue
    const nextHexIndex = GameState.movementQueue.shift();
    
    // Skip if it's the current position (player may have moved there already)
    if (nextHexIndex === GameState.playerHexIndex) {
        processMovementQueue();
        return;
    }
    
    // Start moving
    GameState.isMoving = true;
    movePlayerToHex(nextHexIndex);
}

// Move player to a hex
function movePlayerToHex(hexIndex) {
    const cell = GameState.board[hexIndex];
    if (!cell) return;
    
    // Move player sprite with animation
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Get the new hex polygon first (needed for transparency and position)
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const hexPolygon = hexPolygons[hexIndex];
    if (!hexPolygon) return;
    
    // Reveal hex if it's hidden and make it transparent immediately
    if (!cell.revealed) {
        cell.revealed = true;
        hexPolygon.dataset.revealed = 'true';
        // Make hex transparent immediately when clicked
        hexPolygon.setAttribute('fill-opacity', '0');
        hexPolygon.setAttribute('stroke-opacity', '0.3');
        removeHexCover(hexIndex);
        revealHexContents(hexIndex);
    } else {
        // Hex already revealed - ensure it's transparent
        hexPolygon.setAttribute('fill-opacity', '0');
        hexPolygon.setAttribute('stroke-opacity', '0.3');
    }
    
    // Store old player hex index before updating
    const oldPlayerHexIndex = GameState.playerHexIndex;
    
    // Get old player position BEFORE removing
    const oldPlayerImage = svg.querySelector('image[data-player="true"]');
    const oldPlayerGroup = svg.querySelector('g[data-player-group="true"]');
    const imageSize = 50;
    let startX, startY;
    
    if (oldPlayerImage) {
        // Extract current position from the group transform
        if (oldPlayerGroup) {
            const transformAttr = oldPlayerGroup.getAttribute('transform') || '';
            const translateMatch = transformAttr.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
            if (translateMatch) {
                // Group transform stores center position, convert to top-left
                startX = parseFloat(translateMatch[1]) - imageSize / 2;
                startY = parseFloat(translateMatch[2]) - imageSize / 2;
            } else {
                startX = parseFloat(oldPlayerImage.getAttribute('x')) || 0;
                startY = parseFloat(oldPlayerImage.getAttribute('y')) || 0;
            }
            // Remove old group (includes the image)
            oldPlayerGroup.remove();
        } else {
            // Legacy: image without group
            try {
                const pBbox = oldPlayerImage.getBBox();
                startX = pBbox.x;
                startY = pBbox.y;
            } catch (e) {
                startX = parseFloat(oldPlayerImage.getAttribute('x')) || 0;
                startY = parseFloat(oldPlayerImage.getAttribute('y')) || 0;
            }
            oldPlayerImage.remove();
        }
    } else {
        // No old player image - this is the first move, so start from the end position (no animation)
        const bbox = hexPolygon.getBBox();
        startX = bbox.x + bbox.width / 2 - imageSize / 2;
        startY = bbox.y + bbox.height / 2 - imageSize / 2 + 18;
    }
    
    const bbox = hexPolygon.getBBox();
    const endX = bbox.x + bbox.width / 2 - imageSize / 2;
    // Move player sprite down a little to avoid overlap with damage text
    const endY = bbox.y + bbox.height / 2 - imageSize / 2 + 18;
    
    // Calculate angle from start to end (center of sprite)
    const startCenterX = startX + imageSize / 2;
    const startCenterY = startY + imageSize / 2;
    const endCenterX = endX + imageSize / 2;
    const endCenterY = endY + imageSize / 2;
    const dx = endCenterX - startCenterX;
    const dy = endCenterY - startCenterY;
    // Angle in degrees: 0 = right, 90 = down. Offset by -90 so "up" is 0 degrees for the ship sprite
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    
    // Create a group to hold the player image (for rotation around center)
    const playerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    playerGroup.setAttribute('data-player-group', 'true');
    
    // Create player image at starting position
    const playerImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    playerImage.setAttribute('data-player', 'true');
    playerImage.setAttribute('data-hex-index', hexIndex.toString());
    playerImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player.png');
    // Position image centered at origin within the group
    playerImage.setAttribute('x', (-imageSize / 2).toString());
    playerImage.setAttribute('y', (-imageSize / 2).toString());
    playerImage.setAttribute('width', imageSize.toString());
    playerImage.setAttribute('height', imageSize.toString());
    playerImage.setAttribute('opacity', '1');
    playerImage.setAttribute('pointer-events', 'none');
    
    // Set the group transform to position at start and rotate toward destination
    playerGroup.setAttribute('transform', `translate(${startCenterX}, ${startCenterY}) rotate(${angleDeg})`);
    
    svg.appendChild(playerGroup);
    playerGroup.appendChild(playerImage);
    
    // Apply critical glow if shields are at 0
    if (GameState.shields <= 0) {
        playerImage.classList.add('shields-critical');
    }
    
    // Update player position immediately (for game state tracking)
    GameState.playerHexIndex = hexIndex;
    
    // Update damage sum for old player hex (to remove "up" positioning)
    if (oldPlayerHexIndex !== null && oldPlayerHexIndex !== undefined && oldPlayerHexIndex !== hexIndex) {
        updateSingleHexDamageSum(svg, oldPlayerHexIndex);
    }
    
    // Make the hex the player is on transparent (ensure it's set even if already revealed)
    hexPolygon.setAttribute('fill-opacity', '0');
    hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
    
    // Function to handle entity/combat after animation completes
    const handleEntityAfterAnimation = () => {
        // Handle entity in this hex (if present)
        if (cell.entity || cell.enemy) {
            const entity = cell.entity || cell.enemy;
            const attackValue = entity.damage || 0;
            
            if (attackValue > GameState.shields) {
                // Player dies - clear the movement queue
                GameState.movementQueue = [];
                GameState.isMoving = false;
                playerDeath(hexPolygon, entity);
                return; // Don't process more movements
            } else {
                // Player defeats enemy and clears the hex
                defeatEnemy(hexPolygon, entity, hexIndex);
                
                // Update neighbor damage sums for all neighbors of cleared hex
                updateNeighborDamageSums(hexIndex);
                
                // Update cleared display
                updateDisplays();
            }
        
            // Check for win condition after defeating enemy
            checkWinCondition();
        } else {
            // Empty hex - safe movement, mark as cleared/revealed
            hexPolygon.classList.add('cleared');
            console.log('Moved to empty hex');
            
            // Update neighbor damage sums (in case this hex had an entity before)
            updateNeighborDamageSums(hexIndex);
            
            // Update cleared display
            updateDisplays();
        }
        
        // Process next movement in queue
        processMovementQueue();
    };
    
    // Warp animation parameters
    const animDuration = 1200; // ms
    const hasAnimation = !!oldPlayerImage;
    
    if (hasAnimation) {
        // Create warp trail elements
        const warpTrails = [];
        const numTrails = 5;
        for (let i = 0; i < numTrails; i++) {
            const trail = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            trail.setAttribute('class', 'warp-trail');
            trail.setAttribute('cx', startCenterX.toString());
            trail.setAttribute('cy', startCenterY.toString());
            trail.setAttribute('rx', '2');
            trail.setAttribute('ry', '2');
            trail.setAttribute('fill', 'none');
            trail.setAttribute('stroke', '#00d4ff');
            trail.setAttribute('stroke-width', '1.5');
            trail.setAttribute('opacity', '0');
            trail.setAttribute('pointer-events', 'none');
            svg.insertBefore(trail, playerGroup);
            warpTrails.push(trail);
        }
        
        // Easing function: ease-in-out cubic
        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        
        const startTime = performance.now();
        let entityHandled = false;
        
        function animateWarp(currentTime) {
            const elapsed = currentTime - startTime;
            const rawProgress = Math.min(elapsed / animDuration, 1);
            const progress = easeInOutCubic(rawProgress);
            
            // Interpolate position
            const currentX = startCenterX + (endCenterX - startCenterX) * progress;
            const currentY = startCenterY + (endCenterY - startCenterY) * progress;
            
            // Calculate speed for warp effect (derivative of easing)
            const speed = rawProgress < 0.5
                ? 12 * rawProgress * rawProgress
                : 12 * (1 - rawProgress) * (1 - rawProgress);
            
            // Scale stretch based on speed (elongate in direction of travel)
            const stretchX = 1 + speed * 0.15;
            const stretchY = 1 / Math.sqrt(stretchX); // Compensate to keep area roughly equal
            
            // Update player group transform with position, rotation, and stretch
            playerGroup.setAttribute('transform',
                `translate(${currentX}, ${currentY}) rotate(${angleDeg}) scale(${stretchY}, ${stretchX})`
            );
            
            // Update warp trails - stretched ellipses trailing behind the ship
            warpTrails.forEach((trail, i) => {
                const trailDelay = (i + 1) * 0.06;
                const trailProgress = Math.max(0, Math.min(1, easeInOutCubic(Math.max(0, rawProgress - trailDelay))));
                const trailX = startCenterX + (endCenterX - startCenterX) * trailProgress;
                const trailY = startCenterY + (endCenterY - startCenterY) * trailProgress;
                
                // Trail opacity peaks in the middle of the journey
                const trailOpacity = speed * 0.5 * (1 - (i / numTrails) * 0.6);
                
                // Stretch trail ellipses along travel direction
                const trailStretch = 2 + speed * 8;
                
                trail.setAttribute('cx', trailX.toString());
                trail.setAttribute('cy', trailY.toString());
                // Rotate ellipse to align with travel direction
                trail.setAttribute('transform', `rotate(${angleDeg}, ${trailX}, ${trailY})`);
                trail.setAttribute('rx', (3 - i * 0.3).toString());
                trail.setAttribute('ry', trailStretch.toString());
                trail.setAttribute('opacity', Math.max(0, trailOpacity).toFixed(3));
                trail.setAttribute('stroke-opacity', Math.max(0, trailOpacity).toFixed(3));
            });
            
            if (rawProgress < 1) {
                requestAnimationFrame(animateWarp);
            } else {
                // Animation complete - clean up warp trails
                warpTrails.forEach(trail => trail.remove());
                
                // Reset scale and set final position without stretch
                playerGroup.setAttribute('transform',
                    `translate(${endCenterX}, ${endCenterY}) rotate(0)`
                );
                
                // Handle entity
                if (!entityHandled) {
                    entityHandled = true;
                    handleEntityAfterAnimation();
                }
            }
        }
        
        requestAnimationFrame(animateWarp);
    } else {
        // No animation (first move) - set position and handle entity immediately
        playerGroup.setAttribute('transform', `translate(${endCenterX}, ${endCenterY}) rotate(0)`);
        handleEntityAfterAnimation();
    }
}

// Check if player has won (cleared all hexes with entities)
function checkWinCondition() {
    const clearedCount = GameState.clearedHexes.size;
    const totalEntities = GameState.totalHexesWithEntities;
    
    console.log(`Win check: cleared ${clearedCount} of ${totalEntities} entities`);
    
    // Only win when we've cleared exactly all entities (not >= to prevent early wins)
    if (clearedCount === totalEntities && totalEntities > 0) {
        console.log('Sector cleared! All entities defeated.');
        showWinScreen();
    }
}

// Show win screen
function showWinScreen() {
    // Calculate cleared percentage
    let clearedCount = 0;
    let clearedPercent = 0;
    if (GameState.totalHexes > 0) {
        for (let i = 0; i < GameState.board.length; i++) {
            const cell = GameState.board[i];
            if (cell && cell.revealed && (!cell.entity && !cell.enemy)) {
                clearedCount++;
            }
        }
        clearedPercent = Math.round((clearedCount / GameState.totalHexes) * 100);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-content">
            <h2>SECTOR CLEARED!</h2>
            <p>You have successfully cleared all enemies from the sector.</p>
            <p>Parts collected: ${GameState.parts}</p>
            <p>Final shields: ${GameState.shields}/${GameState.maxShields}</p>
            <p>Sector cleared: ${clearedPercent}%</p>
            <button onclick="location.reload()">Play Again</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Player defeats an enemy
function defeatEnemy(hex, enemy, hexIndex) {
    const attackValue = enemy.damage || 0;
    
    // Subtract attack from shields
    GameState.shields -= attackValue;
    
    // Add shield bonus as shield surges to inventory if present
    if (enemy.shield_bonus !== undefined && enemy.shield_bonus > 0) {
        GameState.shieldSurgeCount += enemy.shield_bonus;
        console.log(`Shield bonus: +${enemy.shield_bonus} shield surge(s) added to inventory. Total: ${GameState.shieldSurgeCount}`);
    }
    
    // Scavenge parts - use part_bonus if present, otherwise use attack value
    const partsAwarded = (enemy.part_bonus !== undefined && enemy.part_bonus > 0) ? enemy.part_bonus : attackValue;
    GameState.parts += partsAwarded;
    
    console.log(`Enemy defeated! Lost ${attackValue} shields, gained ${partsAwarded} parts`);
    
    // Check for ALERT_TEXT and show leader alert if present
    if (enemy.alert_text && enemy.alert_text.trim() !== '') {
        console.log('Entity has alert_text:', enemy.alert_text);
        showLeaderAlert(enemy.alert_text);
    }
    
    // Check if E11 (Local Warlord) was defeated
    if (enemy.id === 'E11') {
        console.log('E11 (Local Warlord) defeated! Revealing E10 (Command Core) location');
        revealAllE10();
    }
    
    // Check if E10 (Command Core) was defeated
    if (enemy.id === 'E10') {
        console.log('E10 (Command Core) defeated! Deactivating all E15 (Extinction Engine) entities');
        deactivateAllE15();
    }
    
    // Check if E16 (Trader Ship) was defeated
    if (enemy.id === 'E16') {
        console.log('E16 (Trader Ship) defeated! Revealing all E05 and E08 ships');
        revealAllE05AndE08();
    }
    
    // Check if E14 (Merc Ship) was defeated
    if (enemy.id === 'E14') {
        console.log('E14 (Merc Ship) defeated! Revealing all E01 ships');
        revealAllE01();
    }
    
    // Check if B03 (Shield Surge) was captured
    if (enemy.id === 'B03' && enemy.shield_surge === 1) {
        GameState.shieldSurgeCount++;
        console.log(`B03 (Shield Surge) captured! Shield surge count: ${GameState.shieldSurgeCount}`);
    }
    
    // Check if E09 (Harbinger Class Ship) was defeated
    if (enemy.id === 'E09') {
        GameState.shieldSurgeCount++;
        console.log(`E09 (Harbinger Class Ship) defeated! Shield surge gained. Shield surge count: ${GameState.shieldSurgeCount}`);
    }
    
    // Mark hex as cleared
    GameState.clearedHexes.add(hexIndex);
    
    // Remove entity from hex
    const cell = GameState.board[hexIndex];
    if (cell) {
        cell.entity = null;
        cell.enemy = null;
    }
    
    // Remove entity sprite and damage text
    const svg = boardContainer.querySelector('svg');
    if (svg) {
        const images = svg.querySelectorAll(`image[data-hex-index="${hexIndex}"]`);
        images.forEach(img => {
            if (!img.hasAttribute('data-player')) {
                img.remove();
            }
        });
        
        const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
        damageTexts.forEach(text => {
            text.remove();
        });
    }
    
    // Visual feedback
    hex.classList.add('defeated');
    
    // Update damage sums for this hex and its neighbors
    // This is important because clearing an entity changes whether the hex is empty,
    // which affects the positioning of the damage sum text
    updateNeighborDamageSums(hexIndex);
    
    updateDisplays();
}

// Shake all hexes and their contents
function shakeAllHexes() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    // Shake all hex polygons
    hexPolygons.forEach((hexPolygon, hexIndex) => {
        // Remove any existing shake class
        hexPolygon.classList.remove('hex-shake');
        
        // Force reflow to restart animation
        void hexPolygon.offsetWidth;
        
        // Add shake class
        hexPolygon.classList.add('hex-shake');
        
        // Remove class after animation completes
        setTimeout(() => {
            hexPolygon.classList.remove('hex-shake');
        }, 500);
    });
    
    // Shake all images (entities and player)
    const allImages = svg.querySelectorAll('image');
    allImages.forEach(img => {
        img.classList.remove('hex-shake');
        void img.offsetWidth;
        img.classList.add('hex-shake');
        setTimeout(() => {
            img.classList.remove('hex-shake');
        }, 500);
    });
    
    // Shake all text elements (damage numbers, sums, markers)
    const allTexts = svg.querySelectorAll('text');
    allTexts.forEach(text => {
        text.classList.remove('hex-shake');
        void text.offsetWidth;
        text.classList.add('hex-shake');
        setTimeout(() => {
            text.classList.remove('hex-shake');
        }, 500);
    });
    
    // Shake hex covers
    const hexCovers = svg.querySelectorAll('polygon.hex-cover');
    hexCovers.forEach(cover => {
        cover.classList.remove('hex-shake');
        void cover.offsetWidth;
        cover.classList.add('hex-shake');
        setTimeout(() => {
            cover.classList.remove('hex-shake');
        }, 500);
    });
}

// Deactivate all E15 (Extinction Engine) entities on the board
function deactivateAllE15() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Trigger hex shake instead of screen shake
    shakeAllHexes();
    
    // Find all E15 entities on the board
    let e15Count = 0;
    for (let hexIndex = 0; hexIndex < GameState.board.length; hexIndex++) {
        const cell = GameState.board[hexIndex];
        if (cell && cell.entity && cell.entity.id === 'E15') {
            // Deactivate E15: set damage to 0 and part_bonus to 3
            cell.entity.damage = 0;
            cell.entity.part_bonus = 3;
            e15Count++;
            
            // Update visual damage text (only for revealed hexes)
            // Remove damage text since damage is now 0
            if (cell.revealed) {
                const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
                damageTexts.forEach(text => {
                    // Check if this is a damage text (not a sum text or marker)
                    if (!text.hasAttribute('data-hex-sum-index') && !text.hasAttribute('data-marker-hex')) {
                        text.remove(); // Remove damage text when damage is 0
                    }
                });
            } else {
                // For unrevealed hexes, remove damage text if it exists
                const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
                damageTexts.forEach(text => {
                    if (!text.hasAttribute('data-hex-sum-index') && !text.hasAttribute('data-marker-hex')) {
                        text.remove(); // Remove damage text when damage is 0
                    }
                });
            }
        }
    }
    
    console.log(`Deactivated ${e15Count} E15 entities`);
    
    // Recalculate all damage sums for all hexes
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    hexPolygons.forEach((hexPolygon, hexIndex) => {
        updateSingleHexDamageSum(svg, hexIndex);
    });
    
    console.log('Recalculated all damage sums after E15 deactivation');
}

// Reveal all E10 (Command Core) entities
function revealAllE10() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    let e10Count = 0;
    
    // Find all E10 entities on the board
    for (let hexIndex = 0; hexIndex < GameState.board.length; hexIndex++) {
        const cell = GameState.board[hexIndex];
        if (cell && cell.entity && cell.entity.id === 'E10') {
            // Skip if already revealed
            if (cell.revealed) {
                continue;
            }
            
            // Mark as revealed
            cell.revealed = true;
            
            // Update polygon data attribute
            const hexPolygon = hexPolygons[hexIndex];
            if (hexPolygon) {
                hexPolygon.dataset.revealed = 'true';
            }
            
            // Remove cover and show contents
            removeHexCover(hexIndex);
            revealHexContents(hexIndex);
            
            // Count revealed entities
            e10Count++;
        }
    }
    
    console.log(`Revealed ${e10Count} E10 (Command Core) entities`);
}

// Reveal all E05 (Bulwark Class Ship) and E08 (Obliterator Class Ship) entities
function revealAllE05AndE08() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    let e05Count = 0;
    let e08Count = 0;
    
    // Find all E05 and E08 entities on the board
    for (let hexIndex = 0; hexIndex < GameState.board.length; hexIndex++) {
        const cell = GameState.board[hexIndex];
        if (cell && cell.entity && (cell.entity.id === 'E05' || cell.entity.id === 'E08')) {
            // Skip if already revealed
            if (cell.revealed) {
                continue;
            }
            
            // Mark as revealed
            cell.revealed = true;
            
            // Update polygon data attribute
            const hexPolygon = hexPolygons[hexIndex];
            if (hexPolygon) {
                hexPolygon.dataset.revealed = 'true';
            }
            
            // Remove cover and show contents
            removeHexCover(hexIndex);
            revealHexContents(hexIndex);
            
            // Count revealed entities
            if (cell.entity.id === 'E05') {
                e05Count++;
            } else if (cell.entity.id === 'E08') {
                e08Count++;
            }
        }
    }
    
    console.log(`Revealed ${e05Count} E05 (Bulwark Class Ship) and ${e08Count} E08 (Obliterator Class Ship) entities`);
}

// Reveal all E01 (Skirmisher Class Ship) entities
function revealAllE01() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    
    let e01Count = 0;
    
    // Find all E01 entities on the board
    for (let hexIndex = 0; hexIndex < GameState.board.length; hexIndex++) {
        const cell = GameState.board[hexIndex];
        if (cell && cell.entity && cell.entity.id === 'E01') {
            // Skip if already revealed
            if (cell.revealed) {
                continue;
            }
            
            // Mark as revealed
            cell.revealed = true;
            
            // Update polygon data attribute
            const hexPolygon = hexPolygons[hexIndex];
            if (hexPolygon) {
                hexPolygon.dataset.revealed = 'true';
            }
            
            // Remove cover and show contents
            removeHexCover(hexIndex);
            revealHexContents(hexIndex);
            
            // Count revealed entities
            e01Count++;
        }
    }
    
    console.log(`Revealed ${e01Count} E01 (Skirmisher Class Ship) entities`);
}

// Player death
function playerDeath(hex, enemy) {
    const attackValue = enemy.damage || 0;
    GameState.isAlive = false;
    GameState.shields = 0;
    
    console.log(`GAME OVER! Enemy attack (${attackValue}) exceeded shields`);
    
    // Visual feedback
    hex.classList.add('death');
    
    updateDisplays();
    
    // Show game over message
    showGameOver();
}

// Reveal an empty cell
function revealEmptyCell(hex) {
    console.log('Empty cell - safe!');
    hex.classList.add('cleared');
}

// Show game over screen
function showGameOver() {
    // Calculate cleared percentage
    let clearedCount = 0;
    let clearedPercent = 0;
    if (GameState.totalHexes > 0) {
        for (let i = 0; i < GameState.board.length; i++) {
            const cell = GameState.board[i];
            if (cell && cell.revealed && (!cell.entity && !cell.enemy)) {
                clearedCount++;
            }
        }
        clearedPercent = Math.round((clearedCount / GameState.totalHexes) * 100);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-content">
            <h2>SHIP DESTROYED</h2>
            <p>Your shields were overwhelmed by enemy fire.</p>
            <p>Parts salvaged: ${GameState.parts}</p>
            <p>Sector cleared: ${clearedPercent}%</p>
            <button onclick="location.reload()">Try Again</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Update shield surge icons in the shield display
function updateShieldSurgeIcons() {
    const shieldsPanel = document.querySelector('.status-item.shields');
    if (!shieldsPanel) return;
    
    // Remove existing shield surge container
    const existingContainer = shieldsPanel.querySelector('.shield-surge-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Only create container if there are shield surges
    if (GameState.shieldSurgeCount > 0) {
        // Create container for shield surge icon
        const surgeContainer = document.createElement('div');
        surgeContainer.className = 'shield-surge-container';
        surgeContainer.style.display = 'flex';
        surgeContainer.style.gap = '4px';
        surgeContainer.style.marginLeft = '8px';
        surgeContainer.style.alignItems = 'center';
        
        // Create single shield surge icon
        const surgeIcon = document.createElement('div');
        surgeIcon.className = 'shield-surge-icon';
        surgeIcon.style.width = '20px';
        surgeIcon.style.height = '20px';
        surgeIcon.style.cursor = 'pointer';
        surgeIcon.style.opacity = '1';
        surgeIcon.style.transition = 'opacity 0.2s ease';
        surgeIcon.title = 'Click to use shield surge (maxes out shields)';
        
        // Create filled shield SVG icon
        const shieldSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        shieldSvg.setAttribute('viewBox', '0 0 24 24');
        shieldSvg.setAttribute('width', '20');
        shieldSvg.setAttribute('height', '20');
        shieldSvg.style.display = 'block';
        
        // Filled shield path
        const shieldPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shieldPath.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
        shieldPath.setAttribute('fill', '#00d4ff');
        shieldPath.setAttribute('stroke', '#00d4ff');
        shieldPath.setAttribute('stroke-width', '1');
        shieldSvg.appendChild(shieldPath);
        
        surgeIcon.appendChild(shieldSvg);
        
        // Add click and touch handler
        const surgeClickHandler = (e) => {
            e.stopPropagation(); // Prevent triggering shield recharge
            useShieldSurge(0);
        };
        addTouchAndClickHandler(surgeIcon, surgeClickHandler);
        
        // Add hover effect (mouse)
        surgeIcon.addEventListener('mouseenter', () => {
            surgeIcon.style.opacity = '0.7';
        });
        surgeIcon.addEventListener('mouseleave', () => {
            surgeIcon.style.opacity = '1';
        });
        
        // Add touch hover effect
        surgeIcon.addEventListener('touchstart', () => {
            surgeIcon.style.opacity = '0.7';
        }, { passive: true });
        surgeIcon.addEventListener('touchend', () => {
            surgeIcon.style.opacity = '1';
        }, { passive: true });
        
        surgeContainer.appendChild(surgeIcon);
        
        // Add count text if more than 1
        if (GameState.shieldSurgeCount > 1) {
            const countText = document.createElement('span');
            countText.className = 'shield-surge-count';
            countText.textContent = `x ${GameState.shieldSurgeCount}`;
            countText.style.color = '#00d4ff';
            countText.style.fontFamily = 'Orbitron, sans-serif';
            countText.style.fontSize = '0.875rem';
            countText.style.fontWeight = '600';
            countText.style.marginLeft = '2px';
            countText.style.userSelect = 'none';
            surgeContainer.appendChild(countText);
        }
        
        // Insert after status-info
        const statusInfo = shieldsPanel.querySelector('.status-info');
        if (statusInfo) {
            statusInfo.parentNode.insertBefore(surgeContainer, statusInfo.nextSibling);
        } else {
            shieldsPanel.appendChild(surgeContainer);
        }
    }
}

// Use a shield surge to max out shields
function useShieldSurge(index) {
    if (!GameState.isAlive) {
        console.log('Game over - cannot use shield surge');
        return;
    }
    
    if (GameState.shieldSurgeCount <= 0) {
        console.log('No shield surges available');
        return;
    }
    
    // Max out shields
    GameState.shields = GameState.maxShields;
    
    // Remove one shield surge
    GameState.shieldSurgeCount--;
    
    console.log(`Shield surge used! Shields maxed to ${GameState.shields}/${GameState.maxShields}. Remaining surges: ${GameState.shieldSurgeCount}`);
    
    // Update displays
    updateDisplays();
}

// Update the UI displays
function updateDisplays() {
    shieldsDisplay.textContent = `${GameState.shields}/${GameState.maxShields}`;
    
    // Update shield surge icons
    updateShieldSurgeIcons();
    
    // Display parts as "current/needed" format
    const partsNeeded = getPartsNeededForRecharge();
    partsDisplay.textContent = `${GameState.parts}/${partsNeeded}`;
    
    // Calculate cleared hexes percentage
    // Cleared hexes = revealed hexes that are empty (no entity)
    let clearedCount = 0;
    if (GameState.totalHexes > 0) {
        for (let i = 0; i < GameState.board.length; i++) {
            const cell = GameState.board[i];
            if (cell && cell.revealed && (!cell.entity && !cell.enemy)) {
                clearedCount++;
            }
        }
        const clearedPercent = Math.round((clearedCount / GameState.totalHexes) * 100);
        if (clearedDisplay) {
            clearedDisplay.textContent = `${clearedPercent}%`;
        }
    } else if (clearedDisplay) {
        clearedDisplay.textContent = '0%';
    }
    
    // Update shield display color based on health
    const shieldPercent = GameState.shields / GameState.maxShields;
    const playerSprite = document.querySelector('image[data-player="true"]');
    const shieldsPanel = document.querySelector('.status-item.shields');
    
    if (GameState.shields <= 0) {
        // Shields at 0 - add critical glow around player sprite and shields panel
        shieldsDisplay.classList.add('critical');
        shieldsDisplay.classList.remove('warning');
        if (playerSprite) {
            playerSprite.classList.add('shields-critical');
        }
        if (shieldsPanel) {
            shieldsPanel.classList.add('shields-critical');
        }
    } else if (shieldPercent <= 0.2) {
        shieldsDisplay.classList.add('critical');
        shieldsDisplay.classList.remove('warning');
        if (playerSprite) {
            playerSprite.classList.remove('shields-critical');
        }
        if (shieldsPanel) {
            shieldsPanel.classList.remove('shields-critical');
        }
    } else if (shieldPercent <= 0.5) {
        shieldsDisplay.classList.add('warning');
        shieldsDisplay.classList.remove('critical');
        if (playerSprite) {
            playerSprite.classList.remove('shields-critical');
        }
        if (shieldsPanel) {
            shieldsPanel.classList.remove('shields-critical');
        }
    } else {
        shieldsDisplay.classList.remove('warning', 'critical');
        if (playerSprite) {
            playerSprite.classList.remove('shields-critical');
        }
        if (shieldsPanel) {
            shieldsPanel.classList.remove('shields-critical');
        }
    }
    
    // Update recharge availability indicator
    if (GameState.parts >= partsNeeded) {
        shieldsDisplay.classList.add('repair-available');
    } else {
        shieldsDisplay.classList.remove('repair-available');
    }
}

// Calculate parts needed for next recharge based on recharge count
function getPartsNeededForRecharge() {
    const rechargeCount = GameState.repairCount;
    
    // Pattern mapping: rechargeCount -> parts needed
    // Based on user's pattern: 4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,25,25,25,25,25
    const partsNeededPattern = [
        4,  // rechargeCount 0: need 4 parts
        5,  // rechargeCount 1: need 5 parts
        6,  // rechargeCount 2: need 6 parts
        7,  // rechargeCount 3: need 7 parts
        8,  // rechargeCount 4: need 8 parts
        9,  // rechargeCount 5: need 9 parts
        10, // rechargeCount 6: need 10 parts
        11, // rechargeCount 7: need 11 parts
        12, // rechargeCount 8: need 12 parts
        13, // rechargeCount 9: need 13 parts
        14, // rechargeCount 10: need 14 parts
        15, // rechargeCount 11: need 15 parts
        16, // rechargeCount 12: need 16 parts
        17, // rechargeCount 13: need 17 parts
        18, // rechargeCount 14: need 18 parts
        19, // rechargeCount 15: need 19 parts
        20, // rechargeCount 16: need 20 parts
        21, // rechargeCount 17: need 21 parts
        22, // rechargeCount 18: need 22 parts
        23, // rechargeCount 19: need 23 parts
        24, // rechargeCount 20: need 24 parts
        25, // rechargeCount 21: need 25 parts
        25, // rechargeCount 22: need 25 parts (capped)
        25, // rechargeCount 23: need 25 parts (capped)
        25, // rechargeCount 24: need 25 parts (capped)
        25, // rechargeCount 25: need 25 parts (capped)
        25, // rechargeCount 26: need 25 parts (capped)
    ];
    
    if (rechargeCount < partsNeededPattern.length) {
        return partsNeededPattern[rechargeCount];
    } else {
        return 25; // Cap at 25 parts for rechargeCount 27+
    }
}

// Get the shield level after next recharge
// The pattern shows: [shield level after recharge, parts needed]
function getShieldLevelAfterRecharge() {
    const rechargeCount = GameState.repairCount;
    
    // Pattern mapping: rechargeCount -> shield level after recharge
    // Based on user's pattern: 5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,12,12,12,12,12,12,12
    const shieldLevelPattern = [
        5,  // rechargeCount 0 -> 5 shields (after 1st recharge)
        5,  // rechargeCount 1 -> 5 shields (after 2nd recharge)
        6,  // rechargeCount 2 -> 6 shields (after 3rd recharge)
        6,  // rechargeCount 3 -> 6 shields (after 4th recharge)
        6,  // rechargeCount 4 -> 6 shields (after 5th recharge)
        7,  // rechargeCount 5 -> 7 shields (after 6th recharge)
        7,  // rechargeCount 6 -> 7 shields (after 7th recharge)
        7,  // rechargeCount 7 -> 7 shields (after 8th recharge)
        8,  // rechargeCount 8 -> 8 shields (after 9th recharge)
        8,  // rechargeCount 9 -> 8 shields (after 10th recharge)
        8,  // rechargeCount 10 -> 8 shields (after 11th recharge)
        9,  // rechargeCount 11 -> 9 shields (after 12th recharge)
        9,  // rechargeCount 12 -> 9 shields (after 13th recharge)
        9,  // rechargeCount 13 -> 9 shields (after 14th recharge)
        10, // rechargeCount 14 -> 10 shields (after 15th recharge)
        10, // rechargeCount 15 -> 10 shields (after 16th recharge)
        10, // rechargeCount 16 -> 10 shields (after 17th recharge)
        11, // rechargeCount 17 -> 11 shields (after 18th recharge)
        11, // rechargeCount 18 -> 11 shields (after 19th recharge)
        11, // rechargeCount 19 -> 11 shields (after 20th recharge)
        12, // rechargeCount 20 -> 12 shields (after 21st recharge)
        12, // rechargeCount 21 -> 12 shields (after 22nd recharge)
        12, // rechargeCount 22 -> 12 shields (after 23rd recharge)
        12, // rechargeCount 23 -> 12 shields (after 24th recharge)
        12, // rechargeCount 24 -> 12 shields (after 25th recharge)
        12, // rechargeCount 25 -> 12 shields (after 26th recharge)
        12, // rechargeCount 26 -> 12 shields (after 27th recharge)
    ];
    
    if (rechargeCount < shieldLevelPattern.length) {
        return shieldLevelPattern[rechargeCount];
    } else {
        return 12; // Cap at 12 shields for rechargeCount 27+
    }
}

// Recharge shields (increase by 1)
function rechargeShields() {
    if (!GameState.isAlive) {
        console.log('Game over - cannot recharge');
        return;
    }
    
    const partsNeeded = getPartsNeededForRecharge();
    
    // Check if player has enough parts
    if (GameState.parts < partsNeeded) {
        console.log(`Not enough parts to recharge. Need ${partsNeeded}, have ${GameState.parts}`);
        return;
    }
    
    // Calculate new shield level BEFORE incrementing recharge count
    // Both lookups must use the same repairCount index
    const newShieldLevel = getShieldLevelAfterRecharge();
    
    // Deduct parts
    GameState.parts -= partsNeeded;
    
    // Increment recharge count (after both lookups)
    GameState.repairCount++;
    
    // Set shields to new level (recharge always sets to the new level)
    GameState.shields = newShieldLevel;
    GameState.maxShields = newShieldLevel;
    
    console.log(`Shields recharged to ${GameState.shields}/${GameState.maxShields}. Cost: ${partsNeeded} parts. Remaining parts: ${GameState.parts}`);
    
    // Update displays
    updateDisplays();
}

// Utility functions for game state
function modifyShields(amount) {
    GameState.shields = Math.max(0, Math.min(GameState.maxShields, GameState.shields + amount));
    updateDisplays();
}

function modifyParts(amount) {
    GameState.parts = Math.max(0, GameState.parts + amount);
    updateDisplays();
}

function upgradeMaxShields(amount) {
    GameState.maxShields += amount;
    updateDisplays();
}


// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', init);
