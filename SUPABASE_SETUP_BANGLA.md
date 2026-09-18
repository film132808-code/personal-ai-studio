# Supabase থেকে কোন কোন Key লাগবে - সহজ গাইড

### Supabase Dashboard এ যাও:
1. তোমার প্রজেক্ট `personal-ai-studio` ওপেন আছে
2. বাম পাশে একদম নিচে ⚙️ **Project Settings** (Gear Icon) এ ক্লিক করো
3. তারপর **API** বা **Data API** তে ক্লিক করো (নতুন UI তে Data API নামে আছে)

### এখানে ৩ টা জিনিস লাগবে:

#### 1. Project URL
- উপরে **Project URL** লেখা থাকবে
- দেখতে এমন: `https://tweswxbxpqvjfsunofdf.supabase.co`
- এটা কপি করো

#### 2. anon public key
- নিচে **Project API keys** সেকশনে যাও
- **anon public** নামে একটা লম্বা Key থাকবে (eyJhbGciOiJIUzI1NiIs...)
- এটার পাশে 👁️ Reveal বা Copy আইকনে ক্লিক করে কপি করো
- **এটা Public - ব্রাউজারে যাবে, সমস্যা নেই**

#### 3. service_role key (SECRET!)
- একই জায়গায় **service_role** নামে আরেকটা Key থাকবে
- এটাও eyJ দিয়ে শুরু, কিন্তু অনেক বেশি পাওয়ারফুল
- **এটা কখনোই ব্রাউজারে যাবে না, শুধু সার্ভারে থাকবে**
- এটার পাশে Reveal করে কপি করো
- **সাবধান: এটা কাউকে দিও না!**

### 4. ENCRYPTION_KEY (আমি বানিয়ে দেব)
- তোমার API Key গুলো এনক্রিপ্ট করে রাখার জন্য একটা 32 অক্ষরের Secret লাগবে
- তুমি চাইলে আমি বানিয়ে দেব, বা তুমি এই কমান্ড রান করতে পারো:
  ```
  openssl rand -base64 32
  ```
- আমি নিচে একটা রেডিমেড বানিয়ে দিচ্ছি

---

### আমাকে এই ফরম্যাটে দাও:

```
URL: https://tweswxbxpqvjfsunofdf.supabase.co
ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

আমি সাথে সাথে তোমার প্রজেক্টে `.env.local` ফাইল বানিয়ে দেব এবং Supabase কানেক্ট করে দেব।

### এরপর কি হবে?
1. আমি .env.local বানাবো
2. Supabase Auth চালু করবো (Email/Password)
3. তোমার SQL Migration টা চেক করবো
4. Real Chat + Model Discovery চালু করবো
