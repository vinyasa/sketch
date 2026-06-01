/**
 * Device and Operating System detection utility.
 * Identifies phone vs. tablet vs. computer viewports and userAgents, 
 * as well as the user's operating system.
 */

export function getDeviceInfo() {
    if (typeof window === 'undefined') {
        return { 
            device: 'computer', 
            os: 'Unknown', 
            isPhone: false, 
            isTablet: false, 
            isComputer: true 
        };
    }

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Detect Operating System
    let os = 'Unknown';
    if (/windows|win32|win64/i.test(ua)) {
        os = 'Windows';
    } else if (/macintosh|mac os x/i.test(ua)) {
        os = 'Mac';
    } else if (/linux/i.test(ua) && !/android/i.test(ua)) {
        os = 'Linux';
    } else if (/iphone|ipod/i.test(ua)) {
        os = 'iOS';
    } else if (/ipad/i.test(ua)) {
        os = 'iOS (iPad)';
    } else if (/android/i.test(ua)) {
        os = 'Android';
    }

    // 2. Detect Device Type (Phone vs. Tablet vs. Computer)
    let device = 'computer';

    const isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    
    // Modern iPads on iOS 13+ present as Macintosh but have multi-touch capability
    const isIPadOS = (/macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || /ipad/i.test(ua);
    
    const isTabletUA = isIPadOS || /Tablet|PlayBook|Silk/i.test(ua);

    // Screen size heuristics to back up userAgent checks
    const maxDimension = Math.max(width, height);
    const minDimension = Math.min(width, height);

    if (isTabletUA || (isMobileUA && maxDimension >= 768 && minDimension >= 600)) {
        device = 'tablet';
    } else if (isMobileUA || minDimension < 500 || (maxDimension < 850 && minDimension < 480)) {
        device = 'phone';
    }

    return {
        device,
        os,
        isPhone: device === 'phone',
        isTablet: device === 'tablet',
        isComputer: device === 'computer',
        width,
        height
    };
}
