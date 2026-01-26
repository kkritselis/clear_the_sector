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
- Blue numbers show the sum of damage from surrounding hexes:
  - Upper right corner for hexes with entities
  - Centered for empty hexes (double font size)
- Empty, revealed hexes with 0 neighbor damage become transparent to show the background

**Damage Markers**
- Right-click on hidden hexes to place a damage marker
- A circular menu appears with numbers 1-11 and 100
- Click a number to place it as cyan text centered above the hex
- Right-click an already marked hex to remove the marker
- Markers help you track suspected enemy damage values

**Cover System**
- All hexes start covered (hidden) except the player's starting hex
- The 6 hexes connected to the player's starting position are automatically revealed at game start
- Click a covered hex to reveal its contents
- Once revealed, hexes remain visible
- The hex the player is currently on becomes transparent (fill-opacity: 0) to show the background

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
- Use the blue neighbor damage sums to assess risk before revealing hexes
- Empty hexes show centered blue numbers indicating total threat from surrounding hexes
- Use right-click damage markers to track suspected enemy locations
- Save parts to refill shields when running low
- Consider upgrading max shields for more survivability (every 3rd repair upgrades max shields)
- The risk/reward: stronger enemies give more parts but are more dangerous
- Hover over revealed hexes to see a zoom view with entity name and details

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
- ✅ Red damage numbers displayed on entities (lower left of sprites)
- ✅ Blue neighbor damage sum calculations:
  - Upper right positioning for occupied hexes
  - Centered positioning for empty hexes (double font size)
- ✅ Cover system to hide unrevealed hexes
- ✅ Reveal system to show hex contents when clicked
- ✅ Automatic reveal of player's starting neighbors at game launch
- ✅ Player hex transparency when landed on
- ✅ Empty revealed hexes with 0 damage become transparent
- ✅ Zoom hex display showing larger view of hovered/selected hexes
- ✅ Background image (Space-Bkgd.jpg) displayed on game board
- ✅ Right-click damage marker menu with yellow outlines/text
- ✅ Cyan damage marker text displayed above marked hexes

### Gameplay Systems
- ✅ Click-to-reveal hex mechanics
- ✅ Combat system with damage calculations
- ✅ Shield and parts tracking
- ✅ Shield repair system (click shield counter when parts >= max shields)
- ✅ Shield upgrade system (every 3rd repair increases max shields by 1)
- ✅ Player movement to any hex (hidden or revealed)
- ✅ Win condition (clear all entities from the board)
- ✅ Game over detection
- ✅ Visual feedback for different cell states
- ✅ Right-click damage marker system
- ✅ Zoom hex display (hover over revealed hexes)

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

- [ ] Special entity behaviors (E10 Command Core, E15 Extinction Engine states, E16 Trader Ship reveals)
- [ ] Bonus items (B01-B03) functionality
- [ ] Save/load game state
- [ ] Difficulty levels
- [ ] Sound effects and music
- [ ] Animation effects for combat and movement
- [ ] Statistics tracking (enemies defeated, parts collected, etc.)

---

*Game is in active development. Features are being added incrementally.*
