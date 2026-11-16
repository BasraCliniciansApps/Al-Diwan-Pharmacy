import 'package:firebase_core/firebase_core.dart';

/// نفس إعدادات الويب الحالية (مفتاح عام بطبيعته، والحماية في firestore.rules).
const diwanFirebaseOptions = FirebaseOptions(
  apiKey: 'AIzaSyDimxdd2vaKdOFw-IDYfWaivslosGMFVh4',
  appId: '1:670194103463:web:ab22898112c5a5b9a69782',
  messagingSenderId: '670194103463',
  projectId: 'al-d1-pharmacy',
  authDomain: 'al-d1-pharmacy.firebaseapp.com',
  storageBucket: 'al-d1-pharmacy.firebasestorage.app',
);

/// UID المالك كما في firestore.rules.
const diwanOwnerUid = 'VrZUN6AMvTPMklvhlZcwKlqJciY2';
