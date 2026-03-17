"use client";
import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// SUPABASE CLIENT (lightweight, no SDK needed)
// ============================================================
const SUPABASE_URL = "https://dafdxgtrbtegvbvbwbfc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZmR4Z3RyYnRlZ3ZidmJ3YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzg4MDgsImV4cCI6MjA4OTI1NDgwOH0.q_TqHq9ZahYTOMEB_OT0WASzlf1CmWrc0pgU7eUP-Bo";

class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.token = null;
    this.user = null;
    this._listeners = [];
    this._init();
  }

  _headers(auth = true) {
    const h = { "apikey": this.key, "Content-Type": "application/json" };
    if (auth && this.token) h["Authorization"] = `Bearer ${this.token}`;
    else if (auth) h["Authorization"] = `Bearer ${this.key}`;
    return h;
  }

  _init() {
    try {
      const stored = localStorage.getItem("sb-session");
      if (stored) {
        const session = JSON.parse(stored);
        if (session?.access_token && session?.user) {
          this.token = session.access_token;
          this.user = session.user;
        }
      }
    } catch {}
  }

  _saveSession(session) {
    this.token = session.access_token;
    this.user = session.user;
    localStorage.setItem("sb-session", JSON.stringify(session));
    this._listeners.forEach(fn => fn(session.user));
  }

  _clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("sb-session");
    this._listeners.forEach(fn => fn(null));
  }

  onAuthChange(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(l => l !== fn); }; }

  async signUp(email, password, name) {
    const res = await fetch(`${this.url}/auth/v1/signup`, {
      method: "POST", headers: this._headers(false),
      body: JSON.stringify({ email, password, data: { name } })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.msg || "Signup failed");
    if (data.access_token) this._saveSession(data);
    return data;
  }

  async signIn(email, password) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: this._headers(false),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.msg || "Login failed");
    this._saveSession(data);
    return data;
  }

  async signOut() {
    try { await fetch(`${this.url}/auth/v1/logout`, { method: "POST", headers: this._headers() }); } catch {}
    this._clearSession();
  }

  async query(table, { select = "*", filter, order, limit, single } = {}) {
    let url = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (filter) url += `&${filter}`;
    if (order) url += `&order=${order}`;
    if (limit) url += `&limit=${limit}`;
    const h = this._headers();
    if (single) h["Accept"] = "application/vnd.pgrst.object+json";
    const res = await fetch(url, { headers: h });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    return res.json();
  }

  async insert(table, data, { returnData = true } = {}) {
    const h = this._headers();
    if (returnData) h["Prefer"] = "return=representation";
    const res = await fetch(`${this.url}/rest/v1/${table}`, { method: "POST", headers: h, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    return returnData ? res.json() : null;
  }

  async update(table, data, filter) {
    const h = this._headers();
    h["Prefer"] = "return=representation";
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, { method: "PATCH", headers: h, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    return res.json();
  }

  async remove(table, filter) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: this._headers() });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    return true;
  }

  async uploadFile(bucket, path, file) {
    const h = { "apikey": this.key };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    const formData = new FormData();
    formData.append("", file);
    const res = await fetch(`${this.url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST", headers: h, body: file
    });
    if (!res.ok) throw new Error("Upload failed");
    return `${this.url}/storage/v1/object/public/${bucket}/${path}`;
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// HELPERS
// ============================================================
const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// THE EMBRACE LOGO
function SpliceLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="22" fill="#1a2029"/>
      <path d="M38 22 C20 22, 20 50, 38 50 C20 50, 20 78, 38 78" stroke="#f4a261" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path d="M62 22 C80 22, 80 50, 62 50 C80 50, 80 78, 62 78" stroke="#e76f51" strokeWidth="7" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

const AVATAR_COLORS = ["#E8927C","#7CA8E8","#7CE8A6","#D47CE8","#E8D07C","#7CE8D0","#E87CA8","#A87CE8","#7CB8E8","#E8A87C","#8CE87C","#E87CD4","#7CE8E8","#C87CE8","#E8C87C"];
const getAvatarColor = (name) => { let h = 0; for (let i = 0; i < (name||"").length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; };

function Avatar({ name, url, size = 40 }) {
  const color = getAvatarColor(name || "?");
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function Splice() {
  const [user, setUser] = useState(supabase.user);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("feed");
  const [viewUserId, setViewUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = supabase.onAuthChange(u => { setUser(u); if (!u) { setProfile(null); setView("feed"); } });
    setLoading(false);
    return unsub;
  }, []);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const p = await supabase.query("profiles", { filter: `id=eq.${user.id}`, single: true });
      setProfile(p);
    } catch (e) {
      // Profile might not exist yet if trigger hasn't fired; create it
      try {
        const [p] = await supabase.insert("profiles", { id: user.id, name: user.user_metadata?.name || user.email, bio: "", location: "" });
        setProfile(p);
      } catch {}
    }
  };

  const navigateToUser = (userId) => { setViewUserId(userId); setView("user"); };

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen setUser={setUser} setError={setError} error={error} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f1419", color: "#e7e9ea", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700;9..40,800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      <Sidebar view={view} setView={setView} profile={profile} user={user} />

      <main style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
          {view === "feed" && <FeedView user={user} profile={profile} navigateToUser={navigateToUser} />}
          {view === "friends" && <FriendsView user={user} navigateToUser={navigateToUser} />}
          {view === "albums" && <AlbumsView user={user} />}
          {view === "profile" && <ProfileView userId={user.id} isOwn={true} currentUser={user} navigateToUser={navigateToUser} />}
          {view === "user" && viewUserId && <ProfileView userId={viewUserId} isOwn={viewUserId === user.id} currentUser={user} navigateToUser={navigateToUser} />}
        </div>
      </main>

      <RightSidebar user={user} navigateToUser={navigateToUser} />
    </div>
  );
}

// ============================================================
// LOADING
// ============================================================
function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1419", color: "#e7e9ea", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <SpliceLogo size={48}/>
        <div style={{ fontSize: 14, opacity: 0.6, marginTop: 12 }}>Loading Splice...</div>
      </div>
    </div>
  );
}

// ============================================================
// AUTH SCREEN
// ============================================================
function AuthScreen({ setUser, error, setError }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async () => {
    setError(null); setMsg(""); setBusy(true);
    try {
      if (mode === "signup") {
        const data = await supabase.signUp(email, password, name);
        if (!data.access_token) {
          setMsg("Check your email for a confirmation link, then come back and sign in.");
          setMode("login");
        }
      } else {
        await supabase.signIn(email, password);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1419", color: "#e7e9ea", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700;9..40,800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-block", marginBottom: 16 }}><SpliceLogo size={72}/></div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 800, color: "#f4a261", margin: 0 }}>Splice</h1>
          <p style={{ color: "#8899a6", fontSize: 15, marginTop: 8 }}>Your people. Your space.</p>
        </div>

        {msg && <div style={{ background: "rgba(122,199,132,0.15)", border: "1px solid rgba(122,199,132,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#7ac784" }}>{msg}</div>}
        {error && <div style={{ background: "rgba(231,111,81,0.15)", border: "1px solid rgba(231,111,81,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#e76f51" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {mode === "signup" && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />
        </div>

        <button onClick={handleSubmit} disabled={busy || !email || !password || (mode === "signup" && !name)} style={{
          width: "100%", padding: "14px", borderRadius: 12, background: (!email || !password) ? "#2f3640" : "linear-gradient(135deg, #f4a261, #e76f51)",
          border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (!email || !password) ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 12
        }}>{busy ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}</button>

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMsg(""); }} style={{
          width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #2f3640", background: "transparent", color: "#8899a6", fontSize: 14, cursor: "pointer", fontFamily: "inherit"
        }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
      </div>
    </div>
  );
}

const inputStyle = { padding: "14px 16px", borderRadius: 10, border: "1px solid #2f3640", background: "#161c23", color: "#e7e9ea", fontSize: 15, fontFamily: "inherit", outline: "none" };

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ view, setView, profile, user }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.query("friendships", { select: "id", filter: `friend_id=eq.${user.id}&status=eq.pending` })
      .then(d => setPendingCount(d.length)).catch(() => {});
    const interval = setInterval(() => {
      supabase.query("friendships", { select: "id", filter: `friend_id=eq.${user.id}&status=eq.pending` })
        .then(d => setPendingCount(d.length)).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <aside style={{ width: 260, background: "#161c23", borderRight: "1px solid #2f3640", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #2f3640" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SpliceLogo size={36}/>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "#f4a261" }}>Splice</span>
        </div>
      </div>

      <nav style={{ padding: "12px 10px", flex: 1 }}>
        {[
          { key: "feed", label: "News Feed", icon: "◉" },
          { key: "friends", label: "Friends", icon: "◎", badge: pendingCount },
          { key: "albums", label: "Photo Albums", icon: "❑" },
          { key: "profile", label: "My Profile", icon: "◐" },
        ].map(item => (
          <button key={item.key} onClick={() => setView(item.key)} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", marginBottom: 2, borderRadius: 10, border: "none",
            background: view === item.key ? "rgba(244,162,97,0.12)" : "transparent", color: view === item.key ? "#f4a261" : "#8899a6",
            cursor: "pointer", fontSize: 15, fontWeight: view === item.key ? 700 : 500, fontFamily: "inherit", textAlign: "left"
          }}>
            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{item.icon}</span>
            {item.label}
            {item.badge > 0 && <span style={{ marginLeft: "auto", background: "#e76f51", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{item.badge}</span>}
          </button>
        ))}
      </nav>

      <div style={{ padding: "16px 14px", borderTop: "1px solid #2f3640" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Avatar name={profile?.name || user?.email} url={profile?.avatar_url} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.name || user?.email}</div>
            <div style={{ fontSize: 12, color: "#8899a6" }}>{profile?.location || "Edit your profile"}</div>
          </div>
        </div>
        <button onClick={() => supabase.signOut()} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #2f3640", background: "transparent", color: "#8899a6", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
      </div>
    </aside>
  );
}

// ============================================================
// RIGHT SIDEBAR
// ============================================================
function RightSidebar({ user, navigateToUser }) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!user) return;
    supabase.query("profiles", { filter: `id=neq.${user.id}`, limit: 6, order: "created_at.desc" })
      .then(setPeople).catch(() => {});
  }, [user]);

  return (
    <aside style={{ width: 280, background: "#161c23", borderLeft: "1px solid #2f3640", padding: "24px 16px", overflow: "auto", flexShrink: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#8899a6", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>People on Splice</h3>
      {people.map(p => (
        <div key={p.id} onClick={() => navigateToUser(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer" }}>
          <Avatar name={p.name} url={p.avatar_url} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "#8899a6" }}>{p.location || "Splice member"}</div>
          </div>
        </div>
      ))}
    </aside>
  );
}

// ============================================================
// FEED VIEW
// ============================================================
function FeedView({ user, profile, navigateToUser }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const loadPosts = async () => {
    try {
      const data = await supabase.query("posts", {
        select: "*, profiles:user_id(id,name,avatar_url,location), post_likes(user_id), comments(id)",
        order: "created_at.desc", limit: 50
      });
      setPosts(data);
    } catch {}
  };

  useEffect(() => { loadPosts(); const i = setInterval(loadPosts, 10000); return () => clearInterval(i); }, []);

  const createPost = async () => {
    if (!newPost.trim() || posting) return;
    setPosting(true);
    try {
      await supabase.insert("posts", { user_id: user.id, text: newPost });
      setNewPost("");
      await loadPosts();
    } catch {}
    setPosting(false);
  };

  return (
    <>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, marginBottom: 24, color: "#f4a261" }}>News Feed</h2>
      <div style={{ background: "#161c23", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid #2f3640" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Avatar name={profile?.name || user?.email} url={profile?.avatar_url} size={40} />
          <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="What's on your mind?" rows={3}
            style={{ flex: 1, background: "#0f1419", border: "1px solid #2f3640", borderRadius: 12, padding: "12px 16px", color: "#e7e9ea", fontSize: 15, fontFamily: "inherit", resize: "none", outline: "none" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={createPost} disabled={!newPost.trim() || posting} style={{
            padding: "10px 24px", borderRadius: 10, background: newPost.trim() ? "linear-gradient(135deg, #f4a261, #e76f51)" : "#2f3640",
            border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: newPost.trim() ? "pointer" : "not-allowed", fontFamily: "inherit"
          }}>{posting ? "Posting..." : "Post"}</button>
        </div>
      </div>
      {posts.length === 0 && <div style={{ textAlign: "center", color: "#556677", padding: "40px 0" }}>No posts yet. Be the first!</div>}
      {posts.map(post => <PostCard key={post.id} post={post} user={user} navigateToUser={navigateToUser} onUpdate={loadPosts} />)}
    </>
  );
}

// ============================================================
// POST CARD
// ============================================================
function PostCard({ post, user, navigateToUser, onUpdate }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const author = post.profiles;
  const likeCount = post.post_likes?.length || 0;
  const commentCount = post.comments?.length || 0;
  const liked = post.post_likes?.some(l => l.user_id === user.id);

  const toggleLike = async () => {
    try {
      if (liked) await supabase.remove("post_likes", `post_id=eq.${post.id}&user_id=eq.${user.id}`);
      else await supabase.insert("post_likes", { post_id: post.id, user_id: user.id }, { returnData: false });
      onUpdate();
    } catch {}
  };

  const loadComments = async () => {
    try {
      const data = await supabase.query("comments", { select: "*, profiles:user_id(id,name,avatar_url)", filter: `post_id=eq.${post.id}`, order: "created_at.asc" });
      setComments(data);
    } catch {}
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await supabase.insert("comments", { post_id: post.id, user_id: user.id, text: commentText });
      setCommentText("");
      loadComments();
      onUpdate();
    } catch {}
  };

  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  return (
    <div style={{ background: "#161c23", borderRadius: 16, marginBottom: 16, border: "1px solid #2f3640", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 0" }}>
        <div style={{ cursor: "pointer" }} onClick={() => navigateToUser(author?.id)}>
          <Avatar name={author?.name} url={author?.avatar_url} size={42} />
        </div>
        <div>
          <div onClick={() => navigateToUser(author?.id)} style={{ fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{author?.name || "Unknown"}</div>
          <div style={{ fontSize: 12, color: "#8899a6" }}>{timeAgo(post.created_at)}{author?.location ? ` · ${author.location}` : ""}</div>
        </div>
      </div>
      <div style={{ padding: "14px 20px", fontSize: 15, lineHeight: 1.55, color: "#d1d5db", whiteSpace: "pre-wrap" }}>{post.text}</div>
      <div style={{ padding: "0 20px 10px", display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8899a6" }}>
        <span>{likeCount > 0 ? `${likeCount} like${likeCount > 1 ? "s" : ""}` : ""}</span>
        <span style={{ cursor: "pointer" }} onClick={() => setShowComments(!showComments)}>{commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? "s" : ""}` : ""}</span>
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #2f3640" }}>
        <button onClick={toggleLike} style={{ flex: 1, padding: 12, border: "none", background: "transparent", color: liked ? "#f4a261" : "#8899a6", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{liked ? "♥ Liked" : "♡ Like"}</button>
        <button onClick={() => setShowComments(!showComments)} style={{ flex: 1, padding: 12, border: "none", borderLeft: "1px solid #2f3640", background: "transparent", color: "#8899a6", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>💬 Comment</button>
      </div>
      {showComments && (
        <div style={{ borderTop: "1px solid #2f3640", padding: "12px 20px" }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar name={c.profiles?.name} url={c.profiles?.avatar_url} size={30} />
              <div style={{ background: "#0f1419", borderRadius: 12, padding: "10px 14px", flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.profiles?.name}</div>
                <div style={{ fontSize: 14, color: "#d1d5db" }}>{c.text}</div>
                <div style={{ fontSize: 11, color: "#556677", marginTop: 4 }}>{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addComment(); }}
              placeholder="Write a comment..." style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "1px solid #2f3640", background: "#0f1419", color: "#e7e9ea", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FRIENDS VIEW
// ============================================================
function FriendsView({ user, navigateToUser }) {
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());

  const loadAll = async () => {
    try {
      // Accepted friendships where I'm either side
      const [sent, received] = await Promise.all([
        supabase.query("friendships", { select: "*, profiles:friend_id(id,name,avatar_url,location,bio)", filter: `user_id=eq.${user.id}&status=eq.accepted` }),
        supabase.query("friendships", { select: "*, profiles:user_id(id,name,avatar_url,location,bio)", filter: `friend_id=eq.${user.id}&status=eq.accepted` })
      ]);
      setFriends([...sent.map(f => f.profiles), ...received.map(f => f.profiles)]);

      // Pending requests to me
      const pending = await supabase.query("friendships", { select: "*, profiles:user_id(id,name,avatar_url,location)", filter: `friend_id=eq.${user.id}&status=eq.pending` });
      setRequests(pending);

      // Discover
      const all = await supabase.query("profiles", { filter: `id=neq.${user.id}`, limit: 20 });
      const friendIds = new Set([...sent.map(f => f.friend_id), ...received.map(f => f.user_id)]);
      const pendingIds = new Set(pending.map(p => p.user_id));
      setDiscover(all.filter(p => !friendIds.has(p.id) && !pendingIds.has(p.id)));

      // Track what I've already sent
      const mySent = await supabase.query("friendships", { select: "friend_id", filter: `user_id=eq.${user.id}&status=eq.pending` });
      setSentIds(new Set(mySent.map(s => s.friend_id)));
    } catch {}
  };

  useEffect(() => { loadAll(); }, []);

  const sendRequest = async (toId) => {
    try {
      await supabase.insert("friendships", { user_id: user.id, friend_id: toId, status: "pending" }, { returnData: false });
      setSentIds(s => new Set([...s, toId]));
    } catch {}
  };

  const acceptRequest = async (friendshipId) => {
    try { await supabase.update("friendships", { status: "accepted" }, `id=eq.${friendshipId}`); loadAll(); } catch {}
  };

  const declineRequest = async (friendshipId) => {
    try { await supabase.remove("friendships", `id=eq.${friendshipId}`); loadAll(); } catch {}
  };

  return (
    <>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, marginBottom: 20, color: "#f4a261" }}>Friends</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[{ key: "friends", label: `My Friends (${friends.length})` }, { key: "requests", label: `Requests (${requests.length})` }, { key: "discover", label: "Discover" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "10px 18px", borderRadius: 10, border: "none", background: tab === t.key ? "rgba(244,162,97,0.15)" : "transparent",
            color: tab === t.key ? "#f4a261" : "#8899a6", fontSize: 14, fontWeight: tab === t.key ? 700 : 500, cursor: "pointer", fontFamily: "inherit"
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "friends" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {friends.map(f => (
            <div key={f.id} onClick={() => navigateToUser(f.id)} style={{ background: "#161c23", borderRadius: 14, padding: 20, border: "1px solid #2f3640", cursor: "pointer", textAlign: "center" }}>
              <Avatar name={f.name} url={f.avatar_url} size={56} />
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 12 }}>{f.name}</div>
              <div style={{ fontSize: 13, color: "#8899a6", marginTop: 2 }}>{f.location}</div>
            </div>
          ))}
          {friends.length === 0 && <div style={{ gridColumn: "1/3", textAlign: "center", color: "#556677", padding: 32 }}>No friends yet. Check Discover!</div>}
        </div>
      )}

      {tab === "requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161c23", borderRadius: 14, padding: "16px 20px", border: "1px solid #2f3640" }}>
              <Avatar name={r.profiles?.name} url={r.profiles?.avatar_url} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.profiles?.name}</div>
                <div style={{ fontSize: 13, color: "#8899a6" }}>{r.profiles?.location}</div>
              </div>
              <button onClick={() => acceptRequest(r.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f4a261, #e76f51)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept</button>
              <button onClick={() => declineRequest(r.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2f3640", background: "transparent", color: "#8899a6", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Decline</button>
            </div>
          ))}
          {requests.length === 0 && <div style={{ textAlign: "center", color: "#556677", padding: 32 }}>No pending requests.</div>}
        </div>
      )}

      {tab === "discover" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {discover.map(p => (
            <div key={p.id} style={{ background: "#161c23", borderRadius: 14, padding: 20, border: "1px solid #2f3640", textAlign: "center" }}>
              <div style={{ cursor: "pointer" }} onClick={() => navigateToUser(p.id)}><Avatar name={p.name} url={p.avatar_url} size={56} /></div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 12 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "#8899a6", marginTop: 2 }}>{p.location || "Splice member"}</div>
              {!sentIds.has(p.id) ? (
                <button onClick={() => sendRequest(p.id)} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f4a261, #e76f51)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add Friend</button>
              ) : (
                <div style={{ marginTop: 12, fontSize: 13, color: "#8899a6" }}>Request sent</div>
              )}
            </div>
          ))}
          {discover.length === 0 && <div style={{ gridColumn: "1/3", textAlign: "center", color: "#556677", padding: 32 }}>No one new to discover right now.</div>}
        </div>
      )}
    </>
  );
}

