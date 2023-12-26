module.exports = (req, res) => {
    const isIpCheckEnabled = process.env.IS_IPCHECK_ING === 'ipcheck.ing';
    res.status(200).json({ isIpCheckEnabled });
};
