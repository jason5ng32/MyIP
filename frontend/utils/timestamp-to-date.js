// Convert Unix timestamp to date time
const unixToDateTime = (timestamp) => {
    timestamp = Number(timestamp);
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    };
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, options);
}

export default unixToDateTime