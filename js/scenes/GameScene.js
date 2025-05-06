// js/scenes/GameScene.js
import StarEater from '../gameObjects/StarEater.js';
import BotController from '../ai/BotController.js'; // ---> IMPORT BOT CONTROLLER
import { showPopup, hidePopup } from '../endGamePopup/PopupManager.js'; // Ensure path is correct
import { createScoreDisplay, updateScoreDisplay } from '../ui/ScoreDisplay.js'; // Import UI functions
import { createBoostDisplay, updateBoostDisplay } from '../ui/BoostDisplay.js';

// --- Constants ---
const MAX_STARS = 600;
const STAR_RESPAWN_TIME = 1000;
const VACUUM_RADIUS = 60;
const VACUUM_SPEED = 280;
const FRAME_COLOR = 0x888888;
const FRAME_THICKNESS = 5;
const BODY_EAT_DISTANCE_THRESHOLD = 12;

// Boost UI
const BOOST_DURATION = 2.0;
const BOOST_COOLDOWN = 5.0;

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

        this.starEater = null;        // Player's StarEater instance
        this.botController = null;    // Controller for the AI bot
        this.playerBodyGroup = null;  // Physics group for Player's body segments ONLY
        this.stars = null;            // Physics group for stars
        this.scoreText = null; // Property to hold the score text object
        this.boostUI = null; 
        this.isInitialized = false; // Keep scene init flag
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.boundaryFrame = null;
        this.gameOverActive = false; // Flag to prevent duplicate game over triggers
        this.playerHeadStarOverlap = null; // Track player-vs-star overlap
        this.playerHeadBotBodyOverlap = null; // Track player-vs-bot overlap
    }

    init(data) {
        this.worldWidth = data.worldWidth || 5000;
        this.worldHeight = data.worldHeight || 5000;
        this.gameOverActive = false; // Reset flag on scene start/restart
        console.log(`GameScene initialized with world: ${this.worldWidth}x${this.worldHeight}`);
    }

    preload() {
        console.log("GameScene preload");
        // Load common assets
        this.load.image('segment', 'assets/segment.png');
        this.load.image('low-level-head', 'assets/low-level-head.png');
        this.load.image('middle-level-head', 'assets/middle-level-head.png');
        this.load.image('max-level-head', 'assets/max-level-head.png');
        this.load.image('background_nebula', 'assets/universe_bg_tile_nebula.png');
        this.load.image('boost-icon', 'assets/lightning.png');
        // Generate the star texture
        this.makeStarTexture();
    }

    create() {
        console.log("GameScene create");
        this.gameOverActive = false; // Ensure flag is reset
        this.isInitialized = false;

        // --- Background, World, Frame ---
        this.add.tileSprite(
            this.worldWidth / 2, this.worldHeight / 2,
            this.worldWidth, this.worldHeight,
            'background_nebula'
        );
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.drawBoundaryFrame();
        // --- End Background ---

        // --- Create Player Star Eater ---
        // Start player somewhat off-center to make space
        const playerStartX = this.worldWidth / 3;
        const playerStartY = this.worldHeight / 2;
        // Pass 'player' identifier
        this.starEater = new StarEater(this, playerStartX, playerStartY, 'player');

        // --- Create Player Body Segment Group ---
        // This group is used for collision checks (e.g., bot head hitting player body)
        this.playerBodyGroup = this.physics.add.group();
        this.updatePlayerBodyGroup(); // Populate initially

        // --- Camera Follow Player ---
        this.cameras.main.startFollow(this.starEater.head, true, 0.08, 0.08);

        // --- Create Score Display UI (Phaser Text) --- // Keep Phaser score
        this.scoreText = createScoreDisplay(this);
        if (this.scoreText) {
            updateScoreDisplay(this.scoreText, 0); // Set initial score
        } else { console.warn("Failed to create Phaser score text."); }
        // --- End Score Display --- //

        // --- Create Boost Display UI (Phaser Objects) --- // This section
        // Position it relative to the score text (adjust offsets as needed)
        if (this.scoreText) { // Position based on score text if it exists
            const scoreBounds = this.scoreText.getBounds();
            // Place boost UI to the right of the score, vertically centered
            const boostX = scoreBounds.right + 60; // Adjust 60px gap as needed
            const boostY = scoreBounds.centerY;
            this.boostUI = createBoostDisplay(this, boostX, boostY, 'boost-icon');
        } else { // Fallback position if score text failed
            console.warn("Score text missing, placing boost UI at default position.");
            this.boostUI = createBoostDisplay(this, this.cameras.main.width * 0.75, 40, 'boost-icon');
        }
        // --- End Boost Display --- //


        // --- Create Stars Group ---
        this.stars = this.physics.add.group({
            key: 'star', // Texture key from makeStarTexture
            maxSize: MAX_STARS,
            runChildUpdate: false // Manual star updates
        });
        this.makeStarTexture(); // Must happen before stars are added if using 'star' key
        // Spawn initial stars with overlap avoidance
        for (let i = 0; i < MAX_STARS; i++) {
            this.spawnStar();
        }
        // --- End Stars Group ---

        // --- Create Bot Controller and Bot ---
        this.botController = new BotController(this, this.starEater, this.stars);
        // Start bot on the other side
        const botStartX = this.worldWidth * (2 / 3);
        const botStartY = this.worldHeight / 2;
        // The controller creates the bot's StarEater instance internally
        this.botController.createBot(botStartX, botStartY);
        // --- End Bot Creation ---


        // --- Setup Physics Collisions ---
        console.log("Setting up physics overlaps...");

        // Track overlap objects for toggling
        this.playerHeadStarOverlap = this.physics.add.overlap(
            this.starEater.head,
            this.stars,
            this.handleEatStar, // Use scene's handler
            (playerHead, star) => star?.active && this.starEater && !this.starEater.isDead, // Process check
            this // Context
        );

        const botBodyGroup = this.botController?.getBotBodyGroup(); // Safely get bot group
        if (this.starEater?.head && botBodyGroup) {
            this.playerHeadBotBodyOverlap = this.physics.add.overlap(
                this.starEater.head,
                botBodyGroup,
                this.handlePlayerHitBotBody, // Callback defined below
                (playerHead, botSegment) => { // Process check: ensures both alive, segment is body
                    return botSegment?.active && !botSegment.getData('isHead') &&
                           this.starEater && !this.starEater.isDead &&
                           this.botController?.getBotInstance() && !this.botController.getBotInstance().isDead;
                },
                this // Context
            );
            console.log("Overlap: PlayerHead <-> BotBody setup OK.");
        } else {
             console.warn("Overlap setup FAILED: PlayerHead <-> BotBody (Missing player head or bot body group).");
        }

        // 3. Bot collisions (Bot Head vs Stars, Bot Head vs Player Body)
        //    These are set up internally by BotController._setupBotCollisions() when createBot is called.
        //    Bot Head vs Player Body -> PLAYER DIES (handled by BotController._handleHitPlayerBody calling killStarEater)

        // --- End Physics Collisions ---

        this.setupInputHandling(); // Call the input setup method here

        this.isInitialized = true;

        console.log("GameScene create complete.");
    } // End create()


    update(time, delta) {
        // --- Update Player ---
        if (this.starEater && !this.starEater.isDead) {
            this.starEater.update(time, delta);
            // Player body group updates are handled after growth in StarEater.update
        }

        // --- Update Bot Controller ---
        if (this.botController) {
            this.botController.update(time, delta);
             // Bot body group updates are handled after growth in StarEater.update
        }

        // --- Ghost collision logic ---
        if (this.starEater && this.starEater.currentHeadLevel === 'middle') {
            const ghosting = this.starEater.isGhosting;
            if (this.playerHeadStarOverlap) this.playerHeadStarOverlap.active = !ghosting;
            if (this.playerHeadBotBodyOverlap) this.playerHeadBotBodyOverlap.active = !ghosting;
        } else {
            // Always enable overlaps in other forms
            if (this.playerHeadStarOverlap) this.playerHeadStarOverlap.active = true;
            if (this.playerHeadBotBodyOverlap) this.playerHeadBotBodyOverlap.active = true;
        }

        // --- Star Logic (Vacuum + Player Body Eating) ---
        if (this.stars) {
            // Get current state of player and bot for efficiency
            const playerAlive = this.starEater && !this.starEater.isDead;
            const playerHead = playerAlive ? this.starEater.head : null;
            const playerBodyParts = playerAlive ? this.starEater.bodyParts : [];

            const botInstance = this.botController?.getBotInstance(); // Safely get bot
            const botAlive = botInstance && !botInstance.isDead;
            const botHead = botAlive ? botInstance.head : null;
            // --- End Get State ---

            this.stars.children.iterate(star => {
                // Skip inactive stars or stars missing a physics body
                if (!star || !star.active || !star.body) {
                    // Safety check: ensure non-body stars don't have velocity
                     if(star && !star.body && star.velocity && (star.velocity.x !== 0 || star.velocity.y !== 0)) {
                         if(typeof star.setVelocity === 'function') star.setVelocity(0,0);
                     }
                    return true; // Continue to next star
                }

                const starX = star.x;
                const starY = star.y;
                let stopVelocity = true; // Assume we stop the star unless vacuumed/eaten

                // --- Combined Vacuum Logic ---  // <- Update Section Start
                let distSqPlayer = Infinity;
                let distSqBot = Infinity;
                let vacuumTarget = null; // Head to vacuum towards (null if none)
                const minDistSq = VACUUM_RADIUS * VACUUM_RADIUS; // Squared radius

                // Calculate distance to player if alive
                if (playerHead) {
                    distSqPlayer = Phaser.Math.Distance.Squared(starX, starY, playerHead.x, playerHead.y);
                }
                // Calculate distance to bot if alive
                if (botHead) {                       // <- Update (Check if bot is valid)
                    distSqBot = Phaser.Math.Distance.Squared(starX, starY, botHead.x, botHead.y); // <- Update (Calculate distance to bot)
                }

                // Check if star is within vacuum range of EITHER eater
                if (distSqPlayer < minDistSq || distSqBot < minDistSq) { // <- Update (Check both distances)
                    // Determine which is closer
                    if (distSqPlayer <= distSqBot) { // Player is closer or same distance
                        vacuumTarget = playerHead;
                    } else { // Bot is closer         // <- Update (Select bot head)
                        vacuumTarget = botHead;       // <- Update (Assign bot head)
                    }
                }

                // Apply vacuum velocity if a target was found
                if (vacuumTarget) {                   // <- Update (Will be true if botHead selected)
                    const angle = Phaser.Math.Angle.Between(starX, starY, vacuumTarget.x, vacuumTarget.y);
                    // Apply velocity to the star's body towards the target head
                    this.physics.velocityFromRotation(angle, VACUUM_SPEED, star.body.velocity); // <- Update (Applies velocity towards bot if bot is target)
                    stopVelocity = false; // Don't stop velocity if vacuuming
                }
                // --- End Combined Vacuum Logic --- // <- Update Section End


                // --- Player Body Segment Eating Check (Keep As Is - Only player does this) ---
                let eatenByPlayerBody = false;
                if (playerAlive) {
                    for (let i = 1; i < playerBodyParts.length; i++) {
                        const segment = playerBodyParts[i];
                        if (!segment || !segment.active) continue;

                        const distanceToSegment = Phaser.Math.Distance.Between(starX, starY, segment.x, segment.y);
                        const currentThreshold = BODY_EAT_DISTANCE_THRESHOLD * (this.starEater.sizeMultiplier || 1.0);

                        if (distanceToSegment < currentThreshold) {
                            this.killAndRespawnStar(star, this.starEater); // Pass player as eater
                            eatenByPlayerBody = true;
                            stopVelocity = false; // Star is being handled
                            break; // Stop checking segments for this star
                        }
                    }
                }
                // --- End Player Body Eating ---

                // Stop star's velocity if it wasn't vacuumed or eaten by player body
                if (stopVelocity && (star.body.velocity.x !== 0 || star.body.velocity.y !== 0)) {
                    star.body.setVelocity(0, 0);
                }

                // Continue iterating only if star wasn't eaten by player body
                return !eatenByPlayerBody;

            }); // End star iteration
        }
        // --- End Star Logic ---


        // --- Star Spawning ---
        // Respawn stars if needed to maintain the count
        if (this.stars && this.stars.countActive(true) < MAX_STARS) {
             this.spawnStar();
        }

        // --- Update UI --- // Call Phaser Boost UI update
        if (this.starEater && this.boostUI && !this.starEater.isDead) {
            let abilityType = 'boost';
            let charge = this.starEater.boostCharge;
            let maxCharge = BOOST_DURATION;
            let cooldownActive = this.starEater.isBoostOnCooldown;
            let cooldownProgress = this.starEater.boostCooldownTimer ? (this.starEater.boostCooldownTimer.getProgress()) : 0;
            let cooldownRemaining = this.starEater.boostCooldownTimer ? Math.max(0, BOOST_COOLDOWN - this.starEater.boostCooldownTimer.getElapsedSeconds()) : BOOST_COOLDOWN;
            let boostingActive = this.starEater.isBoosting;
            let canUseAbility = this.starEater.canUseAbility;
            // If in medium form, show ghost state instead
            if (this.starEater.currentHeadLevel === 'middle') {
                abilityType = 'ghost';
                charge = this.starEater.ghostCharge;
                maxCharge = 2.0;
                cooldownActive = this.starEater.isGhostOnCooldown;
                cooldownProgress = this.starEater.ghostCooldownTimer ? (this.starEater.ghostCooldownTimer.getProgress()) : 0;
                cooldownRemaining = this.starEater.ghostCooldownTimer ? Math.max(0, 5.0 - this.starEater.ghostCooldownTimer.getElapsedSeconds()) : 5.0;
                boostingActive = this.starEater.isGhosting;
                canUseAbility = this.starEater.canUseAbility;
                console.log("Boost UI: Ghosting active, showing ghost state.");
            }
            const boostState = {
                charge,
                maxCharge,
                cooldownActive,
                cooldownProgress,
                cooldownRemaining,
                boostingActive,
                canUseAbility,
                abilityType
            };
            updateBoostDisplay(this.boostUI, boostState);
        } else if (this.boostUI && this.starEater?.isDead && this.boostUI.icon.visible) {
            this.boostUI.icon.setVisible(false);
            this.boostUI.meterGraphics.setVisible(false);
            this.boostUI.cooldownText.setVisible(false);
        }
        // --- End Update UI ---

    } // End update()

    // --- Helper Methods ---

          
    // --- Add: Input Handling Setup --- // This whole method
    setupInputHandling() {
        // Check if input system exists before adding listeners
        if (!this.input) {
            console.error("Input system not available in setupInputHandling.");
            return;
        }

        // Listen for Pointer Down (specifically left button)
        this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) => {
            // Ensure the primary button (usually left) is pressed
            if (pointer.leftButtonDown()) {
                // Check if the player exists, is alive, and has the boost method before calling
                if (this.starEater && !this.starEater.isDead) {
                    if (this.starEater.currentHeadLevel === 'middle' && typeof this.starEater.startGhost === 'function') {
                        this.starEater.startGhost();
                    } else if (typeof this.starEater.startBoost === 'function') {
                        this.starEater.startBoost();
                    }
                }
            }
        });

        // Listen for Pointer Up (specifically left button)
        this.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
            // Check if the primary button (usually left) was the one released
            if (pointer.leftButtonReleased()) {
                // Check if the player exists and has the method before calling
                // No need to check isDead here, stopping boost is safe even if player just died
                if (this.starEater) {
                    if (this.starEater.currentHeadLevel === 'middle' && typeof this.starEater.stopGhost === 'function') {
                        this.starEater.stopGhost();
                    } else if (typeof this.starEater.stopBoost === 'function') {
                        this.starEater.stopBoost();
                    }
                }
            }
        });

        // Also stop boost if pointer moves off the game canvas while down
        this.input.on(Phaser.Input.Events.GAME_OUT, () => {
            if (this.starEater) {
                if (this.starEater.currentHeadLevel === 'middle' && typeof this.starEater.stopGhost === 'function') {
                    this.starEater.stopGhost();
                } else if (typeof this.starEater.stopBoost === 'function') {
                    this.starEater.stopBoost();
                }
            }
        });
        console.log("Input handling for boost/ghost setup.");
    }
    // --- End Add --- //



    // drawBoundaryFrame (Keep as is)
    drawBoundaryFrame() {
        if (this.boundaryFrame) this.boundaryFrame.destroy();
        this.boundaryFrame = this.add.graphics();
        this.boundaryFrame.lineStyle(FRAME_THICKNESS, FRAME_COLOR, 1);
        const offset = FRAME_THICKNESS / 2;
        this.boundaryFrame.strokeRect(offset, offset, this.worldWidth - FRAME_THICKNESS, this.worldHeight - FRAME_THICKNESS);
    }

    // --- makeStarTexture (Keep as is) ---
    makeStarTexture() {
        if (!this.textures.exists('star')) {
            const graphics = this.make.graphics();
            const centerX = STAR_TEXTURE_SIZE / 2;
            const centerY = STAR_TEXTURE_SIZE / 2;
            graphics.fillStyle(0xffffff, 1.0);
            graphics.fillCircle(centerX, centerY, STAR_VISUAL_RADIUS);
            graphics.generateTexture('star', STAR_TEXTURE_SIZE, STAR_TEXTURE_SIZE);
            graphics.destroy();
            console.log(`Generated SOLID star texture (Radius: ${STAR_VISUAL_RADIUS}).`);
        }
    }

    // --- REVISED: spawnStar (Keep non-overlapping logic) ---
    spawnStar() {
        if (!this.stars || this.stars.countActive(true) >= MAX_STARS) return;
        const margin = 50 + FRAME_THICKNESS;
        let attempts = 0;
        let validPositionFound = false;
        let spawnX = 0, spawnY = 0;

        while (attempts < MAX_SPAWN_ATTEMPTS && !validPositionFound) {
            attempts++;
            spawnX = Phaser.Math.Between(margin, this.worldWidth - margin);
            spawnY = Phaser.Math.Between(margin, this.worldHeight - margin);
            validPositionFound = true; // Assume valid initially
            this.stars.children.iterate(existingStar => {
                if (!existingStar || !existingStar.active || !validPositionFound) return true;
                const distance = Phaser.Math.Distance.Between(spawnX, spawnY, existingStar.x, existingStar.y);
                if (distance < MIN_STAR_DISTANCE) {
                    validPositionFound = false;
                    return false; // Stop checking for this attempt
                }
                return true;
            });
        }

        if (validPositionFound) {
            this.spawnStarAt(spawnX, spawnY);
        } else {
            console.warn(`Could not find non-overlapping star position after ${MAX_SPAWN_ATTEMPTS} attempts.`);
            // Optionally spawn anyway: this.spawnStarAt(spawnX, spawnY);
        }
    }

    // --- spawnStarAt (Keep as is - places star at coords) ---
    spawnStarAt(x, y) {
        if (!this.stars) return null;
        const star = this.stars.get(x, y, 'star');
        if (star) {
            star.setActive(true).setVisible(true);
            star.setTint(Phaser.Math.RND.pick(STAR_COLORS));
            if (star.body) {
                star.body.reset(x, y);
                star.body.enable = true;
                star.body.setVelocity(0, 0);
                star.body.setAllowGravity(false);
                star.body.setCircle(STAR_VISUAL_RADIUS);
            } else { console.warn("Star lacks physics body during spawn!"); }
        }
        return star;
    }

    // --- Player Head vs Star Callback ---
    handleEatStar(playerHead, star) {
        // Check added to prevent calls after death begins processing
        if (!star || !star.active || !this.starEater || this.starEater.isDead) {
            return;
        }
        this.killAndRespawnStar(star, this.starEater); // Pass player instance
    }


    // --- MODIFIED: killAndRespawnStar (Accepts eater instance) ---
    killAndRespawnStar(star, eaterInstance = null) {
        // Prevent double processing
        if (!star || !star.active) return;

        // Disable and hide the star
        this.stars.killAndHide(star);
        if (star.body) {
            star.body.enable = false;
            star.body.setVelocity(0, 0);
        }

        // Grow the specific eater if it's provided and still alive
        if (eaterInstance && !eaterInstance.isDead) {
            eaterInstance.grow(); // Calls grow() on the correct StarEater
            // Collision group updates are now handled within StarEater.update after adding segment
        }
        // --- Update Score Display --- // This block
        if (eaterInstance.identifier === 'player') {
            updateScoreDisplay(this.scoreText, eaterInstance.totalStarsEaten);
       }
       // --- End Score Display Update --- //

        // Schedule a new star spawn after delay
        this.time.delayedCall(STAR_RESPAWN_TIME, this.spawnStar, [], this);
    }


    // --- NEW: Callback for Player Head hitting Bot Body Segment -> BOT DIES ---
    handlePlayerHitBotBody(playerHead, botSegment) {
        // Prevent repeated calls during death sequences or if objects invalid
        if (this.gameOverActive || !this.starEater || this.starEater.isDead || !this.botController?.getBotInstance() || this.botController.getBotInstance().isDead) {
            return;
        }

        console.log("GameScene: Player head hit Bot Body! Bot dies.");
        // Kill the BOT, player is the killer
        this.killStarEater(this.starEater, this.botController.getBotInstance());
    }


    // --- REVISED: Generic Death Handler (Replaces original gameOver) ---
    killStarEater(eaterToKill, killer) {
        // Prevent processing if eater invalid, already dead, or player game over active
        if (!eaterToKill || eaterToKill.isDead || (eaterToKill === this.starEater && this.gameOverActive)) {
             console.log(`Kill request ignored for ${eaterToKill?.identifier} (invalid/dead/game over active).`);
             return;
        }

        const killedIdentifier = eaterToKill.identifier;
        const killerIdentifier = killer ? killer.identifier : 'the boundary';
        console.log(`--- KILL EVENT: ${killedIdentifier} killed by ${killerIdentifier} ---`);

        // Mark the eater as dead (disables physics, starts fadeout in StarEater.markAsDead)
        eaterToKill.markAsDead();

        // --- Spawn stars from the dead eater's body (Optional Effect) ---
        // Keep this if you want the visual explosion of stars
        const segmentPositions = eaterToKill.bodyParts
                                      .filter(p => p?.active) // Check if part exists and is active
                                      .map(segment => ({ x: segment.x, y: segment.y }));
        console.log(`Spawning ${segmentPositions.length} stars from ${killedIdentifier}'s segments...`);
        segmentPositions.forEach(pos => {
            if (typeof pos.x === 'number' && typeof pos.y === 'number') {
                this.spawnStarAt(pos.x, pos.y);
            }
        });
        // --- End Spawn stars ---


        // --- Handle Consequences based on who died ---
        if (killedIdentifier === 'player') {
            console.log("Player died - Initiating Game Over sequence.");
            this.gameOverActive = true; // Set game over flag

            // Stop camera
            this.cameras.main.stopFollow();

            // Immediately clear player body group to prevent ghost collisions
            this.playerBodyGroup?.clear(true, true);

            // --- This is your original Game Over Logic ---
            showPopup("You were eaten or hit the boundary!", {
                title: 'GAME OVER',
                buttonText: 'Start Over',
                onButtonClick: () => {
                    hidePopup();
                    // Restarting the scene handles cleanup via shutdown()
                    this.scene.restart();
                }
            }).catch(error => {
                 console.error("Failed to show Game Over popup:", error);
                 // Fallback if popup fails? Maybe just log and wait?
            });
            console.log("Game paused. Waiting for 'Start Over' button click.");
            // --- End original Game Over Logic ---

        } else if (killedIdentifier === 'bot') {
            console.log("Bot died - Notifying BotController for cleanup.");
             // Immediately clear bot body group
             this.botController?.getBotBodyGroup()?.clear(true, true);
             // Tell the controller to handle the death (stops timers, cleans up group)
             // BotController.handleBotDeath NO LONGER handles respawn
             this.botController?.handleBotDeath(killer);
             // Bot is now effectively removed from play until scene restart

        } else {
            console.warn("KillStarEater called with unknown identifier:", killedIdentifier);
        }

    } // --- End killStarEater ---


    // --- NEW: Method to get player body segments group (used by BotController) ---
    getPlayerBodyGroup() {
        // Ensure the group is up-to-date before returning it for collision checks
        // this.updatePlayerBodyGroup(); // This is now called after growth in StarEater
        return this.playerBodyGroup;
    }

    // --- NEW: Helper to update the player's body segment group ---
    // Called initially and after player grows
    updatePlayerBodyGroup() {
        if (!this.playerBodyGroup || !this.starEater) {
             // console.warn("Cannot update player body group - missing group or player.");
             return; // Exit if group or player doesn't exist
        }
        // Clear previous segment references (don't destroy the actual sprites)
        this.playerBodyGroup.clear();

        // Add currently active segments ONLY if player is ALIVE
        if (!this.starEater.isDead) {
             const activeSegments = this.starEater.getBodySegments(); // Gets only active body parts
             if (activeSegments.length > 0) {
                 this.playerBodyGroup.addMultiple(activeSegments);
             }
        }
        // If player is dead, the group remains empty.
    }

    // --- NEW: Cleanup method called by Phaser on scene stop/restart ---
    shutdown() {
        console.log("GameScene shutdown: Cleaning up...");

        this.isInitialized = false; // Reset flag if you added one

        // --- Stop Input Listeners --- // This block
        // Check if input manager exists before trying to remove listeners
        if (this.input) {
             this.input.off(Phaser.Input.Events.POINTER_DOWN);
             this.input.off(Phaser.Input.Events.POINTER_UP);
             this.input.off(Phaser.Input.Events.GAME_OUT);
        }
        // --- End Add --- //

        // Destroy the bot controller (stops its timers, destroys its eater instance and groups)
        if (this.botController) {
            this.botController.destroy();
            this.botController = null;
            console.log("BotController destroyed.");
        }

        // Destroy player body group explicitly
        if (this.playerBodyGroup) {
            this.playerBodyGroup.destroy(true, true); // Destroy group and sprite children within it
            this.playerBodyGroup = null;
            console.log("PlayerBodyGroup destroyed.");
        }

        // Optional: Explicitly destroy player if not handled by scene restart fully
        // if (this.starEater) {
        //     this.starEater.destroy();
        //     this.starEater = null;
        // }

        // --- Destroy UI Elements --- // Destroy Phaser Boost UI objects
        if (this.scoreText) {
            this.scoreText.destroy(); this.scoreText = null;
        }
        if (this.boostUI) { // Check boostUI exists
            if(this.boostUI.icon) this.boostUI.icon.destroy(); // <- Add
            if(this.boostUI.meterGraphics) this.boostUI.meterGraphics.destroy(); // <- Add
            if(this.boostUI.cooldownText) this.boostUI.cooldownText.destroy(); // <- Add
            this.boostUI = null; // Nullify reference
        }
        // removeBoostUI(); // Remove call to HTML UI remover
        // --- End Update --- //

        // Remove any scene-level timers or listeners if needed
        this.time.removeAllEvents();
        console.log("GameScene cleanup complete.");
    }
    // --- END NEW ---

} // End Scene Class