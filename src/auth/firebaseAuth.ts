import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";

class FirebaseAuth {
  constructor() {
    admin.initializeApp();
  }

  verifyFirebaseToken(token: string) {
    return getAuth().verifyIdToken(token);
  }
}

export const firebaseAuth = new FirebaseAuth();
