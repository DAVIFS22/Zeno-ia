import { adminAuth } from "./src/lib/firebaseAdmin";
adminAuth.listUsers(1).then(() => {
  console.log("Auth admin works!");
  process.exit(0);
}).catch(e => {
  console.error("Auth admin error:", e.message);
  process.exit(1);
});
