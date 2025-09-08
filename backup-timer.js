const { performBackup } = require('./api/backup');

// Timer configuration
const BACKUP_INTERVAL = 60 * 1000; // 60 seconds (1 minute)

/**
 * Start automatic backup timer
 */
function startBackupTimer() {
  console.log('🕐 Starting automatic backup timer (every 1 minute)...');
  
  // Run initial backup
  performBackup();
  
  // Set up recurring timer
  setInterval(async () => {
    console.log('⏰ Timer triggered - Running automatic backup...');
    await performBackup();
  }, BACKUP_INTERVAL);
  
  console.log('✅ Backup timer started successfully');
}

// Start the timer when this module is loaded
startBackupTimer();

module.exports = {
  startBackupTimer
};
