// js/ui/ScoreDisplay.js

// Style constants for the score text
const SCORE_TEXT_STYLE = {
    fontSize: '32px',
    // fill: '#fff', // <- Update: Changed fill to color
    color: '#FFFFFF', // <- Add: Explicitly use color
    fontFamily: 'Arial, sans-serif', // <- Add: Specify a font family
    stroke: '#000000', // <- Add: Black stroke
    strokeThickness: 4   // <- Add: Stroke thickness
    // You can add shadows too:
    // shadow: {
    //     offsetX: 2,
    //     offsetY: 2,
    //     color: '#000',
    //     blur: 2,
    //     stroke: true,
    //     fill: true
    // }
};
const SCORE_TEXT_PADDING = 20; // Pixels from the top edge

/**
 * Creates the score text object.
 * @param {Phaser.Scene} scene - The scene to add the text to.
 * @returns {Phaser.GameObjects.Text} The created text object.
 */
export function createScoreDisplay(scene) { // <- Add: Export this function
    const x = scene.cameras.main.width / 2; // Center X based on camera viewport
    const y = SCORE_TEXT_PADDING;        // Position near top

    const scoreText = scene.add.text(x, y, 'Stars: 0', SCORE_TEXT_STYLE)
        .setOrigin(0.5, 0)     // Origin top-center
        .setScrollFactor(0); // Keep fixed on screen

    console.log("Score display created.");
    return scoreText;
}

/**
 * Updates the score text object's content.
 * @param {Phaser.GameObjects.Text} scoreTextObject - The text object to update.
 * @param {number} newScore - The new score value.
 */
export function updateScoreDisplay(scoreTextObject, newScore) { // <- Add: Export this function
    if (scoreTextObject && typeof scoreTextObject.setText === 'function') { // Check if it's a valid text object
        scoreTextObject.setText('Stars: ' + newScore);
    } else {
        // console.warn("Attempted to update invalid score text object.");
    }
}