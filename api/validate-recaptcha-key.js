// This API will be used to validate the recaptcha key
export default (req, res) => {
    if (process.env.RECAPTCHA_SECRET_KEY) {
        res.status(200).json({ isValid: true });
    } else {
        res.status(200).json({ isValid: false });
    }
};
