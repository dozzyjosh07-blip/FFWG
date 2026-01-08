// --- script.js V3 (Gallery Support) ---

// 1. IMPORTS (Now includes Storage)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc, getDoc, getCountFromServer, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// 2. YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDeSmzZSU9JvENgPoGfJqasYmCJccrg-sk",
  authDomain: "ffwg-bdb48.firebaseapp.com",
  projectId: "ffwg-bdb48",
  storageBucket: "ffwg-bdb48.firebasestorage.app",
  messagingSenderId: "1012017353984",
  appId: "1:1012017353984:web:a3a6f64df2cf2b87d44fe5",
  measurementId: "G-5R9MHCT5VK"
};

// 3. START APP
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Start Storage

window.currentUserData = null;

// --- AUTH ---
window.signUp = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    if (!email || !password || !username) { alert("Please fill all fields"); return; }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const snapshot = await getCountFromServer(collection(db, "users"));
        const isVerified = snapshot.data().count < 10;

        await setDoc(doc(db, "users", user.uid), {
            username: username,
            email: email,
            bio: "New Survivor",
            pic: "https://i.ibb.co/5k0409z/profile-user.png",
            verified: isVerified,
            joinedAt: serverTimestamp()
        });
        await updateProfile(user, { displayName: username });
        alert("Welcome Survivor!");
    } catch (error) { alert("Error: " + error.message); }
};

window.signIn = async () => {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
    } catch (error) { alert("Login failed: " + error.message); }
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
                username: user.displayName,
                email: user.email,
                bio: "New Survivor",
                pic: user.photoURL, 
                verified: snapshot.data().count < 10,
                joinedAt: serverTimestamp()
            });
        }
    } catch (error) { console.error(error); alert("Google Login Error"); }
};

window.logout = () => signOut(auth);

// --- APP LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            window.currentUserData = userDoc.data();
            loadProfile();
        }
        loadFeed();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

// --- FEED & LIKES ---
window.createPost = async () => {
    const text = document.getElementById('post-text').value;
    if (!text) return;
    try {
        await addDoc(collection(db, "posts"), {
            text: text,
            uid: auth.currentUser.uid,
            username: window.currentUserData.username,
            verified: window.currentUserData.verified,
            timestamp: serverTimestamp(),
            likes: 0
        });
        document.getElementById('post-text').value = "";
    } catch (e) { alert("Post failed"); }
};

window.toggleLike = async (postId) => {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, { likes: increment(1) });
};

function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const feedContainer = document.getElementById('feed-container');
        feedContainer.innerHTML = ""; 
        if (snapshot.empty) { feedContainer.innerHTML = "<p style='text-align:center;'>No posts yet.</p>"; return; }

        snapshot.forEach((doc) => {
            const post = doc.data();
            const badge = post.verified ? `<i class="fa-solid fa-circle-check verified-badge"></i>` : "";
            const postHTML = `
                <div class="post">
                    <div class="post-header">
                        <div class="username">${post.username} ${badge}</div>
                    </div>
                    <div class="post-content">${post.text}</div>
                    <div class="post-actions" style="margin-top:10px; color:gray; cursor:pointer;" onclick="toggleLike('${doc.id}')">
                        <i class="fa-regular fa-heart"></i> ${post.likes || 0} Likes
                    </div>
                </div>
            `;
            feedContainer.innerHTML += postHTML;
        });
    });
}

// --- PROFILE & GALLERY LOGIC ---

window.toggleTheme = () => { document.body.classList.toggle("light-mode"); };

window.editBio = async () => {
    const newBio = prompt("Enter new bio:", window.currentUserData.bio);
    if (newBio) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { bio: newBio });
        location.reload();
    }
}

// 1. Click the button -> Open Phone Gallery
window.triggerGallery = () => {
    document.getElementById('file-input').click();
}

// 2. When user picks a photo -> Upload to Firebase Storage
window.uploadProfilePic = async (input) => {
    const file = input.files[0];
    if (!file) return;

    // Show loading state
    alert("Uploading photo... please wait.");

    try {
        // Create a reference (Name of the file in the cloud)
        const storageRef = ref(storage, 'profile_pics/' + auth.currentUser.uid);
        
        // Upload the file
        await uploadBytes(storageRef, file);
        
        // Get the internet link (URL) of the uploaded file
        const downloadURL = await getDownloadURL(storageRef);

        // Save this link to the user's profile
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            pic: downloadURL
        });

        alert("Photo updated!");
        location.reload();

    } catch (error) {
        console.error(error);
        alert("Upload failed. Did you enable 'Storage' in Firebase?");
    }
}

function loadProfile() {
    document.getElementById('profile-name').innerHTML = window.currentUserData.username;
    if (window.currentUserData.verified) {
        document.getElementById('profile-name').innerHTML += ` <i class="fa-solid fa-circle-check verified-badge"></i>`;
    }
    document.getElementById('profile-bio').innerText = window.currentUserData.bio;
    const picUrl = window.currentUserData.pic || "https://i.ibb.co/5k0409z/profile-user.png";
    document.getElementById('profile-pic').src = picUrl;
}

window.switchPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
};
