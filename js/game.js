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
    repairCount: 0, // Track number of repairs for upgrade system
    damageMarkers: {} // Track damage markers: hexIndex -> damage number
};

// Game data loaded from CSV
const GameData = {
    entities: [], // Array of entity objects parsed from CSV
    images: {}, // Cache of loaded images by sprite name
    markerSvg: null // Cached right-click marker SVG
};

// DOM Elements
const shieldsDisplay = document.getElementById('shields-value');
const partsDisplay = document.getElementById('parts-value');
const boardContainer = document.getElementById('board-container');

// Initialize the game
async function init() {
    try {
        await loadCSVData();
        await preloadImages();
        await loadMarkerSVG();
        await loadGameBoard();
        setupShieldRepair();
        updateDisplays();
        console.log('Game initialized successfully');
        console.log(`Loaded ${GameData.entities.length} entities from CSV`);
    } catch (error) {
        console.error('Error initializing game:', error);
        boardContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center;">Error loading game data</p>';
    }
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

// Set up shield repair click handler
function setupShieldRepair() {
    if (!shieldsDisplay) return;
    
    shieldsDisplay.addEventListener('click', repairShields);
    shieldsDisplay.style.cursor = 'pointer';
    shieldsDisplay.title = 'Click to repair shields (costs max shields in parts)';
}

// Parse CSV text into array of objects
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse data rows
    const entities = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.split(',').every(cell => !cell.trim())) continue; // Skip empty rows
        
        const values = line.split(',').map(v => v.trim());
        if (values.length < headers.length) continue; // Skip incomplete rows
        
        // Create entity object
        const entity = {};
        
        // First column is the ID (no header name)
        if (values[0]) {
            entity.id = values[0];
        }
        
        // Map remaining columns to headers (skip first empty header)
        headers.forEach((header, index) => {
            if (index === 0) return; // Skip first empty header column
            const value = values[index] || '';
            // Convert numeric fields
            if (['DAMAGE', 'COUNT', 'SHIELD_BONUS', 'PART_BONUS', 'SHIELD_SURGE'].includes(header)) {
                entity[header.toLowerCase()] = value ? parseInt(value, 10) : 0;
            } else {
                entity[header.toLowerCase()] = value;
            }
        });
        
        // Only add entities with a valid ID and sprite
        if (entity.id && entity.sprite_name) {
            entities.push(entity);
        }
    }
    
    return entities;
}

