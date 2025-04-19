// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8; // Base spacing between segment centers
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10; // How quickly segments follow (higher = tighter)
const TURN_RATE = 8.5; // Radians per second for head turning
const SCREEN_DEAD_ZONE = 15;
const STARS_NEEDED_PER_SEGMENT = 3; // How many stars add a segment
const STARS_NEEDED_FOR_SIZE_GROWTH = 10; // How many stars needed to grow in size
const SIZE_GROWTH_PER_LEVEL = 0.1; // Changed from 0.2 to 0.1 (10% growth)
const MAX_SIZE_MULTIPLIER = 3.0; // Maximum size multiplier
const SIZE_ANIMATION_DURATION = 1000; // Animation duration in milliseconds
const SIZE_ANIMATION_EASE = 'Power2'; // Phaser easing function

// Head evolution constants
const STARS_FOR_MIDDLE_HEAD = 50;
const STARS_FOR_MAX_HEAD = 100; // Stars needed for max head
const HEAD_CHANGE_ANIMATION_DURATION = 500;

export default class StarEater {
    constructor(scene, x, y) {
        this.scene = scene;
        this.headSpeed = HEAD_SPEED;
        this.turnRate = TURN_RATE;
        this.isDead = false;

        this.bodyParts = [];
        this.pendingLengthGrowth = 0;
        this.starsEatenCounter = 0;
        this.totalStarsEaten = 0; // New counter for size growth
        this.sizeMultiplier = 1.0; // Start at normal size
        this.targetSizeMultiplier = 1.0; // New: target size for smooth animation
        this.isGrowing = false; // New: track if currently animating growth
        this.currentHeadLevel = 'low'; // Track current head level
        // Base size for calculations, visual size set by setDisplaySize
        this.baseSegmentSize = BODY_SPACING * 1.5;
        this.movementAngle = 0; // Start pointing right

        // --- Head Creation ---
        this.head = scene.physics.add.image(x, y, 'low-level-head') // Changed from 'star-eater-head' to 'low-level-head'
            .setOrigin(0.5, 0.5)
            .setDisplaySize(this.baseSegmentSize + 20, this.baseSegmentSize + 20);

        // Initialize physics body for the head
        this.updatePhysicsBody(this.head);

        if (this.head.body) {
             this.head.body.setCollideWorldBounds(true);
             this.head.body.setBounce(0);
             this.head.body.onWorldBounds = true;
        } else { console.error("StarEater head failed to get a physics body!"); }

        this.bodyParts.push(this.head);

        // --- Initial Body Segments ---
        for (let i = 1; i < STARTING_SIZE; i++) {
            this.addSegment(x, y);
        }
    }

    // Helper function to set physics body size
    updatePhysicsBody(gameObject) {
        if (!gameObject || !gameObject.texture?.source?.[0]) return;
        if (!gameObject.body) this.scene.physics.world.enable(gameObject);
        if (!gameObject.body) return;

        
        // Use for physical collision detection area size
        const bodyRadius = (gameObject.displayWidth / 2) * 6; // 80% of half the DISPLAYED width

        gameObject.body.setCircle(bodyRadius);
        // Offset based on original texture dimensions to center circle correctly
        gameObject.body.setOffset(
            gameObject.texture.source[0].width / 2 - bodyRadius,
            gameObject.texture.source[0].height / 2 - bodyRadius
        );
        gameObject.body.enable = true;
    }

    updateSegmentSizes() {
        const baseSize = this.baseSegmentSize + 20;
        const currentSize = baseSize * this.sizeMultiplier;
        
        this.bodyParts.forEach(segment => {
            segment.setDisplaySize(currentSize, currentSize);
            if (segment === this.head) {
                this.updatePhysicsBody(segment);
            }
        });
    }

