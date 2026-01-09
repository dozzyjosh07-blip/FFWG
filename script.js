import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp, setDoc, doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// GLOBALS
let currentUser = null;
let verificationCode = null;
const OWNER_EMAIL = "nzeabaluchidozie@gmail.com";
let tempSignupData = {};

// --- AUTHENTICATION --- //

window.showPage = (id) => {
    document.querySelectorAll('.auth-box').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

// Step 1: Collect Data
window.sendVerification = async () => {
    const name = document.getElementById('signup-name').value;
    const username = document.getElementById('signup-username').value;
    const gender = document.getElementById('signup-gender').value;
    const country = document.getElementById('signup-country').value;
    const email = document.getElementById('signup-email').value;

    if(!name || !username || !gender || !country || !email) { alert("Fill all fields"); return; }

    tempSignupData = { name, username, gender, country, email };
    
    // Simulate Verification Code
    verificationCode = Math.floor(100000 + Math.random() * 900000);
    alert(`[SIMULATION] Verification Code sent to ${email}: ${verificationCode}`);
    
    showPage('auth-signup-step2');
};

// Step 2: Verify Code
window.checkVerification = () => {
    const input = document.getElementById('verify-code').value;
    if(parseInt(input) === verificationCode) {
        showPage('auth-signup-step3');
    } else {
        alert("Wrong Code");
    }
};

// Step 3: Create User
window.completeSignUp = async () => {
    const password = document.getElementById('signup-pass').value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, tempSignupData.email, password);
        await initUserProfile(cred.user, tempSignupData);
        alert("Account Created! Please Log In.");
        showPage('auth-login');
    } catch (e) { alert(e.message); }
};

// Helper: Initialize Profile in Firestore
async function initUserProfile(user, data) {
    let isOwner = data.email === OWNER_EMAIL;
    let genderSymbol = data.gender === "male" ? "♂️" : "♀️";
    let countryFlag = data.country.split(" ")[0]; // Get just the flag

    const userData = {
        uid: user.uid,
        name: data.name,
        username: data.username,
        displayname: `${genderSymbol} ${data.name} ${countryFlag}`,
        email: data.email,
        verified: isOwner, // Auto verify owner
        following: isOwner ? 0 : 1, // Auto follow owner if not owner
        followers: 0,
        likes: 0,
        bio: "Just joined F.F.W.G!",
        pic: "https://via.placeholder.com/150",
        joinedAt: serverTimestamp()
    };

    await setDoc(doc(db, "users", user.uid), userData);
    await updateProfile(user, { displayName: userData.displayname });

    // Auto Follow Owner Logic
    if (!isOwner) {
        // Find owner ID (Hardcoded logic or query)
        // For simplicity, we just add the logic. In a real app, we'd query for email.
        const q = query(collection(db, "users"), where("email", "==", OWNER_EMAIL));
        const snapshot = await getCountFromServer(q); 
        // Note: Client side querying by email requires index permissions, simplified here:
        // We will assume the owner logs in first to set up the DB.
    }
}

window.login = async () => {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value);
    } catch(e) { alert("Login Failed: " + e.message); }
};

window.signInWithGoogle = async () => {
    try {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        const userDoc = await getDoc(doc(db, "users", res.user.uid));
        if (!userDoc.exists()) {
            await initUserProfile(res.user, {
                name: res.user.displayName,
                username: "@" + res.user.displayName.replace(/\s/g, ''),
                email: res.user.email,
                gender: "male", // Default
                country: "🏳️ World"
            });
        }
    } catch(e) { console.error(e); }
};

window.logout = () => signOut(auth);

// --- MAIN APP LOGIC --- //

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadFeed();
        listenForNotifications();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

// NAVIGATION
window.navTo = (pageId, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    
    if(pageId === 'world-chat-page') loadWorldChat();
    if(pageId === 'friends-page') loadFriends();
};

