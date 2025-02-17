const sharp = require('sharp');
const path = require('path');
// Your SVG path (using double backslashes for Windows)
const svgPath = "C:\\Users\\tso0016\\OneDrive - Shelter Insurance Companies\\Documents\\1 QA Lead\\JavaScript Helpers\\qa-action-recorder\\assets\\icons\\tracer-logo-salmon.svg";
// Output directory (same directory as the SVG)
const outputDir = path.dirname(svgPath);
const sizes = [16, 32, 48, 64, 128, 256]; // Add more sizes if needed
sizes.forEach(size => {
    sharp(svgPath)
        .resize(size, size)
        .toFile(path.join(outputDir, `eye_${size}.png`), (err, info) => {
            if (err) {
                console.error(`Error creating eye_${size}.png:`, err);
            } else {
                console.log(`Created eye_${size}.png (${size}x${size})`);
            }
        });
});