    startSizeAnimation(targetSize) {
        if (this.isGrowing) return; // Don't start new animation if one is in progress
        this.isGrowing = true;
        this.targetSizeMultiplier = targetSize;

        // Create the tween for smooth size transition
        this.scene.tweens.add({
            targets: this,
            sizeMultiplier: this.targetSizeMultiplier,
            duration: SIZE_ANIMATION_DURATION,
            ease: SIZE_ANIMATION_EASE,
            onUpdate: () => {
                this.updateSegmentSizes();
            },
            onComplete: () => {
                this.isGrowing = false;
            }
        });
    }

    addSegment(x, y) {
        const baseSize = this.baseSegmentSize + 20;
        const currentSize = baseSize * this.sizeMultiplier;
        
        const segment = this.scene.add.image(x, y, 'segment')
             .setOrigin(0.5, 0.5)
             .setDisplaySize(currentSize, currentSize);

        this.bodyParts.push(segment);
        return segment;
    }

    updateHeadTexture() {
        console.log("Test");
        if (this.isDead) return;

        let newHeadLevel = this.currentHeadLevel;
        let newTexture = '';

        console.log(`Checking head evolution - Total stars: ${this.totalStarsEaten}, Current level: ${this.currentHeadLevel}`);

        if (this.totalStarsEaten >= STARS_FOR_MAX_HEAD && this.currentHeadLevel !== 'max') {
            newHeadLevel = 'max';
            newTexture = 'max-level-head'; // Changed to match the loaded texture key
        } else if (this.totalStarsEaten >= STARS_FOR_MIDDLE_HEAD && this.currentHeadLevel === 'low') {
            newHeadLevel = 'middle';
            newTexture = 'middle-level-head'; // Changed to match the loaded texture key
        }

        if (newHeadLevel !== this.currentHeadLevel) {
            console.log(`About to evolve head from ${this.currentHeadLevel} to ${newHeadLevel}`);
            
            // Store current properties
            const currentRotation = this.head.rotation;
            const currentX = this.head.x;
            const currentY = this.head.y;
            const currentSize = this.head.displayWidth;

            // Create flash effect
            this.scene.tweens.add({
                targets: this.head,
                alpha: 0,
                duration: HEAD_CHANGE_ANIMATION_DURATION / 2,
                onComplete: () => {
                    // Change texture
                    console.log(`Setting head texture to: ${newTexture}`);
                    try {
                        this.head.setTexture(newTexture);
                    } catch (error) {
                        console.error('Error setting texture:', error);
                        // Try to recover by keeping current texture
                        console.log('Available textures:', this.scene.textures.list);
                    }
                    
                    // Restore properties
                    this.head.setPosition(currentX, currentY);
                    this.head.setRotation(currentRotation);
                    this.head.setDisplaySize(currentSize, currentSize);
                    this.updatePhysicsBody(this.head);
                    
                    // Fade back in
                    this.scene.tweens.add({
                        targets: this.head,
                        alpha: 1,
                        duration: HEAD_CHANGE_ANIMATION_DURATION / 2
                    });
                }
            });

            this.currentHeadLevel = newHeadLevel;
            console.log(`Head evolved to ${newHeadLevel} level!`);
        }
    }

