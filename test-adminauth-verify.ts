import { adminAuth } from "./src/lib/firebaseAdmin";
adminAuth.verifyIdToken("invalid-token").catch(e => {
  console.log("Error:", e.message);
  process.exit(0);
});
