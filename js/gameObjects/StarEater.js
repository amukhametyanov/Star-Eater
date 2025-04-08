// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8;
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10;
const TURN_RATE = 8.5; // Radians per second - Start here, may need fine-tuning!
const SCREEN_DEAD_ZONE = 15; // Pixels from screen center where no turning occurs
const STARS_NEEDED_PER_SEGMENT = 3; // Adjust this number! Higher = slower growth.

export default class StarEater {
    constructor(scene, x, y) {
        this.scene = scene;
        this.headSpeed = HEAD_SPEED;
        this.turnRate = TURN_RATE;
        this.isDead = false;

        this.bodyParts = [];
        this.pendingGrowth = 0;
        this.starsEatenCounter = 0;
        this.segmentSize = BODY_SPACING * 1.5;
        this.glowIntensity = 0;
        this.movementAngle = 0; // Start pointing right

        this.head = scene.physics.add.image(x, y, 'circle')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(this.segmentSize, this.segmentSize)
            .setTint(0x00ff00);

        this.head.body.setSize(this.segmentSize * 0.8, this.segmentSize * 0.8);
        this.head.body.setCollideWorldBounds(true);
        this.head.body.setBounce(0);

        // --- <<< Tell body to notify on world bounds collision >>> ---
        this.head.body.onWorldBounds = true;

        this.bodyParts.push(this.head);
        for (let i = 1; i < STARTING_SIZE; i++) {
            this.addSegment(x, y);
        }
    }

    addSegment(x, y) {
        // (Same as before)
        const segment = this.scene.add.image(x, y, 'circle')
             .setOrigin(0.5, 0.5)
             .setDisplaySize(this.segmentSize, this.segmentSize)
             .setTint(0x00dd00);
        this.bodyParts.push(segment);
        return segment;
    }

    grow() {
        this.starsEatenCounter++; // Increment stars eaten count

        // Check if enough stars have been eaten to add a segment
        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) {
            this.pendingGrowth++; // Add one segment to the queue
            this.starsEatenCounter = 0; // Reset the counter for the next segment
            console.log(`Growth triggered! Pending segments: ${this.pendingGrowth}`);

            // Optional: Trigger glow update ONLY when actually growing
            this.updateGlow();
        }
        // --- <<< END MODIFICATION >>> ---
    }

    updateGlow() {
        const maxLengthForMaxGlow = 50;
        this.glowIntensity = Math.min(1, Math.sqrt(this.bodyParts.length / maxLengthForMaxGlow));
        const startColor = Phaser.Display.Color.ValueToColor(0x00ff00);
        const endColor = Phaser.Display.Color.ValueToColor(0xffffaa);
        const blendedColor = Phaser.Display.Color.Interpolate.ColorWithColor(startColor, endColor, 100, this.glowIntensity * 100);
        this.head.setTint(Phaser.Display.Color.GetColor(blendedColor.r, blendedColor.g, blendedColor.b));
    }

    update(time, delta) {
        // --- <<< Prevent updates if dead >>> ---
        if (this.isDead) {
            return;
        }

        const deltaSec = delta / 1000;

        // --- Handle Growth ---
        if (this.pendingGrowth > 0) {
            const tail = this.bodyParts[this.bodyParts.length - 1];
            this.addSegment(tail.x, tail.y);
            this.pendingGrowth--;
        }

        // --- <<< NEW Screen-Relative Head Steering Logic >>> ---
        const pointer = this.scene.input.activePointer;
        const screenCenterX = this.scene.scale.width / 2;
        const screenCenterY = this.scene.scale.height / 2;

        // Get cursor position relative to the screen center
        const cursorScreenX = pointer.x;
        const cursorScreenY = pointer.y;

        // Calculate distance from screen center to cursor
        const distFromCenter = Phaser.Math.Distance.Between(
            screenCenterX, screenCenterY,
            cursorScreenX, cursorScreenY
        );

        // Only calculate a new target angle if cursor is outside the dead zone
        if (distFromCenter > SCREEN_DEAD_ZONE) {
            const targetAngle = Phaser.Math.Angle.Between(screenCenterX, screenCenterY, cursorScreenX, cursorScreenY);
            this.movementAngle = Phaser.Math.Angle.RotateTo(this.movementAngle, targetAngle, this.turnRate * deltaSec);
        }
        // If inside the dead zone, movementAngle remains unchanged (goes straight)

        // ALWAYS apply forward velocity based on the potentially updated movementAngle
        this.scene.physics.velocityFromRotation(
            this.movementAngle,
            this.headSpeed,
            this.head.body.velocity
        );

        // Update the visual rotation of the head sprite
        this.head.rotation = this.movementAngle;
        // --- <<< END Screen-Relative Head Steering Logic >>> ---


        // --- Body Segment Following (Interpolation logic) ---
        // (Same as before)
        for (let i = 1; i < this.bodyParts.length; i++) {
            const currentSegment = this.bodyParts[i];
            const targetSegment = this.bodyParts[i - 1];
            const angleToTarget = Phaser.Math.Angle.Between(currentSegment.x, currentSegment.y, targetSegment.x, targetSegment.y);
            const targetPosX = targetSegment.x - Math.cos(angleToTarget) * BODY_SPACING;
            const targetPosY = targetSegment.y - Math.sin(angleToTarget) * BODY_SPACING;
            const moveX = targetPosX - currentSegment.x;
            const moveY = targetPosY - currentSegment.y;
            currentSegment.x += moveX * FOLLOW_SPEED_FACTOR * deltaSec;
            currentSegment.y += moveY * FOLLOW_SPEED_FACTOR * deltaSec;
            // Optional: currentSegment.rotation = angleToTarget;
        }

        // --- <<< Check for World Bounds Collision AFTER movement >>> ---
        // The physics engine updates the 'blocked' status after its step
        // Note: 'blocked' is more reliable than 'onWorldBounds' sometimes
        if (this.head.body.blocked.left || this.head.body.blocked.right || this.head.body.blocked.up || this.head.body.blocked.down) {
             // Alternatively, check the flag we set:
             // if (this.head.body.onWorldBounds) {
                 // Call the scene's game over function, passing this instance
                 this.scene.gameOver(this);
                 // No need to set isDead here, gameOver in scene will handle it
             // }
        }
    }

    getBodySegments() {
        return this.bodyParts.slice(1);
    }
}