// js/ai/BotController.js
import StarEater from '../gameObjects/StarEater.js';

// --- Constants ---
// Base values for reference
const BASE_HEAD_SPEED = 250;
const BASE_TURN_RATE = 8.5;
const BASE_STARTING_SIZE = 5;

// Constants derived from your old BotStarEater logic
const BOT_DETECTION_RADIUS = 400; // How far the bot can "see" stars
const BOT_DETECTION_RADIUS_SQ = BOT_DETECTION_RADIUS * BOT_DETECTION_RADIUS; // Squared for efficiency
const BOT_ROAM_INTERVAL = 4000;   // How often to pick a new random direction (milliseconds) - Adjusted slightly
const BOT_TARGETING_RATE = 250;   // How often the AI logic runs (milliseconds) - Reasonable starting point

// Bot configuration (Tunable)
const BOT_DEFAULT_CONFIG = {
    headSpeed: BASE_HEAD_SPEED * 0.9,  // Slightly slower than player default
    turnRate: BASE_TURN_RATE * 0.75,  // Slightly slower turning
    startingSize: BASE_STARTING_SIZE
};
// --- End Constants ---

export default class BotController {
    constructor(scene, playerEater, starsGroup) {
        this.scene = scene;
        this.playerEater = playerEater; // Still needed for potential future use or context
        this.starsGroup = starsGroup;

        this.botEater = null;
        this.botSegmentsGroup = null;
        this.isDestroyed = false;
        this.targetUpdateTimer = null; // Timer for AI logic

        // --- State Variables from old BotStarEater ---
        this.targetStar = null;       // The specific star instance being targeted
        this.roamTargetAngle = Phaser.Math.RND.angle(); // Initial random roam direction
        this.lastRoamTime = 0;        // Timestamp of last roam direction change
        // --- End State Variables ---
    }

    // --- Public Methods ---

    createBot(x, y, config = BOT_DEFAULT_CONFIG) {
        if (this.botEater || this.isDestroyed) { /* ... warning ... */ return; }

        console.log("BotController: Creating bot...");
        this.botEater = new StarEater(this.scene, x, y, 'bot', config);
        this.botSegmentsGroup = this.scene.physics.add.group();
        this.updateCollisionGroup();
        this._setupBotCollisions();

        // Initialize lastRoamTime here to ensure it uses scene time
        this.lastRoamTime = this.scene.time.now;

        // Start the AI logic timer
        this.targetUpdateTimer = this.scene.time.addEvent({
             delay: BOT_TARGETING_RATE,
             callback: this._updateBotTargetAndMovement,
             callbackScope: this,
             loop: true
        });

        console.log("BotController: Bot created successfully.");
        return this.botEater;
    }

    update(time, delta) {
        // Delegates movement update to the bot's StarEater instance
        if (this.botEater && !this.botEater.isDead && !this.isDestroyed) {
             this.botEater.update(time, delta);
        }
    }

    // Handles bot death (no respawn) - KEEP AS IS from previous correct version
    handleBotDeath(killer) {
        if (!this.botEater || this.isDestroyed) { /* ... checks ... */ return; }
        const killerIdentifier = killer ? killer.identifier : 'the boundary';
        console.log(`BotController: Handling bot death (killed by ${killerIdentifier}). Cleaning up...`);
        if (this.targetUpdateTimer) { this.targetUpdateTimer.remove(); this.targetUpdateTimer = null; }
        // Optional star spawning effect
        const segmentPositions = this.botEater.bodyParts.filter(p => p?.active).map(s => ({ x: s.x, y: s.y }));
        console.log(`BotController: Spawning ${segmentPositions.length} stars from bot segments...`);
        segmentPositions.forEach(pos => { if (this.scene?.spawnStarAt) { this.scene.spawnStarAt(pos.x, pos.y); } });
        // Clear group and destroy segment sprites
        this.botSegmentsGroup?.clear(true, true);
        // Destroy the bot's StarEater instance
        console.log("BotController: Destroying the bot's StarEater instance...");
        this.botEater?.destroy();
        this.botEater = null;
        console.log("BotController: Bot death handling complete (no respawn).");
        // Optional: this.destroy();
    }

    // Destroys controller - KEEP AS IS
    destroy() {
        if (this.isDestroyed) return; this.isDestroyed = true; console.log("BotController: Destroying...");
        this.targetUpdateTimer?.remove(); this.targetUpdateTimer = null;
        this.respawnTimer?.remove(); this.respawnTimer = null; // <- Update: Add this line to clear respawn timer on shutdown
        this.botSegmentsGroup?.destroy(true, true); this.botSegmentsGroup = null;
        this.botEater?.destroy(); this.botEater = null;
        this.scene = null; this.playerEater = null; this.starsGroup = null;
        console.log("BotController: Destroyed.");
    }

    // Getters - KEEP AS IS
    getBotInstance() { return this.botEater; }
    getBotBodyGroup() { return this.botSegmentsGroup; }

    // --- Internal Methods ---

