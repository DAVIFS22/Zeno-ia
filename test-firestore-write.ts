import { adminDb } from "./src/lib/firebaseAdmin";
adminDb.collection('users').doc('1').set({test: 1}).then(() => {
  console.log("Success! Write worked.");
  process.exit(0);
}).catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
