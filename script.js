import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDeSmzZSU9JvENgPoGfJqasYmCJccrg-sk",
  authDomain: "ffwg-bdb48.firebaseapp.com",
  projectId: "ffwg-bdb48",
  storageBucket: "ffwg-bdb48.firebasestorage.app",
  messagingSenderId: "1012017353984",
  appId: "1:1012017353984:web:a3a6f64df2cf2b87d44fe5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.currentUserData = null;

// --- UI HELPERS ---
window.showSignUp = () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
};

window.showLogin = () => {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
};

// --- AUTHENTICATION ---
window.login = async () => {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
    } catch(e) { alert("Login Error: " + e.message); }
};

window.signUp = async () => {
    const email = document.getElementById('su-email').value;
    const pass = document.getElementById('su-password').value;
    const username = document.getElementById('su-username').value;
    const country = document.getElementById('su-country').value;
    const gender = document.getElementById('su-gender').value;

    if(!email || !pass || !username) { alert("Please fill all fields"); return; }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = cred.user;
        
        // Save User Data
        await setDoc(doc(db, "users", user.uid), {
            username: username,
            email: email,
            country: country,
            gender: gender,
            bio: "Fresh Survivor",
            pic: "https://via.placeholder.com/150",
            verified: false,
            likes: 0
        });
        
        await updateProfile(user, { displayName: username });
        alert("Account Created! You are now logged in.");
    } catch(e) { alert("Signup Error: " + e.message); }
};

window.signInWithGoogle = async () => {
    try {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        // Check if user exists, if not create profile (Simplified)
        const userDoc = await getDoc(doc(db, "users", res.user.uid));
        if(!userDoc.exists()) {
             await setDoc(doc(db, "users", res.user.uid), {
                username: res.user.displayName,
                email: res.user.email,
                bio: "Google Survivor",
                pic: res.user.photoURL,
                verified: false,
                likes: 0
            });
        }
    } catch(e) { console.error(e); }
};

// --- MAIN APP LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Logged In
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        
        // Load User Data
        const snap = await getDoc(doc(db, "users", user.uid));
        if(snap.exists()) {
            window.currentUserData = snap.data();
            loadProfile();
        }
        loadFeed();
    } else {
        // Logged Out
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').classList.add('hidden');
    }
});

// --- FEED ---
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const badge = data.verified ? '<i class="fa-solid fa-circle-check" style="color:#20D5EC; margin-left:5px;"></i>' : '';
            container.innerHTML += `
                <div class="post">
                    <div style="font-weight:bold; margin-bottom:5px;">${data.username} ${badge}</div>
                    <div>${data.text}</div>
                    <div style="margin-top:10px; color:gray;"><i class="fa-regular fa-heart"></i> ${data.likes || 0}</div>
                </div>
            `;
        });
    });
}

// --- POSTING ---
window.createPostPrompt = async () => {
    const text = prompt("What's on your mind?");
    if(text) {
        await addDoc(collection(db, "posts"), {
            text: text,
            uid: auth.currentUser.uid,
            username: window.currentUserData.username,
            verified: window.currentUserData.verified,
            timestamp: serverTimestamp(),
            likes: 0
        });
    }
};

// --- PROFILE ---
window.openProfile = () => {
    document.getElementById('profile-page').classList.remove('hidden');
    document.querySelector('.bottom-nav').style.display = 'none'; // Hide Nav
};
window.closeProfile = () => {
    document.getElementById('profile-page').classList.add('hidden');
    document.querySelector('.bottom-nav').style.display = 'flex'; // Show Nav
};

function loadProfile() {
    if(!window.currentUserData) return;
    document.getElementById('profile-name').innerText = window.currentUserData.username;
    document.getElementById('profile-username').innerText = "@" + window.currentUserData.username;
    document.getElementById('profile-pic').src = window.currentUserData.pic;
    document.getElementById('total-likes').innerText = window.currentUserData.likes || 0;
}

// Gallery Upload (Simple)
window.triggerGallery = () => document.getElementById('file-input').click();
window.uploadProfilePic = (input) => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
        // Save Base64 to DB
        await updateDoc(doc(db, "users", auth.currentUser.uid), { pic: e.target.result });
        alert("Photo Updated!");
        location.reload();
    };
};
