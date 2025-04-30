// js/ui/BoostDisplay.js

// --- Configuration Constants ---
const METER_RADIUS = 18;
const METER_LINE_WIDTH = 4;
const METER_X_OFFSET = 45; // Horizontal distance from the icon center to the meter center
const ICON_SIZE = 24;

// Colors (feel free to change)
const COLOR_TRACK = 0x555555; // Background circle
const COLOR_READY = 0x00ffff; // Cyan
const COLOR_BOOSTING = 0xffff00; // Yellow
const COLOR_COOLDOWN = 0xff8800; // Orange

// Text Style for Cooldown Number
const COOLDOWN_TEXT_STYLE = {
    fontSize: '13px',
    color: '#FFFFFF',
    fontFamily: 'Arial, sans-serif',
    stroke: '#000000',
    strokeThickness: 3
};

// --- Create Function ---
/**
 * Creates the Boost UI elements (Icon, Meter Graphics, Cooldown Text).
 * @param {Phaser.Scene} scene - The scene to add the elements to.
 * @param {number} x - The desired X position (e.g., relative to score).
 * @param {number} y - The desired Y position (usually aligned with score).
 * @param {string} iconKey - The key for the preloaded boost icon texture.
 * @returns {object|null} An object containing references { icon, meterGraphics, cooldownText } or null if scene invalid.
 */
export function createBoostDisplay(scene, x, y, iconKey = 'boost-icon') { // <- Add: Export create function
    if (!scene || !scene.add) {
        console.error("BoostDisplay: Invalid scene object provided.");
        return null;
    }

    // --- Icon ---
    const icon = scene.add.image(x, y, iconKey)
        .setDisplaySize(ICON_SIZE, ICON_SIZE)
        .setOrigin(0.5, 0.5) // Center origin for easier positioning
        .setScrollFactor(0) // Fix to camera
        .setDepth(100);     // Ensure UI is on top
    icon.setActive(true).setVisible(true); // Start visible and ready

    // --- Graphics Object for Meter ---
    // Position graphics relative to the icon
    const meterX = x + METER_X_OFFSET;
    const meterY = y;
    const meterGraphics = scene.add.graphics({ x: meterX, y: meterY });
    meterGraphics.setScrollFactor(0); // Fix to camera
    meterGraphics.setDepth(100);      // Ensure UI is on top
    meterGraphics.setActive(true).setVisible(true);

    // --- Cooldown Text ---
    // Position text roughly in the center of the meter graphics object
    const textX = meterX; // Centered horizontally with meterGraphics origin
    const textY = meterY; // Centered vertically with meterGraphics origin
    const cooldownText = scene.add.text(textX, textY, '', COOLDOWN_TEXT_STYLE)
        .setOrigin(0.5, 0.5) // Center the text block
        .setScrollFactor(0)
        .setDepth(101) // Slightly above meter graphics
        .setVisible(false); // Start hidden

    console.log("Boost display created (Phaser Objects).");
    // Return references to the created objects
    return { icon, meterGraphics, cooldownText };
}


// --- Update Function ---
/**
 * Updates the Boost UI visuals based on the current boost state.
 * @param {object} uiElements - The object returned by createBoostDisplay { icon, meterGraphics, cooldownText }.
 * @param {object} boostState - Current state from StarEater.
 * @param {number} boostState.charge - Remaining boost charge (seconds).
 * @param {number} boostState.maxCharge - Maximum boost charge (seconds).
 * @param {boolean} boostState.cooldownActive - Is the ability on cooldown?
 * @param {number} boostState.cooldownProgress - Cooldown progress (0 to 1).
 * @param {number} boostState.cooldownRemaining - Cooldown remaining (seconds).
 * @param {boolean} boostState.boostingActive - Is the boost currently active?
 * @param {boolean} boostState.canUseAbility - Is the ability available for the current stage?
 */
export function updateBoostDisplay(uiElements, boostState) { // <- Add: Export update function
    // Safety check
    if (!uiElements || !uiElements.icon || !uiElements.meterGraphics || !uiElements.cooldownText) {
        // console.warn("updateBoostDisplay: Invalid UI elements provided.");
        return;
    }

    const { icon, meterGraphics, cooldownText } = uiElements;

    // --- Visibility based on ability availability ---
    const shouldBeVisible = boostState.canUseAbility;
    if (icon.visible !== shouldBeVisible) { // Only update if changed
        icon.setVisible(shouldBeVisible);
        meterGraphics.setVisible(shouldBeVisible);
        // Cooldown text visibility is handled below based on cooldown state
        if (!shouldBeVisible) cooldownText.setVisible(false); // Ensure text is hidden if ability disabled
    }
    if (!shouldBeVisible) return; // Don't process further if hidden


    // --- Clear previous drawings and draw background ---
    meterGraphics.clear();
    meterGraphics.lineStyle(METER_LINE_WIDTH, COLOR_TRACK, 0.7); // Background track (slightly transparent)
    meterGraphics.strokeCircle(0, 0, METER_RADIUS); // Draw relative to graphics origin (0,0)

    // --- Determine State & Draw Progress Arc ---
    const startAngle = Phaser.Math.DegToRad(-90); // Start at the top
    let endAngle;
    let progressColor;
    let iconAlpha = 0.7; // Default dim state
    let showCooldownNum = false;

    if (boostState.cooldownActive) {
        progressColor = COLOR_COOLDOWN;
        // Cooldown fills up: angle goes from startAngle to full circle
        endAngle = startAngle + (boostState.cooldownProgress * Math.PI * 2);
        iconAlpha = 0.5; // Dimmer during cooldown
        showCooldownNum = true;

    } else if (boostState.boostingActive) {
        progressColor = COLOR_BOOSTING;
        // Charge depletes: angle goes from full circle down to startAngle
        const chargePercent = Math.max(0, boostState.charge / boostState.maxCharge);
        endAngle = startAngle + (chargePercent * Math.PI * 2);
        iconAlpha = 1.0; // Bright while boosting

    } else if (boostState.charge >= boostState.maxCharge) { // Ready
        progressColor = COLOR_READY;
        endAngle = startAngle + (Math.PI * 2); // Full circle
        iconAlpha = 1.0; // Bright when ready

    } else { // Partially charged, not boosting or cooling down
        progressColor = COLOR_READY; // Show ready color but partial amount
        const chargePercent = Math.max(0, boostState.charge / boostState.maxCharge);
        endAngle = startAngle + (chargePercent * Math.PI * 2);
        iconAlpha = 0.7; // Dim if partially charged but not ready/boosting
    }

    // --- Draw the Progress Arc ---
    // Only draw if end angle is greater than start angle (prevents tiny visual glitches at 0)
    if (endAngle > startAngle) {
        meterGraphics.lineStyle(METER_LINE_WIDTH, progressColor, 1.0); // Use determined color
        meterGraphics.beginPath();
        meterGraphics.arc(0, 0, METER_RADIUS, startAngle, endAngle, false); // Draw arc relative to graphics origin
        meterGraphics.strokePath();
    }

    // --- Update Icon Alpha ---
    icon.setAlpha(iconAlpha);

    // --- Update Cooldown Text ---
    if (showCooldownNum) {
        cooldownText.setText(boostState.cooldownRemaining.toFixed(1));
        cooldownText.setVisible(true);
    } else {
        cooldownText.setVisible(false);
    }
}