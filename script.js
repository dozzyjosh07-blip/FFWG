// --- script.js ---

// 1. WE USE THESE SPECIAL WEB IMPORTS (Do not change these links)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc, getDoc, getCountFromServer } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 2. YOUR SPECIFIC KEYS (I copied these from your screenshot)
const firebaseConfig = {
  apiKey: "AIzaSyDeSmzZSU9JvENgPoGfJqasYmCJccrg-sk",
  authDomain: "ffwg-bdb48.firebaseapp.com",
  projectId: "ffwg-bdb48",
  storageBucket: "ffwg-bdb48.firebasestorage.app",
  messagingSenderId: "1012017353984",
  appId: "1:1012017353984:web:a3a6f64df2cf2b87d44fe5",
  measurementId: "G-5R9MHCT5VK"
};

// 3. START FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- GLOBAL VARIABLES ---
window.currentUserData = null;

// --- AUTH FUNCTIONS (Sign Up, Login, Logout) ---

// Sign Up Logic with "First 10 Verified" check
window.signUp = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (!email || !password || !username) {
        alert("Please fill in all fields");
        return;
    }

    try {
        // Create User in Authentication System
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check how many users exist to give the badge
        const usersColl = collection(db, "users");
        const snapshot = await getCountFromServer(usersColl);
        const userCount = snapshot.data().count;

        // If user is within first 10, verify them
        const isVerified = userCount < 10;

        // Save User Profile to Database
        await setDoc(doc(db, "users", user.uid), {
            username: username,
            email: email,
            bio: "New Survivor",
            verified: isVerified, 
            joinedAt: serverTimestamp()
        });

        // Update Auth Profile name
        await updateProfile(user, { displayName: username });

        alert("Account created! Welcome to FFWG.");
    } catch (error) {
        alert("Error: " + error.message);
    }
};

window.signIn = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Login failed: " + error.message);
    }
};

window.logout = () => signOut(auth);

// --- APP LOGIC (Feed, Page Switching) ---

// Listen for Login State Changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        
        // Fetch user data (badge status, etc)
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            window.currentUserData = userDoc.data();
            loadProfile(user);
        }
        
        loadFeed(); // Start Real-time Feed
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

// --- FEED SYSTEM ---

window.createPost = async () => {
    const text = document.getElementById('post-text').value;
    if (!text) return;

    try {
        await addDoc(collection(db, "posts"), {
            text: text,
            uid: auth.currentUser.uid,
            username: window.currentUserData.username || auth.currentUser.displayName,
            verified: window.currentUserData.verified, 
            timestamp: serverTimestamp(),
            likes: 0
        });
        document.getElementById('post-text').value = ""; // Clear input
    } catch (e) {
        console.error("Error posting:", e);
        alert("Could not post. Check console for details.");
    }
};

// Real-time Feed Listener
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    
    // This updates automatically whenever the database changes
    onSnapshot(q, (snapshot) => {
        const feedContainer = document.getElementById('feed-container');
        feedContainer.innerHTML = ""; 
        
        if (snapshot.empty) {
            feedContainer.innerHTML = "<p style='text-align:center; padding:20px;'>No posts yet. Stay tuned!</p>";
            return;
        }

        snapshot.forEach((doc) => {
            const post = doc.data();
            
            // Check if user is verified to show badge
            const badge = post.verified ? `<i class="fa-solid fa-circle-check verified-badge"></i>` : "";

            const postHTML = `
                <div class="post">
                    <div class="post-header">
                        <div class="username">${post.username} ${badge}</div>
                    </div>
                    <div class="post-content">${post.text}</div>
                    <div class="post-actions" style="margin-top:10px; color:gray;">
                        <i class="fa-regular fa-heart"></i> Like
                    </div>
                </div>
            `;
            feedContainer.innerHTML += postHTML;
        });
    });
}

// --- UI HELPERS ---

function loadProfile(user) {
    document.getElementById('profile-name').innerText = window.currentUserData.username;
    // Show badge on profile if verified
    if (window.currentUserData.verified) {
        const badgeIcon = document.createElement('i');
        badgeIcon.className = "fa-solid fa-circle-check verified-badge";
        document.getElementById('profile-name').appendChild(badgeIcon);
    }
}

window.switchPage = (pageId) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Show selected
    document.getElementById(pageId).classList.add('active');
};
// --- GOOGLE LOGIN LOGIC ---
window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if this user is new or existing
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // IT IS A NEW USER! Run the Verified Badge check.
            const usersColl = collection(db, "users");
            const snapshot = await getCountFromServer(usersColl);
            const userCount = snapshot.data().count;
            
            // If they are among the first 10, verify them
            const isVerified = userCount < 10;

            // Save their profile
            await setDoc(userDocRef, {
                username: user.displayName, // Uses their Google name
                email: user.email,
                bio: "New Survivor",
                verified: isVerified,
                joinedAt: serverTimestamp()
            });
            
            alert("Google Sign-In Successful! Welcome.");
        } else {
            // OLD USER
            console.log("Welcome back!");
        }
    } catch (error) {
        console.error(error);
        alert("Google Login Failed: " + error.message);
    }
};
