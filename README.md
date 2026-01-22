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

### Board Setup

The game board is procedurally generated with entities placed according to specific rules:

1. **E11 (Local Warlord)** - Placed at a random location first
2. **E12 (Dominion Fighter Ship)** - Placed on all 6 neighboring hexes around E11
3. **All Other Entities** - Randomly distributed across remaining hexes based on their COUNT values from the CSV data
4. **Player** - Placed on a random empty hex after all entities are placed

### Visual Indicators

**Damage Display**
- Red numbers (lower left of sprites) show the damage value of each entity
- Yellow numbers show the sum of damage from surrounding hexes:
  - Upper right corner for hexes with entities
  - Centered for empty hexes

**Cover System**
- All hexes with entities start covered (hidden) except the player's starting hex
- Click a covered hex to reveal its contents
- Once revealed, hexes remain visible

### Combat

When you click on a hex cell, one of two things can happen:

1. **Empty Cell** - The cell is safe and gets marked as cleared
2. **Enemy Encounter** - You discover an enemy with an attack rating

#### Enemy Encounters

Each enemy has a **damage value** (shown in red on the sprite). When you encounter an enemy:

- **If enemy damage > your shields**: You die. Game over.
- **If enemy damage <= your shields**: 
  - Your shields are reduced by the enemy's damage value
  - You defeat the enemy and scavenge parts equal to their damage value

**Example:**
- You have 5 shields
- You click a cell with an enemy (damage value: 3)
- Result: 5 - 3 = 2 shields remaining, +3 parts collected

### Strategy Tips

- Monitor your shield level carefully before clicking unknown cells
- Use the yellow neighbor damage sums to assess risk before revealing hexes
- Empty hexes show centered yellow numbers indicating total threat from surrounding hexes
- Save parts to refill shields when running low
- Consider upgrading max shields for more survivability
- The risk/reward: stronger enemies give more parts but are more dangerous

## Game States

| Cell State | Description |
|------------|-------------|
| Covered | Dark hex overlay - contents hidden, click to reveal |
| Unrevealed | Dark hex - contents unknown (after cover removed) |
| Cleared | Green hex - empty, safe cell |
| Defeated | Purple hex - enemy was defeated here |
| Death | Red hex - where you met your end |

## Implemented Features

### Core Systems
- ✅ CSV data loading from `data/sector_data.csv`
- ✅ Image preloading system for all entity sprites
- ✅ Hex coordinate system with neighbor detection
- ✅ Procedural entity placement:
  - E11 (Local Warlord) placement logic
  - E12 (Dominion Fighter Ship) neighbor placement
  - Random distribution of all other entities
- ✅ Player sprite placement on random empty hex

### Visual Features
- ✅ Entity sprites rendered on hexes
- ✅ Red damage numbers displayed on entities
- ✅ Yellow neighbor damage sum calculations:
  - Upper right positioning for occupied hexes
  - Centered positioning for empty hexes
- ✅ Cover system to hide unrevealed hexes
- ✅ Reveal system to show hex contents when clicked

### Gameplay Systems
- ✅ Click-to-reveal hex mechanics
- ✅ Combat system with damage calculations
- ✅ Shield and parts tracking
- ✅ Game over detection
- ✅ Visual feedback for different cell states

## Development

### File Structure
```
clear_the_sector/
├── index.html              # Main game page
├── css/
│   └── style.css           # Game styling
├── js/
│   └── game.js             # Game logic
├── img/
│   ├── sector_cleared.svg  # Hex grid game board
│   ├── player.png          # Player sprite
│   └── [entity sprites]    # Entity sprites (E01-E16, B01-B03)
├── data/
│   └── sector_data.csv     # Entity data (damage, count, sprites, etc.)
└── README.md
```

### Data Format

The `sector_data.csv` file contains entity definitions with the following columns:
- **ID** - Unique identifier (E01-E16 for enemies, B01-B03 for bonuses)
- **NAME** - Entity name
- **DAMAGE** - Attack/damage value
- **COUNT** - Number of instances to place on the board
- **SPRITE_NAME** - Image filename (e.g., E01.png)
- **SHIELD_BONUS** - Shield bonus value
- **PART_BONUS** - Parts bonus value
- **SHIELD_SURGE** - Shield surge value
- **DESC** - Description text

### Tech Stack
- HTML5
- CSS3 (with CSS variables and animations)
- Vanilla JavaScript (ES6+)
- SVG for the game board

## Future Enhancements

- [ ] Shield refill system using parts
- [ ] Max shield upgrades
- [ ] Special entity behaviors (E10 Command Core, E15 Extinction Engine states, E16 Trader Ship reveals)
- [ ] Bonus items (B01-B03) functionality
- [ ] Win condition
- [ ] Save/load game state
- [ ] Difficulty levels
- [ ] Sound effects and music

---

*Game is in active development. Features are being added incrementally.*
