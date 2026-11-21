# Life Hub setup (all free)
1. `npm install` then `npm run dev`. With no keys it runs local-only on this device.
2. For sync: create a free Supabase project, run `supabase/schema.sql` in its SQL Editor, copy `.env.example` to `.env`
   and paste the project URL and anon key. In Auth > Providers keep email on; turn off public sign-ups once your account exists.
3. Push the folder to GitHub, import it in Vercel (or Cloudflare Pages), add the same two variables, deploy.
4. On a phone open the site and choose "Add to Home Screen". The existing NZ Explorer map is at `/map.html`, unchanged.
