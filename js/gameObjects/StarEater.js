// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8;
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10;
const TURN_RATE = 8.5; // Radians per second
const SCREEN_DEAD_ZONE = 15;
const STARS_NEEDED_PER_SEGMENT = 3;

export default class StarEater {
    constructor(scene, x, y) {
        this.scene = scene;
        this.headSpeed = HEAD_SPEED;
        this.turnRate = TURN_RATE;
        this.isDead = false;

        this.bodyParts = [];
        this.pendingGrowth = 0;
        this.starsEatenCounter = 0;
        // segmentSize is now mainly for the body, head uses its own size
        this.segmentSize = BODY_SPACING * 1.5;
        this.glowIntensity = 0;
        this.movementAngle = 0; // Start pointing right

        // --- <<< MODIFICATION: Use 'eater_head' texture >>> ---
        this.head = scene.physics.add.image(x, y, 'star-eater-head') // <<< USE NEW KEY
            .setOrigin(0.5, 0.3)
            // --- <<< REMOVE setDisplaySize and setTint for the head >>> ---
            .setDisplaySize(this.segmentSize + 20, this.segmentSize + 20); // Remove: Use image's natural size
            // .setTint(0x00ff00); // Remove: Use image's natural colors

        // --- <<< MODIFICATION: Adjust body size based on HEAD image dimensions >>> ---
        // We need the body object to exist first
        if (this.head.body) {
            // Example: Set body as a circle, slightly smaller than the image's width
            const bodyRadius = this.head.width / 2 * 0.8; // 80% of half the head image width
            this.head.body.setCircle(bodyRadius);
             // Center the circle body within the (potentially non-square) image frame
            this.head.body.setOffset(this.head.width / 2 - bodyRadius, this.head.height / 2 - bodyRadius);

            this.head.body.setCollideWorldBounds(true);
            this.head.body.setBounce(0);
            // Tell body to notify on world bounds collision
            this.head.body.onWorldBounds = true;
        } else {
            console.error("StarEater head failed to get a physics body!");
        }
        // --- <<< END BODY SIZE MODIFICATION >>> ---


        this.bodyParts.push(this.head);
        // Body segments still use 'circle' and segmentSize
        for (let i = 1; i < STARTING_SIZE; i++) {
            // Pass the intended position for the new segment
            // Initially, they might stack at the start position before update adjusts them
             this.addSegment(x, y);
        }

         // Initial glow update might tint the head if needed based on starting length
         // Or remove if you only want glow change on growth
         this.updateGlow();
    }

    addSegment(x, y) {
        // Body segments continue using 'circle' texture and defined size/tint
        const segment = this.scene.add.image(x, y, 'circle')
             .setOrigin(0.5, 0.5)
             .setDisplaySize(this.segmentSize, this.segmentSize) // Body segments keep fixed size
             .setTint(0x00dd00); // Body segments keep tint
        this.bodyParts.push(segment);
        return segment;
    }

    grow() {
        this.starsEatenCounter++;

        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) {
            this.pendingGrowth++;
            this.starsEatenCounter = 0;
            console.log(`Growth triggered! Pending segments: ${this.pendingGrowth}`);
            // Optional: Trigger glow update ONLY when actually growing
            // this.updateGlow(); // Keep this commented if you only update in constructor/elsewhere
        }
    }

    updateGlow() {
        // This function tints the head. If you removed the initial tint,
        // this will now tint your star-eater-head.png image based on length.
        // If you DON'T want the head image tinted at all, remove or comment out
        // the this.head.setTint(...) line below.
        const maxLengthForMaxGlow = 50;
        this.glowIntensity = Math.min(1, Math.sqrt(this.bodyParts.length / maxLengthForMaxGlow));

        // Original green tint for body segments (or a base color)
        const startColor = Phaser.Display.Color.ValueToColor(0x00ff00);
        // Target glow color (e.g., light yellow/white)
        const endColor = Phaser.Display.Color.ValueToColor(0xffffaa);

        const blendedColor = Phaser.Display.Color.Interpolate.ColorWithColor(startColor, endColor, 100, this.glowIntensity * 100);

        // --- Apply tint to the head ---
        // >>> COMMENT OUT this next line if you want the head PNG to keep its original colors <<<
        // this.head.setTint(Phaser.Display.Color.GetColor(blendedColor.r, blendedColor.g, blendedColor.b));

        // Optional: Tint body segments slightly differently?
        // for (let i = 1; i < this.bodyParts.length; i++) {
        //     this.bodyParts[i].setTint(Phaser.Display.Color.GetColor(blendedColor.r * 0.9, blendedColor.g * 0.9, blendedColor.b*0.9)); // Slightly darker maybe
        // }
    }


    // update(time, delta) function remains the same as your provided code...
    update(time, delta) {
        if (this.isDead) {
            return;
        }

        const deltaSec = delta / 1000;

        if (this.pendingGrowth > 0) {
            const tail = this.bodyParts[this.bodyParts.length - 1];
            this.addSegment(tail.x, tail.y);
            this.pendingGrowth--;
             // Optional: Update glow when a segment is actually added
             this.updateGlow();
        }

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

        this.scene.physics.velocityFromRotation(this.movementAngle, this.headSpeed, this.head.body.velocity);
        // Add 90 degrees (PI/2 radians) to align the sprite's 'up' with the movement direction
        this.head.rotation = this.movementAngle - Math.PI / 2;


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
        }

        // Use 'blocked' status for more reliable boundary collision detection
        if (this.head.body.blocked.left || this.head.body.blocked.right || this.head.body.blocked.up || this.head.body.blocked.down) {
             // Check if NOT already dead to prevent multiple calls
             if (!this.isDead) {
                 this.scene.gameOver(this); // Let scene handle setting isDead flag
             }
        }
    }

    // --- NEW: Method to mark as dead (called by scene's gameOver) ---
    markAsDead() {
        this.isDead = true;
        // Optionally stop head movement immediately
        if (this.head.body) {
            this.head.body.setVelocity(0, 0);
        }
        console.log("StarEater marked as dead.");
    }
    // --- END NEW Method ---


    getBodySegments() { // No change needed
        return this.bodyParts.slice(1);
    }

     // Add destroy method for cleanup
     destroy() {
        console.log("Destroying StarEater...");
        // Destroy all body parts, including the head
        this.bodyParts.forEach(part => {
            if (part) { // Check if part exists before destroying
                part.destroy();
            }
        });
        this.bodyParts = []; // Clear the array
        this.scene = null; // Remove scene reference
    }
}