// ============================================================
// ALBUMS VIEW
// ============================================================
function AlbumsView({ user }) {
  const [albums, setAlbums] = useState([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    supabase.query("albums", { select: "*, album_photos(id)", filter: `user_id=eq.${user.id}`, order: "created_at.desc" })
      .then(setAlbums).catch(() => {});
  }, []);

  const createAlbum = async () => {
    if (!newName.trim()) return;
    try {
      await supabase.insert("albums", { user_id: user.id, name: newName });
      setNewName("");
      const data = await supabase.query("albums", { select: "*, album_photos(id)", filter: `user_id=eq.${user.id}`, order: "created_at.desc" });
      setAlbums(data);
    } catch {}
  };

  return (
    <>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, marginBottom: 24, color: "#f4a261" }}>Photo Albums</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") createAlbum(); }}
          placeholder="New album name..." style={{ flex: 1, ...inputStyle }} />
        <button onClick={createAlbum} style={{
          padding: "14px 24px", borderRadius: 12, border: "none", background: newName.trim() ? "linear-gradient(135deg, #f4a261, #e76f51)" : "#2f3640",
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: newName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit"
        }}>Create</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {albums.map(album => (
          <div key={album.id} style={{ background: "#161c23", borderRadius: 14, border: "1px solid #2f3640", overflow: "hidden" }}>
            <div style={{ height: 140, background: `linear-gradient(135deg, ${getAvatarColor(album.name)}, ${getAvatarColor(album.name+"x")})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "rgba(255,255,255,0.3)" }}>❑</div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{album.name}</div>
              <div style={{ fontSize: 13, color: "#8899a6", marginTop: 2 }}>{album.album_photos?.length || 0} photos · {new Date(album.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
      {albums.length === 0 && <div style={{ textAlign: "center", color: "#556677", padding: "40px 0" }}><div style={{ fontSize: 40, marginBottom: 8 }}>❑</div>No albums yet. Create one above!</div>}
    </>
  );
}

// ============================================================
// PROFILE VIEW
// ============================================================
function ProfileView({ userId, isOwn, currentUser, navigateToUser }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");

  const load = async () => {
    try {
      const p = await supabase.query("profiles", { filter: `id=eq.${userId}`, single: true });
      setProfile(p);
      setEditName(p.name); setEditBio(p.bio || ""); setEditLocation(p.location || "");
      const ps = await supabase.query("posts", { select: "*, profiles:user_id(id,name,avatar_url,location), post_likes(user_id), comments(id)", filter: `user_id=eq.${userId}`, order: "created_at.desc" });
      setPosts(ps);
      const [s, r] = await Promise.all([
        supabase.query("friendships", { select: "id", filter: `user_id=eq.${userId}&status=eq.accepted` }),
        supabase.query("friendships", { select: "id", filter: `friend_id=eq.${userId}&status=eq.accepted` })
      ]);
      setFriendCount(s.length + r.length);
    } catch {}
  };

  useEffect(() => { load(); }, [userId]);

  const saveProfile = async () => {
    try {
      await supabase.update("profiles", { name: editName, bio: editBio, location: editLocation }, `id=eq.${userId}`);
      setEditing(false);
      load();
    } catch {}
  };

  if (!profile) return <div style={{ color: "#556677", padding: 40, textAlign: "center" }}>Loading profile...</div>;

  return (
    <>
      <div style={{ height: 180, borderRadius: 16, marginBottom: -50, background: `linear-gradient(135deg, ${profile.cover_color || "#2d3748"}, #4a5568)`, position: "relative" }} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "0 20px", marginBottom: 20, position: "relative", zIndex: 2 }}>
        <div style={{ borderRadius: "50%", border: "4px solid #0f1419" }}><Avatar name={profile.name} url={profile.avatar_url} size={96} /></div>
        <div style={{ flex: 1, paddingBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>{profile.name}</h2>
          <div style={{ color: "#8899a6", fontSize: 14, marginTop: 2 }}>{profile.location || ""}</div>
        </div>
        {isOwn && <button onClick={() => setEditing(!editing)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #f4a261", background: "transparent", color: "#f4a261", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{editing ? "Cancel" : "Edit Profile"}</button>}
      </div>

      {editing && (
        <div style={{ background: "#161c23", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #2f3640", display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" style={inputStyle} />
          <input value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Bio" style={inputStyle} />
          <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Location" style={inputStyle} />
          <button onClick={saveProfile} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #f4a261, #e76f51)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>Save Changes</button>
        </div>
      )}

      {profile.bio && !editing && (
        <div style={{ background: "#161c23", borderRadius: 14, padding: "16px 20px", marginBottom: 20, border: "1px solid #2f3640" }}>
          <div style={{ fontSize: 15, color: "#d1d5db", lineHeight: 1.5 }}>{profile.bio}</div>
          <div style={{ fontSize: 13, color: "#8899a6", marginTop: 8 }}>{friendCount} friends · {posts.length} posts</div>
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#8899a6", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Posts</h3>
      {posts.length === 0 && <div style={{ textAlign: "center", color: "#556677", padding: 32 }}>No posts yet.</div>}
      {posts.map(post => <PostCard key={post.id} post={post} user={currentUser} navigateToUser={navigateToUser} onUpdate={load} />)}
    </>
  );
}
