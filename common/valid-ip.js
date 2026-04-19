// Validate if IP address is valid
function isValidIP(ip) {
    if (typeof ip !== 'string') {
        return false;
    }

    // IPv4
    const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (ipv4Pattern.test(ip)) {
        return true;
    }

    const doubleColonParts = ip.split('::');
    if (doubleColonParts.length > 2) {
        return false;
    }
    
    // IPv6
    const hasCompressedGroup = doubleColonParts.length === 2;
    const groups = doubleColonParts.flatMap(part => part === '' ? [] : part.split(':'));

    if (groups.some(group => !/^[0-9a-fA-F]{1,4}$/.test(group))) {
        return false;
    }

    return hasCompressedGroup ? groups.length < 8 : groups.length === 8;
};

export { isValidIP };
