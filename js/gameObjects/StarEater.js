// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8; // Base spacing between segment centers
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10; // How quickly segments follow (higher = tighter)
const TURN_RATE = 8.5; // Radians per second for head turning
const SCREEN_DEAD_ZONE = 15;
const STARS_NEEDED_PER_SEGMENT = 3; // How many stars add a segment
const STARS_NEEDED_FOR_SIZE_GROWTH = 10; // How many stars needed to grow in size
const SIZE_GROWTH_PER_LEVEL = 0.1;
const MAX_SIZE_MULTIPLIER = 3.0;
const SIZE_ANIMATION_DURATION = 1000;
const SIZE_ANIMATION_EASE = 'Power2';

// Head evolution constants
const STARS_FOR_MIDDLE_HEAD = 50;
const STARS_FOR_MAX_HEAD = 100;
const HEAD_CHANGE_ANIMATION_DURATION = 800;

// --- Add: Stage 1 Boost Constants ---
const BOOST_SPEED_MULTIPLIER = 1.8; // Speed increase factor
const BOOST_DURATION = 2.0;       // Total seconds of boost charge
const BOOST_COOLDOWN = 5.0;         // Cooldown in seconds after depletion
// --- End Add ---

// --- Add: Ghost Ability Constants ---
const GHOST_DURATION = 2.0; // seconds
const GHOST_COOLDOWN = 5.0; // seconds
// --- End Add ---

export default class StarEater {
    // Added 'identifier' and optional 'config' for bots
    constructor(scene, x, y, identifier = 'player', config = {}) {
        this.scene = scene;
        this.identifier = identifier; // 'player' or 'bot'

        // Use config for bots, defaults from constants for player
        this.baseHeadSpeed = config.headSpeed || HEAD_SPEED; // Store base speed separately
        this.headSpeed = this.baseHeadSpeed;                 // Current speed starts at base
        this.turnRate = config.turnRate || TURN_RATE;
        // Use STARTING_SIZE constant unless overridden by config (primarily for bot)
        this.startingSize = config.startingSize || STARTING_SIZE;

        // --- Core Properties ---
        this.isDead = false;
        this.bodyParts = [];
        this.pendingLengthGrowth = 0;
        this.starsEatenCounter = 0;
        this.totalStarsEaten = 0;
        this.sizeMultiplier = 1.0;
        this.targetSizeMultiplier = 1.0;
        this.isGrowing = false;
        this.currentHeadLevel = 'low';
        this.baseSegmentSize = BODY_SPACING * 1.5;
        this.movementAngle = Math.random() * Math.PI * 2; // Start facing random direction
        // --- End Core Properties ---

        // --- AI Control Property ---
        this.targetAngle = null; // Used by BotController
        // --- End AI Control ---

         // --- Add: Boost State Variables ---
        // Initialize based on starting state (Stage 1)
        this.canUseAbility = (this.currentHeadLevel === 'low'); // Only usable in stage 1
        this.isBoosting = false;         // Is boost currently active?
        this.boostCharge = BOOST_DURATION; // Remaining boost time available
        this.isBoostOnCooldown = false;  // Is the ability recharging?
        this.boostCooldownTimer = null;  // Phaser TimerEvent for cooldown management
        // --- End Add ---

        // --- Ghost Ability State ---
        this.isGhosting = false;
        this.ghostCharge = GHOST_DURATION;
        this.isGhostOnCooldown = false;
        this.ghostCooldownTimer = null;
        // --- End Add ---

        // --- Head Creation ---
        this.head = scene.physics.add.image(x, y, 'low-level-head')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(this.baseSegmentSize + 20, this.baseSegmentSize + 20)
            .setData('isHead', true)          // Identify as head for collisions
            .setData('eaterInstance', this);  // Link GameObject back to this class instance

        // Setup head physics using original method
        this.updatePhysicsBody(this.head);

        if (this.head.body) {
             this.head.body.setCollideWorldBounds(true);
             this.head.body.setBounce(0);
             // We check body.blocked in update, so onWorldBounds is useful
             this.head.body.onWorldBounds = true;
        } else { console.error("StarEater head failed to get a physics body!"); }

        this.bodyParts.push(this.head);
        // --- End Head Creation ---

        // --- Initial Body Segments ---
        // Use the determined starting size
        for (let i = 1; i < this.startingSize; i++) {
            this.addSegment(x, y);
        }
        // Apply initial size multiplier visual update
        this.updateSegmentSizes();
    }

