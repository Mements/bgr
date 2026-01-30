// Simple script that logs periodically
let count = 0;
setInterval(() => {
    count++;
    console.log(`[${new Date().toISOString()}] Hello from test-worker! Count: ${count}`);
    if (count % 3 === 0) {
        console.error(`[${new Date().toISOString()}] Warning: This is an error log example`);
    }
}, 1500);

console.log("🚀 Test worker started!");
