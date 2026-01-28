# Sweep the Sector!

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
- Maximum shields can be upgraded through the recharge system
- If shields reach 0 from an attack, you die
- Click the shield display to recharge (requires parts based on recharge level)

**Parts**
- Collected by defeating enemies
- Displayed as `current/needed` format (e.g., "3/5" means 3 parts collected, 5 needed for next recharge)
- Used to recharge shields following a progressive cost pattern
- Parts needed increases with each recharge: 4 → 5 → 6 → 7... up to 25 (capped)

**Shield Surge**
- Special items collected by defeating B03 (Shield Surge) entities
- Displayed as filled shield icons next to the shield value
- Click a shield surge icon to instantly max out shields (no parts cost)
- Multiple shield surges can be collected and stored

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
- Right-click (or touch and hold on mobile) on hidden hexes to place a damage marker
- A circular menu appears with numbers 1-11 and 100
- Click/tap a number to place it as cyan text centered above the hex
- Right-click/touch and hold an already marked hex to remove the marker
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
  - Special enemies trigger unique effects when defeated (see Special Entities below)

**Example:**
- You have 5 shields
- You click a cell with an enemy (damage value: 3)
- Result: 5 - 3 = 2 shields remaining, +3 parts collected

#### Special Entities

**E10 (Command Core)**
- When defeated, triggers a screen shake effect
- Deactivates all E15 (Extinction Engine) entities on the board
- Deactivated E15 entities have their damage set to 0 and parts set to 3
- All damage counts are recalculated after deactivation

**E15 (Extinction Engine)**
- Has two states: active and inactive
- Active: Deals 100 damage when encountered
- Inactive: Deals 0 damage, awards 3 parts when defeated
- Can be deactivated by defeating E10 (Command Core)

**E16 (Trader Ship)**
- When defeated, reveals the locations of all E05 (Bulwark Class Ship) and E08 (Obliterator Class Ship) entities
- Revealed hexes become transparent and show their contents

**E14 (Merc Ship)**
- When defeated, reveals the locations of all E01 (Skirmisher Class Ship) entities
- Revealed hexes become transparent and show their contents

**B03 (Shield Surge)**
- When defeated/captured, adds a shield surge to your inventory
- Shield surges appear as filled shield icons next to the shield display
- Click/tap a shield surge icon to instantly max out shields (no parts cost)

### Shield Recharge System

The shield recharge system uses a progressive cost pattern:

| Recharge # | Shield Level | Parts Needed |
|------------|--------------|--------------|
| 1 | 5 | 4 |
| 2 | 5 | 5 |
| 3 | 6 | 6 |
| 4 | 6 | 7 |
| 5 | 6 | 8 |
| 6 | 7 | 9 |
| ... | ... | ... |
| 21+ | 12 | 25 (capped) |

- Click/tap the shield display to recharge when you have enough parts
- Each recharge increases your shield level according to the pattern
- Maximum shields cap at 12, parts cost caps at 25

### Strategy Tips

- Monitor your shield level carefully before clicking unknown cells
- Use the blue neighbor damage sums to assess risk before revealing hexes
- Empty hexes show centered blue numbers indicating total threat from surrounding hexes
- Use right-click/touch-and-hold damage markers to track suspected enemy locations
- Save parts to recharge shields when running low
- Defeat E10 early to deactivate dangerous E15 entities
- Use E16 and E14 strategically to reveal enemy locations
- Collect B03 shield surges for emergency shield restoration
- The risk/reward: stronger enemies give more parts but are more dangerous
- Hover/touch revealed hexes to see a zoom view with entity name and details

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
- ✅ Reveal system to show hex contents when clicked/tapped
- ✅ Automatic reveal of player's starting neighbors at game launch
- ✅ All revealed hexes become transparent to show background
- ✅ Empty revealed hexes with 0 damage become transparent
- ✅ Zoom hex display showing larger view of hovered/touched hexes
- ✅ Background image (Space-Bkgd.jpg) displayed on game board
- ✅ Right-click/touch-and-hold damage marker menu with yellow outlines/text
- ✅ Cyan damage marker text displayed above marked hexes
- ✅ Shield surge icons displayed next to shield value
- ✅ Screen shake animation effect
- ✅ Full-height game board layout (100% viewport height)
- ✅ Rotated title on left side of board
- ✅ Status items (shields/parts) positioned in upper left of game board
- ✅ Mobile-responsive touch interactions

### Gameplay Systems
- ✅ Click/tap-to-reveal hex mechanics
- ✅ Combat system with damage calculations
- ✅ Shield and parts tracking
- ✅ Progressive shield recharge system with pattern-based costs
- ✅ Shield surge inventory system (B03 items)
- ✅ Shield surge usage (instant max shields, no parts cost)
- ✅ Player movement to any hex (hidden or revealed)
- ✅ Smooth player ship animation (1.5 second duration) when moving to clicked hex
- ✅ Hex becomes transparent immediately on click to reveal contents
- ✅ Entity removal delayed until animation completes
- ✅ Win condition (clear all entities from the board)
- ✅ Game over detection
- ✅ Visual feedback for different cell states
- ✅ Right-click/touch-and-hold damage marker system
- ✅ Zoom hex display (hover/touch over revealed hexes)
- ✅ Screen shake effect when E10 is defeated
- ✅ E15 deactivation system (damage 0, parts 3 when inactive)
- ✅ E16 defeat reveals E05 and E08 locations
- ✅ E14 defeat reveals E01 locations
- ✅ Touch/mobile support for all interactions

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
- Touch event API for mobile support

## Mobile Support

The game is fully optimized for mobile devices with touch support:

- **Tap to move** - Tap any hex to move the player there
- **Touch and hold** - Hold for 500ms on hidden hexes to place damage markers (right-click equivalent)
- **Tap to recharge** - Tap the shield display to recharge shields
- **Tap to use surge** - Tap shield surge icons to instantly max shields
- **Touch hover** - Touch revealed hexes to preview their contents in the zoom display
- **Touch targets** - All interactive elements have minimum 44x44px touch targets
- **No text selection** - Text selection disabled for better touch experience
- **Responsive layout** - Works on all screen sizes

## Future Enhancements

- [ ] Bonus items (B01-B02) functionality
- [ ] Save/load game state
- [ ] Difficulty levels
- [ ] Sound effects and music
- [ ] Animation effects for combat
- [ ] Statistics tracking (enemies defeated, parts collected, etc.)
- [ ] Tutorial/help system
- [ ] Settings menu (sound, difficulty, etc.)

---

*Game is in active development. Features are being added incrementally.*
