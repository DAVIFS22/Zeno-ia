import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy, limit, writeBatch, getCountFromServer, addDoc, updateDoc } from "firebase/firestore";
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig, "server-client");
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

class MockQuery {
  constructor(public _ref: any, public _q: any) {}
  
  where(field: string, op: any, value: any) {
    return new MockQuery(this._ref, query(this._q, where(field, op, value)));
  }
  orderBy(field: string, dir: any = 'asc') {
    return new MockQuery(this._ref, query(this._q, orderBy(field, dir)));
  }
  limit(n: number) {
    return new MockQuery(this._ref, query(this._q, limit(n)));
  }
  async get() {
    const snap = await getDocs(this._q);
    return {
      empty: snap.empty,
      docs: snap.docs.map(d => ({
        id: d.id,
        exists: d.exists(),
        data: () => d.data(),
        ref: new MockDoc(d.ref.path)
      })),
      size: snap.size
    };
  }
  count() {
    return {
      get: async () => {
        const snap = await getCountFromServer(this._q);
        return { data: () => ({ count: snap.data().count }) };
      }
    };
  }
}

class MockCollection {
  constructor(public path: string) {}
  
  doc(id?: string) {
    return new MockDoc(id ? `${this.path}/${id}` : `${this.path}/${Math.random().toString(36).substring(2)}`);
  }
  
  async add(data: any) {
    const ref = await addDoc(collection(db, this.path), data);
    return new MockDoc(ref.path);
  }
  
  where(field: string, op: any, value: any) {
    return new MockQuery(collection(db, this.path), query(collection(db, this.path), where(field, op, value)));
  }
  orderBy(field: string, dir: any = 'asc') {
    return new MockQuery(collection(db, this.path), query(collection(db, this.path), orderBy(field, dir)));
  }
  limit(n: number) {
    return new MockQuery(collection(db, this.path), query(collection(db, this.path), limit(n)));
  }
  async get() {
    const snap = await getDocs(collection(db, this.path));
    return {
      empty: snap.empty,
      docs: snap.docs.map(d => ({
        id: d.id,
        exists: d.exists(),
        data: () => d.data(),
        ref: new MockDoc(d.ref.path)
      })),
      size: snap.size
    };
  }
  count() {
    return {
      get: async () => {
        const snap = await getCountFromServer(collection(db, this.path));
        return { data: () => ({ count: snap.data().count }) };
      }
    };
  }
}

class MockDoc {
  constructor(public path: string) {}

  collection(subPath: string) {
    return new MockCollection(`${this.path}/${subPath}`);
  }
  
  async get() {
    const snap = await getDoc(doc(db, this.path));
    return {
      id: snap.id,
      exists: snap.exists(),
      data: () => snap.data(),
      ref: this
    };
  }
  
  async set(data: any, options?: any) {
    await setDoc(doc(db, this.path), data, options);
  }
  
  async update(data: any) {
    await updateDoc(doc(db, this.path), data);
  }
  
  async delete() {
    await deleteDoc(doc(db, this.path));
  }
}

class MockBatch {
  _batch = writeBatch(db);
  
  set(docRef: any, data: any, options?: any) {
    this._batch.set(doc(db, docRef.path), data, options);
    return this;
  }
  update(docRef: any, data: any) {
    this._batch.update(doc(db, docRef.path), data);
    return this;
  }
  delete(docRef: any) {
    this._batch.delete(doc(db, docRef.path));
    return this;
  }
  commit() {
    return this._batch.commit();
  }
}

export const adminDb = {
  collection: (path: string) => new MockCollection(path),
  doc: (path: string) => {
    // If the path contains a slash, it's a full document path
    if (path.includes('/')) return new MockDoc(path);
    throw new Error('adminDb.doc() requires a full path');
  },
  batch: () => new MockBatch(),
  listCollections: async () => []
};
