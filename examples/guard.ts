#!/usr/bin/env bun
/**
 * Simple Guard Script for BGR
 * This script monitors a specific process and automatically restarts it if it stops
 * 
 * Usage: bun guard.ts <process-name> [check-interval-seconds]
 */

import { $, sleep } from "bun";

async function main() {
  // Parse command line arguments
  const processName = process.argv[2];
  const checkInterval = parseInt(process.argv[3] || "30") * 1000; // Default 30 seconds
  
  if (!processName) {
    console.error("❌ Error: Process name is required");
    console.error("Usage: bun guard.ts <process-name> [check-interval-seconds]");
    process.exit(1);
  }
  
  console.log(`🔍 Starting guard for process "${processName}"`);
  console.log(`⏱️  Checking every ${checkInterval/1000} seconds`);
  
  // Main monitoring loop
  while (true) {
    try {
      // Check process status using bgr
      const result = await $`bgr ${processName}`.quiet().nothrow();
      
      // Check if the process is not running (look for "Status: ○ Stopped" in the output)
      if (result.stdout.includes("○ Stopped") || result.exitCode !== 0) {
        console.log(`⚠️ Process "${processName}" is not running! Attempting to restart...`);
        
        // Restart the process
        const restartResult = await $`bgr ${processName} --restart --force`.nothrow();
        
        if (restartResult.exitCode === 0) {
          console.log(`✅ Successfully restarted "${processName}"`);
        } else {
          console.error(`❌ Failed to restart "${processName}"`);
          console.error(restartResult.stderr);
        }
      } else {
        console.log(`✅ Process "${processName}" is running (${new Date().toLocaleTimeString()})`);
      }
    } catch (error) {
      console.error(`❌ Error checking process: ${error.message}`);
    }
    
    // Wait for the next check interval
    await sleep(checkInterval);
  }
}

main().catch(err => {
  console.error("🚨 Fatal error:", err);
  process.exit(1);
});