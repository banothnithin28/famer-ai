// Farmer AI - Device Geolocation Service
// Communicates with the browser's Geolocation API on mobile and desktop devices.
// Passes ONLY latitude and longitude to the Flask backend without storing private credentials.

const CACHE_KEY = 'farmer_ai_device_gps';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes cache per session

export function isGeolocationSupported() {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

export function isSecureContextSupported() {
  if (typeof window === 'undefined') return true;
  // Local development is always considered a secure context
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost')
  ) {
    return true;
  }
  return window.isSecureContext === true || window.location.protocol === 'https:';
}

/**
 * Reads cached session coordinates if available and not expired.
 */
export function getCachedFarmerLocation() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.latitude || !parsed.longitude) return null;
    if (Date.now() - (parsed.cachedAt || 0) > CACHE_MAX_AGE_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Stores acquired GPS coordinates in session storage.
 */
export function setCachedFarmerLocation(data) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        latitude: data.latitude,
        longitude: data.longitude,
        name: data.name || '',
        accuracy: data.accuracy || 0,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clears cached GPS location.
 */
export function clearCachedFarmerLocation() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Requests the current GPS coordinates from the user's phone or browser.
 * Uses high accuracy first (device GPS chip), falling back to standard accuracy if needed.
 */
export async function getFarmerGPSLocation(options = {}) {
  if (!isGeolocationSupported()) {
    throw {
      code: 'UNSUPPORTED',
      message: 'Geolocation is not supported by your browser.',
    };
  }

  if (!isSecureContextSupported()) {
    throw {
      code: 'INSECURE_CONTEXT',
      message: 'Location access requires a secure HTTPS connection. Please access Farmer AI via HTTPS.',
    };
  }

  const queryPosition = (enableHighAccuracy, timeoutMs) => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: options.maximumAge ?? 60000,
        }
      );
    });
  };

  try {
    // Attempt 1: High accuracy GPS (ideal for Android & iPhone)
    const result = await queryPosition(true, 10000);
    setCachedFarmerLocation(result);
    return result;
  } catch (err) {
    // User explicitly denied permission
    if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
      throw {
        code: 'PERMISSION_DENIED',
        message: '📍 Location access is required to provide live weather for your farm. Please allow location access in your browser settings and try again.',
      };
    }

    // Attempt 2: Standard network accuracy fallback (e.g. indoors or weak GPS satellite reception)
    try {
      const fallbackResult = await queryPosition(false, 10000);
      setCachedFarmerLocation(fallbackResult);
      return fallbackResult;
    } catch (fallbackErr) {
      if (fallbackErr.code === 1 || fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
        throw {
          code: 'PERMISSION_DENIED',
          message: '📍 Location access is required to provide live weather for your farm. Please allow location access in your browser settings and try again.',
        };
      }
      if (fallbackErr.code === 2 || fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) {
        throw {
          code: 'POSITION_UNAVAILABLE',
          message: 'Unable to acquire GPS position. Please make sure Location/GPS is turned on in your phone settings and try again.',
        };
      }
      if (fallbackErr.code === 3 || fallbackErr.code === fallbackErr.TIMEOUT) {
        throw {
          code: 'TIMEOUT',
          message: 'GPS location request timed out. Please tap Retry to detect your location again.',
        };
      }
      throw {
        code: 'UNKNOWN',
        message: fallbackErr.message || 'Unable to retrieve your location.',
      };
    }
  }
}
