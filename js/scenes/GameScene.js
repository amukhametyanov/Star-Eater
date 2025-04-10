// js/scenes/GameScene.js
import StarEater from '../gameObjects/StarEater.js';
import { showPopup, hidePopup } from '../endGamePopup/PopupManager.js'; // Ensure path is correct

// --- Constants ---
const MAX_STARS = 500; // Or your desired max
const STAR_RESPAWN_TIME = 1000;
const VACUUM_RADIUS = 60; // Adjust as needed
const VACUUM_SPEED = 280; // Adjust as needed
const FRAME_COLOR = 0x888888;
const FRAME_THICKNESS = 5;
const BODY_EAT_DISTANCE_THRESHOLD = 12; // Adjust based on STAR_VISUAL_RADIUS

// --- Star Appearance Constants ---
const STAR_COLORS = [
    0xff4d4d, // Red
    0x87cefa, // Light Blue
    0xffff00, // Yellow
    0xfffacd, // Light Yellow
    0xffffff  // White
];
const STAR_VISUAL_RADIUS = 5; // Radius of the solid core (adjust for look)
const STAR_TEXTURE_SIZE = STAR_VISUAL_RADIUS * 2 + 4; // Calculate texture size

// --- Star Spacing Constants ---
const MIN_STAR_DISTANCE = (STAR_VISUAL_RADIUS * 2) + 20; // Minimum distance between star centers
const MAX_SPAWN_ATTEMPTS = 20; // Max tries to find a non-overlapping spot

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.starEater = null;
        this.stars = null;
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.boundaryFrame = null;
    }

    init(data) {
        this.worldWidth = data.worldWidth || 5000;
        this.worldHeight = data.worldHeight || 5000;
        console.log(`GameScene initialized with world: ${this.worldWidth}x${this.worldHeight}`);
    }

    preload() {
        console.log("GameScene preload");
        this.load.image('segment', 'assets/segment.png');
        this.load.image('star-eater-head', 'assets/star-eater-head.png');
        this.load.image('background_nebula', 'assets/universe_bg_tile_nebula.png');
        // Generate the star texture (Solid Core Only)
        this.makeStarTexture();
    }

    create() {
        console.log("GameScene create");

        // --- >>> ADD THE TILESPRITE BACKGROUND <<< ---
    // Create a TileSprite that covers the entire world dimensions
    // Position its center at the center of the world
    let bg = this.add.tileSprite(
        this.worldWidth / 2,  // Center X of the world
        this.worldHeight / 2, // Center Y of the world
        this.worldWidth,      // Width matching the world
        this.worldHeight,     // Height matching the world
        'background_nebula'   // Key of the loaded background image
    );

        // World and Physics Setup
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Draw Visual Boundary Frame
        this.drawBoundaryFrame();

        // Create Star Eater
        this.starEater = new StarEater(this, this.worldWidth / 2, this.worldHeight / 2);

        // Camera Follow
        this.cameras.main.startFollow(this.starEater.head, true, 0.08, 0.08);

        // Create Stars Group
        this.stars = this.physics.add.group({
            key: 'star', // Texture key from makeStarTexture
            maxSize: MAX_STARS,
            runChildUpdate: false // We manually update stars in the scene's update
        });

        // Spawn initial stars (using the non-overlapping logic)
        for (let i = 0; i < MAX_STARS; i++) {
            this.spawnStar();
        }

        // Setup Physics Collisions (Head eating)
        this.physics.add.overlap(
            this.starEater.head,
            this.stars,
            this.eatStar, // Callback for head overlap
            null,
            this
        );
    } // End create()

    update(time, delta) {
        // --- Update Star Eater ---
        if (this.starEater && !this.starEater.isDead) {
            this.starEater.update(time, delta);
        }

        // --- Star Vacuum & Body Eating Logic ---
        if (this.stars) {
            // Get player details safely, handling null/dead states
            const eaterAlive = this.starEater && !this.starEater.isDead;
            const headX = eaterAlive ? this.starEater.head.x : 0;
            const headY = eaterAlive ? this.starEater.head.y : 0;
            const bodyParts = eaterAlive ? this.starEater.bodyParts : [];

            this.stars.children.iterate(star => {
                // Skip inactive or invalid stars immediately
                if (!star || !star.active) {
                    return true; // Continue to next star in iteration
                }

                // --- Physics Interactions (Vacuum & Eating - only if player is alive) ---
                if (eaterAlive && star.body) {
                    const starX = star.x;
                    const starY = star.y;
                    let eaten = false; // Flag to prevent processing after eating

                    // Vacuum Check
                    const distanceToHead = Phaser.Math.Distance.Between(starX, starY, headX, headY);
                    if (distanceToHead < VACUUM_RADIUS) {
                        const angle = Phaser.Math.Angle.Between(starX, starY, headX, headY);
                        this.physics.velocityFromRotation(angle, VACUUM_SPEED, star.body.velocity);
                    } else {
                        // Stop vacuum movement if outside radius
                        if (star.body.velocity.x !== 0 || star.body.velocity.y !== 0) {
                            star.body.setVelocity(0, 0);
                        }
                    }

                    // Body Segment Eating Check
                    for (let i = 1; i < bodyParts.length; i++) {
                        const segment = bodyParts[i];
                        if (!segment) continue; // Should not happen, but safety check

                        const distanceToSegment = Phaser.Math.Distance.Between(starX, starY, segment.x, segment.y);
                        if (distanceToSegment < BODY_EAT_DISTANCE_THRESHOLD) {
                            // console.log(`Star near segment ${i}, distance: ${distanceToSegment.toFixed(1)}`);
                            this.killAndRespawnStar(star);
                            eaten = true; // Mark as eaten
                            break; // Exit segment check loop for this star
                        }
                    }
                    // If eaten by body, return false to potentially stop iterate processing for this star
                    if (eaten) return false;

                } else if (star.body) {
                    // If player is dead or doesn't exist, ensure stars stop moving
                     if (star.body.velocity.x !== 0 || star.body.velocity.y !== 0) {
                            star.body.setVelocity(0, 0);
                     }
                }
                // --- End Physics Interactions ---

                return true; // Continue iteration to the next star
            }); // End star iteration
        }
        // --- End Star Update Loop ---


        // --- Star Spawning ---
        if (this.stars && this.stars.countActive(true) < MAX_STARS) {
             this.spawnStar(); // Use the revised spawnStar that checks for overlap
        }
    } // End update()

    // --- Helper Methods ---

    drawBoundaryFrame() {
        if (this.boundaryFrame) this.boundaryFrame.destroy();
        this.boundaryFrame = this.add.graphics();
        this.boundaryFrame.lineStyle(FRAME_THICKNESS, FRAME_COLOR, 1);
        const offset = FRAME_THICKNESS / 2;
        this.boundaryFrame.strokeRect(offset, offset, this.worldWidth - FRAME_THICKNESS, this.worldHeight - FRAME_THICKNESS);
    }

    // --- makeStarTexture (Solid Core Only) ---
    makeStarTexture() {
        if (!this.textures.exists('star')) {
            const graphics = this.make.graphics();
            const centerX = STAR_TEXTURE_SIZE / 2;
            const centerY = STAR_TEXTURE_SIZE / 2;

            // Draw the Solid Core ONLY
            graphics.fillStyle(0xffffff, 1.0); // Solid white
            graphics.fillCircle(centerX, centerY, STAR_VISUAL_RADIUS); // Core radius

            // Generate Texture
            graphics.generateTexture('star', STAR_TEXTURE_SIZE, STAR_TEXTURE_SIZE);
            graphics.destroy();
            console.log(`Generated SOLID star texture (Radius: ${STAR_VISUAL_RADIUS}).`);
        }
    }
    // --- END makeStarTexture ---


    // --- REVISED: spawnStar (Find Non-Overlapping Position) ---
    spawnStar() {
        // Ensure group exists and check limit
        if (!this.stars || this.stars.countActive(true) >= MAX_STARS) {
            return;
        }

        const margin = 50 + FRAME_THICKNESS; // Keep away from frame
        let attempts = 0;
        let validPositionFound = false;
        let spawnX = 0;
        let spawnY = 0;

        // Try to find a valid position up to MAX_SPAWN_ATTEMPTS times
        while (attempts < MAX_SPAWN_ATTEMPTS && !validPositionFound) {
            attempts++;
            // Generate a candidate position
            spawnX = Phaser.Math.Between(margin, this.worldWidth - margin);
            spawnY = Phaser.Math.Between(margin, this.worldHeight - margin);

            validPositionFound = true; // Assume position is valid initially

            // Check against all *active* stars
            this.stars.children.iterate(existingStar => {
                // Skip if the existing star is inactive or if we already found an overlap
                if (!existingStar || !existingStar.active || !validPositionFound) {
                    return true; // Continue iteration if needed
                }

                // Calculate distance to the existing active star
                const distance = Phaser.Math.Distance.Between(
                    spawnX, spawnY,
                    existingStar.x, existingStar.y
                );

                // If too close, mark position as invalid and stop checking for this attempt
                if (distance < MIN_STAR_DISTANCE) {
                    validPositionFound = false;
                    // console.log(`Spawn attempt ${attempts} failed: Too close to existing star at ${existingStar.x.toFixed(0)},${existingStar.y.toFixed(0)} (Dist: ${distance.toFixed(1)})`);
                    return false; // Stop iterating through existing stars for this attempt
                }
                return true; // Continue checking against other existing stars
            });
        } // End while loop

        // If a valid position was found (or max attempts reached), spawn the star
        if (validPositionFound) {
            // console.log(`Spawn attempt ${attempts} succeeded at ${spawnX.toFixed(0)}, ${spawnY.toFixed(0)}`);
            this.spawnStarAt(spawnX, spawnY);
        } else {
            console.warn(`Could not find a valid non-overlapping position for star after ${MAX_SPAWN_ATTEMPTS} attempts.`);
            // Optionally spawn anyway: this.spawnStarAt(spawnX, spawnY);
        }
    }
    // --- END REVISED spawnStar ---


    // --- spawnStarAt (Unchanged, places star at given coords) ---
    spawnStarAt(x, y) {
        if (!this.stars) return null;

        const star = this.stars.get(x, y, 'star'); // Get/reuse sprite using the texture
        if (star) {
            star.setActive(true);
            star.setVisible(true);
            // No alpha setting here (unless flicker is re-added)

            // Apply random tint
            const randomColor = Phaser.Math.RND.pick(STAR_COLORS);
            star.setTint(randomColor);

            // Reset physics body state
            if (star.body) {
                star.body.reset(x, y);
                star.body.enable = true;
                star.body.setVelocity(0, 0);
                star.body.setAllowGravity(false);
                // Set physics body size to match visual core
                star.body.setCircle(STAR_VISUAL_RADIUS);
            } else {
                 console.warn("Star lacks physics body during spawn!");
            }
        }
        return star;
    }
    // --- END spawnStarAt ---

    // Callback for head-star physics overlap
    eatStar(head, star) {
        // Add checks to prevent processing if player dead or star inactive
        if (!star || !star.active || !this.starEater || this.starEater.isDead) {
            return;
        }
        // console.log("Star eaten by HEAD overlap."); // Can be noisy
        this.killAndRespawnStar(star); // Consolidate eating logic
    }

    // Helper to handle star removal and respawn trigger
    killAndRespawnStar(star) {
        // Prevent double processing
        if (!star || !star.active) {
            return;
        }
        // No alpha reset needed

        // Disable and hide the star
        this.stars.killAndHide(star);
        if (star.body) {
            star.body.enable = false;
            star.body.setVelocity(0, 0);
        }

        // Grow the eater if it's alive
        if (this.starEater && !this.starEater.isDead) {
            this.starEater.grow();
        }

        // Schedule a new star spawn
        this.time.delayedCall(STAR_RESPAWN_TIME, this.spawnStar, [], this);
    }

    // Game Over logic
    async gameOver(deadStarEater) {
        if (!deadStarEater || deadStarEater.isDead) {
            console.log("gameOver called on already dead or invalid eater.");
            return;
        }
        console.log("GAME OVER - Processing Star Eater Death!");

        // Mark dead, stop physics & camera
        deadStarEater.isDead = true;
        if (deadStarEater.head && deadStarEater.head.body) {
            deadStarEater.head.body.enable = false;
            deadStarEater.head.body.setVelocity(0, 0);
        }
        this.cameras.main.stopFollow();

        // Show HTML Popup
        try {
            await showPopup("You hit the boundary!", {
                title: 'GAME OVER',
                buttonText: 'Start Over',
                onButtonClick: () => {
                    hidePopup();
                    this.scene.restart();
                }
            });
        } catch (error) {
            console.error("Failed to show Game Over popup:", error);
        }

        // Explode: Spawn stars from segments
        console.log("Spawning stars from segments...");
        if (deadStarEater.bodyParts && this.stars) {
            const segmentPositions = deadStarEater.bodyParts.map(segment => ({ x: segment.x, y: segment.y }));
            segmentPositions.forEach((pos) => {
                if (typeof pos.x === 'number' && typeof pos.y === 'number') {
                    this.spawnStarAt(pos.x, pos.y);
                }
            });
            console.log("Finished spawning stars.");
        }

        // Destroy old Star Eater parts
        console.log("Destroying Star Eater segments...");
        if (deadStarEater.bodyParts) {
            while (deadStarEater.bodyParts.length > 0) {
                const segment = deadStarEater.bodyParts.pop();
                if (segment) segment.destroy();
            }
            console.log("Finished destroying segments.");
        }
        this.starEater = null; // Clear scene reference

        console.log("Game paused. Waiting for 'Start Over' button click.");
    } // End gameOver

} // End Scene Class