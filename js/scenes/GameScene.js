// js/scenes/GameScene.js
import StarEater from '../gameObjects/StarEater.js';
import BotStarEater from '../gameObjects/BotStarEater.js';
import { showPopup, hidePopup } from '../endGamePopup/PopupManager.js';

// --- Constants ---
const MAX_STARS = 600;
const STAR_RESPAWN_TIME = 1000;
// const VACUUM_RADIUS = 60; // No longer used
// const VACUUM_SPEED = 280; // No longer used
const FRAME_COLOR = 0x888888;
const FRAME_THICKNESS = 5;
// const BODY_EAT_DISTANCE_THRESHOLD = 12; // No longer used

// --- Star Appearance Constants ---
const STAR_COLORS = [
    0xff4d4d, 0x87cefa, 0xffff00, 0xfffacd, 0xffffff
];
const STAR_VISUAL_RADIUS = 5;
const STAR_TEXTURE_SIZE = STAR_VISUAL_RADIUS * 2 + 4;

// --- Star Spacing Constants ---
const MIN_STAR_DISTANCE = (STAR_VISUAL_RADIUS * 2) + 20;
const MAX_SPAWN_ATTEMPTS = 20;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.playerStarEater = null;
        this.botStarEater = null;
        this.stars = null;
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.boundaryFrame = null;
        this.starEaterHeadsGroup = null;
        this.starEaterBodiesGroup = null;
        this.activeStarEaters = [];
    }

    init(data) {
        this.worldWidth = data.worldWidth || 5000;
        this.worldHeight = data.worldHeight || 5000;
        console.log(`GameScene initialized with world: ${this.worldWidth}x${this.worldHeight}`);
        this.activeStarEaters = []; // Reset on init/restart
    }

    preload() {
        console.log("GameScene preload");
        this.load.image('segment', 'assets/segment.png');
        this.load.image('low-level-head', 'assets/low-level-head.png');
        this.load.image('middle-level-head', 'assets/middle-level-head.png');
        this.load.image('max-level-head', 'assets/max-level-head.png');
        this.load.image('background_nebula', 'assets/universe_bg_tile_nebula.png');
        this.makeStarTexture();
    }

    create() {
        console.log("GameScene create");

        // Background
        this.add.tileSprite(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 'background_nebula');

        // World Bounds Physics & Visual Frame
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.drawBoundaryFrame();

        // Physics Groups
        this.starEaterHeadsGroup = this.physics.add.group();
        this.starEaterBodiesGroup = this.physics.add.group();
        console.log("Created heads and bodies physics groups.");

        // Stars Group
        this.stars = this.physics.add.group({
            key: 'star',
            maxSize: MAX_STARS,
            runChildUpdate: false
        });
        for (let i = 0; i < MAX_STARS; i++) {
            this.spawnStar();
        }

        // Player Star Eater
        const playerStartX = this.worldWidth / 2 - 200;
        const playerStartY = this.worldHeight / 2;
        this.playerStarEater = new StarEater(this, playerStartX, playerStartY, this.starEaterHeadsGroup, this.starEaterBodiesGroup);
        this.activeStarEaters.push(this.playerStarEater);
        console.log("Player StarEater created.");

        // Bot Star Eater
        const botStartX = this.worldWidth / 2 + 200;
        const botStartY = this.worldHeight / 2;
        this.botStarEater = new BotStarEater(this, botStartX, botStartY, this.starEaterHeadsGroup, this.starEaterBodiesGroup);
        this.activeStarEaters.push(this.botStarEater);
        console.log("Bot StarEater created.");

        // Camera Follow Player (NO BOUNDS)
        if (this.playerStarEater && this.playerStarEater.head) {
            this.cameras.main.startFollow(this.playerStarEater.head, true, 0.08, 0.08);
            console.log("Camera set to follow player WITHOUT bounds.");
            // this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight); // REMOVED
        }

        // --- Setup Physics Collisions & Overlaps ---

        // 1. HEAD vs BODY Collision
        this.physics.add.overlap(
            this.starEaterHeadsGroup,
            this.starEaterBodiesGroup,
            this.handleHeadBodyCollision, // Callback
            this.checkDifferentEaters,    // Process Callback
            this                            // Context
        );
        console.log("Added Head vs Body overlap check.");

        // 2. HEAD vs STAR Collision
        this.physics.add.overlap(
            this.starEaterHeadsGroup,
            this.stars,
            this.handleHeadStarCollision, // Callback
            null,                         // No process callback needed
            this                            // Context
        );
        console.log("Added Head vs Star overlap check.");

        // 3. HEAD vs WORLD BOUNDS (using the existing physics world listener)
        // The StarEater class sets `onWorldBounds = true` on its head.
        // We listen for the custom event emitted by StarEater's boundary handler.
        this.events.on('starEaterHitBoundary', this.handleEaterBoundaryCollision, this);
        console.log("Added listener for 'starEaterHitBoundary' event.");

    } // End create()


    // --- Collision Callback & Process Functions ---

    // Process Callback: Only allow overlap if head and segment belong to DIFFERENT StarEaters
    checkDifferentEaters(head, segment) {
        // Basic check: are game objects defined?
        if (!head || !segment) return false;

        const headOwner = head.parentStarEater;
        const segmentOwner = segment.parentStarEater;

        // Check if owners exist, are different, and NEITHER is dead
        const isValid = headOwner && segmentOwner && headOwner !== segmentOwner && !headOwner.isDead && !segmentOwner.isDead;

        // Optional logging (can be noisy)
        // if (isValid) {
        //    console.log(`checkDifferentEaters: Valid collision potential between ${headOwner.constructor.name} head and ${segmentOwner.constructor.name} segment.`);
        // }

        return isValid;
    }

    // Collision Callback: Head hits a valid body segment (filtered by checkDifferentEaters)
    handleHeadBodyCollision(head, segment) {
        const headOwner = head.parentStarEater;
        const segmentOwner = segment.parentStarEater; // For logging

        console.log(`!!! handleHeadBodyCollision called: Head Owner=${headOwner?.constructor.name}(dead:${headOwner?.isDead}), Segment Owner=${segmentOwner?.constructor.name}(dead:${segmentOwner?.isDead})`);

        // Double-check headOwner is valid and NOT already dead before triggering game over
        if (headOwner && !headOwner.isDead) {
            console.log(`>>> Collision Confirmed! ${headOwner.constructor.name}'s head hit ${segmentOwner.constructor.name}'s body. Calling gameOver.`);
            // Pass the one whose head hit the body
            this.gameOver(headOwner, `${headOwner.constructor.name} collided with another Star Eater!`);
        } else {
            console.log(`>>> Collision detected but head owner invalid or already dead.`);
        }
    }

    // Collision Callback: Head hits a star
    handleHeadStarCollision(head, star) {
        const headOwner = head.parentStarEater;

        // Ensure owner exists, isn't dead, and star is valid and active
        if (headOwner && !headOwner.isDead && star && star.active) {
             // console.log(`${headOwner.constructor.name} checking star collision`); // Noisy
             this.killAndRespawnStar(star, headOwner); // Pass the eater
        }
    }

    // Boundary Collision Handler (triggered by event from StarEater)
    handleEaterBoundaryCollision(eater) {
        console.log(`Scene received 'starEaterHitBoundary' event for: ${eater ? eater.constructor.name : 'undefined eater'}`);
        if (eater && !eater.isDead) {
            console.log(`>>> ${eater.constructor.name} confirmed hit boundary. Calling gameOver.`);
            this.gameOver(eater, `${eater.constructor.name} hit the boundary!`);
        } else {
             console.log(`>>> Boundary event received, but eater invalid or dead (Eater: ${eater}, Dead: ${eater?.isDead})`);
        }
    }

    // --- Main Update Loop ---
    update(time, delta) {

        // --- Player Input Handling ---
        if (this.playerStarEater && !this.playerStarEater.isDead) {
            const pointer = this.input.activePointer;
            // Convert screen pointer coords to world coords relative to the camera
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

            // Calculate angle from the player's head to the world point
            const targetAngle = Phaser.Math.Angle.Between(
                this.playerStarEater.head.x, this.playerStarEater.head.y,
                worldPoint.x, worldPoint.y
            );

            this.playerStarEater.setTargetAngle(targetAngle);
            this.playerStarEater.update(time, delta); // Call player's update
        }

        // --- Bot Update ---
        if (this.botStarEater && !this.botStarEater.isDead) {
            this.botStarEater.update(time, delta); // Call bot's update (includes AI)
        }

        // --- Star Spawning ---
        if (this.stars && this.stars.countActive(true) < MAX_STARS) {
             this.spawnStar(); // Keep spawning if below max
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

    makeStarTexture() {
        if (!this.textures.exists('star')) {
            const graphics = this.make.graphics();
            const centerX = STAR_TEXTURE_SIZE / 2;
            const centerY = STAR_TEXTURE_SIZE / 2;
            graphics.fillStyle(0xffffff, 1.0);
            graphics.fillCircle(centerX, centerY, STAR_VISUAL_RADIUS);
            graphics.generateTexture('star', STAR_TEXTURE_SIZE, STAR_TEXTURE_SIZE);
            graphics.destroy();
            // console.log(`Generated SOLID star texture (Radius: ${STAR_VISUAL_RADIUS}).`);
        }
    }

    spawnStar() {
        if (!this.stars || this.stars.countActive(true) >= MAX_STARS) {
            return;
        }

        const margin = 50 + FRAME_THICKNESS;
        let attempts = 0;
        let validPositionFound = false;
        let spawnX = 0;
        let spawnY = 0;

        while (attempts < MAX_SPAWN_ATTEMPTS && !validPositionFound) {
            attempts++;
            spawnX = Phaser.Math.Between(margin, this.worldWidth - margin);
            spawnY = Phaser.Math.Between(margin, this.worldHeight - margin);
            validPositionFound = true;

            this.stars.children.iterate(existingStar => {
                if (!existingStar || !existingStar.active || !validPositionFound) {
                    return true;
                }
                const distance = Phaser.Math.Distance.Between(spawnX, spawnY, existingStar.x, existingStar.y);
                if (distance < MIN_STAR_DISTANCE) {
                    validPositionFound = false;
                    return false; // Stop inner iteration for this attempt
                }
                return true;
            });
        }

        if (validPositionFound) {
            this.spawnStarAt(spawnX, spawnY);
        } else {
            console.warn(`Could not find a valid non-overlapping position for star after ${MAX_SPAWN_ATTEMPTS} attempts.`);
            // Optional: Spawn anyway if needed, even if overlapping
            // this.spawnStarAt(spawnX, spawnY);
        }
    }

    spawnStarAt(x, y) {
        if (!this.stars) return null;
        const star = this.stars.get(x, y, 'star');
        if (star) {
            star.setActive(true);
            star.setVisible(true);
            const randomColor = Phaser.Math.RND.pick(STAR_COLORS);
            star.setTint(randomColor);

            if (star.body) {
                star.body.reset(x, y);
                star.body.enable = true;
                star.body.setVelocity(0, 0);
                star.body.setAllowGravity(false);
                star.body.setCircle(STAR_VISUAL_RADIUS); // Use visual radius for physics body
                 star.body.setOffset( // Center the circle body
                    star.width / 2 - STAR_VISUAL_RADIUS,
                    star.height/ 2 - STAR_VISUAL_RADIUS
                );
            } else {
                 console.warn("Star lacks physics body during spawn!");
            }
        }
        return star;
    }

    killAndRespawnStar(star, eater) { // Added 'eater' parameter
        if (!star || !star.active) {
            return;
        }

        this.stars.killAndHide(star);
        if (star.body) {
            star.body.enable = false;
            star.body.setVelocity(0, 0);
        }

        if (eater && !eater.isDead) {
            eater.grow();
        } else {
            console.warn("killAndRespawnStar called without a valid eater.");
        }

        this.time.delayedCall(STAR_RESPAWN_TIME, this.spawnStar, [], this);
    }

    // --- Game Over Logic ---
    async gameOver(deadStarEater, message = "GAME OVER") {
        if (!deadStarEater || deadStarEater.isDead) {
            // console.log("gameOver called on already dead or invalid eater."); // Can be noisy if events fire rapidly
            return; // Avoid processing death multiple times
        }
        console.log(`GAME OVER triggered for ${deadStarEater.constructor.name}`);

        // 1. Mark the specific eater as dead IMMEDIATELY
        deadStarEater.markAsDead();

        // 2. Stop camera if following the player and player died
        if (this.playerStarEater === deadStarEater && this.cameras.main.following === this.playerStarEater.head) {
             console.log("Stopping camera follow.");
            this.cameras.main.stopFollow();
        }

        // 3. Remove from active list (important for win/loss checks)
        this.activeStarEaters = this.activeStarEaters.filter(eater => eater !== deadStarEater);
        console.log(`Active eaters remaining: ${this.activeStarEaters.length}`);

        // 4. Determine game outcome
        let popupTitle = "GAME OVER";
        let popupMessage = message;
        let isPlayerDead = (deadStarEater === this.playerStarEater);
        let showEndPopup = false; // Decide whether to show the final popup

        if (isPlayerDead) {
            // Player died, always show game over popup
            showEndPopup = true;
            console.log("Player died. Preparing Game Over popup.");
        } else {
            // Bot died. Check if player is still alive.
            const playerIsAlive = this.activeStarEaters.some(eater => eater === this.playerStarEater && !eater.isDead);
            if (playerIsAlive) {
                // Player is alive and bot died - Victory!
                 popupTitle = "VICTORY!";
                 popupMessage = "You defeated the opponent!";
                 showEndPopup = true; // Show victory popup
                 console.log("Bot died, player alive. Preparing Victory popup.");
            } else {
                // Bot died, but player was already dead? (Shouldn't happen with current logic but handle defensively)
                 console.log("Bot died, but player was not found in active list or was already dead. No popup.");
                 showEndPopup = false;
            }
        }

         // 5. Explode the dead eater (Spawn stars) AFTER determining outcome
        console.log(`Destroying ${deadStarEater.constructor.name} and spawning stars...`);
        const segmentPositions = deadStarEater.destroy(true); // Call destroy with explode = true

        if (segmentPositions && this.stars) {
             segmentPositions.forEach((pos) => {
                if (typeof pos.x === 'number' && typeof pos.y === 'number') {
                    const offsetX = Phaser.Math.FloatBetween(-5, 5);
                    const offsetY = Phaser.Math.FloatBetween(-5, 5);
                    this.spawnStarAt(pos.x + offsetX, pos.y + offsetY);
                }
            });
            // console.log(`Finished spawning stars from ${deadStarEater.constructor.name}.`);
        } else {
            console.log(`No segments to spawn stars from for ${deadStarEater.constructor.name}.`);
        }

        // 6. Show Popup and set up restart (if applicable)
        if (showEndPopup) {
            try {
                 console.log(`Showing Popup: Title='${popupTitle}', Message='${popupMessage}'`);
                 await showPopup(popupMessage, {
                    title: popupTitle,
                    buttonText: 'Start Over',
                    onButtonClick: () => {
                        hidePopup();
                        console.log(">>> Start Over clicked <<<");
                        // --- IMPORTANT: Remove listener before restart ---
                        console.log("Removing boundary listener before scene restart.");
                        this.events.off('starEaterHitBoundary', this.handleEaterBoundaryCollision, this);
                        // Restart the ENTIRE scene
                        this.scene.restart();
                    }
                });
                console.log("Popup display initiated.");
            } catch (error) {
                console.error("Failed to show Game Over/Victory popup:", error);
            }
        } else {
             console.log("No end popup condition met.");
             // Cleanup references if no popup (otherwise restart handles it)
             if (deadStarEater === this.playerStarEater) this.playerStarEater = null;
             if (deadStarEater === this.botStarEater) this.botStarEater = null;
        }

        console.log(`gameOver processing complete for ${deadStarEater.constructor.name}.`);

    } // End gameOver

} // End Scene Class