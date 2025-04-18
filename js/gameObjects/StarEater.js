// js/gameObjects/StarEater.js

const HEAD_SPEED = 250;
const BODY_SPACING = 8;
const STARTING_SIZE = 5;
const FOLLOW_SPEED_FACTOR = 10;
const TURN_RATE = 8.5;
const STARS_NEEDED_PER_SEGMENT = 3;
const STARS_NEEDED_FOR_SIZE_GROWTH = 10;
const SIZE_GROWTH_PER_LEVEL = 0.1;
const MAX_SIZE_MULTIPLIER = 3.0;
const SIZE_ANIMATION_DURATION = 1000;
const SIZE_ANIMATION_EASE = 'Power2';

const STARS_FOR_MIDDLE_HEAD = 50;
const STARS_FOR_MAX_HEAD = 100;
const HEAD_CHANGE_ANIMATION_DURATION = 500;

const HEAD_PHYSICS_RADIUS_MULTIPLIER = 5; // <-- NEW: Multiplier specifically for the HEAD (10% larger than visual)
const SEGMENT_EXTRA_COVERAGE = 20; // <-- NEW: How much OVERLAP factor? (1.0 = just touch, 1.2 = 20% extra radius beyond half-gap)

export default class StarEater {
    constructor(scene, x, y, headsGroup, bodiesGroup) {
        this.scene = scene;
        this.headsGroup = headsGroup;
        this.bodiesGroup = bodiesGroup;
        this.headSpeed = HEAD_SPEED;
        this.turnRate = TURN_RATE;
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
        this.movementAngle = Phaser.Math.RND.angle();

        // --- Head Creation ---
        // Calculate initial head visual size based on base segment size + extra
        const initialHeadVisualSize = (this.baseSegmentSize + 20) * this.sizeMultiplier; // Use initial multiplier
        this.head = scene.physics.add.image(x, y, 'low-level-head')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(initialHeadVisualSize, initialHeadVisualSize);

        this.head.parentStarEater = this;

        // Initialize physics body for the HEAD using the multiplier method
        this.updatePhysicsBody(this.head); // Pass the head object

        if (this.head.body) {
             this.head.body.setCollideWorldBounds(true);
             this.head.body.setBounce(0);
             this.head.body.onWorldBounds = true;
             // console.log(`Head physics: collideWorldBounds=true, onWorldBounds=true`);
        } else { console.error("StarEater head failed to get a physics body!"); }

        if (this.headsGroup) { this.headsGroup.add(this.head); }
        else { console.warn("StarEater created without a headsGroup!"); }


        this.bodyParts.push(this.head);

        // --- Initial Body Segments ---
        for (let i = 1; i < STARTING_SIZE; i++) {
            // Pass head's initial position, segments will snap during first updates
            this.addSegment(this.head.x, this.head.y);
        }

        // World Bounds Collision Listener Setup (handled by scene event)
    }

    handleBoundaryCollision() {
        console.log(`${this.constructor.name} executing handleBoundaryCollision. Emitting event.`);
        if (!this.isDead) {
            this.scene.events.emit('starEaterHitBoundary', this);
        } else {
            console.log(`${this.constructor.name} hit boundary but was already dead.`);
        }
    }

    // --- MODIFIED: updatePhysicsBody uses gap-filling for segments ---
    updatePhysicsBody(gameObject) {
        if (!gameObject || !gameObject.texture?.source?.[0] || !this.scene) return;
        if (!gameObject.body) this.scene.physics.world.enable(gameObject);
        if (!gameObject.body) { console.error("Failed to enable physics body for", gameObject.texture?.key); return; }

        let bodyRadius = 0;

        // --- Apply specific logic based on type ---
        if (gameObject === this.head) {
            // HEAD: Use the simple visual multiplier
            bodyRadius = (gameObject.displayWidth / 2) * HEAD_PHYSICS_RADIUS_MULTIPLIER;
            // console.log(`Updating HEAD physics. Visual: ${gameObject.displayWidth.toFixed(1)}, Radius: ${bodyRadius.toFixed(1)}`);
        } else {
            // SEGMENT: Calculate radius to cover half the gap + extra coverage
            // 1. Visual radius of the segment itself
            const visualRadius = gameObject.displayWidth / 2;
            // 2. Half the distance to the next segment center (use current sizeMultiplier)
            const halfGapSize = (BODY_SPACING * this.sizeMultiplier) / 2;
            // 3. Base radius needed to reach halfway into the gap
            const baseRadiusToFillGap = visualRadius + halfGapSize;
            // 4. Apply extra coverage multiplier for sensitivity and overlap assurance
            bodyRadius = baseRadiusToFillGap * SEGMENT_EXTRA_COVERAGE; // Use the new constant

            // console.log(`Updating SEGMENT physics. Visual: ${gameObject.displayWidth.toFixed(1)}, HalfGap: ${halfGapSize.toFixed(1)}, BaseRadius: ${baseRadiusToFillGap.toFixed(1)}, FinalRadius: ${bodyRadius.toFixed(1)}`);
        }

        // Ensure radius is at least a minimum value (e.g., 1 pixel) to avoid issues
        bodyRadius = Math.max(1, bodyRadius);

        gameObject.body.setCircle(bodyRadius);

        // Offset calculation logic remains the same
        const textureWidth = gameObject.texture.source[0].width;
        const textureHeight = gameObject.texture.source[0].height;
        gameObject.body.setOffset(
             textureWidth / 2 - bodyRadius,
             textureHeight / 2 - bodyRadius
         );

        gameObject.body.enable = true;
    }

