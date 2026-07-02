const fs = require('fs')
const path = require('path')

// BF-P2-013 (extension) : genere public/version.json a chaque build
// pour permettre la detection automatique de nouvelle version cote client (PWA multi-clients)
const version = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())

const outPath = path.join(__dirname, '..', 'public', 'version.json')
fs.writeFileSync(outPath, JSON.stringify({ version }))
console.log('[generate-version] version.json genere :', version)
