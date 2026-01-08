import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp, setDoc, doc, getDoc, getCountFromServer, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeSmzZSU9JvENgPoGfJqasYmCJccrg-sk",
  authDomain: "ffwg-bdb48.firebaseapp.com",
  projectId: "ffwg-bdb48",
  storageBucket: "ffwg-bdb48.firebasestorage.app",
  messagingSenderId: "1012017353984",
  appId: "1:1012017353984:web:a3a6f64df2cf2b87d44fe5",
  measurementId: "G-5R9MHCT5VK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.currentUserData = null;

// AUTH
window.signUp = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const snapshot = await getCountFromServer(collection(db, "users"));
        await setDoc(doc(db, "users", user.uid), {
            username: username, email: email, bio: "New Survivor",
            pic: "https://i.ibb.co/5k0409z/profile-user.png",
            verified: snapshot.data().count < 10,
            joinedAt: serverTimestamp()
        });
        await updateProfile(user, { displayName: username });
        alert("Welcome!");
    } catch (error) { alert("Error: " + error.message); }
};

window.signIn = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); }
    catch (error) { alert("Login failed: " + error.message); }
};

window.signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const user = result.user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            const snapshot = await getCountFromServer(collection(db, "users"));
            await setDoc(userDocRef, {
                username: user.displayName, email: user.email, bio: "New Survivor",
                pic: user.photoURL, verified: snapshot.data().count < 10,
                joinedAt: serverTimestamp()
            });
        }
    } catch (error) { console.error(error); alert("Google Login Error"); }
};

window.logout = () => signOut(auth);

// LOGIC
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            window.currentUserData = userDoc.data();
            loadProfile();
            loadMyGrid(user.uid); // Load Profile Grid
        }
        loadFeed();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

window.createPost = async () => {
    const text = document.getElementById('post-text').value;
    if (!text) return;
    try {
        await addDoc(collection(db, "posts"), {
            text: text, uid: auth.currentUser.uid,
            username: window.currentUserData.username,
            verified: window.currentUserData.verified,
            timestamp: serverTimestamp(), likes: 0
        });
        document.getElementById('post-text').value = "";
    } catch (e) { alert("Post failed"); }
};

window.toggleLike = async (postId) => {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, { likes: increment(1) });
};

// Main Feed
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const feedContainer = document.getElementById('feed-container');
        feedContainer.innerHTML = ""; 
        snapshot.forEach((doc) => {
            const post = doc.data();
            const badge = post.verified ? `<i class="fa-solid fa-circle-check verified-badge"></i>` : "";
            feedContainer.innerHTML += `
                <div class="post">
                    <div class="post-header"><div class="username">${post.username} ${badge}</div></div>
                    <div class="post-content">${post.text}</div>
                    <div class="post-actions" onclick="toggleLike('${doc.id}')">
                        <i class="fa-regular fa-heart"></i> ${post.likes || 0}
                    </div>
                </div>`;
        });
    });
}

// PROFILE LOGIC
function loadProfile() {
    document.getElementById('profile-name').innerHTML = window.currentUserData.username;
    if (window.currentUserData.verified) {
        document.getElementById('profile-name').innerHTML += ` <i class="fa-solid fa-circle-check verified-badge"></i>`;
    }
    document.getElementById('profile-username').innerText = "@" + window.currentUserData.username.replace(/\s/g, '').toLowerCase();
    document.getElementById('profile-bio').innerText = window.currentUserData.bio;
    const picUrl = window.currentUserData.pic || "https://i.ibb.co/5k0409z/profile-user.png";
    document.getElementById('profile-pic').src = picUrl;
}

// NEW: Load My Posts into Grid
function loadMyGrid(myUid) {
    const q = query(collection(db, "posts"), where("uid", "==", myUid), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const grid = document.getElementById('my-posts-grid');
        grid.innerHTML = "";
        let totalLikes = 0;
        
        snapshot.forEach((doc) => {
            const post = doc.data();
            totalLikes += (post.likes || 0);
            // Create a small grid box for each post
            grid.innerHTML += `
                <div class="grid-post">
                    <div class="grid-text">${post.text.substring(0, 20)}...</div>
                </div>`;
        });
        document.getElementById('total-likes').innerText = totalLikes;
    });
}

// Gallery & Bio
window.editBio = async () => {
    const newBio = prompt("Enter new bio:", window.currentUserData.bio);
    if (newBio) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { bio: newBio });
        location.reload();
    }
}
window.triggerGallery = () => document.getElementById('file-input').click();

window.uploadProfilePic = (input) => {
    const file = input.files[0];
    if (!file) return;
    alert("Updating photo...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { pic: dataUrl });
                location.reload();
            } catch (e) { alert("Image too large."); }
        };
    };
}

window.switchPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
};
