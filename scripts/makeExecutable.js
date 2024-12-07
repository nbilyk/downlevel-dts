const fs = require('fs');

fs.chmodSync('dist/index.js', 0o755);
