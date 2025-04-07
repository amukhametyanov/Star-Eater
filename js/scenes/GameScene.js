// js/scenes/GameScene.js
import StarEater from '../gameObjects/StarEater.js';

// --- Constants ---
const MAX_STARS = 300;
const STAR_RESPAWN_TIME = 3000;
const VACUUM_RADIUS = 60;
const VACUUM_SPEED = 280;
const FRAME_COLOR = 0x888888; // Color for the boundary frame (light grey)
const FRAME_THICKNESS = 5;    // Thickness of the frame

const BODY_EAT_DISTANCE_THRESHOLD = 10; // Pixels: segment center to star center

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.starEater = null;
        this.stars = null;
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.boundaryFrame = null; // Reference to the graphics object for the frame
    }

    init(data) {
        this.worldWidth = data.worldWidth || 5000;
        this.worldHeight = data.worldHeight || 5000;
        console.log(`GameScene initialized with world: ${this.worldWidth}x${this.worldHeight}`);
    }

    preload() {
        console.log("GameScene preload");
        this.load.image('circle', 'assets/circle.png');
        this.makeStarTexture();
    }

    create() {
        console.log("GameScene create");

        // --- World and Camera Setup ---
        // Set world bounds for PHYSICS
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Set background color for the CAMERA (this will be the void color)
        // this.cameras.main.setBackgroundColor('#000000'); // Black void

        // --- Draw Visual Boundary Frame ---
        this.drawBoundaryFrame();

        // --- Create Game Objects ---
        this.starEater = new StarEater(this, this.worldWidth / 2, this.worldHeight / 2);

        // Make the camera follow (no bounds, so it can show the void)
        this.cameras.main.startFollow(this.starEater.head, true, 0.08, 0.08);

        // --- Create Stars Group ---
        this.stars = this.physics.add.group({
            key: 'star',
            maxSize: MAX_STARS,
            runChildUpdate: false
        });

        // Spawn initial stars
        for (let i = 0; i < MAX_STARS; i++) {
            this.spawnStar(); // Spawn randomly
        }

        // --- Setup Physics Collisions ---
        this.physics.add.overlap(
            this.starEater.head,
            this.stars,
            this.eatStar,
            null,
            this
        );

        // --- Placeholder for head-body collision ---
        // ...
    }

    update(time, delta) {
        // Update Star Eater IF it exists and is not dead
        if (this.starEater && !this.starEater.isDead) {
            this.starEater.update(time, delta);
        }

        // --- Star Vacuum & Body Eating Logic ---
        if (this.starEater && !this.starEater.isDead && this.stars) {
            const headX = this.starEater.head.x;
            const headY = this.starEater.head.y;
            const bodyParts = this.starEater.bodyParts; // Get reference to body parts

            // Iterate through active stars
            this.stars.children.iterate(star => {
                // Ensure star is valid and active before processing
                if (!star || !star.active || !star.body) {
                    return true; // Continue iteration
                }

                const starX = star.x;
                const starY = star.y;
                let eatenByBody = false; // Flag to prevent double processing

                // --- Vacuum Logic (applied first) ---
                const distanceToHead = Phaser.Math.Distance.Between(starX, starY, headX, headY);
                if (distanceToHead < VACUUM_RADIUS) {
                    const angle = Phaser.Math.Angle.Between(starX, starY, headX, headY);
                    this.physics.velocityFromRotation(angle, VACUUM_SPEED, star.body.velocity);
                } else {
                    // Stop vacuum if outside radius
                    if (star.body.velocity.x !== 0 || star.body.velocity.y !== 0) {
                        star.body.setVelocity(0, 0);
                    }
                }

                // --- NEW: Body Segment Eating Check ---
                // Loop through body parts (SKIP the head - index 0)
                for (let i = 1; i < bodyParts.length; i++) {
                    const segment = bodyParts[i];
                    if (!segment) continue; // Skip if segment somehow invalid

                    const distanceToSegment = Phaser.Math.Distance.Between(
                        starX, starY,
                        segment.x, segment.y
                    );

                    // Check if close enough to this segment
                    if (distanceToSegment < BODY_EAT_DISTANCE_THRESHOLD) {
                        console.log(`Star near segment ${i}, distance: ${distanceToSegment.toFixed(1)}`);
                        // Trigger eat logic (similar to eatStar, but call directly)
                        this.killAndRespawnStar(star);
                        eatenByBody = true; // Mark as eaten
                        break; // Exit the inner loop (no need to check other segments for this star)
                    }
                }
                // --- END NEW Body Segment Eating Check ---

                // Continue to next star
                return true;
            }); // End star iteration
        } // End main check

        // --- Star Spawning ---
        if (this.stars && this.stars.countActive(true) < MAX_STARS) {
             this.spawnStar();
        }
    } // End update()

    // --- Helper Methods ---

    drawBoundaryFrame() {
        // Destroy previous frame if exists (useful on restart)
        if (this.boundaryFrame) {
            this.boundaryFrame.destroy();
        }
        this.boundaryFrame = this.add.graphics();
        this.boundaryFrame.lineStyle(FRAME_THICKNESS, FRAME_COLOR, 1); // Thickness, color, alpha
        // Draw rectangle slightly inside bounds if thickness is large, or directly on bounds
        const offset = FRAME_THICKNESS / 2;
        this.boundaryFrame.strokeRect(
            offset,                         // x
            offset,                         // y
            this.worldWidth - FRAME_THICKNESS, // width
            this.worldHeight - FRAME_THICKNESS // height
        );
        // Optional: Set depth if needed, e.g., behind the player
        // this.boundaryFrame.setDepth(-1);
    }


    makeStarTexture() {
        // (Same as before)
        if (!this.textures.exists('star')) {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(3, 3, 3);
            graphics.generateTexture('star', 6, 6);
            graphics.destroy();
            console.log("Generated star texture.");
        }
    }

    spawnStar() {
        // Spawns a star at a random location within bounds
        if (!this.stars || this.stars.countActive(true) >= MAX_STARS) {
            return;
        }
        const margin = 50 + FRAME_THICKNESS; // Keep away from frame visually
        const x = Phaser.Math.Between(margin, this.worldWidth - margin);
        const y = Phaser.Math.Between(margin, this.worldHeight - margin);
        this.spawnStarAt(x, y); // Use the specific spawn function
    }

    spawnStarAt(x, y) {
        // Spawns or gets a star at a specific X, Y
        if (!this.stars) return null;

        const star = this.stars.get(x, y, 'star');
        if (star) {
            star.setActive(true);
            star.setVisible(true);
            if (star.body) {
                star.body.reset(x, y);
                star.body.enable = true;
                star.body.setVelocity(0, 0);
                star.body.setAllowGravity(false);
                // Optional: prevent stars colliding with world bounds?
                // star.body.setCollideWorldBounds(false);
            } else {
                 console.warn("Star lacks physics body during spawn!");
            }
        }
        return star;
    }


    // Original overlap callback - still needed for head collision!
    eatStar(head, star) {
        // This function is now primarily triggered by direct head overlap.
        // The body check calls killAndRespawnStar directly.
        // We add checks here to prevent processing if already handled by body check.
        if (!star || !star.active || !this.starEater || this.starEater.isDead) {
            return;
        }
        console.log("Star eaten by HEAD overlap.");
        this.killAndRespawnStar(star);
    }

    // --- NEW Helper to consolidate star killing/respawning ---
    killAndRespawnStar(star) {
        if (!star || !star.active) {
            return; // Already processed or invalid
        }

        // Disable the star
        this.stars.killAndHide(star);
        if (star.body) {
            star.body.enable = false;
            star.body.setVelocity(0, 0);
        }

        // Tell the Star Eater to grow (if it's alive)
        if (this.starEater && !this.starEater.isDead) {
            this.starEater.grow();
        }

        // Respawn *another* star after a delay
        this.time.delayedCall(STAR_RESPAWN_TIME, this.spawnStar, [], this);
    }
    // --- END NEW Helper ---


    // --- Game Over Logic ---
    gameOver(deadStarEater) {
        // Check if already processed or invalid
        if (!deadStarEater || deadStarEater.isDead) {
             console.log("gameOver called on already dead or invalid eater.");
             return;
        }
        console.log("GAME OVER - Processing Star Eater Death!");

        // 1. Mark as dead immediately
        deadStarEater.isDead = true; // Mark on the object itself

        // 2. Stop physics and camera
        if (deadStarEater.head && deadStarEater.head.body) {
            deadStarEater.head.body.enable = false;
            deadStarEater.head.body.setVelocity(0, 0);
        }
        this.cameras.main.stopFollow();

        // --- ADD GAME OVER TEXT (Fix for Issue 3) ---
        const gameOverText = this.add.text(
            this.cameras.main.midPoint.x, // Use camera midpoint for centering
            this.cameras.main.midPoint.y,
            'GAME OVER',
            { fontSize: '64px', fill: '#ff0000', align: 'center' }
        );
        gameOverText.setOrigin(0.5); // Center the text origin
        gameOverText.setScrollFactor(0); // Fix text to camera viewport
        gameOverText.setDepth(100); // Ensure text is on top
        // --- END GAME OVER TEXT ---


        // 3. Explode: Spawn stars (add logging)
        console.log("Spawning stars from segments...");
        if (deadStarEater.bodyParts && this.stars) {
            // IMPORTANT: Iterate backwards if destroying elements in the loop can affect indices,
            // OR create a copy of coordinates first. Let's copy coordinates.
            const segmentPositions = deadStarEater.bodyParts.map(segment => ({ x: segment.x, y: segment.y }));

            segmentPositions.forEach((pos, index) => {
                // Only spawn if position is valid (simple check)
                if (typeof pos.x === 'number' && typeof pos.y === 'number') {
                    console.log(` - Spawning star for segment ${index} at ${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}`);
                    this.spawnStarAt(pos.x, pos.y);
                } else {
                    console.warn(` - Invalid position for segment ${index}`);
                }
            });
            console.log("Finished spawning stars.");
        } else {
            console.warn("Could not spawn stars: bodyParts or stars group missing.");
        }

        // 4. Destroy the old Star Eater parts (add logging)
        console.log("Destroying Star Eater segments...");
        if (deadStarEater.bodyParts) {
            // Use a simple loop, destroying safely
            while(deadStarEater.bodyParts.length > 0) {
                const segment = deadStarEater.bodyParts.pop(); // Remove from end
                if (segment) {
                    // console.log(" - Destroying segment: ", segment); // Can be verbose
                    segment.destroy();
                }
            }
            console.log("Finished destroying segments.");
            // bodyParts array is now empty
        } else {
             console.warn("Could not destroy segments: bodyParts missing.");
        }
        // Ensure the scene reference is cleared AFTER destruction is attempted
        this.starEater = null;

        // 5. Restart the scene after a delay
        console.log("Scheduling scene restart...");
        this.time.delayedCall(2500, () => { // Slightly longer delay to see message
             console.log("Executing scene restart.");
             // Clean up text before restart if needed (usually scene restart handles it)
             // if(gameOverText) gameOverText.destroy();
             this.scene.restart();
        }, [], this);
    } // End gameOver
    
}