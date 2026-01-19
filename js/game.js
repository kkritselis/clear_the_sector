// Clear the Sector! - Game Logic

const GameState = {
    shields: 5,
    maxShields: 5,
    parts: 0,
    isAlive: true,
    board: [] // Will hold cell data including enemies
};

// DOM Elements
const shieldsDisplay = document.getElementById('shields-value');
const partsDisplay = document.getElementById('parts-value');
const boardContainer = document.getElementById('board-container');

// Initialize the game
async function init() {
    await loadGameBoard();
    updateDisplays();
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

// Set up click handlers for hex cells
function setupBoardInteractions(svg) {
    const hexPaths = svg.querySelectorAll('path');
    
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
    
    // Check if there's an enemy in this cell
    if (cell.enemy) {
        const enemy = cell.enemy;
        console.log(`Encountered enemy with attack value: ${enemy.attack}`);
        
        if (enemy.attack > GameState.shields) {
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
    // Subtract attack from shields
    GameState.shields -= enemy.attack;
    
    // Scavenge parts equal to attack value
    GameState.parts += enemy.attack;
    
    console.log(`Enemy defeated! Lost ${enemy.attack} shields, gained ${enemy.attack} parts`);
    
    // Visual feedback
    hex.classList.add('defeated');
    
    updateDisplays();
}

// Player death
function playerDeath(hex, enemy) {
    GameState.isAlive = false;
    GameState.shields = 0;
    
    console.log(`GAME OVER! Enemy attack (${enemy.attack}) exceeded shields`);
    
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
