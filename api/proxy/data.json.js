module.exports = async (req, res) => {
  try {
    // Set headers for JSON display in browser
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Check if we have cached data
    if (!global.cachedApiData) {
      return res.status(404).json({
        error: 'No data available. Please call /proxy first to fetch data.',
        timestamp: new Date().toISOString()
      });
    }

    // Return the cached API data directly for browser display
    return res.status(200).json(global.cachedApiData.data);

  } catch (error) {
    console.error('Error serving data.json:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};