    // --- Physics Body Setup (KEEP YOUR ORIGINAL LOGIC) ---
    // This defines the collision area size and shape
    updatePhysicsBody(gameObject) {
        if (!gameObject || !gameObject.texture?.source?.[0]) return;
        if (!gameObject.body) this.scene.physics.world.enable(gameObject);
        if (!gameObject.body) {
            console.warn("Failed to enable physics body for", gameObject);
            return;
        }

        // <<< YOUR ORIGINAL LOGIC for different head/segment physics radius >>>
        let baseRadiusMultiplier;
        if (gameObject === this.head) {
            baseRadiusMultiplier = 6.0; // Head physics radius multiplier
        } else {
            // Segment physics radius multiplier (your logic based on size)
            if(this.sizeMultiplier > 2.0) {
                baseRadiusMultiplier = 10.0;
            } else {
                baseRadiusMultiplier = 15.0;
            }
        }
        // <<< END YOUR ORIGINAL LOGIC >>>

        // Optional reduction factor based on size (keep if desired)
        let sizeReductionFactor = (this.sizeMultiplier - 1.0) * 0.1;
        let finalRadiusMultiplier = Math.max(0.5, baseRadiusMultiplier - sizeReductionFactor);

        const bodyRadius = (gameObject.displayWidth / 2) * finalRadiusMultiplier; // Calculate radius

        // Set the circular physics body
        gameObject.body.setCircle(bodyRadius);
        // Set offset to center the circle on the visual sprite
        gameObject.body.setOffset(
            gameObject.texture.source[0].width / 2 - bodyRadius,
            gameObject.texture.source[0].height / 2 - bodyRadius
        );
        gameObject.body.enable = true; // Ensure body is enabled
    }
    // --- End updatePhysicsBody ---

    // --- Visual Size Update ---
    // Updates display size of all parts based on sizeMultiplier
    updateSegmentSizes() {
        const baseSize = this.baseSegmentSize + 20; // Base visual size
        const currentSize = baseSize * this.sizeMultiplier; // Scaled visual size

        this.bodyParts.forEach(segment => {
            if (segment) { // Check if segment exists
                segment.setDisplaySize(currentSize, currentSize);
                // Update physics body to match new visual size (important!)
                if (segment.body) {
                    this.updatePhysicsBody(segment);
                } else if (segment !== this.head) {
                    console.warn("Attempted to update size for a segment without a physics body.", segment);
                }
            }
        });
    }
    // --- End updateSegmentSizes ---

    // --- Smooth Size Growth Animation ---
    startSizeAnimation(targetSize) {
        if (this.isGrowing || !this.scene) return; // Don't stack animations, check scene exists
        this.isGrowing = true;
        this.targetSizeMultiplier = targetSize;

        this.scene.tweens.add({
            targets: this, // Target the StarEater instance itself
            sizeMultiplier: this.targetSizeMultiplier, // Tween the sizeMultiplier property
            duration: SIZE_ANIMATION_DURATION,
            ease: SIZE_ANIMATION_EASE,
            onUpdate: (tween, target) => {
                // On each step of the tween, update visuals and physics
                this.updateSegmentSizes();
            },
            onComplete: () => {
                this.isGrowing = false;
                 // Final update to ensure physics matches final size
                this.updateSegmentSizes();
            }
        });
    }
    // --- End startSizeAnimation ---

