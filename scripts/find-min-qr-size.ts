/**
 * Find minimum viable QR size for reliable decoding.
 *
 * This creates a test HTML page that generates QRs at various sizes
 * and tests if jsQR can decode them after canvas re-rendering.
 *
 * Open in browser: npx vite scripts/find-min-qr-size.html
 */

console.log(`
Create this HTML file and open in browser to test:

<!DOCTYPE html>
<html>
<head>
  <title>QR Size Test</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
  <style>
    body { font-family: monospace; padding: 20px; }
    .test { display: inline-block; margin: 10px; text-align: center; }
    .pass { background: #d4ffd4; }
    .fail { background: #ffd4d4; }
    canvas { border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>QR Minimum Size Test</h1>
  <p>Testing QR decode reliability at different sizes and module counts...</p>
  <div id="results"></div>

  <script>
    const testData = "MV1/ABCD1234/1/1:0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const results = document.getElementById('results');

    // Test different QR sizes
    const sizes = [48, 64, 80, 96, 112, 128, 144, 160];
    const eccLevels = ['L', 'M', 'Q'];

    for (const ecc of eccLevels) {
      const section = document.createElement('div');
      section.innerHTML = '<h2>ECC Level ' + ecc + '</h2>';
      results.appendChild(section);

      for (const size of sizes) {
        const div = document.createElement('div');
        div.className = 'test';

        // Generate QR
        const qr = qrcode(0, ecc);
        qr.addData(testData);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const modulePx = size / (moduleCount + 4); // +4 for margin

        // Render to canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const cellSize = size / (moduleCount + 4);
        const offset = cellSize * 2;

        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
            }
          }
        }

        // Try to decode
        const imageData = ctx.getImageData(0, 0, size, size);
        const decoded = jsQR(imageData.data, size, size);

        const passed = decoded && decoded.data === testData;
        div.className = 'test ' + (passed ? 'pass' : 'fail');

        div.innerHTML =
          '<div>' + size + 'px</div>' +
          '<div>' + moduleCount + ' modules</div>' +
          '<div>' + modulePx.toFixed(1) + 'px/mod</div>' +
          '<div>' + (passed ? '✓ PASS' : '✗ FAIL') + '</div>';

        div.appendChild(canvas);
        section.appendChild(div);
      }
    }
  </script>
</body>
</html>
`);
