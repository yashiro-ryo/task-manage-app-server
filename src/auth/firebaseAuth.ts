import * as admin from "firebase-admin";
import * as serviceAccount from "../../keys/task-manage-app-1cb7a-firebase-adminsdk-mqez7-9784b5b4d1.json";
import { getAuth } from "firebase-admin/auth";

class FirebaseAuth {
  constructor() {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }

  verifyFirebaseToken(token: string) {
    return getAuth().verifyIdToken(token);
  }
}

export const firebaseAuth = new FirebaseAuth();
