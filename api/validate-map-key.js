export default (req, res) => {
    if (process.env.BING_MAP_API_KEY) {
        res.status(200).json({ isValid: true });
    } else {
        res.status(200).json({ isValid: false });
    }
};
