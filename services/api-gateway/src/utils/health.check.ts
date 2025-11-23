// ====================================
// src/utils/health-check.ts
// ====================================

import axios from 'axios';

export const checkServiceHealth = async (url: string, name: string) => {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    return { name, status: 'UP', url, statusCode: response.status };
  } catch (error) {
    return { 
      name, 
      status: 'DOWN', 
      url, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};