    updateSegmentSizes() {
        const baseVisualSegmentSize = this.baseSegmentSize + 20; // Use baseSegmentSize for consistency
        const currentVisualSize = baseVisualSegmentSize * this.sizeMultiplier;

        this.bodyParts.forEach(segment => {
            if (!segment || !segment.active) return;
            segment.setDisplaySize(currentVisualSize, currentVisualSize);
            this.updatePhysicsBody(segment); // This now applies the correct logic
        });
    }


    startSizeAnimation(targetSize) {
        if (this.isGrowing) return;
        this.isGrowing = true;
        this.targetSizeMultiplier = targetSize;

        this.scene.tweens.add({
            targets: this,
            sizeMultiplier: this.targetSizeMultiplier,
            duration: SIZE_ANIMATION_DURATION,
            ease: SIZE_ANIMATION_EASE,
            onUpdate: () => {
                // Update visual size AND physics body size during the animation
                this.updateSegmentSizes();
            },
            onComplete: () => {
                this.isGrowing = false;
                 // Ensure final size is set correctly after animation
                 this.updateSegmentSizes();
            }
        });
    }

    addSegment(x, y) {
        const baseVisualSegmentSize = this.baseSegmentSize + 20; // Use baseSegmentSize
        const currentVisualSize = baseVisualSegmentSize * this.sizeMultiplier;

        const segment = this.scene.add.image(x, y, 'segment')
             .setOrigin(0.5, 0.5)
             .setDisplaySize(currentVisualSize, currentVisualSize);

        segment.parentStarEater = this;
        this.bodyParts.push(segment);

        if (this.bodiesGroup) {
            this.scene.physics.world.enable(segment);
            if (segment.body) {
                this.updatePhysicsBody(segment); // Correctly sets radius/offset using the gap-filling logic
                segment.body.allowGravity = false;
                segment.body.immovable = true;
                this.bodiesGroup.add(segment);
            } else { console.error("Failed to enable physics body for segment!"); }
        } else { console.warn("StarEater segment added without a bodiesGroup!"); }
        return segment;
    }

    updateHeadTexture() {
        if (this.isDead) return;
        let newHeadLevel = this.currentHeadLevel;
        let newTexture = '';
        if (this.totalStarsEaten >= STARS_FOR_MAX_HEAD && this.currentHeadLevel !== 'max') {
            newHeadLevel = 'max'; newTexture = 'max-level-head';
        } else if (this.totalStarsEaten >= STARS_FOR_MIDDLE_HEAD && this.currentHeadLevel === 'low') {
            newHeadLevel = 'middle'; newTexture = 'middle-level-head';
        }
        if (newHeadLevel !== this.currentHeadLevel) {
            console.log(`About to evolve head from ${this.currentHeadLevel} to ${newHeadLevel}`);
            const currentRotation = this.head.rotation; const currentX = this.head.x; const currentY = this.head.y;
            const currentSize = this.head.displayWidth; // Use displayWidth
            this.scene.tweens.add({ targets: this.head, alpha: 0, duration: HEAD_CHANGE_ANIMATION_DURATION / 2,
                onComplete: () => {
                    try { this.head.setTexture(newTexture); } catch (error) { console.error('Error setting texture:', error); }
                    this.head.setPosition(currentX, currentY); this.head.setRotation(currentRotation);
                    this.head.setDisplaySize(currentSize, currentSize); // Restore visual size
                    this.updatePhysicsBody(this.head); // IMPORTANT: Update physics body AFTER texture/size change
                    this.scene.tweens.add({ targets: this.head, alpha: 1, duration: HEAD_CHANGE_ANIMATION_DURATION / 2 });
                }
            });
            this.currentHeadLevel = newHeadLevel;
            console.log(`Head evolved to ${newHeadLevel} level!`);
        }
    }

