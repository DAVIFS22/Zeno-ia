import { adminDb } from "./src/lib/firebaseAdmin";
adminDb.listCollections().then(cols => {
  console.log("Success! Collections:", cols.length);
  process.exit(0);
}).catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
