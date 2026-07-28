import { adminDb } from "./src/lib/firebaseAdmin";
adminDb.doc('test/1').get().then(doc => {
  console.log("Success! Doc exists:", doc.exists);
  process.exit(0);
}).catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