    grow() {
        this.starsEatenCounter++; this.totalStarsEaten++;
        this.updateHeadTexture();
        if (this.totalStarsEaten > 0 && this.totalStarsEaten % STARS_NEEDED_FOR_SIZE_GROWTH === 0) {
            const newTargetSize = Math.min(this.targetSizeMultiplier + SIZE_GROWTH_PER_LEVEL, MAX_SIZE_MULTIPLIER);
            if (newTargetSize > this.targetSizeMultiplier) { this.startSizeAnimation(newTargetSize); console.log(`Size growth triggered! New target multiplier: ${newTargetSize.toFixed(2)}x`); }
        }
        if (this.starsEatenCounter >= STARS_NEEDED_PER_SEGMENT) { this.starsEatenCounter = 0; this.pendingLengthGrowth++; }
    }

    update(time, delta) {
        if (this.isDead) { return; }
        const deltaSec = delta / 1000;
        if (this.pendingLengthGrowth > 0) {
            const tail = this.bodyParts[this.bodyParts.length - 1];
             if (tail && tail.active) { this.addSegment(tail.x, tail.y); this.pendingLengthGrowth--; }
             else if (this.bodyParts.length > 0 && this.bodyParts[0].active) { this.addSegment(this.head.x, this.head.y); this.pendingLengthGrowth--; console.warn("Added segment near head as tail missing/inactive."); }
             else { console.warn("Cannot add segment, tail/head missing or inactive."); this.pendingLengthGrowth = 0; }
        }
        if (this.head.body) { this.scene.physics.velocityFromRotation(this.movementAngle, this.headSpeed, this.head.body.velocity); }
        this.head.rotation = this.movementAngle - Math.PI / 2;
        const effectiveBodySpacing = BODY_SPACING * this.sizeMultiplier;
        for (let i = 1; i < this.bodyParts.length; i++) {
            const currentSegment = this.bodyParts[i]; const targetSegment = this.bodyParts[i - 1];
             if (!currentSegment || !currentSegment.active || !targetSegment || !targetSegment.active) continue;
            const angleToTarget = Phaser.Math.Angle.Between(currentSegment.x, currentSegment.y, targetSegment.x, targetSegment.y);
            const targetPosX = targetSegment.x - Math.cos(angleToTarget) * effectiveBodySpacing;
            const targetPosY = targetSegment.y - Math.sin(angleToTarget) * effectiveBodySpacing;
            const moveX = targetPosX - currentSegment.x; const moveY = targetPosY - currentSegment.y;
            currentSegment.x += moveX * FOLLOW_SPEED_FACTOR * deltaSec; currentSegment.y += moveY * FOLLOW_SPEED_FACTOR * deltaSec;
            currentSegment.rotation = angleToTarget + Math.PI / 2;
        }
    }

    setTargetAngle(angle) {
        const deltaSec = this.scene.game.loop.delta / 1000 || 1 / 60;
        this.movementAngle = Phaser.Math.Angle.RotateTo(this.movementAngle, angle, this.turnRate * deltaSec);
    }

    markAsDead() {
        if (this.isDead) return; this.isDead = true;
        console.log(`StarEater ${this.constructor.name} marked as dead.`);
        if (this.head.body) { this.head.body.enable = false; this.head.body.setVelocity(0, 0); }
        this.bodyParts.forEach(part => {
             if (part && part.active) { part.setTint(0xff0000); if(part.body) part.body.enable = false; }
        });
    }

    getBodySegments() { return this.bodyParts.slice(1).filter(part => part && part.active); }

    destroy(explode = false) {
        console.log(`Destroying StarEater ${this.constructor.name}... Explode: ${explode}`); this.isDead = true;
        const segmentPositions = []; if (explode) { this.bodyParts.forEach(segment => { if (segment && segment.active) { segmentPositions.push({ x: segment.x, y: segment.y }); } }); }
        this.bodyParts.forEach(part => {
            if (!part) return; if (part.body) { part.body.enable = false; }
            if (part === this.head && this.headsGroup) { this.headsGroup.remove(part, true, true); }
            else if (part !== this.head && this.bodiesGroup) { this.bodiesGroup.remove(part, true, true); }
            else { if (part.active) { part.destroy(); } }
        });
        this.bodyParts = [];
        return explode ? segmentPositions : null;
    }
}