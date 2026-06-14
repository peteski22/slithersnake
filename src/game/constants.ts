// All tunable gameplay numbers live here so balancing is a one-file change.

// Body shape
export const SEGMENT_SPACING = 17;    // world units between body points (spaced but still overlapping)
export const START_SEGMENTS = 8;      // body points at spawn
export const BASE_RADIUS = 9;         // segment radius (px world units) at mass 0
export const GIRTH_FACTOR = 1.3;      // radius added per sqrt(mass)
export const MASS_PER_SEGMENT = 4;    // mass needed to add one body point

// Movement (same rules for every snake on every difficulty)
export const WORLD_WIDTH = 4200;      // rectangular arena width (landscape) — identical on all difficulties
export const WORLD_HEIGHT = 2800;     // rectangular arena height
export const BASE_SPEED = 150;        // world units/sec for every snake
export const TURN_RATE = 8.0;         // player max turn (rad/sec) — very tight; can loop on itself
export const BOT_TURN_RATE = 7.0;     // bot max turn (rad/sec)

// Growth / food
export const START_MASS = 12;
export const FOOD_RADIUS = 5;
export const FOOD_VALUE = 1;          // mass per normal pellet
export const FOOD_DENSITY = 0.00009;  // target pellets per world unit^2
export const DEATH_FOOD_SPACING = 14; // gap between pellets dropped by a dead snake
export const DEATH_FOOD_VALUE = 2;    // mass per death pellet (glowing/big)

// Boost
export const MIN_BOOST_MASS = 12;     // = START_MASS; can't boost once shrunk to the starting size
export const BOOST_DRAIN = 6;         // mass/sec lost while boosting
export const BOOST_MULTIPLIER = 1.8;  // speed multiplier while boosting
export const BOOST_DROP_INTERVAL = 0.15; // seconds between dropped pellets while boosting