    // --- Add Body Segment ---
    addSegment(x, y) {
        const baseSize = this.baseSegmentSize + 20;
        const currentSize = baseSize * this.sizeMultiplier;

        const segment = this.scene.add.image(x, y, 'segment')
             .setOrigin(0.5, 0.5)
             .setDisplaySize(currentSize, currentSize) // Set initial display size
             .setData('isHead', false)         // Identify as body segment
             .setData('eaterInstance', this);  // Link back to this StarEater

        // Enable and configure physics
        this.scene.physics.world.enable(segment);
        if (segment.body) {
            this.updatePhysicsBody(segment); // Configure physics size/shape
            segment.body.setBounce(0);
            // segment.body.setImmovable(true); // Optional: makes segments harder to push
        } else {
            console.error("Failed to create physics body for new segment!");
        }

        this.bodyParts.push(segment);
        return segment; // Return the created segment
    }
    // --- End addSegment ---

    // --- Head Texture Evolution ---
    updateHeadTexture() {
        if (this.isDead || !this.scene) return;

        let originalLevel = this.currentHeadLevel; // Remember original level
        let newHeadLevel = this.currentHeadLevel;
        let newTexture = '';
        let abilityShouldBeActive = true; // Assume active by default for 'low'

        // Determine new texture based on total stars eaten
        if (this.totalStarsEaten >= STARS_FOR_MAX_HEAD && this.currentHeadLevel !== 'max') {
            newHeadLevel = 'max';
            newTexture = 'max-level-head';
            abilityShouldBeActive = false; // Stage 3 has no ability
        } else if (this.totalStarsEaten >= STARS_FOR_MIDDLE_HEAD && this.currentHeadLevel === 'low') {
            newHeadLevel = 'middle';
            newTexture = 'middle-level-head';
            abilityShouldBeActive = true; // Stage 2: ghost ability
        } else {
            // Fix: ability should be active for low or middle
            abilityShouldBeActive = (newHeadLevel === 'low' || newHeadLevel === 'middle');
        }

        // If level changed, apply texture with animation
        if (newHeadLevel !== this.currentHeadLevel && newTexture) {
            console.log(`Evolving head from ${this.currentHeadLevel} to ${newHeadLevel}`);
            const currentProps = { x: this.head.x, y: this.head.y, rotation: this.head.rotation, displayWidth: this.head.displayWidth };

            // Fade out old head
            this.scene.tweens.add({
                targets: this.head, alpha: 0, duration: HEAD_CHANGE_ANIMATION_DURATION / 2,
                onComplete: () => {
                    if (!this.head) return; // Check if head destroyed during fade
                    // Change texture
                    try {
                        this.head.setTexture(newTexture);
                    } catch (error) { console.error('Error setting texture:', error); }
                    // Restore properties & update physics for new texture potentially
                    this.head.setPosition(currentProps.x, currentProps.y);
                    this.head.setRotation(currentProps.rotation);
                    this.head.setDisplaySize(currentProps.displayWidth, currentProps.displayWidth); // Assume square
                    this.updatePhysicsBody(this.head); // Recalculate physics body
                    // Fade back in
                    this.scene.tweens.add({ targets: this.head, alpha: 1, duration: HEAD_CHANGE_ANIMATION_DURATION / 2 });
                }
            });
            this.currentHeadLevel = newHeadLevel;
            console.log(`Head evolved to ${newHeadLevel} level!`);
        }

        // Update ability usability AFTER potentially changing level
        if (this.canUseAbility !== abilityShouldBeActive) {
            this.canUseAbility = abilityShouldBeActive;
            console.log(`${this.identifier} ability availability set to: ${this.canUseAbility}`);
            // If ability got disabled while boosting/ghosting, stop it
            if (!this.canUseAbility) {
                if (this.isBoosting) this.stopBoost();
                if (this.isGhosting) this.stopGhost();
            }
        }
    }
    // --- End updateHeadTexture ---

