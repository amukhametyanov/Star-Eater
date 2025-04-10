// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8; // Base spacing between segment centers
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10; // How quickly segments follow (higher = tighter)
const TURN_RATE = 8.5; // Radians per second for head turning
const SCREEN_DEAD_ZONE = 15;
const STARS_NEEDED_PER_SEGMENT = 3; // How many stars add a segment

export default class StarEater {
    constructor(scene, x, y) {
        this.scene = scene;
        this.headSpeed = HEAD_SPEED;
        this.turnRate = TURN_RATE;
        this.isDead = false;

        this.bodyParts = [];
        this.pendingLengthGrowth = 0; // Renamed for clarity
        this.starsEatenCounter = 0;
        // Base size for calculations, visual size set by setDisplaySize
        this.baseSegmentSize = BODY_SPACING * 1.5;
        this.movementAngle = 0; // Start pointing right

        // --- Head Creation ---
        this.head = scene.physics.add.image(x, y, 'star-eater-head') // Ensure key matches GameScene preload
            .setOrigin(0.5, 0.5) // Center origin is usually best
            .setDisplaySize(this.baseSegmentSize + 20, this.baseSegmentSize + 20); // Keep explicit size

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
        // No initial glow call needed now
    }

    // Helper function to set physics body size
    updatePhysicsBody(gameObject) {
        if (!gameObject || !gameObject.texture?.source?.[0]) return;
        if (!gameObject.body) this.scene.physics.world.enable(gameObject);
        if (!gameObject.body) return;

        // Use DISPLAYED size for body calculation if setDisplaySize is used
        const bodyRadius = (gameObject.displayWidth / 2) * 0.8; // 80% of half the DISPLAYED width

        gameObject.body.setCircle(bodyRadius);
        // Offset based on original texture dimensions to center circle correctly
        gameObject.body.setOffset(
            gameObject.texture.source[0].width / 2 - bodyRadius,
            gameObject.texture.source[0].height / 2 - bodyRadius
        );
        gameObject.body.enable = true;
    }


    addSegment(x, y) {
        // --- Use 'segment_img' key ---
        const segment = this.scene.add.image(x, y, 'segment') // <<< USE SEGMENT IMAGE KEY
             .setOrigin(0.5, 0.5)
             // Match display size with head for consistency, or adjust as needed
             .setDisplaySize(this.baseSegmentSize + 20, this.baseSegmentSize + 20);
             // No tint needed if using image colors

        // Add physics body (if needed for star collision - usually not required for body segments)
        // If you DON'T need segments to collide with stars, you can skip enabling physics on them
        // this.scene.physics.world.enable(segment);
        // this.updatePhysicsBody(segment);

        this.bodyParts.push(segment);
        return segment;
    }

    // Simplified grow function - only handles adding segments
    grow() {
        this.starsEatenCounter++;

        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) {
            this.starsEatenCounter = 0;
            this.pendingLengthGrowth++;
            console.log(`Length growth triggered! Pending segments: ${this.pendingLengthGrowth}`);
        }
    }

    // --- REMOVED updateGlow() function ---


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