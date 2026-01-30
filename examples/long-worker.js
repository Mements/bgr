// Long-running test worker that runs indefinitely
let count = 0;
console.log("🚀 Long-running worker started at", new Date().toISOString());

setInterval(() => {
    count++;
    console.log(`[${new Date().toISOString()}] Tick #${count}`);
}, 2000);
