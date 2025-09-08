const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = 'http://api-sermaca.lat/api_aguilera/api/ai-data';

module.exports = async (req, res) => {
  try {
    // Set headers for JSON display in browser
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Fetch fresh data from external API
    console.log('Fetching fresh data from external API for data.json');
    
    const response = await axios.get(API_BASE_URL, {
      timeout: 10000 // 10 second timeout
    });

    console.log('Fresh API data fetched successfully');

    // Return the fresh API data directly for browser display
    return res.status(200).json(response.data);

  } catch (error) {
    console.error('Error fetching fresh data for data.json:', error.message);
    
    // If fresh fetch fails, try to use cached data as fallback
    if (global.cachedApiData) {
      console.log('Using cached data as fallback');
      return res.status(200).json(global.cachedApiData.data);
    }
    
    // If no cached data available, return error
    return res.status(500).json({
      error: 'Unable to fetch data from external API and no cached data available',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
