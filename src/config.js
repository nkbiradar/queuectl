const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.resolve(process.cwd(), 'config.json');

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultCfg = { max_retries: 3, base_backoff: 2 };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultCfg, null, 2));
      return defaultCfg;
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to load config:', err.message);
    return { max_retries: 3, base_backoff: 2 };
  }
}

function saveConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log('✅ Config saved successfully');
  } catch (err) {
    console.error('❌ Failed to save config:', err.message);
  }
}

function setConfigKey(key, value) {
  const cfg = loadConfig();
  cfg[key] = isNaN(value) ? value : Number(value);
  saveConfig(cfg);
}

module.exports = { loadConfig, saveConfig, setConfigKey, CONFIG_FILE };
