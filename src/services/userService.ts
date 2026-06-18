import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase'
import { User } from '../types/User';

export async function saveUser(user: User) {
    await setDoc(
        doc(db, "users", user.uid),
        user
    );
}