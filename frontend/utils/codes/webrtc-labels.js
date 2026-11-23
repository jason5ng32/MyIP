// WebRTC NAT type code → i18n key, for the live section and every view of a
// recorded code (report page, Snapshots diff). 'unavailable' / 'error' reuse
// the status labels.
export const natTypeKey = (natType) => {
    if (natType === 'unavailable') return 'webrtc.StatusUnavailable';
    if (natType === 'error') return 'webrtc.StatusError';
    return `webrtc.NATType.${natType}`;
};
