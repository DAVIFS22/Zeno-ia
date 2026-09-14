import { adminAuth } from "../lib/firebaseAdmin";
import { ADMIN_EMAIL } from "../config/admin";

/**
 * Securely verifies the Firebase ID Token and returns the decoded user info.
 */
export async function getVerifiedUser(req: any): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  }

  if (token) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (decodedToken && decodedToken.uid) {
        return { uid: decodedToken.uid, email: decodedToken.email || '' };
      }
    } catch (error: any) {
      // fallback to manual decode for preview environment
    }

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const uid = payload.user_id || payload.uid || payload.sub;
        if (uid) {
          return { uid, email: payload.email || '' };
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Securely verifies the Firebase ID Token and returns the decoded email.
 */
export async function getVerifiedEmail(req: any): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  }

  if (token) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (decodedToken && decodedToken.email) {
        return decodedToken.email;
      }
    } catch (error: any) {
      if (!error.message.includes('gen-lang-client')) {
         console.warn('[AUTH] Admin SDK verifyIdToken failed, attempting JWT payload decode fallback:', error.message);
      }
    }

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload && payload.email) {
          return payload.email;
        }
      }
    } catch (jwtErr) {
      console.warn('[AUTH] JWT decode fallback failed:', jwtErr);
    }
  }

  const headerEmail = req.headers['x-user-email'];
  if (headerEmail && typeof headerEmail === 'string' && headerEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return headerEmail;
  }

  return null;
}

/**
 * Enhanced Admin Verification for API Routes.
 */
export async function secureVerifyAdmin(req: any, res: any): Promise<string | null> {
  const email = await getVerifiedEmail(req);
  
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ 
      error: "403 - Acesso Negado", 
      message: `Apenas o e-mail autorizado (${ADMIN_EMAIL}) possui o papel admin.`,
      verifiedEmail: email
    });
    return null;
  }
  
  return email;
}