// Load CSV data file
async function loadCSVData() {
    try {
        const response = await fetch('data/sector_data.csv');
        if (!response.ok) {
            throw new Error(`Failed to load CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        GameData.entities = parseCSV(csvText);
        console.log('CSV data loaded:', GameData.entities);
    } catch (error) {
        console.error('Error loading CSV data:', error);
        throw error;
    }
}

// Preload all images referenced in the CSV
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
            
            setupBoardInteractions(svg);
        }
    } catch (error) {
        console.error('Error loading game board:', error);
        boardContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center;">Error loading game board</p>';
    }
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
        
        // Hex width is approximately 83 pixels (41.6 * 2), so neighbors should be around 80-90 pixels away
        if (distance < 100) {
            distances.push({ index, distance });
        }
    });
    
    // Sort by distance and take the 6 closest (hexes have 6 neighbors)
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, 6).map(d => d.index);
}

// Find entity by ID in CSV data
function findEntityById(entityId) {
    return GameData.entities.find(entity => {
        // Check if the first column (ID) matches
        // The CSV parser should have stored this, but let's check the raw data
        // Actually, looking at the CSV, the first column is the ID (E01, E11, etc.)
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
            
            // Center the image on the hex
            const imageSize = 40;
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
            
            // Add damage text if entity has damage
            if (entity.damage !== undefined && entity.damage !== null) {
                const damageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                damageText.setAttribute('data-hex-index', hexIndex.toString());
                damageText.setAttribute('x', (imageX - 8).toString()); // Lower left of sprite (more offset)
                damageText.setAttribute('y', (imageY + imageSize + 8).toString());
                damageText.setAttribute('fill', '#ff0000'); // Red color
                damageText.setAttribute('font-size', '24');
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
    const e11 = GameData.entities.find(e => e.id === 'E11');
    if (!e11) {
        console.warn('E11 (Local Warlord) not found in CSV data');
        console.log('Available entities:', GameData.entities.map(e => e.id));
        return;
    }
    
    // Find E12 (Dominion Fighter Ship) by ID
    const e12 = GameData.entities.find(e => e.id === 'E12');
    if (!e12) {
        console.warn('E12 (Dominion Fighter Ship) not found in CSV data');
        console.log('Available entities:', GameData.entities.map(e => e.id));
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

// Place the player sprite on a random empty hex
function placePlayer(svg) {
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const totalHexes = hexPolygons.length;
    
    // Find all empty hexes (hexes without entities)
    const emptyHexes = [];
    for (let i = 0; i < totalHexes; i++) {
        const cell = GameState.board[i];
        if (!cell || !cell.entity) {
            emptyHexes.push(i);
        }
    }
    
    if (emptyHexes.length === 0) {
        console.warn('No empty hexes available for player placement');
        return;
    }
    
    // Pick a random empty hex
    const randomIndex = Math.floor(Math.random() * emptyHexes.length);
    const playerHexIndex = emptyHexes[randomIndex];
    
    console.log(`Placing player at hex index ${playerHexIndex}`);
    
    // Get the hex polygon
    const hexPolygon = hexPolygons[playerHexIndex];
    if (!hexPolygon) return;
    
    // Get bounding box of the hex
    const bbox = hexPolygon.getBBox();
    
    // Check if player image already exists
    const existingPlayerImage = svg.querySelector('image[data-player="true"]');
    if (existingPlayerImage) {
        existingPlayerImage.remove();
    }
    
    // Create player image element
    const playerImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    playerImage.setAttribute('data-player', 'true');
    playerImage.setAttribute('data-hex-index', playerHexIndex.toString());
    
    // Center the player image on the hex
    const imageSize = 40;
    const imageX = bbox.x + bbox.width / 2 - imageSize / 2;
    const imageY = bbox.y + bbox.height / 2 - imageSize / 2;
    
    playerImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player.png');
    playerImage.setAttribute('x', imageX.toString());
    playerImage.setAttribute('y', imageY.toString());
    playerImage.setAttribute('width', imageSize.toString());
    playerImage.setAttribute('height', imageSize.toString());
    playerImage.setAttribute('opacity', '1');
    playerImage.setAttribute('pointer-events', 'none'); // Don't block clicks
    
    // Append player image to SVG
    svg.appendChild(playerImage);
    
    // Store player position in game state
    GameState.playerHexIndex = playerHexIndex;
    
    console.log('Player placed successfully');
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
        
        // Add click handler to cover so it can be clicked to reveal
        coverPolygon.addEventListener('click', handleHexClick);
        
        // Add right-click handler for damage markers (only on hidden hexes)
        coverPolygon.addEventListener('contextmenu', (e) => {
            e.preventDefault();
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
            numberGroup.addEventListener('click', (e) => {
                e.stopPropagation();
                // Use currentTarget to get the group the listener is attached to
                // This ensures we get the correct group even if clicking on child elements
                const clickedGroup = e.currentTarget;
                if (clickedGroup && clickedGroup.id === groupId) {
                    const damage = groupIdMap[groupId];
                    selectDamageMarker(hexIndex, damage);
                    hideDamageMarkerMenu();
                }
            });
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
    
    // Listen for clicks on covers to close menu
    setTimeout(() => {
        const covers = svg.querySelectorAll('polygon[data-hex-cover]');
        covers.forEach(cover => {
            cover.addEventListener('click', closeHandler, { once: true });
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
    const topY = bbox.y + 70; // Top of hex
    
    // Create text element for the damage number
    const damageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    damageText.setAttribute('data-marker-hex', hexIndex.toString());
    damageText.setAttribute('data-marker-damage', damage.toString());
    damageText.setAttribute('x', centerX.toString());
    damageText.setAttribute('y', (topY - 10).toString()); // Slightly above the hex
    damageText.setAttribute('fill', '#00ffff'); // Yellow color
    damageText.setAttribute('font-size', '32');
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
    
    // Show damage text for this hex (if entity exists)
    if (cell && cell.entity) {
        const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
        damageTexts.forEach(text => {
            text.setAttribute('opacity', '1');
        });
    }
    
    // Show neighbor damage sum text when revealed (only if > 0)
    const sumTexts = svg.querySelectorAll(`text[data-hex-sum-index="${hexIndex}"]`);
    sumTexts.forEach(text => {
        const sumValue = parseInt(text.textContent, 10);
        if (sumValue > 0) {
            text.setAttribute('opacity', '1');
        } else {
            text.remove(); // Remove 0 damage text
        }
    });
    
    // Make empty hexes with 0 damage transparent
    const isEmpty = !cell || !cell.entity;
    if (isEmpty) {
        // Calculate neighbor damage sum
        const neighborIndices = getNeighborIndices(hexIndex);
        let totalDamage = 0;
        neighborIndices.forEach(neighborIndex => {
            const neighborCell = GameState.board[neighborIndex];
            if (neighborCell && neighborCell.entity && neighborCell.entity.damage !== undefined) {
                totalDamage += neighborCell.entity.damage || 0;
            }
        });
        
        // If 0 damage, make hex transparent
        if (totalDamage === 0) {
            const boardGroup = svg.querySelector('#board');
            const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
            const hexPolygon = hexPolygons[hexIndex];
            if (hexPolygon) {
                hexPolygon.setAttribute('fill-opacity', '0');
                hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
            }
        }
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
                damageSumText.setAttribute('x', (bbox.x + bbox.width / 2).toString());
                damageSumText.setAttribute('y', (10 +bbox.y + bbox.height / 2).toString());
                damageSumText.setAttribute('text-anchor', 'middle'); // Center-align text
                damageSumText.setAttribute('font-size', '30'); // Double font size
            } else {
                // Upper right corner for hexes with entities
                damageSumText.setAttribute('x', (bbox.x + bbox.width - 15).toString());
                damageSumText.setAttribute('y', (bbox.y + 30).toString());
                damageSumText.setAttribute('text-anchor', 'end'); // Right-align text
                damageSumText.setAttribute('font-size', '20');
            }
            
            damageSumText.setAttribute('fill', '#0000ff'); // Blue color
            damageSumText.setAttribute('fill', '#0000ff'); // Blue color
            damageSumText.setAttribute('font-weight', 'bold');
            damageSumText.setAttribute('font-family', 'Arial, sans-serif');
            damageSumText.setAttribute('pointer-events', 'none'); // Don't block clicks
            damageSumText.textContent = totalDamage.toString();
            
            // Append text to SVG
            svg.appendChild(damageSumText);
        }
        
        // Make empty revealed hexes with 0 damage transparent
        const cell = GameState.board[hexIndex];
        const isEmpty = !cell || !cell.entity;
        if (isEmpty && cell && cell.revealed && totalDamage === 0) {
            hexPolygon.setAttribute('fill-opacity', '0');
            hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
        }
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
    
    // Remove existing sum text
    const existingSumText = svg.querySelector(`text[data-hex-sum-index="${hexIndex}"]`);
    if (existingSumText) {
        existingSumText.remove();
    }
    
    // Only show text if there's damage to display (don't show 0 for empty hexes)
    const cell = GameState.board[hexIndex];
    const isEmpty = !cell || !cell.entity;
    
    // Only show sum if damage > 0 (don't show 0 for empty revealed hexes)
    if (totalDamage > 0) {
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
            damageSumText.setAttribute('x', (bbox.x + bbox.width / 2).toString());
            damageSumText.setAttribute('y', (10 + bbox.y + bbox.height / 2).toString());
            damageSumText.setAttribute('text-anchor', 'middle'); // Center-align text
            damageSumText.setAttribute('font-size', '30');
        } else {
            // Upper right corner for hexes with entities
            damageSumText.setAttribute('x', (bbox.x + bbox.width - 15).toString());
            damageSumText.setAttribute('y', (bbox.y + 30).toString());
            damageSumText.setAttribute('text-anchor', 'end'); // Right-align text
            damageSumText.setAttribute('font-size', '20');
        }
        
        damageSumText.setAttribute('fill', '#ffff00'); // Yellow color
        damageSumText.setAttribute('font-weight', 'bold');
        damageSumText.setAttribute('font-family', 'Arial, sans-serif');
        damageSumText.setAttribute('pointer-events', 'none'); // Don't block clicks
        damageSumText.textContent = totalDamage.toString();
        
        // Only show if hex is revealed
        if (cell && cell.revealed) {
            damageSumText.setAttribute('opacity', '1');
        } else {
            damageSumText.setAttribute('opacity', '0');
        }
        
        // Append text to SVG
        svg.appendChild(damageSumText);
    }
    
    // Make empty revealed hexes with 0 damage transparent
    if (isEmpty && cell && cell.revealed && totalDamage === 0) {
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
        polygon.addEventListener('click', handleHexClick);
        
        // Add hover handlers for zoom hex
        polygon.addEventListener('mouseenter', () => updateZoomHex(index));
        polygon.addEventListener('mouseleave', () => clearZoomHex());
        
        // Initialize board cell data
        GameState.board[index] = {
            revealed: false,
            enemy: null // Will be populated when board is set up
        };
    });
    
    console.log(`Game board loaded with ${hexPolygons.length} hex cells`);
    
    // Set up initial board placements
    setupBoardPlacements(svg);
    
    // Initialize zoom hex
    initializeZoomHex(svg);
}

// Handle clicking on a hex cell - now handles movement
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
    
    // Allow movement to any hex (with entities or empty)
    // Move player to this hex
    movePlayerToHex(index);
}

// Move player to a hex
function movePlayerToHex(hexIndex) {
    const cell = GameState.board[hexIndex];
    if (!cell) return;
    
    // Reveal hex if it's hidden
    if (!cell.revealed) {
        cell.revealed = true;
        const boardGroup = boardContainer.querySelector('svg #board');
        const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : boardContainer.querySelector('svg').querySelectorAll('polygon');
        const hexPolygon = hexPolygons[hexIndex];
        if (hexPolygon) {
            hexPolygon.dataset.revealed = 'true';
        }
        removeHexCover(hexIndex);
        revealHexContents(hexIndex);
    }
    
    // Move player sprite
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Remove player from old location
    const oldPlayerImage = svg.querySelector('image[data-player="true"]');
    if (oldPlayerImage) {
        oldPlayerImage.remove();
    }
    
    // Get the new hex polygon
    const boardGroup = svg.querySelector('#board');
    const hexPolygons = boardGroup ? boardGroup.querySelectorAll('polygon') : svg.querySelectorAll('polygon');
    const hexPolygon = hexPolygons[hexIndex];
    if (!hexPolygon) return;
    
    const bbox = hexPolygon.getBBox();
    const imageSize = 40;
    const imageX = bbox.x + bbox.width / 2 - imageSize / 2;
    const imageY = bbox.y + bbox.height / 2 - imageSize / 2;
    
    // Create player image at new location
    const playerImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    playerImage.setAttribute('data-player', 'true');
    playerImage.setAttribute('data-hex-index', hexIndex.toString());
    playerImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player.png');
    playerImage.setAttribute('x', imageX.toString());
    playerImage.setAttribute('y', imageY.toString());
    playerImage.setAttribute('width', imageSize.toString());
    playerImage.setAttribute('height', imageSize.toString());
    playerImage.setAttribute('opacity', '1');
    playerImage.setAttribute('pointer-events', 'none');
    svg.appendChild(playerImage);
    
    // Update player position
    GameState.playerHexIndex = hexIndex;
    
    // Make the hex the player is on transparent
    hexPolygon.setAttribute('fill-opacity', '0');
    hexPolygon.setAttribute('stroke-opacity', '0.3'); // Keep stroke slightly visible
    
    // Handle entity in this hex (if present)
    if (cell.entity || cell.enemy) {
        const entity = cell.entity || cell.enemy;
        const attackValue = entity.damage || 0;
        
        if (attackValue > GameState.shields) {
            // Player dies
            playerDeath(hexPolygon, entity);
        } else {
            // Player defeats enemy and clears the hex
            defeatEnemy(hexPolygon, entity, hexIndex);
            
            // Update neighbor damage sums for all neighbors of cleared hex
            updateNeighborDamageSums(hexIndex);
        }
        
        // Check for win condition after defeating enemy
        checkWinCondition();
    } else {
        // Empty hex - safe movement, mark as cleared/revealed
        hexPolygon.classList.add('cleared');
        console.log('Moved to empty hex');
        
        // Update neighbor damage sums (in case this hex had an entity before)
        updateNeighborDamageSums(hexIndex);
    }
}

// Check if player has won (cleared all hexes with entities)
function checkWinCondition() {
    if (GameState.clearedHexes.size >= GameState.totalHexesWithEntities) {
        showWinScreen();
    }
}

// Show win screen
function showWinScreen() {
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-content">
            <h2>SECTOR CLEARED!</h2>
            <p>You have successfully cleared all enemies from the sector.</p>
            <p>Parts collected: ${GameState.parts}</p>
            <p>Final shields: ${GameState.shields}/${GameState.maxShields}</p>
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
    
    // Scavenge parts equal to attack value
    GameState.parts += attackValue;
    
    console.log(`Enemy defeated! Lost ${attackValue} shields, gained ${attackValue} parts`);
    
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
    
    updateDisplays();
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
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-content">
            <h2>SHIP DESTROYED</h2>
            <p>Your shields were overwhelmed by enemy fire.</p>
            <p>Parts salvaged: ${GameState.parts}</p>
            <button onclick="location.reload()">Try Again</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Update the UI displays
function updateDisplays() {
    shieldsDisplay.textContent = `${GameState.shields}/${GameState.maxShields}`;
    partsDisplay.textContent = GameState.parts;
    
    // Update shield display color based on health
    const shieldPercent = GameState.shields / GameState.maxShields;
    if (shieldPercent <= 0.2) {
        shieldsDisplay.classList.add('critical');
        shieldsDisplay.classList.remove('warning');
    } else if (shieldPercent <= 0.5) {
        shieldsDisplay.classList.add('warning');
        shieldsDisplay.classList.remove('critical');
    } else {
        shieldsDisplay.classList.remove('warning', 'critical');
    }
    
    // Update repair availability indicator
    if (GameState.parts >= GameState.maxShields && GameState.shields < GameState.maxShields) {
        shieldsDisplay.classList.add('repair-available');
    } else {
        shieldsDisplay.classList.remove('repair-available');
    }
}

// Repair shields to maximum
function repairShields() {
    if (!GameState.isAlive) {
        console.log('Game over - cannot repair');
        return;
    }
    
    // Check if player has enough parts
    if (GameState.parts < GameState.maxShields) {
        console.log(`Not enough parts to repair. Need ${GameState.maxShields}, have ${GameState.parts}`);
        return;
    }
    
    // Check if shields are already at max
    if (GameState.shields >= GameState.maxShields) {
        console.log('Shields already at maximum');
        return;
    }
    
    // Increment repair count
    GameState.repairCount++;
    
    // Check if this is the 3rd repair (upgrade)
    const isUpgrade = GameState.repairCount % 3 === 0;
    
    if (isUpgrade) {
        // Upgrade: increase max shields, set shields to new max, subtract old max
        const oldMaxShields = GameState.maxShields;
        GameState.maxShields += 1;
        GameState.shields = GameState.maxShields;
        GameState.parts -= oldMaxShields;
        
        console.log(`Shield upgrade! Max shields increased to ${GameState.maxShields}. Cost: ${oldMaxShields} parts. Remaining parts: ${GameState.parts}`);
    } else {
        // Normal repair: repair to current max, subtract current max
        const repairCost = GameState.maxShields;
        GameState.shields = GameState.maxShields;
        GameState.parts -= repairCost;
        
        console.log(`Shields repaired to ${GameState.maxShields}. Cost: ${repairCost} parts. Remaining parts: ${GameState.parts}`);
    }
    
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

// Initialize the zoom hex display area
function initializeZoomHex(svg) {
    const zoomHex = svg.querySelector('#zoom');
    if (!zoomHex) {
        console.warn('Zoom hex not found in SVG');
        return;
    }
    
    // Create a group inside the zoom hex for content
    let zoomGroup = svg.querySelector('g#zoom-content');
    if (!zoomGroup) {
        zoomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        zoomGroup.setAttribute('id', 'zoom-content');
        svg.appendChild(zoomGroup);
    }
    
    // Initially hide zoom hex content
    clearZoomHex();
}

// Update zoom hex to show contents of hovered hex
function updateZoomHex(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const zoomHex = svg.querySelector('#zoom');
    if (!zoomHex) return;
    
    let zoomGroup = svg.querySelector('g#zoom-content');
    if (!zoomGroup) {
        zoomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        zoomGroup.setAttribute('id', 'zoom-content');
        svg.appendChild(zoomGroup);
    }
    
    // Clear existing zoom content
    zoomGroup.innerHTML = '';
    
    const cell = GameState.board[hexIndex];
    if (!cell) return;
    
    // Get bounding box of zoom hex
    const zoomBBox = zoomHex.getBBox();
    const zoomCenterX = zoomBBox.x + zoomBBox.width / 2;
    const zoomCenterY = zoomBBox.y + zoomBBox.height / 2;
    const imageSize = 120; // Larger size for zoom
    
    // Display entity name and sprite if present
    if (cell.entity && cell.entity.sprite_name) {
        // Display entity name above sprite
        if (cell.entity.name) {
            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', zoomCenterX.toString());
            nameText.setAttribute('y', (zoomCenterY - imageSize / 2 - 20).toString());
            nameText.setAttribute('fill', '#ffffff');
            nameText.setAttribute('font-size', '28');
            nameText.setAttribute('font-weight', 'bold');
            nameText.setAttribute('font-family', 'Arial, sans-serif');
            nameText.setAttribute('text-anchor', 'middle');
            nameText.setAttribute('opacity', cell.revealed ? '1' : '0.5');
            nameText.textContent = cell.entity.name;
            zoomGroup.appendChild(nameText);
        }
        
        const entityImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        entityImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `img/${cell.entity.sprite_name}`);
        entityImage.setAttribute('x', (zoomCenterX - imageSize / 2).toString());
        entityImage.setAttribute('y', (zoomCenterY - imageSize / 2).toString());
        entityImage.setAttribute('width', imageSize.toString());
        entityImage.setAttribute('height', imageSize.toString());
        entityImage.setAttribute('opacity', cell.revealed ? '1' : '0.5'); // Dim if not revealed
        zoomGroup.appendChild(entityImage);
        
        // Display damage value
        if (cell.entity.damage !== undefined && cell.entity.damage !== null) {
            const damageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            damageText.setAttribute('x', (zoomCenterX - 60).toString());
            damageText.setAttribute('y', (zoomCenterY + imageSize / 2 + 30).toString());
            damageText.setAttribute('fill', '#ff0000');
            damageText.setAttribute('font-size', '48');
            damageText.setAttribute('font-weight', 'bold');
            damageText.setAttribute('font-family', 'Arial, sans-serif');
            damageText.setAttribute('opacity', cell.revealed ? '1' : '0.5');
            damageText.textContent = cell.entity.damage.toString();
            zoomGroup.appendChild(damageText);
        }
    }
    
    // Display player sprite if this is the player's hex
    if (hexIndex === GameState.playerHexIndex) {
        // Display "Player" name above sprite
        const playerNameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        playerNameText.setAttribute('x', zoomCenterX.toString());
        playerNameText.setAttribute('y', (zoomCenterY - imageSize / 2 - 20).toString());
        playerNameText.setAttribute('fill', '#ffffff');
        playerNameText.setAttribute('font-size', '28');
        playerNameText.setAttribute('font-weight', 'bold');
        playerNameText.setAttribute('font-family', 'Arial, sans-serif');
        playerNameText.setAttribute('text-anchor', 'middle');
        playerNameText.setAttribute('opacity', '1');
        playerNameText.textContent = 'Player';
        zoomGroup.appendChild(playerNameText);
        
        const playerImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        playerImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player.png');
        playerImage.setAttribute('x', (zoomCenterX - imageSize / 2).toString());
        playerImage.setAttribute('y', (zoomCenterY - imageSize / 2).toString());
        playerImage.setAttribute('width', imageSize.toString());
        playerImage.setAttribute('height', imageSize.toString());
        playerImage.setAttribute('opacity', '1');
        zoomGroup.appendChild(playerImage);
    }
    
    // Calculate and display neighbor damage sum (always show, even for empty hexes)
    const neighborIndices = getNeighborIndices(hexIndex);
    let totalDamage = 0;
    neighborIndices.forEach(neighborIndex => {
        const neighborCell = GameState.board[neighborIndex];
        if (neighborCell && neighborCell.entity && neighborCell.entity.damage !== undefined) {
            totalDamage += neighborCell.entity.damage || 0;
        }
    });
    
    // Show neighbor damage sum even if 0, or if > 0
    const sumText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sumText.setAttribute('x', zoomCenterX.toString());
    sumText.setAttribute('y', (zoomBBox.y + 40).toString());
    sumText.setAttribute('fill', '#bbffbb'); // Blue color
    sumText.setAttribute('font-size', '36');
    sumText.setAttribute('font-weight', 'bold');
    sumText.setAttribute('font-family', 'Arial, sans-serif');
    sumText.setAttribute('text-anchor', 'middle');
    sumText.setAttribute('opacity', cell.revealed ? '1' : '0.5');
    sumText.textContent = totalDamage.toString();
    zoomGroup.appendChild(sumText);
    
    // If empty hex, show message or indicator
    if (!cell.entity && !cell.enemy && hexIndex !== GameState.playerHexIndex) {
        const emptyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        emptyText.setAttribute('x', zoomCenterX.toString());
        emptyText.setAttribute('y', (zoomCenterY + 20).toString());
        emptyText.setAttribute('fill', '#ffffff');
        emptyText.setAttribute('font-size', '24');
        emptyText.setAttribute('font-weight', 'bold');
        emptyText.setAttribute('font-family', 'Arial, sans-serif');
        emptyText.setAttribute('text-anchor', 'middle');
        emptyText.setAttribute('opacity', cell.revealed ? '1' : '0.5');
        emptyText.textContent = 'Empty';
        zoomGroup.appendChild(emptyText);
    }
}

// Clear zoom hex display
function clearZoomHex() {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const zoomGroup = svg.querySelector('g#zoom-content');
    if (zoomGroup) {
        zoomGroup.innerHTML = '';
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', init);
