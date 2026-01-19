# Clear the Sector!

A 2D strategy game inspired by Minesweeper, played on a hex grid. Navigate through a dangerous sector of space, defeating enemies and scavenging parts to survive.

## How to Play

Open `index.html` in a web browser (requires a local server due to SVG loading).

### Quick Start
```bash
# Using Python
python -m http.server 8000

# Then open http://localhost:8000 in your browser
```

## Game Rules

### Resources

**Shields**
- Your primary defense against enemy attacks
- Displayed as `current/maximum` (starts at 5/5)
- Maximum shields can be upgraded throughout the game
- If shields reach 0 from an attack, you die

**Parts**
- Collected by defeating enemies
- Used to refill shields and purchase upgrades

### Combat

When you click on a hex cell, one of two things can happen:

1. **Empty Cell** - The cell is safe and gets marked as cleared
2. **Enemy Encounter** - You discover an enemy with an attack rating

#### Enemy Encounters

Each enemy has an **attack value**. When you encounter an enemy:

- **If enemy attack > your shields**: You die. Game over.
- **If enemy attack <= your shields**: 
  - Your shields are reduced by the enemy's attack value
  - You defeat the enemy and scavenge parts equal to their attack value

**Example:**
- You have 5 shields
- You click a cell with an enemy (attack value: 3)
- Result: 5 - 3 = 2 shields remaining, +3 parts collected

### Strategy Tips

- Monitor your shield level carefully before clicking unknown cells
- Save parts to refill shields when running low
- Consider upgrading max shields for more survivability
- The risk/reward: stronger enemies give more parts but are more dangerous

## Game States

| Cell State | Description |
|------------|-------------|
| Unrevealed | Dark hex - contents unknown |
| Cleared | Green hex - empty, safe cell |
| Defeated | Purple hex - enemy was defeated here |
| Death | Red hex - where you met your end |

## Development

### File Structure
```
clear_the_sector/
├── index.html      # Main game page
├── css/
│   └── style.css   # Game styling
├── js/
│   └── game.js     # Game logic
├── img/
│   └── sector_cleared.svg  # Hex grid game board
└── README.md
```

### Tech Stack
- HTML5
- CSS3 (with CSS variables and animations)
- Vanilla JavaScript (ES6+)
- SVG for the game board

---

*More rules and features to be added as development continues.*
