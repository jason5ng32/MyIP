// backend/middleware/verifyToken.js
import admin from 'firebase-admin';

async function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const idToken = authHeader.split(' ')[1]; // Bearer <token>
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            return {
                isValid: true,
                email: decodedToken.email
            };
        } catch (error) {
            return { isValid: false, email: null };
        }
    } else {
        return { isValid: false, email: null };
    }
}

export default verifyToken;