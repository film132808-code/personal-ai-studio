# Personal AI Studio - Complete Setup Guide (বাংলায়)

## ✅ যা যা হয়ে গেছে

1. **Premium UI** - ChatGPT/Gemini style, Dark/Light, Responsive
2. **Supabase Connected** - তোমার URL: https://tweswxbypqvjyfsunofd.supabase.co
3. **Auth System** - Email/Password Login
4. **BYOK System** - API Key Encryption (AES-256-GCM) + RLS
5. **Real APIs**:
   - `/api/providers/validate` - Key validate + save
   - `/api/models` - Model discovery (OpenRouter, Gemini, Groq)
   - `/api/chat` - Streaming chat (SSE)
6. **Build Success** - Netlify ready

---

## 🔧 এখন তোমাকে যা করতে হবে (5 মিনিট)

### ধাপ ১: SQL Migration রান করো (সবচেয়ে জরুরি)
1. Supabase Dashboard → **SQL Editor** → **New Query**
2. প্রজেক্টে `supabase-migration.sql` ফাইলটা ওপেন করো, সব কপি করো
3. SQL Editor এ Paste করে **Run** ক্লিক করো
4. Success হলে Done!

> যদি पहले Run করে থাকো, তাহলে আবার Run করলে সমস্যা নেই (IF NOT EXISTS আছে)

### ধাপ ২: Storage Buckets চেক করো
তুমি ইতিমধ্যে 3 টা বানিয়েছো:
- `avatars` ✅
- `attachments` ✅
- `project-files` ✅
- `New Bucket` ❌ এটা ডিলিট করো (Settings → Delete Bucket)

### ধাপ ৩: Login করো
1. Preview তে `/login` এ যাও (অটো redirect হবে)
2. **Sign Up** করো - তোমার ইমেইল + পাসওয়ার্ড দাও
3. Supabase Auth এ Confirmation OFF থাকলে সরাসরি Login হবে
4. যদি Confirmation লাগে, Supabase Dashboard → Authentication → Providers → Email → Confirm email OFF করে দাও

### ধাপ ৪: API Keys যোগ করো
1. Login করার পর Settings (⚙️) এ ক্লিক করো
2. **OpenRouter** Key যোগ করো:
   - যাও: https://openrouter.ai/keys
   - Free account বানাও, Key কপি করো (`sk-or-v1-...`)
   - এখানে Paste করে Validate ক্লিক করো
3. একইভাবে Gemini / Groq যোগ করতে পারো (Optional)

### ধাপ ৫: Chat শুরু করো!
- Model Selector এ এখন Real Models দেখাবে (OpenRouter থেকে 100+)
- Free models ফিল্টার করো: `google/gemini-2.0-flash-exp:free` বা `llama-3.3-70b:free`
- মেসেজ লিখে Send করো - Real Streaming আসবে!

---

## 🚀 Netlify Deployment

### 1. GitHub এ Push করো
```bash
cd personal-ai-studio
git init
git add .
git commit -m "Personal AI Studio - Initial"
# GitHub এ নতুন repo বানাও, তারপর:
git remote add origin https://github.com/YOUR_USERNAME/personal-ai-studio.git
git push -u origin main
```

### 2. Netlify এ Connect করো
1. https://app.netlify.com → Add new site → Import an existing project
2. GitHub select করো, `personal-ai-studio` repo select করো
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. **Environment Variables** এ যোগ করো:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tweswxbypqvjyfsunofd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=তোমার anon key
   SUPABASE_SERVICE_ROLE_KEY=তোমার service_role key
   ENCRYPTION_KEY=py5I6dWe/0QmlBZlGqqp10Bng6ooS6SEjbwdWNhCGYE=
   ```
5. Deploy!

### 3. Supabase Redirect URL Set করো
1. Supabase Dashboard → Authentication → URL Configuration
2. Site URL: `https://YOUR_SITE.netlify.app`
3. Redirect URLs এ যোগ করো:
   ```
   https://YOUR_SITE.netlify.app/auth/callback
   http://localhost:3000/auth/callback
   ```

---

## 🔐 Security Notes
- `service_role` key কখনো GitHub এ push করবে না (`.env.local` .gitignore এ আছে)
- Netlify তে Environment Variable হিসেবে দেবে
- তোমার API Keys (OpenRouter etc) Supabase এ Encrypted হয়ে থাকে
- RLS এর জন্য এক User অন্য User এর Data দেখতে পারবে না

---

## 📁 Project Structure
```
src/
  app/
    api/
      chat/ - Streaming chat
      models/ - Model discovery
      providers/validate/ - Key validation
    auth/callback/ - Auth callback
    login/ - Login page
    page.tsx - Main app (auth protected)
  components/
    ChatApp.tsx - Premium UI
  lib/
    supabase/ - Client, Server, Middleware
    providers/ - OpenRouter, Gemini, Groq adapters
    security/ - Encryption
supabase-migration.sql - DB schema + RLS
netlify.toml - Netlify config
```

---

## 🐛 Common Issues

**1. Bucket Delete হচ্ছে না?**
- Bucket এর ভিতরে ফাইল থাকলে আগে ফাইল ডিলিট করো, তারপর Bucket ডিলিট

**2. Login এর পর আবার Login পেজে যাচ্ছে?**
- Browser Cookie clear করো, বা Incognito তে try করো
- Supabase Dashboard → Authentication → Users এ User আছে কিনা চেক করো

**3. Model Discovery হচ্ছে না?**
- Settings এ Provider Connected দেখাচ্ছে কিনা চেক করো
- OpenRouter Key ঠিক আছে কিনা https://openrouter.ai/keys এ গিয়ে চেক করো

**4. Chat Error?**
- Provider Connected আছে কিনা
- Model টা Free কিনা, বা তোমার OpenRouter এ Credit আছে কিনা

---

## 🎯 Next Steps (Phase 2)
- Coding Mode: Monaco Editor + File Tree
- Agent Mode: Tools (calculator, web search) + Verification
- Image Mode: DALL-E / Flux via OpenRouter
- Video Mode: Sora / Veo
- Projects: Chat + Files grouping

এখন Preview তে গিয়ে `/login` এ Sign Up করো এবং API Key যোগ করো!