    // Setup Collisions - KEEP AS IS (BotHead vs Star, BotHead vs PlayerBody)
    _setupBotCollisions() {
        if (!this.botEater || !this.scene || this.isDestroyed || !this.starsGroup) { /* ... checks ... */ return; }
        console.log("BotController: Setting up bot collisions...");
        // 1. Bot Head vs Stars
        this.scene.physics.add.overlap( this.botEater.head, this.starsGroup, this._handleEatStar, (h, s) => s?.active && this.botEater && !this.botEater.isDead, this );
        // 2. Bot Head vs Player Body Segments (Ensure this still correctly kills BOT)
        const playerBodyGroup = this.scene.getPlayerBodyGroup ? this.scene.getPlayerBodyGroup() : null;
        if (playerBodyGroup) {
             this.scene.physics.add.overlap( this.botEater.head, playerBodyGroup, this._handleHitPlayerBody, (bh, ps) => (ps?.active && !ps.getData('isHead') && this.botEater && !this.botEater.isDead && this.playerEater && !this.playerEater.isDead), this );
            console.log("BotController: Overlap BotHead<->PlayerBody setup OK.");
        } else { /* ... warning ... */ }
    }

    // --- AI LOGIC (Based on old BotStarEater.js) ---
    _updateBotTargetAndMovement() {
        // Exit checks
        if (!this.botEater || this.botEater.isDead || this.isDestroyed || !this.scene) {
            this.botEater?.setTargetAngle(this.botEater.movementAngle); // Go straight if dead/invalid
            return;
        }

        const botHead = this.botEater.head;
        const currentTime = this.scene.time.now;
        let calculatedTargetAngle = this.roamTargetAngle; // Default to roaming angle

        // --- 1. Validate Current Target Star ---
        if (this.targetStar && !this.targetStar.active) {
            // console.log("Bot: Target star became inactive.");
            this.targetStar = null; // Forget it
        }

        // --- 2. Find New Target If Necessary ---
        if (!this.targetStar) {
            // --- Inline findClosestStar logic ---
            let closestStar = null;
            let minDistanceSq = BOT_DETECTION_RADIUS_SQ; // Use squared constant

            if (this.starsGroup) {
                const activeStars = this.starsGroup.getChildren().filter(s => s.active);
                activeStars.forEach(star => {
                    const distSq = Phaser.Math.Distance.Squared(botHead.x, botHead.y, star.x, star.y);
                    if (distSq < minDistanceSq) { // Is it the closest so far within detection radius?
                        minDistanceSq = distSq;
                        closestStar = star;
                    }
                });
            }
            this.targetStar = closestStar; // Assign the closest found star (or null if none in range)
            // --- End findClosestStar logic ---
        }

        // --- 3. Decide Action: Chase or Roam ---
        if (this.targetStar) {
            // Chase the target star
            calculatedTargetAngle = Phaser.Math.Angle.Between(
                botHead.x, botHead.y,
                this.targetStar.x, this.targetStar.y
            );
            // Reset roam timer because we are actively chasing
            this.lastRoamTime = currentTime;
            // console.log("Bot: Chasing star.");
        } else {
            // No target star - Roam
            // Check if it's time to pick a new random direction
            if (currentTime > this.lastRoamTime + BOT_ROAM_INTERVAL) {
                this.roamTargetAngle = Phaser.Math.RND.angle(); // Get new random angle (-PI to PI)
                this.lastRoamTime = currentTime;              // Update timestamp
                // console.log("Bot: Picking new roam direction.");
            }
            // Use the current (or newly chosen) roam angle
            calculatedTargetAngle = this.roamTargetAngle;
            // console.log("Bot: Roaming.");
        }

        // --- 4. Set Target Angle on StarEater ---
        // The StarEater's update method will handle rotating towards this angle
        this.botEater.setTargetAngle(calculatedTargetAngle);

    } // --- End _updateBotTargetAndMovement ---

    // Callback for Bot Head eating a Star - KEEP AS IS
    _handleEatStar(botHead, star) {
        if (!star || !star.active || !this.botEater || this.botEater.isDead || !this.scene) return;
        // --- ADDED: Clear target if we ate it ---
        if (star === this.targetStar) {
             // console.log("Bot: Ate target star.");
             this.targetStar = null;
        }
        // --- End ADDED ---
        this.scene.killAndRespawnStar(star, this.botEater); // Pass bot instance to grow
    }

    // Callback for Bot Head hitting Player Body -> BOT DIES - Make sure this is correct!
    _handleHitPlayerBody(botHead, playerSegment) {
        if (!this.botEater || this.botEater.isDead || !this.playerEater || this.playerEater.isDead || !playerSegment?.active || playerSegment.getData('isHead')) return;
        // --- CONFIRM: Kill the BOT ---
        console.log("BotController: Bot head hit Player body. Killing Bot.");
        this.scene.killStarEater(this.botEater, this.playerEater); // Kill bot, player is killer
        // --- END CONFIRM ---
    }

    // Update collision group - KEEP AS IS (uses clear(false,false))
    updateCollisionGroup() {
        if (!this.scene || this.isDestroyed || !this.botSegmentsGroup || !this.botEater) return;
        this.botSegmentsGroup.clear(false, false); // Only remove refs, don't destroy
        if (!this.botEater.isDead) {
             this.botSegmentsGroup.addMultiple(this.botEater.getBodySegments());
        }
    }

} // End BotController Class