    // Enhanced grow function - handles both size and length growth
    grow() {
        this.starsEatenCounter++;
        this.totalStarsEaten++;
        
        console.log(`Stars eaten: ${this.totalStarsEaten}`); // Added debug log
        
        // Check for head evolution
        this.updateHeadTexture();
        
        // Check for size growth (every 10 stars)
        if (this.totalStarsEaten % STARS_NEEDED_FOR_SIZE_GROWTH === 0) {
            const newSize = Math.min(this.targetSizeMultiplier + SIZE_GROWTH_PER_LEVEL, MAX_SIZE_MULTIPLIER);
            this.startSizeAnimation(newSize);
            console.log(`Size growth! New multiplier: ${newSize.toFixed(2)}x`);
        }

        // Check for new segment (every 3 stars)
        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) {
            this.starsEatenCounter = 0;
            this.pendingLengthGrowth++;
            console.log(`Length growth triggered! Pending segments: ${this.pendingLengthGrowth}`);
        }
    }

    update(time, delta) {
        if (this.isDead) {
            return;
        }

        const deltaSec = delta / 1000;

        // --- Add new segment if pending ---
        if (this.pendingLengthGrowth > 0) {
            const tail = this.bodyParts[this.bodyParts.length - 1];
             if (tail) {
                  this.addSegment(tail.x, tail.y);
                  this.pendingLengthGrowth--;
             } else {
                 console.warn("Cannot add segment, tail does not exist.");
                 this.pendingLengthGrowth = 0;
             }
        }

        // --- Head Steering ---
        const pointer = this.scene.input.activePointer;
        const screenCenterX = this.scene.scale.width / 2;
        const screenCenterY = this.scene.scale.height / 2;
        const cursorScreenX = pointer.x;
        const cursorScreenY = pointer.y;
        const distFromCenter = Phaser.Math.Distance.Between(screenCenterX, screenCenterY, cursorScreenX, cursorScreenY);

        if (distFromCenter > SCREEN_DEAD_ZONE) {
            const targetAngle = Phaser.Math.Angle.Between(screenCenterX, screenCenterY, cursorScreenX, cursorScreenY);
            this.movementAngle = Phaser.Math.Angle.RotateTo(this.movementAngle, targetAngle, this.turnRate * deltaSec);
        }

        // Apply velocity (check if body exists)
        if (this.head.body) {
             this.scene.physics.velocityFromRotation(this.movementAngle, this.headSpeed, this.head.body.velocity);
        }

        // --- Head Rotation ---
        // Assuming head image points UP, add PI/2 offset
        this.head.rotation = this.movementAngle - Math.PI / 2;


        // --- Body Segment Following ---
        // Use base spacing, as scale isn't changing now
        const effectiveBodySpacing = BODY_SPACING;
        for (let i = 1; i < this.bodyParts.length; i++) {
            const currentSegment = this.bodyParts[i];
            const targetSegment = this.bodyParts[i - 1];
             if (!currentSegment || !targetSegment) continue; // Safety check

            const angleToTarget = Phaser.Math.Angle.Between(currentSegment.x, currentSegment.y, targetSegment.x, targetSegment.y);

            // Update Position (same as before)
            const targetPosX = targetSegment.x - Math.cos(angleToTarget) * effectiveBodySpacing;
            const targetPosY = targetSegment.y - Math.sin(angleToTarget) * effectiveBodySpacing;
            const moveX = targetPosX - currentSegment.x;
            const moveY = targetPosY - currentSegment.y;
            currentSegment.x += moveX * FOLLOW_SPEED_FACTOR * deltaSec;
            currentSegment.y += moveY * FOLLOW_SPEED_FACTOR * deltaSec;

            // --- <<< ADD SEGMENT ROTATION >>> ---
            // Set the rotation of the current segment to point towards the target segment.
            // Add the same PI/2 offset if your segment.png also points UP.
            // If segment.png points RIGHT, remove the "+ Math.PI / 2".
            currentSegment.rotation = angleToTarget + Math.PI / 2; // <<< Adjust offset if needed
            // --- <<< END SEGMENT ROTATION >>> ---
        }

        // --- World Bounds Collision Check ---
        if (this.head.body?.blocked.left || this.head.body?.blocked.right || this.head.body?.blocked.up || this.head.body?.blocked.down) {
             if (!this.isDead) {
                 this.scene.gameOver(this);
             }
        }
    }

    markAsDead() {
        this.isDead = true;
        if (this.head.body) {
            this.head.body.setVelocity(0, 0);
        }
        console.log("StarEater marked as dead.");
    }

    getBodySegments() {
        return this.bodyParts.slice(1);
    }

     destroy() {
        console.log("Destroying StarEater...");
        this.bodyParts.forEach(part => part?.destroy());
        this.bodyParts = [];
        this.scene = null;
    }
}