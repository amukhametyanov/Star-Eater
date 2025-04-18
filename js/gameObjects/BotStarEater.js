// js/gameObjects/BotStarEater.js
import StarEater from './StarEater.js';

const BOT_DETECTION_RADIUS = 400; // How far the bot can "see" stars
const BOT_ROAM_INTERVAL = 5000; // How often to pick a new random direction (milliseconds)
const BOT_EAT_DISTANCE = 20; // How close the bot needs to be to "eat" (should be slightly larger than collision radius)

export default class BotStarEater extends StarEater {
    constructor(scene, x, y, headsGroup, bodiesGroup) {
        super(scene, x, y, headsGroup, bodiesGroup); // Call parent constructor

        this.targetStar = null;
        this.roamTargetAngle = Phaser.Math.RND.angle(); // Initial random direction
        this.lastRoamTime = scene.time.now; // Track when the bot last chose a roam direction
        this.botDetectionRadius = BOT_DETECTION_RADIUS;

        console.log("BotStarEater created");
    }

    findClosestStar() {
        let closestStar = null;
        let minDistanceSq = this.botDetectionRadius * this.botDetectionRadius; // Use squared distance for efficiency

        if (!this.scene || !this.scene.stars) return null; // Scene or stars group might not exist yet/anymore

        this.scene.stars.children.iterate(star => {
            if (!star || !star.active) {
                return; // Skip inactive stars
            }

            const distanceSq = Phaser.Math.Distance.Squared(this.head.x, this.head.y, star.x, star.y);

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestStar = star;
            }
        });

        return closestStar;
    }

    update(time, delta) {
        if (this.isDead) {
            return; // Don't do anything if dead
        }

        // --- AI Logic ---
        let targetAngle = this.movementAngle; // Default to current angle

        // 1. Check if current target star is still valid
        if (this.targetStar && !this.targetStar.active) {
            this.targetStar = null; // Target was eaten or despawned
        }

        // 2. If no target star, try to find one
        if (!this.targetStar) {
            this.targetStar = this.findClosestStar();
        }

        // 3. Decide whether to chase star or roam
        if (this.targetStar) {
            // Chase the star
            targetAngle = Phaser.Math.Angle.Between(this.head.x, this.head.y, this.targetStar.x, this.targetStar.y);
            this.lastRoamTime = time; // Reset roam timer while chasing

            // Check if close enough to 'eat' (physics overlap will handle actual eating)
            // We don't need explicit eating logic here anymore if GameScene handles head-star overlap
            // const distanceToStar = Phaser.Math.Distance.Between(this.head.x, this.head.y, this.targetStar.x, this.targetStar.y);
            // if (distanceToStar < BOT_EAT_DISTANCE) {
            //     // Considered 'eaten' by the bot reaching it. The overlap handles the actual kill/grow
            //     this.targetStar = null; // Look for a new star
            // }

        } else {
            // Roam: Pick a new random direction periodically
            if (time > this.lastRoamTime + BOT_ROAM_INTERVAL) {
                this.roamTargetAngle = Phaser.Math.RND.angle();
                this.lastRoamTime = time;
                // console.log("Bot changing roam direction");
            }
            targetAngle = this.roamTargetAngle;
        }

        // --- Set the target angle for the base StarEater movement ---
        this.setTargetAngle(targetAngle); // Use the smooth rotation method

        // --- Call the parent update AFTER setting the angle ---
        // This handles movement, segment updates, etc. based on the movementAngle we just calculated
        super.update(time, delta);
    }

     // Override destroy to add specific bot logging if needed
     destroy(explode = false) {
        console.log("Destroying BotStarEater...");
        return super.destroy(explode); // Call parent destroy logic
    }
}