// --- FEED SYSTEM ---
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const div = document.getElementById('feed-list');
        div.innerHTML = "";
        snapshot.forEach(docSnap => {
            const post = docSnap.data();
            const timeAgo = getTimeAgo(post.timestamp);
            const verified = post.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';
            
            div.innerHTML += `
                <div class="feed-post">
                    <div class="post-header" onclick="viewUserProfile('${post.uid}')">
                        <img src="${post.pic}" class="avatar-small">
                        <div>
                            <div style="font-weight:bold;">${post.displayname} ${verified}</div>
                            <div class="post-meta">@${post.username} • ${timeAgo}</div>
                        </div>
                    </div>
                    <div style="margin:10px 0;">${post.text}</div>
                    ${post.img ? `<img src="${post.img}" style="width:100%; border-radius:10px;">` : ''}
                    <div class="post-actions">
                        <div class="action-btn" onclick="likePost('${docSnap.id}')">
                            <i class="fa-regular fa-heart"></i> ${post.likes || 0}
                        </div>
                        <div class="action-btn"><i class="fa-regular fa-comment"></i> Comment</div>
                    </div>
                </div>
            `;
        });
    });
}

// --- PROFILE SYSTEM ---
window.openProfile = async () => {
    document.getElementById('profile-page').classList.remove('hidden');
    const userRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userRef);
    const data = snap.data();
    
    document.getElementById('profile-top-name').innerText = data.username;
    document.getElementById('profile-display-name').innerText = data.displayname;
    document.getElementById('profile-username').innerText = "@" + data.username;
    document.getElementById('profile-bio').innerText = data.bio;
    document.getElementById('profile-pic').src = data.pic;
    document.getElementById('stat-likes').innerText = data.likes || 0;
    
    if(data.verified) document.getElementById('profile-display-name').innerHTML += ' <i class="fa-solid fa-circle-check verified-badge"></i>';
    
    loadUserGrid(auth.currentUser.uid);
};

window.closeProfile = () => document.getElementById('profile-page').classList.add('hidden');

function loadUserGrid(uid) {
    const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const grid = document.getElementById('profile-grid');
        grid.innerHTML = "";
        sn.forEach(d => {
            const p = d.data();
            grid.innerHTML += `<div class="grid-item"><div style="padding:10px; font-size:0.8rem;">${p.text}</div></div>`;
        });
    });
}

// --- WORLD CHAT ---
function loadWorldChat() {
    const q = query(collection(db, "worldchat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (sn) => {
        const box = document.getElementById('world-chat-box');
        box.innerHTML = "";
        sn.forEach(d => {
            const msg = d.data();
            const isMe = msg.uid === auth.currentUser.uid;
            box.innerHTML += `
                <div class="msg-bubble ${isMe ? 'msg-right' : 'msg-left'}">
                    <div style="font-size:0.7rem; opacity:0.7; margin-bottom:2px;">${msg.name}</div>
                    ${msg.text}
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

window.sendWorldMessage = async () => {
    const text = document.getElementById('world-chat-input').value;
    if(!text) return;
    const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userSnap.data();
    
    await addDoc(collection(db, "worldchat"), {
        text: text,
        uid: auth.currentUser.uid,
        name: userData.displayname,
        timestamp: serverTimestamp()
    });
    document.getElementById('world-chat-input').value = "";
};

// --- UTILS ---
function getTimeAgo(timestamp) {
    if(!timestamp) return "just now";
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
}

window.toggleSettings = (show) => {
    const menu = document.getElementById('settings-menu');
    show ? menu.classList.add('open') : menu.classList.remove('open');
};

// --- CREATE POST ---
window.createPostPrompt = async () => {
    const text = prompt("Write something...");
    if(text) {
        const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const data = userSnap.data();
        await addDoc(collection(db, "posts"), {
            text: text,
            uid: auth.currentUser.uid,
            username: data.username,
            displayname: data.displayname,
            pic: data.pic,
            verified: data.verified,
            likes: 0,
            timestamp: serverTimestamp()
        });
    }
};

window.likePost = async (id) => {
    // Basic like increment
    const ref = doc(db, "posts", id);
    await updateDoc(ref, { likes: increment(1) });
    // Also increment Total User Likes
    const postSnap = await getDoc(ref);
    const creatorId = postSnap.data().uid;
    await updateDoc(doc(db, "users", creatorId), { likes: increment(1) });
};