    // --- Grow Logic (Called when star eaten) ---
    grow() {
        if (this.isDead) return;

        this.starsEatenCounter++;
        this.totalStarsEaten++;

        // Check for head evolution
        this.updateHeadTexture();

        // Check for size growth
        if (this.totalStarsEaten > 0 && this.totalStarsEaten % STARS_NEEDED_FOR_SIZE_GROWTH === 0) {
            const newSize = Math.min(this.targetSizeMultiplier + SIZE_GROWTH_PER_LEVEL, MAX_SIZE_MULTIPLIER);
            if (newSize > this.sizeMultiplier && !this.isGrowing) { // Only start if actually bigger and not already growing
                this.startSizeAnimation(newSize);
                console.log(`${this.identifier} size growth! Target multiplier: ${newSize.toFixed(2)}x`);
            }
        }

        // Check for length growth (add segment)
        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) {
            this.starsEatenCounter = 0;
            this.pendingLengthGrowth++; // Queue segment addition for update loop
            // console.log(`${this.identifier} length growth triggered! Pending: ${this.pendingLengthGrowth}`);
        }
    }
    // --- End grow ---

    // --- ADD: Set Target Angle for AI ---
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }
    // --- END ADD ---

     // --- Add: Boost Ability Methods ---
     startBoost() {
        // Conditions: Player only, correct stage, alive, not already boosting, not on cooldown, has charge
        if (this.identifier !== 'player' || !this.canUseAbility || this.isDead || this.isBoosting || this.isBoostOnCooldown || this.boostCharge <= 0) {
            // console.log(`${this.identifier} cannot start boost. Conditions: ID=${this.identifier}, canUse=${this.canUseAbility}, dead=${this.isDead}, boosting=${this.isBoosting}, cooldown=${this.isBoostOnCooldown}, charge=${this.boostCharge.toFixed(2)}`);
            return; // Exit if any condition fails
        }

        this.isBoosting = true;
        this.headSpeed = this.baseHeadSpeed * BOOST_SPEED_MULTIPLIER; // Apply boosted speed
        // console.log(`${this.identifier} STARTED boosting. Speed: ${this.headSpeed.toFixed(0)}, Charge: ${this.boostCharge.toFixed(2)}`);
    }

    stopBoost() {
        // Only stop if currently boosting
        if (this.isBoosting) {
            this.isBoosting = false;
            this.headSpeed = this.baseHeadSpeed; // Restore base speed
            // console.log(`${this.identifier} STOPPED boosting. Speed: ${this.headSpeed.toFixed(0)}, Charge: ${this.boostCharge.toFixed(2)}`);

            // Check if charge ran out EXACTLY when stopping AND cooldown isn't already running
            if (this.boostCharge <= 0 && !this.isBoostOnCooldown) {
                 this._startBoostCooldown(); // Start cooldown if depleted
            }
        }
    }

    _startBoostCooldown() {
         // Prevent multiple cooldown timers, check scene exists
         if (!this.scene || this.isBoostOnCooldown) return;

         console.log(`${this.identifier} boost depleted. Starting ${BOOST_COOLDOWN}s cooldown.`);
         this.isBoostOnCooldown = true;
         this.boostCharge = 0; // Ensure it's exactly zero

         // Clear any potentially orphaned timer
         if (this.boostCooldownTimer) { this.boostCooldownTimer.remove(); }

         // Schedule the end of the cooldown
         this.boostCooldownTimer = this.scene.time.delayedCall(
              BOOST_COOLDOWN * 1000, // Delay in milliseconds
              () => {
                  // Check if destroyed during cooldown
                  if (!this.scene || this.isDead || this.isDestroyed) return;
                  console.log(`${this.identifier} boost COOLDOWN FINISHED.`);
                  this.isBoostOnCooldown = false;
                  this.boostCharge = BOOST_DURATION; // Restore full charge
                  this.boostCooldownTimer = null;
              },
              [], this // args, scope
         );
    }
    // --- End Add Boost Methods ---

    // --- Ghost Ability Methods ---
    startGhost() {
        // Only allow in medium form, not dead, not already ghosting, not on cooldown, has charge
        if (this.identifier !== 'player' || this.currentHeadLevel !== 'middle' || this.isDead || this.isGhosting || this.isGhostOnCooldown || this.ghostCharge <= 0) {
            return;
        }
        this.isGhosting = true;
        // Make all segments ghostly
        this.setGhostAlpha(0.4);
    }

    stopGhost() {
        if (this.isGhosting) {
            this.isGhosting = false;
            // Restore normal alpha
            this.setGhostAlpha(1.0);
            // Re-enable collisions (handled externally)
            if (this.ghostCharge <= 0 && !this.isGhostOnCooldown) {
                this._startGhostCooldown();
            }
        }
    }

    _startGhostCooldown() {
        if (!this.scene || this.isGhostOnCooldown) return;
        this.isGhostOnCooldown = true;
        this.ghostCharge = 0;
        if (this.ghostCooldownTimer) this.ghostCooldownTimer.remove();
        this.ghostCooldownTimer = this.scene.time.delayedCall(
            GHOST_COOLDOWN * 1000,
            () => {
                if (!this.scene || this.isDead || this.isDestroyed) return;
                this.isGhostOnCooldown = false;
                this.ghostCharge = GHOST_DURATION;
                this.ghostCooldownTimer = null;
            },
            [], this
        );
    }

    setGhostAlpha(alpha) {
        if (this.head) this.head.setAlpha(alpha);
        this.getBodySegments().forEach(seg => seg.setAlpha(alpha));
    }
    // --- End Ghost Ability Methods ---

    update(time, delta) {
        if (this.isDead || !this.scene) { // Check if dead or scene gone
            return;
        }

        const deltaSec = delta / 1000; // Delta time in seconds

        // --- Add new segment if pending ---
        if (this.pendingLengthGrowth > 0) {
            const tail = this.bodyParts[this.bodyParts.length - 1];
             if (tail) {
                  const newSegment = this.addSegment(tail.x, tail.y); // Add segment at tail position
                  this.pendingLengthGrowth--;

                  // --- IMPORTANT: Trigger collision group update for the correct entity ---
                  // This ensures the new segment is included in collision checks promptly
                  if (this.identifier === 'player' && this.scene?.updatePlayerBodyGroup) {
                      // Use a small delay OR call directly. Delay is safer if physics updates take time.
                      // this.scene.time.delayedCall(10, this.scene.updatePlayerBodyGroup, [], this.scene);
                      this.scene.updatePlayerBodyGroup(); // Try direct call first
                  } else if (this.identifier === 'bot' && this.scene?.botController?.updateCollisionGroup) {
                      // this.scene.time.delayedCall(10, this.scene.botController.updateCollisionGroup, [], this.scene.botController);
                      this.scene.botController.updateCollisionGroup(); // Try direct call first
                  }
                  // --- END Trigger Collision Group Update ---

             } else {
                 console.warn("Cannot add segment, tail does not exist.");
                 this.pendingLengthGrowth = 0; // Prevent infinite loop
             }
        }
        // --- End Add Segment ---


        // --- Head Steering (Switch Input Source) ---
        let angleToTargetInput = null; // Renamed variable for clarity

        if (this.identifier === 'player') {
            // --- Player Input Logic (KEEP YOUR ORIGINAL) ---
            const pointer = this.scene.input.activePointer;
            const screenCenterX = this.scene.scale.width / 2;
            const screenCenterY = this.scene.scale.height / 2;
            const cursorScreenX = pointer.x;
            const cursorScreenY = pointer.y;
            const distFromCenter = Phaser.Math.Distance.Between(screenCenterX, screenCenterY, cursorScreenX, cursorScreenY);

            if (distFromCenter > SCREEN_DEAD_ZONE) {
                angleToTargetInput = Phaser.Math.Angle.Between(screenCenterX, screenCenterY, cursorScreenX, cursorScreenY);
            }
            // --- End Player Input ---
        } else { // It's a bot
            angleToTargetInput = this.targetAngle; // Use angle provided by BotController
        }

        // Apply rotation towards target angle (if defined)
        if (angleToTargetInput !== null) {
            this.movementAngle = Phaser.Math.Angle.RotateTo(
                this.movementAngle,     // Current angle
                angleToTargetInput,     // Target angle from input/AI
                this.turnRate * deltaSec // Max rotation amount this frame
            );
        }
        // --- End Head Steering ---


        // --- Apply Velocity & Head Visual Rotation (KEEP) ---
        if (this.head.body) {
             // Set velocity based on the potentially updated movementAngle
             this.scene.physics.velocityFromRotation(this.movementAngle, this.headSpeed, this.head.body.velocity);
        }
        // Rotate head sprite to face movement direction (adjust offset if sprite faces differently)
        this.head.rotation = this.movementAngle - Math.PI / 2; // Assumes head sprite points UP initially
        // --- End Velocity & Rotation ---


        // --- Body Segment Following (KEEP YOUR ORIGINAL LOGIC) ---
        // Ensure spacing scales with sizeMultiplier for consistent look
        const effectiveBodySpacing = BODY_SPACING * this.sizeMultiplier;
        for (let i = 1; i < this.bodyParts.length; i++) {
            const currentSegment = this.bodyParts[i];
            const targetSegment = this.bodyParts[i - 1];
             if (!currentSegment || !targetSegment) continue; // Safety check

            // Angle from current segment TO the segment ahead of it
            const angleToTargetSeg = Phaser.Math.Angle.Between(
                currentSegment.x, currentSegment.y,
                targetSegment.x, targetSegment.y
            );

            // Calculate desired position behind the target segment
            const targetPosX = targetSegment.x - Math.cos(angleToTargetSeg) * effectiveBodySpacing;
            const targetPosY = targetSegment.y - Math.sin(angleToTargetSeg) * effectiveBodySpacing;

            // Calculate movement needed and apply interpolation (smooth following)
            const moveX = targetPosX - currentSegment.x;
            const moveY = targetPosY - currentSegment.y;
            currentSegment.x += moveX * FOLLOW_SPEED_FACTOR * deltaSec;
            currentSegment.y += moveY * FOLLOW_SPEED_FACTOR * deltaSec;

            // Rotate segment to face the segment ahead (adjust offset if sprite faces differently)
            currentSegment.rotation = angleToTargetSeg + Math.PI / 2; // Assumes segment sprite points UP
        }
        // --- End Body Segment Following ---

        // --- Add: Boost Depletion Logic ---
        if (this.isBoosting) { // Only deplete if currently boosting
            this.boostCharge -= deltaSec; // Deplete charge based on frame time
            // console.log(`Boost Charge: ${this.boostCharge.toFixed(2)}`); // Debug log (can be noisy)
            if (this.boostCharge <= 0) {
                // console.log(`${this.identifier} boost charge ran out during update.`);
                this.boostCharge = 0; // Clamp charge at zero
                this.stopBoost(); // Stop the effect (will trigger cooldown)
            }
        }
        // --- End Add ---

        // --- Ghost Depletion Logic ---
        if (this.isGhosting) {
            this.ghostCharge -= deltaSec;
            if (this.ghostCharge <= 0) {
                this.ghostCharge = 0;
                this.stopGhost();
            }
        }
        // --- End Add ---

        // --- World Bounds Collision Check (KEEP DETECTION, CHANGE CONSEQUENCE) ---
        // Check if the body *could* collide (onWorldBounds=true) and then if it *is* blocked
        if (!this.isDead && this.head.body?.onWorldBounds) {
            if (this.head.body.blocked.left || this.head.body.blocked.right || this.head.body.blocked.up || this.head.body.blocked.down) {
                 // --- MODIFIED ACTION: Call scene's generic kill method ---
                 if (this.scene?.killStarEater) { // Ensure scene and method exist
                     console.log(`${this.identifier} hit boundary.`);
                     this.scene.killStarEater(this, null); // Pass this instance, killer is null (boundary)
                 } else {
                     console.error("Scene or killStarEater method not found!");
                 }
                 // --- END MODIFIED ACTION ---
            }
        }
        // --- End World Bounds Check ---
    } // End update()


    // --- Mark as Dead (Handles disabling physics, starting fadeout) ---
    markAsDead() {
        if (this.isDead) return; // Prevent multiple calls

        this.isDead = true;
        console.log(`StarEater (${this.identifier}) marked as dead.`);

        // --- Add: Stop boost and clear cooldown timer ---
        if (this.isBoosting) {
            this.stopBoost(); // Stop active boost effect cleanly
       }
       if (this.boostCooldownTimer) {
            this.boostCooldownTimer.remove(); // Cancel any pending cooldown reset
            this.boostCooldownTimer = null;
       }
       this.isBoostOnCooldown = false; // Ensure cooldown state is cleared
       this.boostCharge = BOOST_DURATION; // Optional: Reset charge on death? Resetting is simple.
       this.headSpeed = this.baseHeadSpeed; // Ensure speed is reset to base on death
       // --- End Add ---

        // Stop ghost and clear cooldown timer
        if (this.isGhosting) this.stopGhost();
        if (this.ghostCooldownTimer) {
            this.ghostCooldownTimer.remove();
            this.ghostCooldownTimer = null;
        }
        this.isGhostOnCooldown = false;
        this.ghostCharge = GHOST_DURATION;

        // Stop movement and disable physics interaction for the head
        if (this.head?.body) { // Optional chaining for safety
            this.head.body.setVelocity(0, 0);
            this.head.body.enable = false;
        }
        // Disable physics for all body segments too
        this.getBodySegments().forEach(segment => {
            if (segment?.body) {
                 segment.body.enable = false;
                 segment.body.setVelocity(0,0); // Stop any residual movement
            }
        });

        // Stop any ongoing size growth animation
        this.isGrowing = false;
        if (this.scene) { // Check scene exists before using tweens
             this.scene.tweens.killTweensOf(this); // Kill size tweens targeting 'this' instance
        }

        // Optional: Visual fade out effect for all parts
        if (this.scene) {
            this.scene.tweens.add({
                targets: this.bodyParts.filter(p => p), // Filter out any potentially null parts
                alpha: 0,
                duration: 500, // Fade duration
                ease: 'Power1',
                onComplete: () => {
                    // After fading, hide them completely. Destruction handled elsewhere.
                    this.bodyParts.forEach(part => part?.setVisible(false));
                }
            });
        } else {
            // If no scene, just hide immediately
             this.bodyParts.forEach(part => part?.setVisible(false));
        }
    }
    // --- End markAsDead ---

    // --- Get Body Segments (Helper) ---
    // Returns an array of active body segments (excludes head)
    getBodySegments() {
        // slice(1) skips the head (at index 0)
        // filter ensures parts exist and are active game objects
        return this.bodyParts.slice(1).filter(part => part && part.active);
    }
    // --- End getBodySegments ---

    // --- Respawn Method (Optional - used by scene restart implicitly for player) ---
    // Useful if you ever re-add bot respawning or want manual respawn capability
    respawn(x, y) {
        console.log(`StarEater (${this.identifier}) respawning at ${x.toFixed(0)}, ${y.toFixed(0)}`);
        this.isDead = false;
        this.targetAngle = null; // Reset AI target angle
        this.movementAngle = Math.random() * Math.PI * 2; // Assign random new direction
        this.headSpeed = this.baseHeadSpeed; // Reset speed to base

        // --- OPTIONAL: Reset Stats ---
        // Uncomment below if you want eaters to reset size/length on respawn
        // this.totalStarsEaten = 0;
        // this.starsEatenCounter = 0;
        // this.sizeMultiplier = 1.0;
        // this.targetSizeMultiplier = 1.0;
        // this.currentHeadLevel = 'low';
        // this.pendingLengthGrowth = 0;
        // // Remove extra segments if resetting length:
        // const segmentsToRemove = this.bodyParts.length - 1 - this.startingSize;
        // if (segmentsToRemove > 0) {
        //     console.log(`Removing ${segmentsToRemove} excess segments for respawn.`);
        //     for (let i = 0; i < segmentsToRemove; i++) {
        //         this.bodyParts.pop()?.destroy(); // Remove from end and destroy GameObject
        //     }
        // }
        // --- End Optional Reset Stats ---

        // --- Add: Reset boost state on respawn ---
        this.isBoosting = false;
        this.boostCharge = BOOST_DURATION;
        this.isBoostOnCooldown = false;
        if (this.boostCooldownTimer) {
             this.boostCooldownTimer.remove();
             this.boostCooldownTimer = null;
        }
        // Set ability availability based on current stage (important if stats aren't reset)
        this.canUseAbility = (this.currentHeadLevel === 'low');
        console.log(`${this.identifier} respawned. Boost available: ${this.canUseAbility}`); // Log state
        // --- End Add ---

        // Reset ghost state on respawn
        this.isGhosting = false;
        this.ghostCharge = GHOST_DURATION;
        this.isGhostOnCooldown = false;
        if (this.ghostCooldownTimer) {
            this.ghostCooldownTimer.remove();
            this.ghostCooldownTimer = null;
        }

        // Reposition Head and re-enable physics/visuals
        if (this.head) {
            this.head.setPosition(x, y);
            this.head.setAlpha(1);
            this.head.setVisible(true);
            if (this.head.body) {
                this.head.body.reset(x, y); // Important: resets physics state
                this.head.body.enable = true; // Re-enable physics
            }
            // Reset head texture if stats were reset
            // if (stats_were_reset) this.head.setTexture('low-level-head');
        }

        // Reposition Existing Body Segments (stack them at head initially, following logic handles spacing)
        this.getBodySegments().forEach(segment => {
            if (segment) {
                segment.setPosition(x, y);
                segment.setAlpha(1);
                segment.setVisible(true);
                if (segment.body) {
                     segment.body.reset(x, y);
                     segment.body.enable = true; // Re-enable physics
                }
            }
        });

        // Apply current visual/physics size based on potentially non-reset stats
        this.updateSegmentSizes();
        // Apply correct head texture based on potentially non-reset stats
        this.updateHeadTexture();

        console.log(`${this.identifier} respawn complete.`);
    }
    // --- End Respawn Method ---


    // --- Destroy Method (Cleanup) ---
     destroy() {
        console.log(`Destroying StarEater (${this.identifier})...`);
        this.isDead = true; // Ensure marked as dead

        // --- Add: Clear cooldown timer ---
        if (this.boostCooldownTimer) {
            this.boostCooldownTimer.remove();
            this.boostCooldownTimer = null;
       }
       // --- End Add ---

        // Clear ghost cooldown timer
        if (this.ghostCooldownTimer) {
            this.ghostCooldownTimer.remove();
            this.ghostCooldownTimer = null;
        }

        // Stop any running tweens targeting this instance or its parts
        if (this.scene) {
             this.scene.tweens.killTweensOf(this);
             this.bodyParts.forEach(part => { if(part) this.scene.tweens.killTweensOf(part); });
        }

        // Destroy all Phaser GameObjects associated with this eater
        this.bodyParts.forEach(part => part?.destroy()); // Use optional chaining for safety

        // Clear arrays and references
        this.bodyParts = [];
        this.head = null;
        this.scene = null; // Break scene reference
        console.log(`StarEater (${this.identifier}) destroyed.`);
    }
    // --- End Destroy ---

      
}