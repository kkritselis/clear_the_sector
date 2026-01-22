// Clear the Sector! - Game Logic

const GameState = {
    shields: 5,
    maxShields: 5,
    parts: 0,
    isAlive: true,
    board: [], // Will hold cell data including enemies
    playerHexIndex: null // Current hex index where player is located
};

// Game data loaded from CSV
const GameData = {
    entities: [], // Array of entity objects parsed from CSV
    images: {} // Cache of loaded images by sprite name
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
        await loadGameBoard();
        updateDisplays();
        console.log('Game initialized successfully');
        console.log(`Loaded ${GameData.entities.length} entities from CSV`);
    } catch (error) {
        console.error('Error initializing game:', error);
        boardContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center;">Error loading game data</p>';
    }
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

// Build coordinate mapping from SVG paths
function buildHexCoordinateMap(svg) {
    const hexPaths = svg.querySelectorAll('path');
    
    hexPaths.forEach((path, index) => {
        const coords = parseHexCoords(path.id);
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
    
    const hexPaths = svg.querySelectorAll('path');
    const targetPath = hexPaths[hexIndex];
    if (!targetPath) return [];
    
    const targetBBox = targetPath.getBBox();
    const targetCenterX = targetBBox.x + targetBBox.width / 2;
    const targetCenterY = targetBBox.y + targetBBox.height / 2;
    
    // Calculate distances to all other hexes
    const distances = [];
    hexPaths.forEach((path, index) => {
        if (index === hexIndex) return;
        
        const bbox = path.getBBox();
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
        const hexPaths = svg.querySelectorAll('path');
        const hexPath = hexPaths[hexIndex];
        
        if (hexPath && entity.sprite_name) {
            // Get bounding box of the hex path
            const bbox = hexPath.getBBox();
            
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
    const hexPaths = svg.querySelectorAll('path');
    const totalHexes = hexPaths.length;
    
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
    
    // Add neighbor damage sums to all hexes
    addNeighborDamageSums(svg);
    
    // Place player on a random empty hex
    placePlayer(svg);
    
    // Cover all hexes with entities to hide their contents
    coverHexes(svg);
}

// Place the player sprite on a random empty hex
function placePlayer(svg) {
    const hexPaths = svg.querySelectorAll('path');
    const totalHexes = hexPaths.length;
    
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
    
    // Get the hex path
    const hexPath = hexPaths[playerHexIndex];
    if (!hexPath) return;
    
    // Get bounding box of the hex
    const bbox = hexPath.getBBox();
    
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

// Cover all hexes with entities to hide their contents
function coverHexes(svg) {
    const hexPaths = svg.querySelectorAll('path');
    
    // Create a group for covers to ensure they're on top
    let coverGroup = svg.querySelector('g.hex-covers');
    if (coverGroup) {
        coverGroup.remove(); // Remove existing group if present
    }
    coverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    coverGroup.setAttribute('class', 'hex-covers');
    
    hexPaths.forEach((hexPath, hexIndex) => {
        const cell = GameState.board[hexIndex];
        
        // Skip if hex has no entity, or if it's the player's hex
        if (!cell || !cell.entity || hexIndex === GameState.playerHexIndex) {
            return;
        }
        
        // Hide images and text for this hex initially
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
        
        // Get the path's 'd' attribute to recreate it
        const pathData = hexPath.getAttribute('d');
        if (!pathData) return;
        
        // Create a new cover path (don't clone to avoid inheriting unwanted attributes)
        const coverPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        coverPath.setAttribute('d', pathData);
        coverPath.setAttribute('data-hex-cover', hexIndex.toString());
        coverPath.setAttribute('data-hex-index', hexIndex.toString());
        coverPath.setAttribute('class', 'hex-cover');
        coverPath.setAttribute('fill', '#1a2332'); // Dark fill to cover contents
        coverPath.setAttribute('stroke', '#0d1117'); // Dark stroke
        coverPath.setAttribute('stroke-width', '1');
        coverPath.setAttribute('opacity', '1');
        coverPath.setAttribute('pointer-events', 'all');
        coverPath.style.cursor = 'pointer';
        
        // Add click handler to cover so it can be clicked to reveal
        coverPath.addEventListener('click', handleHexClick);
        
        // Append cover to the group
        coverGroup.appendChild(coverPath);
    });
    
    // Append the cover group LAST to ensure it renders on top of everything
    svg.appendChild(coverGroup);
    
    console.log('Covered hexes with entities');
}

// Remove cover from a hex when revealed
function removeHexCover(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    const cover = svg.querySelector(`path[data-hex-cover="${hexIndex}"]`);
    if (cover) {
        cover.remove();
    }
}

// Show hex contents when revealed
function revealHexContents(hexIndex) {
    const svg = boardContainer.querySelector('svg');
    if (!svg) return;
    
    // Show images for this hex
    const images = svg.querySelectorAll(`image[data-hex-index="${hexIndex}"]`);
    images.forEach(img => {
        img.setAttribute('opacity', '1');
    });
    
    // Show damage text for this hex
    const damageTexts = svg.querySelectorAll(`text[data-hex-index="${hexIndex}"]`);
    damageTexts.forEach(text => {
        text.setAttribute('opacity', '1');
    });
    
    // Show sum text for this hex
    const sumTexts = svg.querySelectorAll(`text[data-hex-sum-index="${hexIndex}"]`);
    sumTexts.forEach(text => {
        text.setAttribute('opacity', '1');
    });
}

// Calculate and display the sum of damage from surrounding hexes
function addNeighborDamageSums(svg) {
    const hexPaths = svg.querySelectorAll('path');
    
    hexPaths.forEach((hexPath, hexIndex) => {
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
        
        // Only show text if there's damage to display
        if (totalDamage > 0) {
            // Get bounding box of the hex
            const bbox = hexPath.getBBox();
            
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
            
            damageSumText.setAttribute('fill', '#ffff00'); // Yellow color
            damageSumText.setAttribute('font-weight', 'bold');
            damageSumText.setAttribute('font-family', 'Arial, sans-serif');
            damageSumText.setAttribute('pointer-events', 'none'); // Don't block clicks
            damageSumText.textContent = totalDamage.toString();
            
            // Append text to SVG
            svg.appendChild(damageSumText);
        }
    });
    
    console.log('Added neighbor damage sums to all hexes');
}

// Set up click handlers for hex cells
function setupBoardInteractions(svg) {
    const hexPaths = svg.querySelectorAll('path');
    
    // Build coordinate map first
    buildHexCoordinateMap(svg);
    
    hexPaths.forEach((path, index) => {
        path.dataset.hexIndex = index;
        path.dataset.revealed = 'false';
        path.addEventListener('click', handleHexClick);
        
        // Initialize board cell data
        GameState.board[index] = {
            revealed: false,
            enemy: null // Will be populated when board is set up
        };
    });
    
    console.log(`Game board loaded with ${hexPaths.length} hex cells`);
    
    // Set up initial board placements
    setupBoardPlacements(svg);
}

// Handle clicking on a hex cell
function handleHexClick(event) {
    if (!GameState.isAlive) {
        console.log('Game over - cannot interact');
        return;
    }
    
    const hex = event.target;
    const index = parseInt(hex.dataset.hexIndex);
    const cell = GameState.board[index];
    
    // Don't allow clicking already revealed cells
    if (cell.revealed) {
        console.log(`Hex ${index} already revealed`);
        return;
    }
    
    // Mark cell as revealed
    cell.revealed = true;
    hex.dataset.revealed = 'true';
    
    // Remove cover overlay if it exists and show contents
    removeHexCover(index);
    revealHexContents(index);
    
    // Check if there's an enemy in this cell
    if (cell.enemy || cell.entity) {
        const enemy = cell.enemy || cell.entity;
        const attackValue = enemy.damage || 0;
        console.log(`Encountered enemy with attack value: ${attackValue}`);
        
        if (attackValue > GameState.shields) {
            // Player dies
            playerDeath(hex, enemy);
        } else {
            // Player defeats enemy
            defeatEnemy(hex, enemy);
        }
    } else {
        // Empty cell - safe!
        revealEmptyCell(hex);
    }
}

// Player defeats an enemy
function defeatEnemy(hex, enemy) {
    const attackValue = enemy.damage || 0;
    
    // Subtract attack from shields
    GameState.shields -= attackValue;
    
    // Scavenge parts equal to attack value
    GameState.parts += attackValue;
    
    console.log(`Enemy defeated! Lost ${attackValue} shields, gained ${attackValue} parts`);
    
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
